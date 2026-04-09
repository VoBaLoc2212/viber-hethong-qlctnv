"use client";

import { useMemo, useState } from "react";

import {
  apiBudgetStatus,
  apiConfigureHardStop,
  apiCreateBudget,
  apiDeleteBudget,
  apiGetBudgetHistory,
  apiListBudgets,
  apiListTransactionReferenceData,
  apiListTransactions,
  apiTransferBudget,
  apiUpdateBudget,
} from "@/lib/api";
import { apiRequest } from "@/lib/api/client";
import type { AuthUser, BudgetHistoryItem, BudgetItem, BudgetStatus, TransactionReferenceDepartment, TransactionItem } from "@/lib/api";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatVnd } from "@/lib/ui-labels";

const DEFAULT_WARNING = 80;

type BudgetingWorkspaceProps = {
  token: string | null;
  currentUser: AuthUser | null;
};

type DepartmentSummaryRow = {
  departmentId: string;
  code: string;
  name: string;
  totalBudget: number;
  spent: number;
};

type DepartmentWithBudgetAllocated = {
  id: string;
  code: string;
  name: string;
  budgetAllocated: number;
};

function generateIdempotencyKey(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function formatHistoryTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function getHistoryAmount(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const amountRaw = (payload as { amount?: unknown }).amount;
  if (typeof amountRaw !== "string" && typeof amountRaw !== "number") return null;
  const amountNumber = Number(amountRaw);
  if (!Number.isFinite(amountNumber)) return null;
  return formatVnd(amountNumber);
}

function buildDepartmentSummaryRows(
  departments: DepartmentWithBudgetAllocated[],
  transactions: TransactionItem[],
): DepartmentSummaryRow[] {
  const spentByDept = new Map<string, number>();

  for (const tx of transactions) {
    if (!tx.departmentId || tx.type !== "EXPENSE" || tx.status !== "EXECUTED") {
      continue;
    }
    const current = spentByDept.get(tx.departmentId) ?? 0;
    spentByDept.set(tx.departmentId, current + Number(tx.amount));
  }

  return departments.map((department) => ({
    departmentId: department.id,
    code: department.code,
    name: department.name,
    totalBudget: department.budgetAllocated,
    spent: spentByDept.get(department.id) ?? 0,
  }));
}

export function BudgetingWorkspace({ token, currentUser }: BudgetingWorkspaceProps) {
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [statusByBudget, setStatusByBudget] = useState<Record<string, BudgetStatus>>({});
  const [departments, setDepartments] = useState<TransactionReferenceDepartment[]>([]);
  const [budgetSearch, setBudgetSearch] = useState("");
  const [transferSearch, setTransferSearch] = useState("");
  const [sourceBudgetId, setSourceBudgetId] = useState("");
  const [activeTab, setActiveTab] = useState<"list" | "transfer">("list");
  const [budgetHistory, setBudgetHistory] = useState<BudgetHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [departmentSummary, setDepartmentSummary] = useState<DepartmentSummaryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [createForm, setCreateForm] = useState({
    departmentId: "",
    period: "",
    amount: "",
    parentBudgetId: "",
  });

  const [updateForm, setUpdateForm] = useState({
    amount: "",
    parentBudgetId: "",
  });

  const [transferForm, setTransferForm] = useState({
    toBudgetId: "",
    amount: "",
    reason: "",
  });

  const [policyForm, setPolicyForm] = useState({
    budgetId: "",
    enabled: true,
    warningThresholdPct: DEFAULT_WARNING,
  });

  const selectedStatus = useMemo(() => {
    if (!sourceBudgetId) return null;
    return statusByBudget[sourceBudgetId] ?? null;
  }, [sourceBudgetId, statusByBudget]);

  const role = currentUser?.role;
  const canMutateBudget = role === "FINANCE_ADMIN";
  const canTransferBudget = role === "FINANCE_ADMIN" || role === "MANAGER";

  async function refreshBudgets() {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const [payload, referenceData, departmentPayload, transactionPayload] = await Promise.all([
        apiListBudgets(token),
        apiListTransactionReferenceData(token),
        apiRequest<{ departments: DepartmentWithBudgetAllocated[] }>("/api/departments", { token }),
        apiListTransactions(token, { page: 1, limit: 1000 }),
      ]);
      setBudgets(payload.budgets);
      setDepartments(referenceData.departments);
      setDepartmentSummary(buildDepartmentSummaryRows(departmentPayload.departments, transactionPayload.data));

      const statuses = await Promise.all(payload.budgets.map((budget) => apiBudgetStatus(token, budget.id)));

      setStatusByBudget(
        statuses.reduce<Record<string, BudgetStatus>>((accumulator, status) => {
          accumulator[status.budgetId] = status;
          return accumulator;
        }, {}),
      );
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Không tải được dữ liệu ngân sách";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateBudget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setError(null);

    try {
      await apiCreateBudget(token, {
        departmentId: createForm.departmentId,
        period: createForm.period,
        amount: createForm.amount,
        parentBudgetId: createForm.parentBudgetId || null,
      });

      setCreateForm({ departmentId: "", period: "", amount: "", parentBudgetId: "" });
      await refreshBudgets();
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Tạo ngân sách thất bại";
      setError(message);
    }
  }

  async function handleUpdateBudget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !sourceBudgetId) return;

    setError(null);

    try {
      await apiUpdateBudget(token, sourceBudgetId, {
        amount: updateForm.amount,
        parentBudgetId: updateForm.parentBudgetId || null,
      });

      setUpdateForm({ amount: "", parentBudgetId: "" });
      await refreshBudgets();
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Cập nhật ngân sách thất bại";
      setError(message);
    }
  }

  async function handleTransferBudget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !sourceBudgetId) return;

    setError(null);

    try {
      await apiTransferBudget(
        token,
        sourceBudgetId,
        {
          toBudgetId: transferForm.toBudgetId,
          amount: transferForm.amount,
          reason: transferForm.reason,
        },
        generateIdempotencyKey("budget-transfer"),
      );

      setTransferForm({ toBudgetId: "", amount: "", reason: "" });
      await refreshBudgets();
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Chuyển ngân sách thất bại";
      setError(message);
    }
  }

  async function handleConfigurePolicy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setError(null);

    try {
      await apiConfigureHardStop(token, {
        budgetId: policyForm.budgetId || null,
        enabled: policyForm.enabled,
        warningThresholdPct: policyForm.warningThresholdPct,
      });
      await refreshBudgets();
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Cấu hình chính sách thất bại";
      setError(message);
    }
  }

  async function handleLoadBudgetHistory(budgetId: string) {
    if (!token) return;

    setHistoryLoading(true);

    try {
      const payload = await apiGetBudgetHistory(token, budgetId);
      setBudgetHistory(payload.history);
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Không tải được lịch sử ngân sách";
      setError(message);
      setBudgetHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleDeleteBudget() {
    if (!token || !sourceBudgetId) return;

    const confirmed = window.confirm("Bạn chắc chắn muốn xóa ngân sách nguồn đã chọn?");
    if (!confirmed) return;

    setError(null);

    try {
      await apiDeleteBudget(token, sourceBudgetId);
      setSourceBudgetId("");
      setBudgetHistory([]);
      setUpdateForm({ amount: "", parentBudgetId: "" });
      setTransferForm({ toBudgetId: "", amount: "", reason: "" });
      await refreshBudgets();
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Xóa ngân sách thất bại";
      setError(message);
    }
  }

  const budgetByDepartmentId = useMemo(() => {
    return departments.reduce<Record<string, TransactionReferenceDepartment>>((accumulator, department) => {
      accumulator[department.id] = department;
      return accumulator;
    }, {});
  }, [departments]);

  const filteredDepartmentSummary = useMemo(() => {
    const keyword = budgetSearch.trim().toLowerCase();
    if (!keyword) return departmentSummary;

    return departmentSummary.filter((row) => {
      return (
        row.name.toLowerCase().includes(keyword) ||
        row.code.toLowerCase().includes(keyword) ||
        row.departmentId.toLowerCase().includes(keyword)
      );
    });
  }, [budgetSearch, departmentSummary]);

  const sourceBudgetOptions = useMemo(() => budgets, [budgets]);

  const transferOptions = useMemo(() => {
    const keyword = transferSearch.trim().toLowerCase();
    return budgets.filter((budget) => {
      if (budget.id === sourceBudgetId) return false;
      if (!keyword) return true;
      const department = budgetByDepartmentId[budget.departmentId];
      return (
        budget.id.toLowerCase().includes(keyword) ||
        budget.period.toLowerCase().includes(keyword) ||
        department?.name.toLowerCase().includes(keyword) ||
        department?.code.toLowerCase().includes(keyword)
      );
    });
  }, [transferSearch, budgets, budgetByDepartmentId, sourceBudgetId]);

  const isHardStop = selectedStatus?.hardStopEnabled && selectedStatus.available === "0.00";
  const hasTransferOptions = transferOptions.length > 0;

  return (
    <section className="space-y-6">
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Ngân sách của tôi</CardTitle>
          <CardDescription>Tạo, cập nhật, chuyển ngân sách, xem lịch sử thay đổi và cấu hình chính sách chặn cứng.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!token ? (
            <Alert>
              <AlertDescription>Vui lòng đăng nhập để thao tác ngân sách.</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={refreshBudgets} disabled={!token || loading}>
              {loading ? "Đang tải..." : "Tải dữ liệu ngân sách"}
            </Button>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {canMutateBudget ? (
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Tạo ngân sách</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCreateBudget}>
              <div className="space-y-2">
                <Label htmlFor="create-department-id">Phòng ban</Label>
                <select
                  id="create-department-id"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={createForm.departmentId}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, departmentId: event.target.value }))}
                  required
                  disabled={!token}
                >
                  <option value="">Chọn phòng ban</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name} ({department.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-period">Kỳ ngân sách</Label>
                <Input
                  id="create-period"
                  value={createForm.period}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, period: event.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-amount">Số tiền</Label>
                <Input
                  id="create-amount"
                  value={createForm.amount}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, amount: event.target.value }))}
                  placeholder="100000000.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-parent-budget-id">Ngân sách cha (tùy chọn)</Label>
                <select
                  id="create-parent-budget-id"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={createForm.parentBudgetId}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, parentBudgetId: event.target.value }))}
                  disabled={!token}
                >
                  <option value="">Không chọn</option>
                  {budgets.map((budget) => {
                    const department = budgetByDepartmentId[budget.departmentId];
                    return (
                      <option key={budget.id} value={budget.id}>
                        {(department?.name ?? budget.departmentId)} • {budget.period} • {budget.id.slice(0, 8)}
                      </option>
                    );
                  })}
                </select>
              </div>

              <Button type="submit" disabled={!token}>
                Tạo ngân sách
              </Button>
            </form>
          </CardContent>
        </Card>
        ) : null}

        {canMutateBudget ? (
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Chính sách kiểm soát ngân sách</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleConfigurePolicy}>
              <div className="space-y-2">
                <Label htmlFor="policy-budget-id">Ngân sách áp dụng (trống = toàn cục)</Label>
                <select
                  id="policy-budget-id"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={policyForm.budgetId}
                  onChange={(event) => setPolicyForm((prev) => ({ ...prev, budgetId: event.target.value }))}
                  disabled={!token}
                >
                  <option value="">Toàn cục</option>
                  {budgets.map((budget) => {
                    const department = budgetByDepartmentId[budget.departmentId];
                    return (
                      <option key={budget.id} value={budget.id}>
                        {(department?.name ?? budget.departmentId)} • {budget.period} • {budget.id.slice(0, 8)}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="policy-enabled"
                  checked={policyForm.enabled}
                  onCheckedChange={(checked) =>
                    setPolicyForm((prev) => ({
                      ...prev,
                      enabled: checked === true,
                    }))
                  }
                />
                <Label htmlFor="policy-enabled">Bật chặn cứng</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="policy-warning-threshold">Ngưỡng cảnh báo (%)</Label>
                <Input
                  id="policy-warning-threshold"
                  type="number"
                  min={1}
                  max={100}
                  value={policyForm.warningThresholdPct}
                  onChange={(event) =>
                    setPolicyForm((prev) => ({
                      ...prev,
                      warningThresholdPct: Number(event.target.value || DEFAULT_WARNING),
                    }))
                  }
                />
              </div>

              <Button type="submit" disabled={!token}>
                Lưu chính sách
              </Button>
            </form>
          </CardContent>
        </Card>
        ) : null}
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>Tổng hợp ngân sách phòng ban</CardTitle>
          <CardDescription>Đồng bộ theo cùng nguồn dữ liệu với màn "Ngân sách" (Department.budgetAllocated + chi từ giao dịch EXPENSE ở trạng thái EXECUTED).</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phòng ban</TableHead>
                <TableHead className="text-right">Tổng ngân sách</TableHead>
                <TableHead className="text-right">Đã chi</TableHead>
                <TableHead className="text-right">Còn lại</TableHead>
                <TableHead className="text-right">Tỷ lệ dùng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departmentSummary.map((row) => {
                const remaining = row.totalBudget - row.spent;
                const ratio = row.totalBudget > 0 ? (row.spent / row.totalBudget) * 100 : 0;
                return (
                  <TableRow key={row.departmentId}>
                    <TableCell>{row.name} ({row.code})</TableCell>
                    <TableCell className="text-right">{formatVnd(row.totalBudget)}</TableCell>
                    <TableCell className="text-right">{formatVnd(row.spent)}</TableCell>
                    <TableCell className="text-right">{formatVnd(remaining)}</TableCell>
                    <TableCell className="text-right">{ratio.toFixed(1)}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "list" | "transfer")}>
        <TabsList>
          <TabsTrigger value="list">Danh sách ngân sách</TabsTrigger>
          <TabsTrigger value="transfer">Chi tiết & chuyển</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle>Danh sách ngân sách</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                value={budgetSearch}
                onChange={(event) => setBudgetSearch(event.target.value)}
                placeholder="Tìm theo phòng ban / mã phòng ban / ID phòng ban"
              />

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Phòng ban</TableHead>
                    <TableHead className="text-right">Tổng ngân sách</TableHead>
                    <TableHead className="text-right">Đã chi</TableHead>
                    <TableHead className="text-right">Còn lại</TableHead>
                    <TableHead className="text-right">Tỷ lệ dùng</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDepartmentSummary.map((row) => {
                    const remaining = row.totalBudget - row.spent;
                    const ratio = row.totalBudget > 0 ? (row.spent / row.totalBudget) * 100 : 0;

                    return (
                      <TableRow key={row.departmentId}>
                        <TableCell>{row.name} ({row.code})</TableCell>
                        <TableCell className="text-right">{formatVnd(row.totalBudget)}</TableCell>
                        <TableCell className="text-right">{formatVnd(row.spent)}</TableCell>
                        <TableCell className="text-right">{formatVnd(remaining)}</TableCell>
                        <TableCell className="text-right">{ratio.toFixed(1)}%</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transfer" className="mt-4">
          <div className="space-y-6">
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle>Chọn ngân sách nguồn</CardTitle>
                <CardDescription>Chọn ngân sách nguồn để xem lịch sử, cập nhật, xóa hoặc chuyển ngân sách.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="source-budget-id">Ngân sách nguồn</Label>
                  <select
                    id="source-budget-id"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={sourceBudgetId}
                    onChange={(event) => {
                      const nextBudgetId = event.target.value;
                      setSourceBudgetId(nextBudgetId);
                      setTransferForm((prev) => ({ ...prev, toBudgetId: "" }));
                      setBudgetHistory([]);
                    }}
                    disabled={!token}
                  >
                    <option value="">Chọn ngân sách nguồn</option>
                    {sourceBudgetOptions.map((budget) => {
                      const department = budgetByDepartmentId[budget.departmentId];
                      return (
                        <option key={budget.id} value={budget.id}>
                          {(department?.name ?? budget.departmentId)} • {budget.period} • {budget.id.slice(0, 8)}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleLoadBudgetHistory(sourceBudgetId)}
                    disabled={!token || !sourceBudgetId || historyLoading}
                  >
                    {historyLoading ? "Đang tải lịch sử..." : "Tải lịch sử ngân sách nguồn"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {sourceBudgetId ? (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                {canMutateBudget ? (
                  <Card className="border-border/50 shadow-sm">
                    <CardHeader>
                      <CardTitle>Cập nhật ngân sách: {sourceBudgetId}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form className="space-y-4" onSubmit={handleUpdateBudget}>
                        <div className="space-y-2">
                          <Label htmlFor="update-amount">Số tiền mới</Label>
                          <Input
                            id="update-amount"
                            value={updateForm.amount}
                            onChange={(event) => setUpdateForm((prev) => ({ ...prev, amount: event.target.value }))}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="update-parent-budget-id">ID ngân sách cha</Label>
                          <Input
                            id="update-parent-budget-id"
                            value={updateForm.parentBudgetId}
                            onChange={(event) => setUpdateForm((prev) => ({ ...prev, parentBudgetId: event.target.value }))}
                          />
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button type="submit" disabled={!token}>
                            Cập nhật
                          </Button>
                          <Button type="button" variant="destructive" disabled={!token} onClick={() => void handleDeleteBudget()}>
                            Xóa ngân sách
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                ) : null}

                {canTransferBudget ? (
                  <Card className="border-border/50 shadow-sm">
                    <CardHeader>
                      <CardTitle>Chuyển ngân sách</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form className="space-y-4" onSubmit={handleTransferBudget}>
                        <div className="space-y-2">
                          <Label htmlFor="transfer-search">Tìm kiếm ngân sách nhận</Label>
                          <Input
                            id="transfer-search"
                            value={transferSearch}
                            onChange={(event) => setTransferSearch(event.target.value)}
                            placeholder="Tìm theo phòng ban / kỳ / mã ngân sách"
                            disabled={!token || Boolean(isHardStop)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="transfer-to-budget-id">ID ngân sách nhận</Label>
                          <select
                            id="transfer-to-budget-id"
                            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                            value={transferForm.toBudgetId}
                            onChange={(event) => setTransferForm((prev) => ({ ...prev, toBudgetId: event.target.value }))}
                            required
                            disabled={!token || Boolean(isHardStop) || !hasTransferOptions}
                          >
                            <option value="">{hasTransferOptions ? "Chọn ngân sách nhận" : "Không có ngân sách nhận phù hợp"}</option>
                            {transferOptions.map((budget) => {
                              const department = budgetByDepartmentId[budget.departmentId];
                              return (
                                <option key={budget.id} value={budget.id}>
                                  {(department?.name ?? budget.departmentId)} • {budget.period} • {budget.id.slice(0, 8)}
                                </option>
                              );
                            })}
                          </select>
                          {!hasTransferOptions ? (
                            <p className="text-xs text-muted-foreground">Không có ngân sách nhận do đang lọc quá hẹp hoặc chỉ còn ngân sách nguồn.</p>
                          ) : null}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="transfer-amount">Số tiền</Label>
                          <Input
                            id="transfer-amount"
                            value={transferForm.amount}
                            onChange={(event) => setTransferForm((prev) => ({ ...prev, amount: event.target.value }))}
                            required
                            disabled={!token || Boolean(isHardStop)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="transfer-reason">Lý do</Label>
                          <Input
                            id="transfer-reason"
                            value={transferForm.reason}
                            onChange={(event) => setTransferForm((prev) => ({ ...prev, reason: event.target.value }))}
                            disabled={!token || Boolean(isHardStop)}
                          />
                        </div>

                        {selectedStatus?.warning ? (
                          <Alert>
                            <AlertDescription>
                              Ngân sách đã sử dụng {selectedStatus.percentageUsed}% ({">="} {selectedStatus.warningThresholdPct}%).
                            </AlertDescription>
                          </Alert>
                        ) : null}

                        {isHardStop ? (
                          <Alert variant="destructive">
                            <AlertDescription>Đang chặn cứng: số dư khả dụng = 0.00, hệ thống khóa thao tác chi/chuyển ra.</AlertDescription>
                          </Alert>
                        ) : null}

                        <Button type="submit" disabled={!token || Boolean(isHardStop) || !hasTransferOptions}>
                          Chuyển ngân sách
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                ) : null}

                <Card className="border-border/50 shadow-sm">
                  <CardHeader>
                    <CardTitle>Lịch sử thay đổi</CardTitle>
                    <CardDescription>{historyLoading ? "Đang tải lịch sử..." : `${budgetHistory.length} bản ghi gần nhất`}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {budgetHistory.length ? (
                      <div className="space-y-2">
                        {budgetHistory.slice(0, 10).map((item) => (
                          <div key={item.id} className="rounded-md border border-border/50 p-3 text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">{item.action}</span>
                              <span className="text-xs text-muted-foreground">{formatHistoryTime(item.createdAt)}</span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span>{item.entityType}</span>
                              <span>•</span>
                              <span>{item.entityId.slice(0, 8)}</span>
                              {item.direction ? (
                                <>
                                  <span>•</span>
                                  <span>{item.direction === "IN" ? "Luồng vào" : "Luồng ra"}</span>
                                </>
                              ) : null}
                              {getHistoryAmount(item.payload) ? (
                                <>
                                  <span>•</span>
                                  <span>Số tiền {getHistoryAmount(item.payload)}</span>
                                </>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Chưa có lịch sử cho ngân sách nguồn đã chọn.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="border-border/50 shadow-sm">
                <CardContent className="pt-6 text-sm text-muted-foreground">
                  Vui lòng chọn một ngân sách nguồn trước khi cập nhật, chuyển hoặc xóa.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}

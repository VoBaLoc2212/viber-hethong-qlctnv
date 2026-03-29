"use client";

import { useMemo, useState } from "react";

import {
  apiBudgetStatus,
  apiConfigureHardStop,
  apiCreateBudget,
  apiListBudgets,
  apiTransferBudget,
  apiUpdateBudget,
} from "@/lib/api";
import type { AuthUser, BudgetItem, BudgetStatus } from "@/lib/api";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const DEFAULT_WARNING = 80;

type BudgetingWorkspaceProps = {
  token: string | null;
  currentUser: AuthUser | null;
};

function generateIdempotencyKey(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function BudgetingWorkspace({ token, currentUser }: BudgetingWorkspaceProps) {
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [statusByBudget, setStatusByBudget] = useState<Record<string, BudgetStatus>>({});
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>("");
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
    if (!selectedBudgetId) return null;
    return statusByBudget[selectedBudgetId] ?? null;
  }, [selectedBudgetId, statusByBudget]);

  const role = currentUser?.role;
  const canMutateBudget = role === "FINANCE_ADMIN";
  const canTransferBudget = role === "FINANCE_ADMIN" || role === "MANAGER";

  async function refreshBudgets() {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const payload = await apiListBudgets(token);
      setBudgets(payload.budgets);

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
    if (!token || !selectedBudgetId) return;

    setError(null);

    try {
      await apiUpdateBudget(token, selectedBudgetId, {
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
    if (!token || !selectedBudgetId) return;

    setError(null);

    try {
      await apiTransferBudget(
        token,
        selectedBudgetId,
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

  const isHardStop = selectedStatus?.hardStopEnabled && selectedStatus.available === "0.00";

  return (
    <section className="space-y-6">
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Điều phối & kiểm soát ngân sách</CardTitle>
          <CardDescription>Tạo, cập nhật, chuyển ngân sách và cấu hình chính sách chặn cứng.</CardDescription>
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
                <Label htmlFor="create-department-id">ID phòng ban</Label>
                <Input
                  id="create-department-id"
                  value={createForm.departmentId}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, departmentId: event.target.value }))}
                  required
                />
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
                <Label htmlFor="create-parent-budget-id">ID ngân sách cha (tùy chọn)</Label>
                <Input
                  id="create-parent-budget-id"
                  value={createForm.parentBudgetId}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, parentBudgetId: event.target.value }))}
                />
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
                <Label htmlFor="policy-budget-id">ID ngân sách (trống = toàn cục)</Label>
                <Input
                  id="policy-budget-id"
                  value={policyForm.budgetId}
                  onChange={(event) => setPolicyForm((prev) => ({ ...prev, budgetId: event.target.value }))}
                />
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
          <CardTitle>Danh sách ngân sách</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Phòng ban</TableHead>
                <TableHead>Kỳ</TableHead>
                <TableHead>Số tiền</TableHead>
                <TableHead>Đã giữ chỗ</TableHead>
                <TableHead>Đã dùng</TableHead>
                <TableHead>Còn khả dụng</TableHead>
                <TableHead>Tỷ lệ dùng %</TableHead>
                <TableHead>Cảnh báo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {budgets.map((budget) => {
                const status = statusByBudget[budget.id];
                const isSelected = selectedBudgetId === budget.id;

                return (
                  <TableRow
                    key={budget.id}
                    data-state={isSelected ? "selected" : undefined}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedBudgetId(budget.id);
                      setUpdateForm({ amount: budget.amount, parentBudgetId: budget.parentBudgetId ?? "" });
                    }}
                  >
                    <TableCell>{budget.id}</TableCell>
                    <TableCell>{budget.departmentId}</TableCell>
                    <TableCell>{budget.period}</TableCell>
                    <TableCell>{budget.amount}</TableCell>
                    <TableCell>{budget.reserved}</TableCell>
                    <TableCell>{budget.used}</TableCell>
                    <TableCell>{budget.available}</TableCell>
                    <TableCell>{status ? `${status.percentageUsed}%` : "-"}</TableCell>
                    <TableCell>
                      {status?.warning ? (
                        <Badge variant="outline" className="border-yellow-500/50 text-yellow-700 dark:text-yellow-300">
                          Cảnh báo
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedBudgetId ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {canMutateBudget ? (
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle>Cập nhật ngân sách: {selectedBudgetId}</CardTitle>
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

                <Button type="submit" disabled={!token}>
                  Cập nhật
                </Button>
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
                  <Label htmlFor="transfer-to-budget-id">ID ngân sách nhận</Label>
                  <Input
                    id="transfer-to-budget-id"
                    value={transferForm.toBudgetId}
                    onChange={(event) => setTransferForm((prev) => ({ ...prev, toBudgetId: event.target.value }))}
                    required
                    disabled={!token || Boolean(isHardStop)}
                  />
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

                <Button type="submit" disabled={!token || Boolean(isHardStop)}>
                  Chuyển ngân sách
                </Button>
              </form>
            </CardContent>
          </Card>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

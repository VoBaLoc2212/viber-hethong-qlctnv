"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";

import {
  apiCreateRecurringTemplate,
  apiCreateTransaction,
  apiListCashbook,
  apiListRecurringTemplates,
  apiListTransactionReferenceData,
  apiListTransactions,
  apiReconcileCashbook,
  apiRunRecurringTemplates,
  apiUploadTransactionAttachment,
} from "@/lib/api";
import type {
  CashbookAccountItem,
  CashbookPostingItem,
  RecurringTemplateItem,
  TransactionItem,
  TransactionReferenceBudget,
  TransactionReferenceDepartment,
  UploadedTransactionAttachment,
} from "@/lib/api";

import { useAuthSession } from "@/components/auth-session-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { UserRole } from "@/modules/shared/contracts/domain";

type TxType = "INCOME" | "EXPENSE";
type Frequency = "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUALLY";

const TX_TYPE_LABEL: Record<TxType, string> = {
  INCOME: "Thu",
  EXPENSE: "Chi",
};

const TX_STATUS_LABEL: Record<TransactionItem["status"], string> = {
  DRAFT: "Nháp",
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  EXECUTED: "Đã thực thi",
  REJECTED: "Từ chối",
  REVERSED: "Đảo chiều",
};

const FREQUENCY_LABEL: Record<Frequency, string> = {
  DAILY: "Hàng ngày",
  WEEKLY: "Hàng tuần",
  MONTHLY: "Hàng tháng",
  QUARTERLY: "Hàng quý",
  ANNUALLY: "Hàng năm",
};

const DIRECTION_LABEL: Record<"IN" | "OUT", string> = {
  IN: "Tiền vào",
  OUT: "Tiền ra",
};

const ROLE_LABEL: Record<UserRole, string> = {
  EMPLOYEE: "Nhân viên",
  MANAGER: "Quản lý",
  ACCOUNTANT: "Kế toán",
  FINANCE_ADMIN: "Tài chính tổng",
  AUDITOR: "Kiểm toán",
};

const RECURRING_READ_ROLES: UserRole[] = ["MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"];
const RECURRING_MANAGE_ROLES: UserRole[] = ["ACCOUNTANT", "FINANCE_ADMIN"];
const CASHBOOK_READ_ROLES: UserRole[] = ["ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"];
const CASHBOOK_RECONCILE_ROLES: UserRole[] = ["ACCOUNTANT", "FINANCE_ADMIN"];
const CREATE_TRANSACTION_ROLES: UserRole[] = ["EMPLOYEE", "MANAGER", "ACCOUNTANT", "FINANCE_ADMIN"];

type TransactionStatusFilter = "ALL" | TransactionItem["status"];

function getLocalDateTimeInputValue(date = new Date()) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function parseMoney(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function statusBadgeClass(status: TransactionItem["status"]) {
  switch (status) {
    case "EXECUTED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "APPROVED":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "PENDING":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "REJECTED":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "REVERSED":
      return "bg-purple-50 text-purple-700 border-purple-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

function txTypeBadgeClass(type: TxType) {
  return type === "INCOME"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-orange-50 text-orange-700 border-orange-200";
}

function formatMoney(value: string) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return value;
  return numberValue.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value < 0) return "-";

  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDepartmentOption(department: TransactionReferenceDepartment) {
  return `${department.code} - ${department.name}`;
}

function formatBudgetOption(budget: TransactionReferenceBudget) {
  return `${budget.period} | ${budget.departmentCode} | Còn ${formatMoney(budget.available)}`;
}

function makeIdempotencyKey(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export default function TransactionsPage() {
  const { token, currentUser } = useAuthSession();
  const role = currentUser?.role ?? null;

  const canCreateTransaction = role ? CREATE_TRANSACTION_ROLES.includes(role) : false;
  const canReadRecurring = role ? RECURRING_READ_ROLES.includes(role) : false;
  const canManageRecurring = role ? RECURRING_MANAGE_ROLES.includes(role) : false;
  const canReadCashbook = role ? CASHBOOK_READ_ROLES.includes(role) : false;
  const canReconcileCashbook = role ? CASHBOOK_RECONCILE_ROLES.includes(role) : false;

  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [recurringTemplates, setRecurringTemplates] = useState<RecurringTemplateItem[]>([]);
  const [accounts, setAccounts] = useState<CashbookAccountItem[]>([]);
  const [postings, setPostings] = useState<CashbookPostingItem[]>([]);
  const [referenceDepartments, setReferenceDepartments] = useState<TransactionReferenceDepartment[]>([]);
  const [referenceBudgets, setReferenceBudgets] = useState<TransactionReferenceBudget[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sectionWarnings, setSectionWarnings] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("list");

  const [txForm, setTxForm] = useState({
    type: "EXPENSE" as TxType,
    amount: "",
    budgetId: "",
    departmentId: "",
    date: getLocalDateTimeInputValue(),
    description: "",
  });
  const [splits, setSplits] = useState<Array<{ amount: string; categoryCode: string; note: string }>>([]);
  const [attachments, setAttachments] = useState<UploadedTransactionAttachment[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);

  const [recurringForm, setRecurringForm] = useState({
    name: "",
    type: "EXPENSE" as TxType,
    amount: "",
    frequency: "MONTHLY" as Frequency,
    nextRunAt: getLocalDateTimeInputValue(),
    budgetId: "",
    departmentId: "",
  });

  const [reconcileForm, setReconcileForm] = useState({
    accountId: "",
    actualBalance: "",
    reason: "",
  });
  const [txSearch, setTxSearch] = useState("");
  const [txFilterType, setTxFilterType] = useState<"ALL" | TxType>("ALL");
  const [txFilterStatus, setTxFilterStatus] = useState<TransactionStatusFilter>("ALL");

  const totalSplitAmount = useMemo(() => {
    return splits.reduce((sum, line) => sum + Number(line.amount || "0"), 0);
  }, [splits]);
  const txAmountNumber = Number(txForm.amount);
  const splitMismatch =
    splits.length > 0 && txForm.amount.trim().length > 0 && Number.isFinite(txAmountNumber) && Math.abs(totalSplitAmount - txAmountNumber) > 0.0001;

  const summary = useMemo(() => {
    const totals = transactions.reduce(
      (acc, tx) => {
        if (tx.type === "INCOME") {
          acc.income += parseMoney(tx.amount);
        } else {
          acc.expense += parseMoney(tx.amount);
        }

        if (tx.status === "PENDING") acc.pending += 1;
        if (tx.status === "EXECUTED") acc.executed += 1;

        return acc;
      },
      { income: 0, expense: 0, pending: 0, executed: 0 },
    );

    const totalCashbookBalance = accounts.reduce((sum, account) => sum + parseMoney(account.balance), 0);

    return {
      ...totals,
      total: transactions.length,
      net: totals.income - totals.expense,
      totalCashbookBalance,
    };
  }, [transactions, accounts]);

  const selectedAccount = useMemo(() => {
    return accounts.find((account) => account.id === selectedAccountId) ?? null;
  }, [accounts, selectedAccountId]);

  const txBudgetOptions = useMemo(() => {
    if (!txForm.departmentId) return [];
    return referenceBudgets.filter((budget) => budget.departmentId === txForm.departmentId);
  }, [referenceBudgets, txForm.departmentId]);

  const recurringBudgetOptions = useMemo(() => {
    if (!recurringForm.departmentId) return [];
    return referenceBudgets.filter((budget) => budget.departmentId === recurringForm.departmentId);
  }, [referenceBudgets, recurringForm.departmentId]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchType = txFilterType === "ALL" || tx.type === txFilterType;
      const matchStatus = txFilterStatus === "ALL" || tx.status === txFilterStatus;
      const keyword = txSearch.trim().toLowerCase();
      const matchKeyword =
        !keyword ||
        tx.transactionCode.toLowerCase().includes(keyword) ||
        (tx.description ?? "").toLowerCase().includes(keyword) ||
        TX_STATUS_LABEL[tx.status].toLowerCase().includes(keyword);
      return matchType && matchStatus && matchKeyword;
    });
  }, [transactions, txFilterType, txFilterStatus, txSearch]);

  async function reloadData(currentToken: string) {
    setLoading(true);
    setError(null);
    setSectionWarnings([]);

    try {
      const [txResult, recurringResult, cashbookResult, referenceDataResult] = await Promise.allSettled([
        apiListTransactions(currentToken, { page: 1, limit: 20 }),
        canReadRecurring ? apiListRecurringTemplates(currentToken, { page: 1, limit: 20 }) : Promise.resolve({ templates: [] }),
        canReadCashbook ? apiListCashbook(currentToken, { page: 1, limit: 30 }) : Promise.resolve({ accounts: [], postings: [] }),
        apiListTransactionReferenceData(currentToken),
      ]);

      if (txResult.status === "rejected") {
        throw txResult.reason;
      }

      setTransactions(txResult.value.data);

      const warnings: string[] = [];

      if (!canReadRecurring) {
        setRecurringTemplates([]);
      } else if (recurringResult.status === "fulfilled") {
        setRecurringTemplates(recurringResult.value.templates);
      } else {
        setRecurringTemplates([]);
        warnings.push("Không tải được dữ liệu giao dịch định kỳ.");
      }

      if (!canReadCashbook) {
        setAccounts([]);
        setPostings([]);
        setSelectedAccountId("");
        setReconcileForm((prev) => ({ ...prev, accountId: "" }));
      } else if (cashbookResult.status === "fulfilled") {
        setAccounts(cashbookResult.value.accounts);
        setPostings(cashbookResult.value.postings);

        const firstAccount = cashbookResult.value.accounts[0] ?? null;
        const stillExists = cashbookResult.value.accounts.some((item) => item.id === selectedAccountId);

        if (!stillExists && firstAccount) {
          setSelectedAccountId(firstAccount.id);
          setReconcileForm((prev) => ({ ...prev, accountId: firstAccount.id }));
        }

        if (!firstAccount) {
          setSelectedAccountId("");
          setReconcileForm((prev) => ({ ...prev, accountId: "" }));
        }
      } else {
        setAccounts([]);
        setPostings([]);
        warnings.push("Không tải được dữ liệu sổ quỹ.");
      }

      if (referenceDataResult.status === "fulfilled") {
        setReferenceDepartments(referenceDataResult.value.departments);
        setReferenceBudgets(referenceDataResult.value.budgets);
      } else {
        setReferenceDepartments([]);
        setReferenceBudgets([]);
        warnings.push("Không tải được danh mục phòng ban/ngân sách cho biểu mẫu.");
      }

      setSectionWarnings(warnings);
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Không tải được dữ liệu transaction";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    void reloadData(token);
  }, [token, role]);

  useEffect(() => {
    if (activeTab === "create" && !canCreateTransaction) {
      setActiveTab("list");
      return;
    }

    if (activeTab === "recurring" && !canReadRecurring) {
      setActiveTab("list");
      return;
    }

    if (activeTab === "cashbook" && !canReadCashbook) {
      setActiveTab("list");
    }
  }, [activeTab, canCreateTransaction, canReadRecurring, canReadCashbook]);

  function handleTxDepartmentChange(departmentId: string) {
    setTxForm((prev) => {
      const keepBudget = prev.budgetId
        ? referenceBudgets.some((budget) => budget.id === prev.budgetId && budget.departmentId === departmentId)
        : false;

      return {
        ...prev,
        departmentId,
        budgetId: keepBudget ? prev.budgetId : "",
      };
    });
  }

  function handleTxBudgetChange(budgetId: string) {
    setTxForm((prev) => {
      const selectedBudget = referenceBudgets.find((budget) => budget.id === budgetId) ?? null;
      return {
        ...prev,
        budgetId,
        departmentId: selectedBudget ? selectedBudget.departmentId : prev.departmentId,
      };
    });
  }

  function handleRecurringDepartmentChange(departmentId: string) {
    setRecurringForm((prev) => {
      const keepBudget = prev.budgetId
        ? referenceBudgets.some((budget) => budget.id === prev.budgetId && budget.departmentId === departmentId)
        : false;

      return {
        ...prev,
        departmentId,
        budgetId: keepBudget ? prev.budgetId : "",
      };
    });
  }

  function handleRecurringBudgetChange(budgetId: string) {
    setRecurringForm((prev) => {
      const selectedBudget = referenceBudgets.find((budget) => budget.id === budgetId) ?? null;
      return {
        ...prev,
        budgetId,
        departmentId: selectedBudget ? selectedBudget.departmentId : prev.departmentId,
      };
    });
  }

  async function handleCreateTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !canCreateTransaction) return;

    setError(null);
    setSuccess(null);

    if (!Number.isFinite(txAmountNumber) || txAmountNumber <= 0) {
      setError("Số tiền giao dịch phải lớn hơn 0.");
      return;
    }

    if (txForm.type === "EXPENSE" && !txForm.departmentId.trim()) {
      setError("Phiếu Chi cần chọn phòng ban.");
      return;
    }

    if (txForm.type === "EXPENSE" && !txForm.budgetId.trim()) {
      setError("Phiếu Chi cần chọn ngân sách.");
      return;
    }

    if (splitMismatch) {
      setError("Tổng các dòng chia tách phải bằng tổng số tiền giao dịch.");
      return;
    }

    try {
      await apiCreateTransaction(token, {
        type: txForm.type,
        amount: txAmountNumber.toFixed(2),
        budgetId: txForm.budgetId || null,
        departmentId: txForm.departmentId || null,
        date: txForm.date || undefined,
        description: txForm.description || null,
        splits: splits.length
          ? splits.map((line) => ({
              amount: line.amount,
              categoryCode: line.categoryCode || null,
              note: line.note || null,
            }))
          : undefined,
        attachments: attachments.length
          ? attachments.map((item) => ({
              fileName: item.fileName,
              fileUrl: item.fileUrl,
              fileSize: item.fileSize,
              mimeType: item.mimeType,
            }))
          : undefined,
      });

      setTxForm({
        type: "EXPENSE",
        amount: "",
        budgetId: "",
        departmentId: "",
        date: getLocalDateTimeInputValue(),
        description: "",
      });
      setSplits([]);
      setAttachments([]);
      setSuccess("Đã tạo phiếu giao dịch thành công.");
      setActiveTab("list");
      await reloadData(token);
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Tạo transaction thất bại";
      setError(message);
    }
  }

  async function handleAttachmentUpload(event: ChangeEvent<HTMLInputElement>) {
    if (!token || !canCreateTransaction) return;

    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    setError(null);
    setSuccess(null);
    setUploadingAttachments(true);

    try {
      const uploaded = await Promise.all(files.map((file) => apiUploadTransactionAttachment(token, file)));
      setAttachments((prev) => [...prev, ...uploaded]);
      setSuccess(`Đã tải lên ${uploaded.length} file hóa đơn.`);
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Tải lên file hóa đơn thất bại";
      setError(message);
    } finally {
      setUploadingAttachments(false);
      event.target.value = "";
    }
  }

  async function handleCreateRecurring(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !canManageRecurring) return;

    setError(null);
    setSuccess(null);

    const recurringAmount = Number(recurringForm.amount);
    if (!Number.isFinite(recurringAmount) || recurringAmount <= 0) {
      setError("Số tiền mẫu định kỳ phải lớn hơn 0.");
      return;
    }

    if (recurringForm.type === "EXPENSE" && !recurringForm.departmentId.trim()) {
      setError("Mẫu Chi định kỳ cần chọn phòng ban.");
      return;
    }

    if (recurringForm.type === "EXPENSE" && !recurringForm.budgetId.trim()) {
      setError("Mẫu Chi định kỳ cần chọn ngân sách.");
      return;
    }

    try {
      await apiCreateRecurringTemplate(token, {
        name: recurringForm.name,
        type: recurringForm.type,
        amount: recurringForm.amount,
        frequency: recurringForm.frequency,
        nextRunAt: recurringForm.nextRunAt,
        budgetId: recurringForm.budgetId || null,
        departmentId: recurringForm.departmentId || null,
      });

      setRecurringForm({
        name: "",
        type: "EXPENSE",
        amount: "",
        frequency: "MONTHLY",
        nextRunAt: getLocalDateTimeInputValue(),
        budgetId: "",
        departmentId: "",
      });
      setSuccess("Đã tạo mẫu giao dịch định kỳ.");
      await reloadData(token);
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Tạo recurring thất bại";
      setError(message);
    }
  }

  async function handleRunRecurring() {
    if (!token || !canManageRecurring) return;

    setError(null);
    setSuccess(null);

    try {
      const result = await apiRunRecurringTemplates(token);
      setSuccess(`Đã quét ${result.scanned} mẫu, tạo ${result.created} phiếu giao dịch.`);
      await reloadData(token);
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Chạy recurring thất bại";
      setError(message);
    }
  }

  async function handleReconcile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !canReconcileCashbook) return;

    setError(null);
    setSuccess(null);

    try {
      await apiReconcileCashbook(
        token,
        {
          accountId: reconcileForm.accountId,
          actualBalance: reconcileForm.actualBalance,
          reason: reconcileForm.reason,
        },
        makeIdempotencyKey("cashbook-reconcile"),
      );

      setReconcileForm({ accountId: selectedAccountId, actualBalance: "", reason: "" });
      setSuccess("Đối soát thành công.");
      await reloadData(token);
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Đối soát thất bại";
      setError(message);
    }
  }

  const visiblePostings = selectedAccountId ? postings.filter((item) => item.accountId === selectedAccountId) : postings;

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Giao dịch & Quỹ tiền mặt</h1>
          <p className="mt-1 text-muted-foreground">
            Không gian làm việc theo user story: tạo phiếu, theo dõi tiến độ, quản lý recurring và đối soát quỹ.
          </p>
          {role ? (
            <div className="mt-2">
              <Badge variant="outline" className="border-border bg-muted/50">Vai trò hiện tại: {ROLE_LABEL[role]}</Badge>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {canCreateTransaction ? (
            <Button type="button" onClick={() => setActiveTab("create")}>Tạo phiếu mới</Button>
          ) : null}
          <Button type="button" variant="outline" disabled={!token || loading} onClick={() => token && void reloadData(token)}>
            {loading ? "Đang làm mới..." : "Làm mới dữ liệu"}
          </Button>
        </div>
      </div>

      {!token ? (
        <Alert>
          <AlertDescription>Vui lòng đăng nhập để sử dụng module Giao dịch/Quỹ tiền mặt.</AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {success ? (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      ) : null}

      {sectionWarnings.length > 0 ? (
        <Alert>
          <AlertDescription>{sectionWarnings.join(" ")}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Tổng giao dịch</CardDescription>
            <CardTitle className="text-2xl">{summary.total}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{summary.pending} phiếu đang chờ duyệt</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Dòng tiền thu/chi</CardDescription>
            <CardTitle className="text-2xl">{formatMoney(summary.net.toFixed(2))}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs text-muted-foreground">
            <p>Thu: {formatMoney(summary.income.toFixed(2))}</p>
            <p>Chi: {formatMoney(summary.expense.toFixed(2))}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Đã thực thi</CardDescription>
            <CardTitle className="text-2xl">{summary.executed}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Sẵn sàng đối chiếu với ledger/cashbook</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Tổng số dư quỹ</CardDescription>
            <CardTitle className="text-2xl">{canReadCashbook ? formatMoney(summary.totalCashbookBalance.toFixed(2)) : "-"}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{canReadCashbook ? `${accounts.length} tài khoản quỹ` : "Không có quyền xem sổ quỹ"}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList className="h-auto min-w-full justify-start gap-1 rounded-xl p-1">
            {canCreateTransaction ? <TabsTrigger value="create">1. Tạo phiếu</TabsTrigger> : null}
            <TabsTrigger value="list">2. Theo dõi giao dịch</TabsTrigger>
            {canReadRecurring ? <TabsTrigger value="recurring">3. Recurring</TabsTrigger> : null}
            {canReadCashbook ? <TabsTrigger value="cashbook">4. Cashbook & Đối soát</TabsTrigger> : null}
          </TabsList>
        </div>

        <TabsContent value="create">
          {canCreateTransaction ? (
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle>Tạo Thu/Chi</CardTitle>
                <CardDescription>
                  Luồng cho {role === "EMPLOYEE" ? "nhân viên" : "người lập phiếu"}: nhập thông tin chính, chia tách hạng mục và tải hóa đơn.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-5" onSubmit={handleCreateTransaction}>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="tx-type">Loại phiếu</Label>
                      <select
                        id="tx-type"
                        className="h-10 w-full rounded-md border bg-background px-3"
                        value={txForm.type}
                        onChange={(event) => setTxForm((prev) => ({ ...prev, type: event.target.value as TxType }))}
                      >
                        <option value="EXPENSE">Phiếu Chi</option>
                        <option value="INCOME">Phiếu Thu</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tx-amount">Số tiền</Label>
                      <Input
                        id="tx-amount"
                        placeholder="Ví dụ: 5000000"
                        value={txForm.amount}
                        onChange={(event) => setTxForm((prev) => ({ ...prev, amount: event.target.value }))}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tx-date">Ngày giao dịch</Label>
                      <Input
                        id="tx-date"
                        type="datetime-local"
                        value={txForm.date}
                        onChange={(event) => setTxForm((prev) => ({ ...prev, date: event.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tx-department">Phòng ban {txForm.type === "EXPENSE" ? "*" : "(không bắt buộc)"}</Label>
                      <select
                        id="tx-department"
                        className="h-10 w-full rounded-md border bg-background px-3"
                        value={txForm.departmentId}
                        onChange={(event) => handleTxDepartmentChange(event.target.value)}
                      >
                        <option value="">{referenceDepartments.length > 0 ? "Chọn phòng ban" : "Chưa có dữ liệu phòng ban"}</option>
                        {referenceDepartments.map((department) => (
                          <option key={department.id} value={department.id}>
                            {formatDepartmentOption(department)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tx-budget">Ngân sách {txForm.type === "EXPENSE" ? "*" : "(không bắt buộc)"}</Label>
                      <select
                        id="tx-budget"
                        className="h-10 w-full rounded-md border bg-background px-3"
                        value={txForm.budgetId}
                        onChange={(event) => handleTxBudgetChange(event.target.value)}
                        disabled={!txForm.departmentId}
                      >
                        <option value="">
                          {!txForm.departmentId
                            ? "Chọn phòng ban trước"
                            : txBudgetOptions.length > 0
                              ? "Chọn ngân sách"
                              : "Không có ngân sách cho phòng ban này"}
                        </option>
                        {txBudgetOptions.map((budget) => (
                          <option key={budget.id} value={budget.id}>
                            {formatBudgetOption(budget)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2 lg:col-span-3">
                      <Label htmlFor="tx-description">Diễn giải</Label>
                      <Input
                        id="tx-description"
                        placeholder="Mô tả nội dung giao dịch"
                        value={txForm.description}
                        onChange={(event) => setTxForm((prev) => ({ ...prev, description: event.target.value }))}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2 rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Label>Chia tách hạng mục</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSplits((prev) => [...prev, { amount: "", categoryCode: "", note: "" }])}
                      >
                        + Thêm dòng
                      </Button>
                    </div>

                    {splits.map((line, idx) => (
                      <div key={`split-${idx}`} className="grid grid-cols-1 gap-2 lg:grid-cols-4">
                        <Input
                          placeholder="Số tiền"
                          value={line.amount}
                          onChange={(event) =>
                            setSplits((prev) => prev.map((row, i) => (i === idx ? { ...row, amount: event.target.value } : row)))
                          }
                        />
                        <Input
                          placeholder="Mã hạng mục"
                          value={line.categoryCode}
                          onChange={(event) =>
                            setSplits((prev) => prev.map((row, i) => (i === idx ? { ...row, categoryCode: event.target.value } : row)))
                          }
                        />
                        <Input
                          placeholder="Ghi chú"
                          value={line.note}
                          onChange={(event) =>
                            setSplits((prev) => prev.map((row, i) => (i === idx ? { ...row, note: event.target.value } : row)))
                          }
                        />
                        <Button type="button" variant="ghost" onClick={() => setSplits((prev) => prev.filter((_, i) => i !== idx))}>
                          Xóa
                        </Button>
                      </div>
                    ))}

                    {splits.length > 0 ? (
                      <p className={`text-xs ${splitMismatch ? "text-destructive" : "text-muted-foreground"}`}>
                        Tổng chia tách: {totalSplitAmount.toFixed(2)}
                        {splitMismatch ? " (chưa khớp tổng số tiền)" : " (đã khớp)"}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nếu cần kiểm soát chi phí theo hạng mục, hãy thêm dòng chia tách.</p>
                    )}
                  </div>

                  <div className="space-y-2 rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="tx-attachments">Hóa đơn đính kèm</Label>
                      {uploadingAttachments ? <span className="text-xs text-muted-foreground">Đang tải lên...</span> : null}
                    </div>
                    <Input
                      id="tx-attachments"
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      multiple
                      onChange={handleAttachmentUpload}
                      disabled={!token || loading || uploadingAttachments}
                    />

                    {attachments.length > 0 ? (
                      <div className="space-y-2">
                        {attachments.map((item, idx) => (
                          <div key={`attachment-${item.fileUrl}-${idx}`} className="grid grid-cols-1 gap-2 rounded-md border p-2 lg:grid-cols-5">
                            <div className="lg:col-span-2">
                              <p className="text-sm font-medium">{item.fileName}</p>
                              <p className="text-xs text-muted-foreground">{item.fileUrl}</p>
                            </div>
                            <p className="text-sm text-muted-foreground">{formatBytes(item.fileSize)}</p>
                            <p className="text-sm text-muted-foreground">{item.mimeType ?? "-"}</p>
                            <Button type="button" variant="ghost" onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}>
                              Xóa
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Chưa có file hóa đơn nào được tải lên.</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={!token || loading || uploadingAttachments}>
                      {loading ? "Đang xử lý..." : "Tạo phiếu giao dịch"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setActiveTab("list")}>Xem danh sách giao dịch</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Alert>
              <AlertDescription>Vai trò hiện tại chỉ có quyền xem danh sách giao dịch, không thể tạo phiếu mới.</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="list">
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle>Danh sách giao dịch</CardTitle>
              <CardDescription>Lọc theo loại, trạng thái, từ khóa để theo dõi tiến độ xử lý nhanh hơn.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 overflow-auto">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
                <Input
                  placeholder="Tìm mã phiếu, diễn giải, trạng thái..."
                  value={txSearch}
                  onChange={(event) => setTxSearch(event.target.value)}
                  className="lg:col-span-2"
                />

                <select
                  className="h-10 w-full rounded-md border bg-background px-3"
                  value={txFilterType}
                  onChange={(event) => setTxFilterType(event.target.value as "ALL" | TxType)}
                >
                  <option value="ALL">Tất cả loại phiếu</option>
                  <option value="EXPENSE">Chỉ phiếu Chi</option>
                  <option value="INCOME">Chỉ phiếu Thu</option>
                </select>

                <select
                  className="h-10 w-full rounded-md border bg-background px-3"
                  value={txFilterStatus}
                  onChange={(event) => setTxFilterStatus(event.target.value as TransactionStatusFilter)}
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="DRAFT">Nháp</option>
                  <option value="PENDING">Chờ duyệt</option>
                  <option value="APPROVED">Đã duyệt</option>
                  <option value="EXECUTED">Đã thực thi</option>
                  <option value="REJECTED">Từ chối</option>
                  <option value="REVERSED">Đảo chiều</option>
                </select>
              </div>

              <div className="text-xs text-muted-foreground">Hiển thị {filteredTransactions.length}/{transactions.length} giao dịch.</div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã phiếu</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Số tiền</TableHead>
                    <TableHead>Ngày</TableHead>
                    <TableHead>Diễn giải</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-medium">{tx.transactionCode}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={txTypeBadgeClass(tx.type)}>{TX_TYPE_LABEL[tx.type]}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusBadgeClass(tx.status)}>{TX_STATUS_LABEL[tx.status]}</Badge>
                      </TableCell>
                      <TableCell>{formatMoney(tx.amount)}</TableCell>
                      <TableCell>{new Date(tx.date).toLocaleString()}</TableCell>
                      <TableCell>{tx.description || "-"}</TableCell>
                    </TableRow>
                  ))}
                  {filteredTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Empty className="border-0 p-6">
                          <EmptyHeader>
                            <EmptyTitle>Không có giao dịch phù hợp</EmptyTitle>
                            <EmptyDescription>Thử nới bộ lọc hoặc tạo giao dịch mới để bắt đầu theo dõi.</EmptyDescription>
                          </EmptyHeader>
                        </Empty>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {canReadRecurring ? (
          <TabsContent value="recurring" className="space-y-4">
            <Alert>
              <AlertDescription>
                Hệ thống đã có lịch chạy tự động recurring theo chu kỳ. Nút chạy tay bên dưới dùng cho nghiệp vụ cần xử lý ngay.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Card className="border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle>Giao dịch định kỳ</CardTitle>
                  <CardDescription>Tạo template để giảm thao tác lặp, theo đúng lịch vận hành.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {canManageRecurring ? (
                    <form className="space-y-4" onSubmit={handleCreateRecurring}>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="recurring-name">Tên mẫu</Label>
                          <Input id="recurring-name" value={recurringForm.name} onChange={(event) => setRecurringForm((prev) => ({ ...prev, name: event.target.value }))} required />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="recurring-type">Loại phiếu</Label>
                          <select
                            id="recurring-type"
                            className="h-10 w-full rounded-md border bg-background px-3"
                            value={recurringForm.type}
                            onChange={(event) => setRecurringForm((prev) => ({ ...prev, type: event.target.value as TxType }))}
                          >
                            <option value="EXPENSE">Phiếu Chi</option>
                            <option value="INCOME">Phiếu Thu</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="recurring-amount">Số tiền</Label>
                          <Input id="recurring-amount" value={recurringForm.amount} onChange={(event) => setRecurringForm((prev) => ({ ...prev, amount: event.target.value }))} required />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="recurring-frequency">Tần suất</Label>
                          <select
                            id="recurring-frequency"
                            className="h-10 w-full rounded-md border bg-background px-3"
                            value={recurringForm.frequency}
                            onChange={(event) => setRecurringForm((prev) => ({ ...prev, frequency: event.target.value as Frequency }))}
                          >
                            <option value="DAILY">Hàng ngày</option>
                            <option value="WEEKLY">Hàng tuần</option>
                            <option value="MONTHLY">Hàng tháng</option>
                            <option value="QUARTERLY">Hàng quý</option>
                            <option value="ANNUALLY">Hàng năm</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="recurring-next-run">Lần chạy kế tiếp</Label>
                          <Input
                            id="recurring-next-run"
                            type="datetime-local"
                            value={recurringForm.nextRunAt}
                            onChange={(event) => setRecurringForm((prev) => ({ ...prev, nextRunAt: event.target.value }))}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="recurring-department">Phòng ban {recurringForm.type === "EXPENSE" ? "*" : "(không bắt buộc)"}</Label>
                          <select
                            id="recurring-department"
                            className="h-10 w-full rounded-md border bg-background px-3"
                            value={recurringForm.departmentId}
                            onChange={(event) => handleRecurringDepartmentChange(event.target.value)}
                          >
                            <option value="">{referenceDepartments.length > 0 ? "Chọn phòng ban" : "Chưa có dữ liệu phòng ban"}</option>
                            {referenceDepartments.map((department) => (
                              <option key={department.id} value={department.id}>
                                {formatDepartmentOption(department)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="recurring-budget">Ngân sách {recurringForm.type === "EXPENSE" ? "*" : "(không bắt buộc)"}</Label>
                          <select
                            id="recurring-budget"
                            className="h-10 w-full rounded-md border bg-background px-3"
                            value={recurringForm.budgetId}
                            onChange={(event) => handleRecurringBudgetChange(event.target.value)}
                            disabled={!recurringForm.departmentId}
                          >
                            <option value="">
                              {!recurringForm.departmentId
                                ? "Chọn phòng ban trước"
                                : recurringBudgetOptions.length > 0
                                  ? "Chọn ngân sách"
                                  : "Không có ngân sách cho phòng ban này"}
                            </option>
                            {recurringBudgetOptions.map((budget) => (
                              <option key={budget.id} value={budget.id}>
                                {formatBudgetOption(budget)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button type="submit" disabled={!token || loading}>Tạo mẫu định kỳ</Button>
                        <Button type="button" variant="outline" disabled={!token || loading} onClick={() => void handleRunRecurring()}>
                          Chạy các mẫu đến hạn
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <Alert>
                      <AlertDescription>Vai trò hiện tại có quyền xem recurring nhưng không có quyền tạo/chạy template.</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle>Danh sách template recurring</CardTitle>
                  <CardDescription>Theo dõi lịch chạy tiếp theo để chủ động ngân sách và nguồn quỹ.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-h-80 overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tên mẫu</TableHead>
                          <TableHead>Loại</TableHead>
                          <TableHead>Số tiền</TableHead>
                          <TableHead>Tần suất</TableHead>
                          <TableHead>Lần chạy kế tiếp</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recurringTemplates.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={txTypeBadgeClass(item.type)}>{TX_TYPE_LABEL[item.type]}</Badge>
                            </TableCell>
                            <TableCell>{formatMoney(item.amount)}</TableCell>
                            <TableCell>{FREQUENCY_LABEL[item.frequency]}</TableCell>
                            <TableCell>{new Date(item.nextRunAt).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                        {recurringTemplates.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground">Chưa có template recurring.</TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        ) : null}

        {canReadCashbook ? (
          <TabsContent value="cashbook" className="space-y-4">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Card className="border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle>Sổ quỹ tiền mặt</CardTitle>
                  <CardDescription>Chọn tài khoản quỹ để xem lịch sử ghi sổ tương ứng.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {accounts.length === 0 ? (
                    <Empty>
                      <EmptyHeader>
                        <EmptyTitle>Chưa có tài khoản quỹ</EmptyTitle>
                        <EmptyDescription>Liên hệ quản trị tài chính để khởi tạo cashbook account trước khi đối soát.</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {accounts.map((account) => (
                          <div
                            key={account.id}
                            className={`rounded-md border p-3 ${selectedAccountId === account.id ? "border-primary" : "border-border"}`}
                          >
                            <div className="flex items-center justify-between">
                              <p className="font-medium">{account.name}</p>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedAccountId(account.id);
                                  setReconcileForm((prev) => ({ ...prev, accountId: account.id }));
                                }}
                              >
                                Chọn
                              </Button>
                            </div>
                            <p className="text-sm text-muted-foreground">{account.type}</p>
                            <p className="mt-2 text-lg font-semibold">{formatMoney(account.balance)}</p>
                          </div>
                        ))}
                      </div>

                      <div className="max-h-72 overflow-auto rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Thời điểm ghi sổ</TableHead>
                              <TableHead>Chiều tiền</TableHead>
                              <TableHead>Số tiền</TableHead>
                              <TableHead>Mã phiếu</TableHead>
                              <TableHead>Diễn giải</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {visiblePostings.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>{new Date(item.postedAt).toLocaleString()}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={item.direction === "IN" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-orange-50 text-orange-700 border-orange-200"}>
                                    {DIRECTION_LABEL[item.direction]}
                                  </Badge>
                                </TableCell>
                                <TableCell>{formatMoney(item.amount)}</TableCell>
                                <TableCell>{item.transaction.code}</TableCell>
                                <TableCell>{item.transaction.description || "-"}</TableCell>
                              </TableRow>
                            ))}
                            {visiblePostings.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground">
                                  Chưa có bút toán quỹ cho tài khoản đã chọn.
                                </TableCell>
                              </TableRow>
                            ) : null}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle>Đối soát & Điều chỉnh</CardTitle>
                  <CardDescription>Đối soát số dư thực tế với hệ thống và tạo bút toán điều chỉnh khi lệch.</CardDescription>
                </CardHeader>
                <CardContent>
                  {canReconcileCashbook ? (
                    <form className="space-y-4" onSubmit={handleReconcile}>
                      <div className="space-y-2">
                        <Label htmlFor="reconcile-account-id">Tài khoản quỹ</Label>
                        <select
                          id="reconcile-account-id"
                          className="h-10 w-full rounded-md border bg-background px-3"
                          value={reconcileForm.accountId}
                          onChange={(event) => setReconcileForm((prev) => ({ ...prev, accountId: event.target.value }))}
                          required
                        >
                          <option value="" disabled>Chọn tài khoản</option>
                          {accounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.name} ({account.type})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="rounded-md border p-3 text-sm text-muted-foreground">
                        Số dư hệ thống hiện tại: {selectedAccount ? formatMoney(selectedAccount.balance) : "-"}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="reconcile-actual-balance">Số dư thực tế</Label>
                        <Input
                          id="reconcile-actual-balance"
                          value={reconcileForm.actualBalance}
                          onChange={(event) => setReconcileForm((prev) => ({ ...prev, actualBalance: event.target.value }))}
                          placeholder="Ví dụ: 1000000.00"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="reconcile-reason">Lý do đối soát</Label>
                        <Input
                          id="reconcile-reason"
                          value={reconcileForm.reason}
                          onChange={(event) => setReconcileForm((prev) => ({ ...prev, reason: event.target.value }))}
                          placeholder="Ví dụ: Đối soát cuối ngày"
                          required
                        />
                      </div>

                      <Button type="submit" disabled={!token || loading}>Thực hiện reconcile</Button>
                    </form>
                  ) : (
                    <Alert>
                      <AlertDescription>Vai trò hiện tại có quyền xem sổ quỹ nhưng không có quyền thực hiện đối soát.</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        ) : null}
      </Tabs>
    </main>
  );
}

export type TransactionType = "INCOME" | "EXPENSE";
export type TransactionStatus = "PENDING" | "APPROVED" | "REJECTED";
export type UserRole = "EMPLOYEE" | "MANAGER" | "ACCOUNTANT" | "FINANCE_ADMIN" | "AUDITOR";

export type Department = {
  id: number;
  name: string;
  code: string;
  budgetAllocated: number;
};

export type Budget = {
  id: number;
  departmentId: number;
  period: string; // YYYY-MM format
  amount: number;
  reserved: number; // Số tiền đã được "giữ chỗ" (approved nhưng chưa chi)
  used: number;     // Số tiền đã thực chi
};

export type Transaction = {
  id: number;
  transactionCode: string;
  type: TransactionType;
  amount: number;
  categoryId: number | null;
  departmentId: number | null;
  departmentName: string | null;
  date: string;
  description: string | null;
  status: TransactionStatus;
  createdAt: string;
};

export type AppUser = {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
};

export type Notification = {
  id: number;
  recipientId: number;
  type: string;
  title: string;
  message: string;
  referenceType: string | null;
  referenceId: number | null;
  isRead: boolean;
  createdAt: string;
};

export type ViberStore = {
  nextTxId: number;
  nextDeptId: number;
  nextNotificationId: number;
  nextBudgetId: number;
  departments: Department[];
  budgets: Budget[];
  transactions: Transaction[];
  users: AppUser[];
  notifications: Notification[];
  currentUserId: number;
};

function createSeedStore(): ViberStore {
  const currentPeriod = "2026-03"; // Tháng hiện tại
  return {
    nextTxId: 3,
    nextDeptId: 3,
    nextNotificationId: 1,
    nextBudgetId: 3,
    departments: [
      { id: 1, name: "Engineering", code: "ENG", budgetAllocated: 250000 },
      { id: 2, name: "Marketing", code: "MKT", budgetAllocated: 150000 },
    ],
    budgets: [
      { id: 1, departmentId: 1, period: currentPeriod, amount: 250000, reserved: 0, used: 0 },
      { id: 2, departmentId: 2, period: currentPeriod, amount: 150000, reserved: 0, used: 0 },
    ],
    transactions: [
      {
        id: 1,
        transactionCode: "TXN-INIT-1",
        type: "EXPENSE",
        amount: 1250,
        categoryId: null,
        departmentId: 2,
        departmentName: "Marketing",
        date: new Date().toISOString(),
        description: "Campaign assets",
        status: "PENDING",
        createdAt: new Date().toISOString(),
      },
      {
        id: 2,
        transactionCode: "TXN-INIT-2",
        type: "INCOME",
        amount: 5000,
        categoryId: null,
        departmentId: 1,
        departmentName: "Engineering",
        date: new Date().toISOString(),
        description: "Internal reimbursement",
        status: "APPROVED",
        createdAt: new Date().toISOString(),
      },
    ],
    users: [
      { id: 1, fullName: "Nguyen Van A", email: "nva@company.com", role: "EMPLOYEE" },
      { id: 2, fullName: "Tran Thi B", email: "ttb@company.com", role: "EMPLOYEE" },
      { id: 3, fullName: "Le Van C", email: "lvc@company.com", role: "MANAGER" },
      { id: 4, fullName: "Pham Thi D", email: "ptd@company.com", role: "ACCOUNTANT" },
      { id: 5, fullName: "Hoang Van E", email: "hve@company.com", role: "ACCOUNTANT" },
      { id: 6, fullName: "Do Thi F", email: "dtf@company.com", role: "FINANCE_ADMIN" },
    ],
    notifications: [],
    currentUserId: 1,
  };
}

function computeNextId(ids: number[]): number {
  const max = ids.reduce((m, v) => (Number.isFinite(v) ? Math.max(m, v) : m), 0);
  return max + 1;
}

export function getStore(): ViberStore {
  const g = globalThis as any;

  if (!g.__VIBER_STORE__ || typeof g.__VIBER_STORE__ !== "object") {
    g.__VIBER_STORE__ = createSeedStore();
    return g.__VIBER_STORE__ as ViberStore;
  }

  const store = g.__VIBER_STORE__ as Partial<ViberStore>;
  if (!Array.isArray(store.departments)) store.departments = [];
  if (!Array.isArray(store.budgets)) store.budgets = [];
  if (!Array.isArray(store.transactions)) store.transactions = [];
  if (!Array.isArray(store.users)) store.users = createSeedStore().users;
  if (!Array.isArray(store.notifications)) store.notifications = [];

  if (typeof store.nextDeptId !== "number") {
    store.nextDeptId = computeNextId(store.departments.map((d: any) => Number(d?.id ?? 0)));
  }
  if (typeof store.nextTxId !== "number") {
    store.nextTxId = computeNextId(store.transactions.map((t: any) => Number(t?.id ?? 0)));
  }
  if (typeof store.nextNotificationId !== "number") {
    store.nextNotificationId = computeNextId(store.notifications.map((n: any) => Number(n?.id ?? 0)));
  }
  if (typeof store.nextBudgetId !== "number") {
    store.nextBudgetId = computeNextId(store.budgets.map((b: any) => Number(b?.id ?? 0)));
  }
  if (typeof store.currentUserId !== "number") {
    store.currentUserId = 1;
  }

  g.__VIBER_STORE__ = store;
  return store as ViberStore;
}

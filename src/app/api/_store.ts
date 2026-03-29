export type TransactionType = "INCOME" | "EXPENSE";
export type TransactionStatus = "PENDING" | "APPROVED" | "REJECTED";

export type Department = {
  id: number;
  name: string;
  code: string;
  budgetAllocated: number;
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

export type ViberStore = {
  nextTxId: number;
  nextDeptId: number;
  departments: Department[];
  transactions: Transaction[];
};

function createSeedStore(): ViberStore {
  return {
    nextTxId: 3,
    nextDeptId: 3,
    departments: [
      { id: 1, name: "Engineering", code: "ENG", budgetAllocated: 250000 },
      { id: 2, name: "Marketing", code: "MKT", budgetAllocated: 150000 },
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
  if (!Array.isArray(store.transactions)) store.transactions = [];

  if (typeof store.nextDeptId !== "number") {
    store.nextDeptId = computeNextId(store.departments.map((d: any) => Number(d?.id ?? 0)));
  }
  if (typeof store.nextTxId !== "number") {
    store.nextTxId = computeNextId(store.transactions.map((t: any) => Number(t?.id ?? 0)));
  }

  g.__VIBER_STORE__ = store;
  return store as ViberStore;
}

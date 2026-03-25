import { NextResponse } from "next/server";

import {
  getStore,
  type Transaction,
  type TransactionStatus,
  type TransactionType,
} from "../_store";

function generateTransactionCode(): string {
  const prefix = "TXN";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

export async function GET(req: Request) {
  const { transactions } = getStore();
  const { searchParams } = new URL(req.url);

  const page = Number(searchParams.get("page") ?? 1);
  const limit = Number(searchParams.get("limit") ?? 20);
  const type = (searchParams.get("type") as TransactionType | null) ?? null;
  const status = (searchParams.get("status") as TransactionStatus | null) ?? null;
  const departmentIdRaw = searchParams.get("departmentId");
  const departmentId = departmentIdRaw ? Number(departmentIdRaw) : null;

  const filtered = transactions
    .filter((t) => (type ? t.type === type : true))
    .filter((t) => (status ? t.status === status : true))
    .filter((t) => (departmentId != null ? t.departmentId === departmentId : true))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 20;
  const offset = (safePage - 1) * safeLimit;
  const data = filtered.slice(offset, offset + safeLimit);

  return NextResponse.json({
    data,
    total: filtered.length,
    page: safePage,
    limit: safeLimit,
  });
}

export async function POST(req: Request) {
  const store = getStore();
  const body = (await req.json()) as any;

  const transactionCode = generateTransactionCode();
  const dept = body.departmentId
    ? store.departments.find((d) => d.id === Number(body.departmentId))
    : undefined;

  const tx: Transaction = {
    id: store.nextTxId++,
    transactionCode,
    type: body.type,
    amount: Number(body.amount ?? 0),
    categoryId: body.categoryId != null ? Number(body.categoryId) : null,
    departmentId: body.departmentId != null ? Number(body.departmentId) : null,
    departmentName: dept?.name ?? null,
    date: body.date ?? new Date().toISOString(),
    description: body.description ?? null,
    status: (body.status ?? "PENDING") as TransactionStatus,
    createdAt: new Date().toISOString(),
  };

  store.transactions.unshift(tx);
  return NextResponse.json(tx, { status: 201 });
}


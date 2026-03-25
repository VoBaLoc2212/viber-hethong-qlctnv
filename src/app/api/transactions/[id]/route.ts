import { NextResponse } from "next/server";

import { getStore, type TransactionStatus } from "../../_store";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const store = getStore();
  const tx = store.transactions.find((t) => t.id === Number(id));
  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  return NextResponse.json(tx);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const store = getStore();
  const tx = store.transactions.find((t) => t.id === Number(id));
  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  const body = (await req.json()) as any;
  if (body.status) {
    tx.status = body.status as TransactionStatus;
  }
  return NextResponse.json(tx);
}

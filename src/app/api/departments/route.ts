import { NextResponse } from "next/server";

import { getStore } from "../_store";

export async function GET() {
  const store = getStore();
  return NextResponse.json(store.departments);
}

export async function POST(req: Request) {
  const store = getStore();
  const body = (await req.json()) as any;
  const dept = {
    id: store.nextDeptId++,
    name: String(body.name ?? ""),
    code: String(body.code ?? "").toUpperCase(),
    budgetAllocated: Number(body.budgetAllocated ?? 0),
  };
  store.departments.push(dept);
  return NextResponse.json(dept, { status: 201 });
}

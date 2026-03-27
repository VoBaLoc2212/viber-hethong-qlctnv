import { NextResponse } from "next/server";
import { getStore } from "../_store";

// GET /api/auth - Lấy thông tin user hiện tại
export async function GET() {
  const store = getStore();
  const user = store.users.find((u) => u.id === store.currentUserId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }
  return NextResponse.json(user);
}

// PUT /api/auth - Đổi user hiện tại (simulate switch user)
export async function PUT(req: Request) {
  const store = getStore();
  const body = (await req.json()) as { userId: number };
  const user = store.users.find((u) => u.id === body.userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  store.currentUserId = body.userId;
  return NextResponse.json(user);
}

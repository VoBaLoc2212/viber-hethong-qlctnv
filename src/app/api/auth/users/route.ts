import { NextResponse } from "next/server";
import { getStore } from "../../_store";

// GET /api/auth/users - Lấy danh sách users (filtered by role nếu cần)
export async function GET(req: Request) {
  const store = getStore();
  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role");

  let users = store.users;
  if (role) {
    users = users.filter((u) => u.role === role);
  }
  return NextResponse.json(users);
}

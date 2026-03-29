import { NextResponse } from "next/server";
import { getStore } from "../../_store";

// POST /api/auth/logout - Reset về user mặc định
export async function POST() {
  const store = getStore();
  store.currentUserId = 1; // Reset về Employee mặc định
  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { getStore } from "../../_store";

// PATCH /api/notifications/read-all - Đánh dấu tất cả đã đọc
export async function PATCH() {
  const store = getStore();
  const currentUser = store.users.find((u) => u.id === store.currentUserId);
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  for (const n of store.notifications) {
    if (n.recipientId === currentUser.id) {
      n.isRead = true;
    }
  }
  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { getStore } from "../_store";

// GET /api/notifications - Danh sách thông báo của user hiện tại
export async function GET(req: Request) {
  const store = getStore();
  const currentUser = store.users.find((u) => u.id === store.currentUserId);
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const onlyUnread = searchParams.get("unread") === "true";

  let notifications = store.notifications.filter(
    (n) => n.recipientId === currentUser.id,
  );
  if (onlyUnread) {
    notifications = notifications.filter((n) => !n.isRead);
  }

  // Sắp xếp mới nhất trước
  notifications.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const unreadCount = store.notifications.filter(
    (n) => n.recipientId === currentUser.id && !n.isRead,
  ).length;

  return NextResponse.json({ data: notifications, unreadCount });
}

import { NextResponse } from "next/server";
import { getStore } from "../../_store";

// PATCH /api/notifications/[id] - Đánh dấu đã đọc
export async function PATCH(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const store = getStore();
  const notification = store.notifications.find((n) => n.id === Number(id));
  if (!notification) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  notification.isRead = true;
  return NextResponse.json(notification);
}

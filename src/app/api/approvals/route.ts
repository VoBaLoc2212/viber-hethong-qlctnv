import { NextResponse } from "next/server";

import {
  getStore,
  type ApprovalRequest,
  type ApprovalRequestStatus,
} from "../_store";

function generateRequestCode(): string {
  const prefix = "REQ";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// GET /api/approvals - Lấy danh sách phiếu yêu cầu
export async function GET(req: Request) {
  const store = getStore();
  const { searchParams } = new URL(req.url);
  const currentUser = store.users.find((u) => u.id === store.currentUserId);
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tab = searchParams.get("tab"); // "my" | "approve" | "execute"
  const status = searchParams.get("status") as ApprovalRequestStatus | null;

  let filtered: ApprovalRequest[];

  if (tab === "approve") {
    // Manager: xem phiếu PENDING + phiếu mình đã duyệt/từ chối (lịch sử)
    filtered = store.approvalRequests.filter(
      (a) => a.status === "PENDING" || a.approverId === currentUser.id,
    );
  } else if (tab === "execute") {
    // Accountant: xem phiếu APPROVED assign cho mình + phiếu mình đã chi/từ chối (lịch sử)
    filtered = store.approvalRequests.filter(
      (a) => a.accountantId === currentUser.id && ["APPROVED", "EXECUTE", "NOT_EXECUTE"].includes(a.status),
    );
  } else {
    // Tab "my": phiếu của chính mình tạo
    filtered = store.approvalRequests.filter(
      (a) => a.requesterId === currentUser.id,
    );
  }

  if (status) {
    filtered = filtered.filter((a) => a.status === status);
  }

  filtered.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return NextResponse.json(filtered);
}

// POST /api/approvals - Tạo phiếu yêu cầu chi mới
export async function POST(req: Request) {
  const store = getStore();
  const currentUser = store.users.find((u) => u.id === store.currentUserId);
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    title: string;
    description?: string;
    amount: number;
    departmentId?: number;
  };

  const dept = body.departmentId
    ? store.departments.find((d) => d.id === body.departmentId)
    : undefined;

  const approval: ApprovalRequest = {
    id: store.nextApprovalId++,
    requestCode: generateRequestCode(),
    title: body.title,
    description: body.description ?? null,
    amount: Number(body.amount),
    departmentId: body.departmentId ?? null,
    departmentName: dept?.name ?? null,
    requesterId: currentUser.id,
    requesterName: currentUser.fullName,
    approverId: null,
    approverName: null,
    accountantId: null,
    accountantName: null,
    status: "NOT_YET",
    rejectionReason: null,
    notExecuteReason: null,
    executedAmount: null,
    submittedAt: null,
    approvedAt: null,
    rejectedAt: null,
    executedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  store.approvalRequests.push(approval);
  return NextResponse.json(approval, { status: 201 });
}

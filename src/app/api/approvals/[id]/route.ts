import { NextResponse } from "next/server";
import { getStore, Budget } from "../../_store";

// Helper: Lấy period hiện tại (format: YYYY-MM)
function getCurrentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

// Helper: Tìm hoặc tạo budget record cho department + period
function findOrCreateBudget(
  store: ReturnType<typeof getStore>,
  departmentId: number,
  period: string,
): Budget {
  let budget = store.budgets.find(
    (b) => b.departmentId === departmentId && b.period === period,
  );
  if (!budget) {
    // Tạo budget mới với amount từ department.budgetAllocated
    const dept = store.departments.find((d) => d.id === departmentId);
    const amount = dept?.budgetAllocated ?? 0;
    budget = {
      id: store.nextBudgetId++,
      departmentId,
      period,
      amount,
      reserved: 0,
      used: 0,
    };
    store.budgets.push(budget);
  }
  return budget;
}

function addNotification(
  store: ReturnType<typeof getStore>,
  recipientId: number,
  type: string,
  title: string,
  message: string,
  referenceId: number,
) {
  store.notifications.push({
    id: store.nextNotificationId++,
    recipientId,
    type,
    title,
    message,
    referenceType: "APPROVAL_REQUEST",
    referenceId,
    isRead: false,
    createdAt: new Date().toISOString(),
  });
}

// GET /api/approvals/[id] - Chi tiết phiếu
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const store = getStore();
  const approval = store.approvalRequests.find((a) => a.id === Number(id));
  if (!approval) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(approval);
}

// PUT /api/approvals/[id] - Cập nhật phiếu (chỉ khi NOT_YET)
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const store = getStore();
  const approval = store.approvalRequests.find((a) => a.id === Number(id));
  if (!approval) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (approval.status !== "NOT_YET") {
    return NextResponse.json(
      { error: "Chỉ được sửa phiếu ở trạng thái NOT_YET" },
      { status: 422 },
    );
  }

  const body = (await req.json()) as {
    title?: string;
    description?: string;
    amount?: number;
    departmentId?: number;
  };

  if (body.title !== undefined) approval.title = body.title;
  if (body.description !== undefined) approval.description = body.description ?? null;
  if (body.amount !== undefined) approval.amount = Number(body.amount);
  if (body.departmentId !== undefined) {
    approval.departmentId = body.departmentId;
    const dept = store.departments.find((d) => d.id === body.departmentId);
    approval.departmentName = dept?.name ?? null;
  }
  approval.updatedAt = new Date().toISOString();

  return NextResponse.json(approval);
}

// DELETE /api/approvals/[id] - Xóa phiếu (chỉ khi NOT_YET)
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const store = getStore();
  const idx = store.approvalRequests.findIndex((a) => a.id === Number(id));
  if (idx === -1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (store.approvalRequests[idx].status !== "NOT_YET") {
    return NextResponse.json(
      { error: "Chỉ được xóa phiếu ở trạng thái NOT_YET" },
      { status: 422 },
    );
  }
  store.approvalRequests.splice(idx, 1);
  return NextResponse.json({ success: true });
}

// PATCH /api/approvals/[id] - Các actions: submit, approve, reject, execute, not-execute
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const store = getStore();
  const currentUser = store.users.find((u) => u.id === store.currentUserId);
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const approval = store.approvalRequests.find((a) => a.id === Number(id));
  if (!approval) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json()) as {
    action: "submit" | "approve" | "reject" | "execute" | "not-execute";
    accountantId?: number;
    rejectionReason?: string;
    notExecuteReason?: string;
    executedAmount?: number;
  };

  const now = new Date().toISOString();

  switch (body.action) {
    // ─── Employee gửi duyệt ───
    case "submit": {
      if (approval.status !== "NOT_YET") {
        return NextResponse.json(
          { error: "Chỉ gửi duyệt phiếu ở trạng thái NOT_YET" },
          { status: 422 },
        );
      }
      approval.status = "PENDING";
      approval.submittedAt = now;
      approval.updatedAt = now;

      // Gửi notification đến tất cả Managers
      const managers = store.users.filter((u) => u.role === "MANAGER");
      for (const mgr of managers) {
        addNotification(
          store,
          mgr.id,
          "APPROVAL_SUBMITTED",
          "Phiếu yêu cầu chi mới",
          `${approval.requesterName} đã gửi phiếu "${approval.title}" - Số tiền: ${approval.amount.toLocaleString("vi-VN")} VND`,
          approval.id,
        );
      }
      break;
    }

    // ─── Manager duyệt phiếu ───
    case "approve": {
      if (approval.status !== "PENDING") {
        return NextResponse.json(
          { error: "Chỉ duyệt phiếu ở trạng thái PENDING" },
          { status: 422 },
        );
      }
      if (!body.accountantId) {
        return NextResponse.json(
          { error: "Phải chọn kế toán chi" },
          { status: 400 },
        );
      }
      const accountant = store.users.find((u) => u.id === body.accountantId && u.role === "ACCOUNTANT");
      if (!accountant) {
        return NextResponse.json(
          { error: "Kế toán không hợp lệ" },
          { status: 400 },
        );
      }

      approval.status = "APPROVED";
      approval.approverId = currentUser.id;
      approval.approverName = currentUser.fullName;
      approval.accountantId = accountant.id;
      approval.accountantName = accountant.fullName;
      approval.approvedAt = now;
      approval.updatedAt = now;

      // ★ GIỮ CHỖ NGÂN SÁCH (Encumbrance) - Reserve budget
      if (approval.departmentId) {
        const budget = findOrCreateBudget(store, approval.departmentId, getCurrentPeriod());
        budget.reserved += approval.amount;
      }

      // Gửi notification cho Employee (người tạo phiếu)
      addNotification(
        store,
        approval.requesterId,
        "APPROVAL_APPROVED",
        "Phiếu đã được duyệt",
        `Phiếu "${approval.title}" (${approval.requestCode}) đã được ${currentUser.fullName} duyệt. Kế toán: ${accountant.fullName}`,
        approval.id,
      );

      // Gửi notification cho Accountant được chỉ định
      addNotification(
        store,
        accountant.id,
        "APPROVAL_ASSIGNED",
        "Phiếu chi mới cần xử lý",
        `Phiếu "${approval.title}" (${approval.requestCode}) - Số tiền: ${approval.amount.toLocaleString("vi-VN")} VND. Yêu cầu bởi ${approval.requesterName}, duyệt bởi ${currentUser.fullName}`,
        approval.id,
      );
      break;
    }

    // ─── Manager không duyệt ───
    case "reject": {
      if (approval.status !== "PENDING") {
        return NextResponse.json(
          { error: "Chỉ từ chối phiếu ở trạng thái PENDING" },
          { status: 422 },
        );
      }
      if (!body.rejectionReason?.trim()) {
        return NextResponse.json(
          { error: "Phải nhập lý do không duyệt" },
          { status: 400 },
        );
      }

      approval.status = "NOT_APPROVED";
      approval.approverId = currentUser.id;
      approval.approverName = currentUser.fullName;
      approval.rejectionReason = body.rejectionReason.trim();
      approval.rejectedAt = now;
      approval.updatedAt = now;

      // Gửi notification cho Employee
      addNotification(
        store,
        approval.requesterId,
        "APPROVAL_NOT_APPROVED",
        "Phiếu không được duyệt",
        `Phiếu "${approval.title}" (${approval.requestCode}) không được duyệt bởi ${currentUser.fullName}. Lý do: ${approval.rejectionReason}`,
        approval.id,
      );
      break;
    }

    // ─── Accountant chi ───
    case "execute": {
      if (approval.status !== "APPROVED") {
        return NextResponse.json(
          { error: "Chỉ chi phiếu ở trạng thái APPROVED" },
          { status: 422 },
        );
      }
      const executedAmount = body.executedAmount ?? approval.amount;
      approval.status = "EXECUTE";
      approval.executedAmount = executedAmount;
      approval.executedAt = now;
      approval.updatedAt = now;

      // ★ GIẢI PHÓNG GIỮ CHỖ & ĐÁNH DẤU ĐÃ CHI (Release reserved & mark used)
      if (approval.departmentId) {
        const budget = findOrCreateBudget(store, approval.departmentId, getCurrentPeriod());
        budget.reserved -= approval.amount; // Giải phóng số tiền đã reserve
        budget.used += executedAmount;      // Đánh dấu số tiền thực chi
      }

      // Gửi notification cho Employee
      addNotification(
        store,
        approval.requesterId,
        "APPROVAL_EXECUTED",
        "Phiếu đã được chi",
        `Phiếu "${approval.title}" (${approval.requestCode}) đã được chi. Số tiền: ${executedAmount.toLocaleString("vi-VN")} VND`,
        approval.id,
      );

      // Gửi notification cho Manager đã duyệt
      if (approval.approverId) {
        addNotification(
          store,
          approval.approverId,
          "APPROVAL_EXECUTED",
          "Phiếu đã được chi",
          `Phiếu "${approval.title}" (${approval.requestCode}) đã được kế toán ${currentUser.fullName} chi. Số tiền: ${executedAmount.toLocaleString("vi-VN")} VND`,
          approval.id,
        );
      }
      break;
    }

    // ─── Accountant không chi ───
    case "not-execute": {
      if (approval.status !== "APPROVED") {
        return NextResponse.json(
          { error: "Chỉ từ chối chi phiếu ở trạng thái APPROVED" },
          { status: 422 },
        );
      }
      if (!body.notExecuteReason?.trim()) {
        return NextResponse.json(
          { error: "Phải nhập lý do không chi" },
          { status: 400 },
        );
      }

      approval.status = "NOT_EXECUTE";
      approval.notExecuteReason = body.notExecuteReason.trim();
      approval.updatedAt = now;

      // ★ GIẢI PHÓNG GIỮ CHỖ (Release reserved) - không chi thực tế nên không mark used
      if (approval.departmentId) {
        const budget = findOrCreateBudget(store, approval.departmentId, getCurrentPeriod());
        budget.reserved -= approval.amount; // Giải phóng số tiền đã reserve
      }

      // Gửi notification cho Employee
      addNotification(
        store,
        approval.requesterId,
        "APPROVAL_NOT_EXECUTED",
        "Phiếu không được chi",
        `Phiếu "${approval.title}" (${approval.requestCode}) không được chi. Lý do: ${approval.notExecuteReason}`,
        approval.id,
      );

      // Gửi notification cho Manager đã duyệt
      if (approval.approverId) {
        addNotification(
          store,
          approval.approverId,
          "APPROVAL_NOT_EXECUTED",
          "Phiếu không được chi",
          `Phiếu "${approval.title}" (${approval.requestCode}) không được kế toán ${currentUser.fullName} chi. Lý do: ${approval.notExecuteReason}`,
          approval.id,
        );
      }
      break;
    }

    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  return NextResponse.json(approval);
}

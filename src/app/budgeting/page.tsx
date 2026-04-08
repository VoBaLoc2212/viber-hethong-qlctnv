"use client";

import { useAuthSession } from "@/components/auth-session-provider";
import { BudgetingWorkspace } from "@/components/budgeting-workspace";

export default function BudgetingPage() {
  const { token, currentUser, initializing } = useAuthSession();

  if (initializing) {
    return (
      <main className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Điều phối ngân sách</h1>
          <p className="text-muted-foreground mt-1">Đang khởi tạo phiên làm việc...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Điều phối ngân sách</h1>
        <p className="text-muted-foreground mt-1">Quản lý ngân sách và kiểm soát chi tiêu.</p>
      </div>

      <BudgetingWorkspace token={token} currentUser={currentUser} />
    </main>
  );
}

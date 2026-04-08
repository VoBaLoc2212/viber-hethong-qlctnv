"use client";

import { useAuthSession } from "@/components/auth-session-provider";
import { ReportsWorkspace } from "@/components/reports/reports-workspace";

export default function ReportsPage() {
  const { token, currentUser, initializing } = useAuthSession();

  if (initializing) {
    return (
      <main className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Báo cáo</h1>
          <p className="mt-1 text-muted-foreground">Đang khởi tạo phiên làm việc...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Báo cáo</h1>
        <p className="mt-1 text-muted-foreground">Tổng hợp tài chính, xu hướng giao dịch và theo dõi chỉ số vận hành.</p>
      </div>

      <ReportsWorkspace token={token} currentUser={currentUser} />
    </main>
  );
}

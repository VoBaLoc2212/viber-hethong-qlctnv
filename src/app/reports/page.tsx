"use client";

import { useAuthSession } from "@/components/auth-session-provider";
import { ReportsWorkspace } from "@/components/reports/reports-workspace";

export default function ReportsPage() {
  const { token, currentUser, initializing } = useAuthSession();

  if (initializing) {
    return null;
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="mt-1 text-muted-foreground">Tổng hợp tài chính, xu hướng giao dịch và theo dõi KPI vận hành.</p>
      </div>

      <ReportsWorkspace token={token} currentUser={currentUser} />
    </main>
  );
}

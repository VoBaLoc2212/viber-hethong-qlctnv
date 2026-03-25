"use client";

import { useAuthSession } from "@/components/auth-session-provider";
import { BudgetingWorkspace } from "@/components/budgeting-workspace";

export default function BudgetingPage() {
  const { token, initializing } = useAuthSession();

  if (initializing) {
    return null;
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Budgeting</h1>
        <p className="text-muted-foreground mt-1">Quản lý ngân sách và budget control.</p>
      </div>

      <BudgetingWorkspace token={token} />
    </main>
  );
}

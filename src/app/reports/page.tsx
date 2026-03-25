"use client";

import { useAuthSession } from "@/components/auth-session-provider";
import { SecurityWorkspace } from "@/components/security-workspace";

export default function ReportsPage() {
  const { token, currentUser, initializing } = useAuthSession();

  if (initializing) {
    return null;
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Security & Logs</h1>
        <p className="text-muted-foreground mt-1">Theo dõi user management, audit logs và immutable ledger.</p>
      </div>

      <SecurityWorkspace token={token} currentUser={currentUser} />
    </main>
  );
}

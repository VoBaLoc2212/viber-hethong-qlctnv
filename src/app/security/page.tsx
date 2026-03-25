"use client";

import { useAuthSession } from "@/components/auth-session-provider";
import { SecurityWorkspace } from "@/components/security/security-workspace";

export default function SecurityPage() {
  const { token, currentUser, initializing } = useAuthSession();

  if (initializing) {
    return null;
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Security & Logs</h1>
        <p className="mt-1 text-muted-foreground">Quản trị user, theo dõi audit logs và vận hành immutable ledger.</p>
      </div>

      <SecurityWorkspace token={token} currentUser={currentUser} />
    </main>
  );
}

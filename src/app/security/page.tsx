"use client";

import { useAuthSession } from "@/components/auth-session-provider";
import { SecurityWorkspace } from "@/components/security/security-workspace";

export default function SecurityPage() {
  const { token, currentUser, initializing } = useAuthSession();

  if (initializing) {
    return (
      <main className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bảo mật & Nhật ký</h1>
          <p className="mt-1 text-muted-foreground">Đang khởi tạo phiên làm việc...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bảo mật & Nhật ký</h1>
        <p className="mt-1 text-muted-foreground">Theo dõi nhật ký kiểm toán và vận hành sổ cái bất biến.</p>
      </div>

      <SecurityWorkspace token={token} currentUser={currentUser} />
    </main>
  );
}

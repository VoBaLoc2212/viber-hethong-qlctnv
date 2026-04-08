"use client";

import { useAuthSession } from "@/components/auth-session-provider";
import { UserManagementWorkspace } from "@/components/security/user-management-workspace";

export default function UsersPage() {
  const { token, currentUser, initializing } = useAuthSession();

  if (initializing) {
    return (
      <main className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quản lý người dùng</h1>
          <p className="mt-1 text-muted-foreground">Đang khởi tạo phiên làm việc...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Quản lý người dùng</h1>
        <p className="mt-1 text-muted-foreground">Quản trị tài khoản người dùng và phân quyền vai trò.</p>
      </div>

      <UserManagementWorkspace token={token} currentUser={currentUser} />
    </main>
  );
}

"use client";

import { AuthPanel } from "@/components/auth-panel";
import { useAuthSession } from "@/components/auth-session-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AuthPage() {
  const { token, currentUser, initializing, onAuthenticated, logout } = useAuthSession();

  if (initializing) {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-10">
      <div className="w-full space-y-6">
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl">BudgetFlow Authentication</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Vui lòng đăng nhập để truy cập hệ thống theo đúng role và quyền nghiệp vụ. Việc tạo tài khoản mới do
              FINANCE_ADMIN thực hiện trong module Security & Logs.
            </p>
          </CardContent>
        </Card>

        <AuthPanel token={token} currentUser={currentUser} onAuthenticated={onAuthenticated} onLogout={logout} />
      </div>
    </main>
  );
}

"use client";

import { ShieldCheck, ScrollText, LockKeyhole } from "lucide-react";

import { AuthPanel } from "@/components/auth-panel";
import { useAuthSession } from "@/components/auth-session-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AuthPage() {
  const { token, currentUser, initializing, onAuthenticated, logout } = useAuthSession();

  if (initializing) {
    return null;
  }

  return (
    <main className="min-h-svh bg-gradient-to-b from-background via-background to-secondary/30 px-4 py-10 sm:py-14">
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-start">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">BudgetFlow Enterprise</p>
            <CardTitle className="text-2xl leading-tight sm:text-3xl">
              Hệ thống quản lý ngân sách và kiểm soát chi tiêu nội bộ
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Đăng nhập để truy cập đúng vai trò nghiệp vụ. Mọi thay đổi đều được theo dõi để đảm bảo minh bạch và
              tuân thủ vận hành tài chính doanh nghiệp.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
                <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm font-medium">RBAC chặt chẽ</p>
                <p className="text-xs text-muted-foreground">Phân quyền theo role tài chính.</p>
              </div>
              <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
                <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                  <ScrollText className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm font-medium">Audit đầy đủ</p>
                <p className="text-xs text-muted-foreground">Truy vết hành động theo correlation.</p>
              </div>
              <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
                <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                  <LockKeyhole className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm font-medium">Bảo mật phiên</p>
                <p className="text-xs text-muted-foreground">Đăng nhập bắt buộc cho mọi truy cập.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <AuthPanel token={token} currentUser={currentUser} onAuthenticated={onAuthenticated} onLogout={logout} />
      </div>
    </main>
  );
}

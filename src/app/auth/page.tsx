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
    <main className="min-h-svh bg-gradient-to-b from-background via-background to-secondary/30 px-4 py-10 sm:py-14 lg:py-16">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-8">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="space-y-4 md:space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">BudgetFlow Doanh nghiệp</p>
            <CardTitle className="max-w-[22ch] text-2xl leading-tight sm:text-3xl">
              Hệ thống quản lý ngân sách và kiểm soát chi tiêu nội bộ
            </CardTitle>
            <p className="max-w-[60ch] text-sm leading-6 text-muted-foreground">
              Đăng nhập để truy cập đúng vai trò nghiệp vụ. Mọi thay đổi đều được theo dõi để đảm bảo minh bạch và
              tuân thủ vận hành tài chính doanh nghiệp.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
              <div className="rounded-lg border border-border/50 bg-secondary/30 p-4">
                <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm font-medium">Phân quyền chặt chẽ</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Phân quyền theo vai trò tài chính.</p>
              </div>
              <div className="rounded-lg border border-border/50 bg-secondary/30 p-4">
                <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                  <ScrollText className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm font-medium">Kiểm toán đầy đủ</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Truy vết hành động theo mã tương quan.</p>
              </div>
              <div className="rounded-lg border border-border/50 bg-secondary/30 p-4">
                <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                  <LockKeyhole className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm font-medium">Bảo mật phiên</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Đăng nhập bắt buộc cho mọi truy cập.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <AuthPanel token={token} currentUser={currentUser} onAuthenticated={onAuthenticated} onLogout={logout} />
      </div>
    </main>
  );
}

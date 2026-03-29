"use client";

import { useMemo, useState } from "react";
import { ShieldCheck, UserPlus } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiLogin } from "@/lib/api";
import { getRoleLabel } from "@/lib/ui-labels";
import type { AuthUser } from "@/lib/api";

type AuthPanelProps = {
  token: string | null;
  currentUser: AuthUser | null;
  onAuthenticated: (payload: { token: string; user: AuthUser }) => Promise<void> | void;
  onLogout: () => Promise<void> | void;
};

export function AuthPanel({ token, currentUser, onAuthenticated, onLogout }: AuthPanelProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLoggedIn = useMemo(() => Boolean(token && currentUser), [token, currentUser]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await apiLogin({ username, password });
      await onAuthenticated({ token: result.token, user: result.user });
      setPassword("");
    } catch (unknownError) {
      const message =
        typeof unknownError === "object" && unknownError && "message" in unknownError
          ? String((unknownError as { message: unknown }).message)
          : "Đăng nhập thất bại";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (isLoggedIn && currentUser) {
    return (
      <Card className="border-border/50 shadow-sm lg:shadow-md">
        <CardHeader className="space-y-2">
          <CardTitle>Đăng nhập</CardTitle>
          <CardDescription>
            Đang đăng nhập: <strong>{currentUser.fullName}</strong> ({getRoleLabel(currentUser.role)})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void onLogout();
            }}
          >
            Đăng xuất
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 shadow-sm lg:shadow-md">
      <CardHeader className="space-y-2">
        <CardTitle>Truy cập hệ thống</CardTitle>
        <CardDescription>Xác thực để làm việc theo đúng quyền và quy trình nghiệp vụ.</CardDescription>
      </CardHeader>
      <CardContent className="pt-1">
        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid h-11 w-full grid-cols-2">
            <TabsTrigger value="login">Đăng nhập</TabsTrigger>
            <TabsTrigger value="register">Đăng ký</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="mt-5">
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="auth-username">Tên đăng nhập</Label>
                <Input
                  id="auth-username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="auth-password">Mật khẩu</Label>
                <Input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Đang đăng nhập..." : "Đăng nhập"}
              </Button>
            </form>

            {error ? (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </TabsContent>

          <TabsContent value="register" className="mt-5 space-y-4">
            <div className="rounded-lg border border-border/50 bg-secondary/30 p-5">
              <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                <UserPlus className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm font-semibold">Đăng ký tài khoản doanh nghiệp</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Hệ thống này không mở tự đăng ký công khai. Tài khoản được FINANCE_ADMIN cấp phát để đảm bảo kiểm soát
                quyền truy cập và tuân thủ nghiệp vụ tài chính.
              </p>
            </div>

            <div className="rounded-lg border border-border/50 p-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Quy trình đề nghị cấp tài khoản
              </div>
              <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
                <li>Gửi yêu cầu tới FINANCE_ADMIN hoặc bộ phận IT nội bộ.</li>
                <li>Cung cấp họ tên, email công ty và phòng ban công tác.</li>
                <li>Sau khi được cấp quyền, đăng nhập bằng tài khoản đã nhận.</li>
              </ol>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

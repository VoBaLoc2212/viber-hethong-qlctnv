"use client";

import { useMemo, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiLogin } from "@/lib/api";
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
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>Đăng nhập</CardTitle>
          <CardDescription>
            Đang đăng nhập: <strong>{currentUser.fullName}</strong> ({currentUser.role})
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
    <Card className="border-border/50 shadow-sm">
      <CardHeader>
        <CardTitle>Đăng nhập</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="auth-username">Username</Label>
            <Input
              id="auth-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="auth-password">Password</Label>
            <Input
              id="auth-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          <Button type="submit" disabled={loading}>
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </Button>
        </form>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

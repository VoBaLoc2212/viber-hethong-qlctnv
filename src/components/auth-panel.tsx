"use client";

import { useMemo, useState } from "react";

import { apiLogin } from "@/lib/api";
import type { AuthUser } from "@/lib/api";

type AuthPanelProps = {
  token: string | null;
  currentUser: AuthUser | null;
  onAuthenticated: (payload: { token: string; user: AuthUser }) => void;
  onLogout: () => void;
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
      onAuthenticated({ token: result.token, user: result.user });
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
      <section className="panel">
        <h2>Đăng nhập</h2>
        <p>
          Đang đăng nhập: <strong>{currentUser.fullName}</strong> ({currentUser.role})
        </p>
        <button type="button" onClick={onLogout}>
          Đăng xuất
        </button>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Đăng nhập</h2>
      <form onSubmit={handleLogin} className="form-grid">
        <label>
          Username
          <input value={username} onChange={(event) => setUsername(event.target.value)} required />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <button type="submit" disabled={loading}>
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>
      {error ? <p className="error-text">{error}</p> : null}
    </section>
  );
}

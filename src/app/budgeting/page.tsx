"use client";

import { useEffect, useState } from "react";

import { AuthPanel } from "@/components/auth-panel";
import { BudgetingWorkspace } from "@/components/budgeting-workspace";
import { apiMe } from "@/lib/api";
import type { AuthUser } from "@/lib/api";

const TOKEN_STORAGE_KEY = "budget-app-token";

export default function BudgetingPage() {
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!stored) return;

    setToken(stored);
    apiMe(stored)
      .then((user) => setCurrentUser(user))
      .catch(() => {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken(null);
        setCurrentUser(null);
      });
  }, []);

  return (
    <main className="page-stack">
      <h1>Budgeting</h1>

      <AuthPanel
        token={token}
        currentUser={currentUser}
        onAuthenticated={({ token: nextToken, user }) => {
          setToken(nextToken);
          setCurrentUser(user);
          window.localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
        }}
        onLogout={() => {
          window.localStorage.removeItem(TOKEN_STORAGE_KEY);
          setToken(null);
          setCurrentUser(null);
        }}
      />

      <BudgetingWorkspace token={token} />
    </main>
  );
}

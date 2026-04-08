"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { apiLogout, apiMe } from "@/lib/api";
import type { AuthUser } from "@/lib/api";
import { AUTH_TOKEN_STORAGE_KEY, getFirstAccessiblePath, getLandingPath, isRouteAllowed, normalizeNextPath } from "@/lib/auth/rbac";
import type { UserRole } from "@/modules/shared/contracts/domain";

type AuthSessionContextValue = {
  token: string | null;
  currentUser: AuthUser | null;
  initializing: boolean;
  onAuthenticated: (payload: { token: string; user: AuthUser }) => Promise<void>;
  logout: () => Promise<void>;
};


const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

function resolvePostLoginPath(nextPath: string | null, role: UserRole): string {
  const normalized = normalizeNextPath(nextPath ?? "");
  if (normalized !== "/" && normalized !== "/auth" && isRouteAllowed(normalized, role)) {
    return normalized;
  }

  const preferred = getLandingPath(role);
  if (isRouteAllowed(preferred, role)) {
    return preferred;
  }

  return getFirstAccessiblePath(role);
}

function getNextPathFromUrl() {
  return new URLSearchParams(window.location.search).get("next");
}

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  const navigateAfterAuth = useCallback((target: string) => {
    window.location.replace(target);
  }, []);

  useEffect(() => {
    const fallbackToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

    apiMe()
      .then((user) => {
        setCurrentUser(user);
        setToken("cookie-session");
        if (fallbackToken) {
          window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        }
      })
      .catch(() => {
        if (fallbackToken) {
          window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        }
        setToken(null);
        setCurrentUser(null);
      })
      .finally(() => {
        setInitializing(false);
      });
  }, []);

  useEffect(() => {
    if (initializing || !currentUser) return;

    if (pathname === "/") {
      const target = resolvePostLoginPath(getNextPathFromUrl(), currentUser.role);
      navigateAfterAuth(target);
      return;
    }

    if (pathname === "/auth") {
      const target = resolvePostLoginPath(getNextPathFromUrl(), currentUser.role);
      navigateAfterAuth(target);
      return;
    }

    if (!isRouteAllowed(pathname, currentUser.role)) {
      router.replace(getFirstAccessiblePath(currentUser.role));
    }
  }, [currentUser, initializing, navigateAfterAuth, pathname, router]);

  const onAuthenticated = useCallback(
    async ({ user }: { token: string; user: AuthUser }) => {
      window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      setToken("cookie-session");
      setCurrentUser(user);

      const target = resolvePostLoginPath(getNextPathFromUrl(), user.role);
      navigateAfterAuth(target);
    },
    [navigateAfterAuth],
  );

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // ignore
    }

    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    setToken(null);
    setCurrentUser(null);
    router.replace("/auth");
  }, [router]);

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      token,
      currentUser,
      initializing,
      onAuthenticated,
      logout,
    }),
    [token, currentUser, initializing, onAuthenticated, logout],
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);
  if (!context) {
    throw new Error("useAuthSession must be used within AuthSessionProvider");
  }

  return context;
}

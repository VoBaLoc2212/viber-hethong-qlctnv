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
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { apiLogout, apiMe } from "@/lib/api";
import type { AuthUser } from "@/lib/api";
import {
  AUTH_TOKEN_COOKIE_KEY,
  AUTH_TOKEN_STORAGE_KEY,
  getFirstAccessiblePath,
  getLandingPath,
  isRouteAllowed,
  normalizeNextPath,
} from "@/lib/auth/rbac";
import type { UserRole } from "@/modules/shared/contracts/domain";

type AuthSessionContextValue = {
  token: string | null;
  currentUser: AuthUser | null;
  initializing: boolean;
  onAuthenticated: (payload: { token: string; user: AuthUser }) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

function setAuthCookie(token: string) {
  document.cookie = `${AUTH_TOKEN_COOKIE_KEY}=${token}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
}

function clearAuthCookie() {
  document.cookie = `${AUTH_TOKEN_COOKIE_KEY}=; path=/; max-age=0; samesite=lax`;
}

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

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  const navigateAfterAuth = useCallback((target: string) => {
    window.location.replace(target);
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (!stored) {
      setToken(null);
      setCurrentUser(null);
      clearAuthCookie();
      setInitializing(false);
      return;
    }

    setToken(stored);
    setAuthCookie(stored);

    apiMe(stored)
      .then((user) => {
        setCurrentUser(user);
      })
      .catch(() => {
        window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        clearAuthCookie();
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
      const target = resolvePostLoginPath(searchParams.get("next"), currentUser.role);
      navigateAfterAuth(target);
      return;
    }

    if (pathname === "/auth") {
      const target = resolvePostLoginPath(searchParams.get("next"), currentUser.role);
      navigateAfterAuth(target);
      return;
    }

    if (!isRouteAllowed(pathname, currentUser.role)) {
      router.replace(getFirstAccessiblePath(currentUser.role));
    }
  }, [currentUser, initializing, navigateAfterAuth, pathname, router, searchParams]);

  const onAuthenticated = useCallback(
    async ({ token: nextToken, user }: { token: string; user: AuthUser }) => {
      window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, nextToken);
      setAuthCookie(nextToken);
      setToken(nextToken);
      setCurrentUser(user);

      const target = resolvePostLoginPath(searchParams.get("next"), user.role);
      navigateAfterAuth(target);
    },
    [navigateAfterAuth, searchParams],
  );

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // ignore
    }

    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    clearAuthCookie();
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

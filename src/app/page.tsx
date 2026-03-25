import { redirect } from "next/navigation";

import { cookies } from "next/headers";

import { AUTH_TOKEN_COOKIE_KEY, getFirstAccessiblePath } from "@/lib/auth/rbac";
import { requireJwtSecret } from "@/lib/auth/jwt";
import { verifyAccessToken } from "@/modules/shared/auth/access-token";

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_TOKEN_COOKIE_KEY)?.value;

  if (!token) {
    redirect("/auth");
  }

  try {
    const payload = verifyAccessToken(token, requireJwtSecret());
    redirect(getFirstAccessiblePath(payload.role));
  } catch {
    redirect("/auth");
  }
}

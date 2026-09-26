import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "./constants";

// httpOnly: every request that reaches ../core-service now originates from
// the Next.js server (docs/MIGRATION_TO_FULL_SSR.md Phases 1-4) —
// lib/api/api-interceptor.ts reads this via next/headers' cookies(), never
// document.cookie — so nothing in the browser needs to see the token
// anymore. Closes docs/IMPROVEMENT_OPPORTUNITIES.md §1.1.
export async function setSessionCookie(token: string, maxAgeSeconds: number) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    path: "/",
    maxAge: maxAgeSeconds,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

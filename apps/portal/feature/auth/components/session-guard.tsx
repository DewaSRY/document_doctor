"use client";

import { useProfileQuery } from "@/feature/auth/hooks/query";

// Fetches the profile purely to surface an invalid/expired session: a 401
// response is caught by lib/api/api-interceptor.ts, which redirects to /logout.
export function SessionGuard() {
  useProfileQuery();
  return null;
}

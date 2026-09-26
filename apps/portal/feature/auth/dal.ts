import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "@/i18n/redirect";
import type { AppLocale } from "@/i18n/settings";
import { SESSION_COOKIE_NAME } from "./constants";

export const verifySession = cache(async (locale: AppLocale) => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    redirect({ href: "/login", locale });
  }

  return { token };
});

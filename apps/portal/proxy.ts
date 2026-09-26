import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { locales, defaultLocale, type AppLocale } from "./i18n/settings";
import { SESSION_COOKIE_NAME } from "./feature/auth/constants";

export const PROTECTED_PATH_PREFIXES = ["/dashboard"];
export const AUTH_ONLY_PATHS = ["/login", "/register", "/logout"];

function splitLocale(pathname: string): {
  locale: AppLocale | null;
  path: string;
} {
  for (const locale of locales) {
    if (pathname === `/${locale}`) {
      return { locale, path: "/" };
    }
    if (pathname.startsWith(`/${locale}/`)) {
      return { locale, path: pathname.slice(`/${locale}`.length) };
    }
  }
  return { locale: null, path: pathname };
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { locale, path } = splitLocale(pathname);
  const activeLocale = locale ?? defaultLocale;

  if (!locale) {
    const url = request.nextUrl.clone();
    url.pathname = `/${activeLocale}${path === "/" ? "" : path}`;
    return NextResponse.redirect(url);
  }

  const isAuthenticated = Boolean(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  );

  if (
    !isAuthenticated &&
    PROTECTED_PATH_PREFIXES.some((p) => path.startsWith(p))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `/${activeLocale}/login`;
    return NextResponse.redirect(url);
  }

  if (isAuthenticated && path !== "/logout" && AUTH_ONLY_PATHS.includes(path)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${activeLocale}/dashboard`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};

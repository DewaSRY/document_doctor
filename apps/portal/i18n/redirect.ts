import { redirect as nextRedirect } from "next/navigation";
import { defaultLocale, type AppLocale } from "./settings";

export function getPathname({
  href,
  locale,
}: {
  href: string;
  locale: AppLocale;
}) {
  // Keep "?query" and "#hash" off the path so "/#faq" becomes "/id#faq".
  const suffixAt = href.search(/[?#]/);
  const path = suffixAt === -1 ? href : href.slice(0, suffixAt);
  const suffix = suffixAt === -1 ? "" : href.slice(suffixAt);
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${normalized === "/" ? "" : normalized}${suffix}`;
}

export function redirect({
  href,
  locale = defaultLocale,
}: {
  href: string;
  locale?: AppLocale;
}): never {
  return nextRedirect(getPathname({ href, locale }));
}

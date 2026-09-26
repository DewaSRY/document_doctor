import { redirect as nextRedirect } from "next/navigation";
import { defaultLocale, type AppLocale } from "./settings";

export function getPathname({
  href,
  locale,
}: {
  href: string;
  locale: AppLocale;
}) {
  const normalized = href.startsWith("/") ? href : `/${href}`;
  return `/${locale}${normalized === "/" ? "" : normalized}`;
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

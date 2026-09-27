"use client";

import { useParams, usePathname as useNextPathname, useRouter as useNextRouter } from "next/navigation";
import NextLink from "next/link";
import type { ComponentProps } from "react";
import { useLeaveGuardContext } from "@/components/leave-guard";
import { defaultLocale, type AppLocale } from "./settings";
import { getPathname } from "./redirect";

function useActiveLocale(): AppLocale {
  const params = useParams<{ locale?: string }>();
  return (params?.locale as AppLocale) ?? defaultLocale;
}

interface LinkProps extends Omit<ComponentProps<typeof NextLink>, "href"> {
  href: string;
  locale?: AppLocale;
}

export function Link({ href, locale, onNavigate, ...props }: LinkProps) {
  const activeLocale = useActiveLocale();
  const router = useNextRouter();
  const { holdLeave } = useLeaveGuardContext();
  const isExternal = /^([a-z][a-z0-9+.-]*:)?\/\//i.test(href);
  const resolvedHref = isExternal
    ? href
    : getPathname({ href, locale: locale ?? activeLocale });

  return (
    <NextLink
      href={resolvedHref}
      onNavigate={(event) => {
        onNavigate?.(event);
        // Held while the page has unfinished work; continued once the user confirms.
        const navigate = props.replace ? router.replace : router.push;
        if (holdLeave(() => navigate(resolvedHref, { scroll: props.scroll }))) {
          event.preventDefault();
        }
      }}
      {...props}
    />
  );
}

export function usePathname() {
  const pathname = useNextPathname();
  const locale = useActiveLocale();
  const prefix = `/${locale}`;

  if (pathname === prefix) return "/";
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length);
  return pathname;
}

export function useRouter() {
  const router = useNextRouter();
  const activeLocale = useActiveLocale();
  const { holdLeave } = useLeaveGuardContext();

  function guarded(navigate: () => void) {
    if (!holdLeave(navigate)) navigate();
  }

  return {
    ...router,
    push(href: string, options?: { locale?: AppLocale }) {
      guarded(() => router.push(getPathname({ href, locale: options?.locale ?? activeLocale })));
    },
    replace(href: string, options?: { locale?: AppLocale }) {
      guarded(() => router.replace(getPathname({ href, locale: options?.locale ?? activeLocale })));
    },
  };
}

"use client";

import type { ComponentProps, MouseEvent } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useNavigationGuardStore } from "./store";

type GuardedLinkProps = ComponentProps<typeof Link>;

/**
 * Drop-in replacement for `@/i18n/navigation`'s `Link` that defers
 * navigation until the user confirms leaving, whenever the navigation guard
 * is armed. Use it anywhere a navigation link should respect the guard
 * (sidebar, logout, "log in instead" links, etc.).
 */
export function GuardedLink({ href, onClick, ...rest }: GuardedLinkProps) {
  const router = useRouter();
  const isGuarded = useNavigationGuardStore((s) => s.isGuarded);
  const requestNavigation = useNavigationGuardStore((s) => s.requestNavigation);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || !isGuarded) return;
    // let modifier-key clicks (open in new tab, etc.) behave normally
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.button !== 0) return;

    event.preventDefault();
    requestNavigation(() => router.push(href));
  };

  return <Link href={href} onClick={handleClick} {...rest} />;
}

"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";

const TRICKLE_INTERVAL_MS = 200;
const TRICKLE_TARGET = 90;
const COMPLETE_DELAY_MS = 250;

function isNavigableClick(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }

  const anchor = (event.target as HTMLElement | null)?.closest("a");
  if (!anchor || !anchor.href) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;

  const url = new URL(anchor.href, window.location.href);

  if (url.origin !== window.location.origin) return false;
  if (url.hash) return false;
  if (
    url.pathname === window.location.pathname &&
    url.search === window.location.search
  ) {
    return false;
  }

  return true;
}

function useIsNavigating() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentKey = `${pathname}?${searchParams}`;
  const [navigating, setNavigating] = useState(false);
  const [settledKey, setSettledKey] = useState(currentKey);

  if (currentKey !== settledKey) {
    setSettledKey(currentKey);
    setNavigating(false);
  }

  useEffect(() => {
    const start = () => setNavigating(true);
    const onClick = (event: MouseEvent) => {
      if (isNavigableClick(event)) start();
    };

    const onPopState = () => {
      if (window.location.hash) return;
      start();
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  return navigating;
}

function ProgressBarInner() {
  const navigating = useIsNavigating();
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const active = navigating || isFetching > 0 || isMutating > 0;

  const barRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(0);
  const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const setBar = (width: number, opacity: number) => {
      widthRef.current = width;
      const el = barRef.current;
      if (!el) return;
      el.style.width = `${width}%`;
      el.style.opacity = `${opacity}`;
    };

    if (trickleRef.current) clearInterval(trickleRef.current);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    if (active) {
      setBar(Math.max(widthRef.current, 8), 1);
      trickleRef.current = setInterval(() => {
        const remaining = TRICKLE_TARGET - widthRef.current;
        if (remaining <= 0) return;
        setBar(widthRef.current + Math.max(0.5, remaining / 12), 1);
      }, TRICKLE_INTERVAL_MS);
    } else if (widthRef.current > 0) {
      setBar(100, 1);
      hideTimeoutRef.current = setTimeout(() => {
        setBar(0, 0);
      }, COMPLETE_DELAY_MS);
    }

    return () => {
      if (trickleRef.current) clearInterval(trickleRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [active]);

  return (
    <div
      aria-hidden
      className="fixed inset-x-0 top-0 z-100 h-0.75 pointer-events-none"
    >
      <div
        ref={barRef}
        className="h-full w-0 opacity-0 bg-primary shadow-[0_0_8px_var(--color-primary)] transition-[width,opacity] duration-200 ease-out"
      />
    </div>
  );
}

export function TopProgressBar() {
  return (
    <Suspense fallback={null}>
      <ProgressBarInner />
    </Suspense>
  );
}

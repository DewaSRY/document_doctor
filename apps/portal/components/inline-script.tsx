"use client";

// Must be a Client Component: the type toggle below needs to evaluate on the
// browser during client-side navigations (locale switches), not just at the
// initial SSR pass, otherwise the script re-renders as "text/javascript" on
// every soft nav and React warns about a freshly client-rendered <script>.
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

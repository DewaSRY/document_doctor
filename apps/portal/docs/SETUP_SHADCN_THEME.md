# shadcn/ui + Theme Switcher Setup

This app uses [shadcn/ui](https://ui.shadcn.com) for UI primitives and
[`next-themes`](https://github.com/pacocoursey/next-themes) for a
light/dark/system theme switcher, wired into the existing Tailwind v4 +
`next-intl` layout.

Files:
- [components.json](../components.json) — shadcn CLI config (style, base
  color, aliases).
- [lib/utils.ts](../lib/utils.ts) — the `cn()` class-merge helper every
  shadcn component uses.
- [components/ui/button.tsx](../components/ui/button.tsx),
  [components/ui/dropdown-menu.tsx](../components/ui/dropdown-menu.tsx) —
  generated shadcn primitives (owned by this repo, not a node_modules
  package — edit them directly).
- [providers/theme-provider.tsx](../providers/theme-provider.tsx) — thin
  wrapper around `next-themes`' `ThemeProvider`.
- [components/theme-toggle.tsx](../components/theme-toggle.tsx) — the
  Light/Dark/System dropdown, built from the generated `Button` +
  `DropdownMenu`.
- [app/[locale]/layout.tsx](../app/%5Blocale%5D/layout.tsx) — mounts
  `ThemeProvider` once, above `NextIntlClientProvider`.
- [app/globals.css](../app/globals.css) — shadcn's CSS variables (`:root`
  and `.dark`) and the `@theme inline` mapping Tailwind reads them through.

## Why this shape

shadcn isn't a component *library* you install from npm — the CLI copies
component source into `components/ui/`, so the code is owned by this repo
from the moment it's generated. `next-themes` supplies the theme state
(`light` / `dark` / `system`, persisted, no flash-of-wrong-theme on
reload); the generated `Button` and `DropdownMenu` are just what
`ThemeToggle` is built out of — same pattern any future shadcn-based
component follows.

```
ThemeProvider (next-themes, providers/theme-provider.tsx)
   │  reads localStorage + prefers-color-scheme, sets <html class="dark">
   ▼
globals.css: :root { --background: ... }  /  .dark { --background: ... }
   │  Tailwind v4 @theme inline maps --color-background -> --background
   ▼
bg-background / text-foreground / etc. utility classes
   │  used by shadcn components and app code alike
   ▼
ThemeToggle (components/theme-toggle.tsx)
   │  useTheme().setTheme("light" | "dark" | "system")
   ▼
back to ThemeProvider — closes the loop
```

## Step 1: Initialize shadcn

```bash
npx shadcn@latest init -d
```

This is a newer major version of the CLI (`shadcn@4.19.0`) than most
existing write-ups describe — worth noting since it behaves differently
from the classic `new-york`/`default` style setup:

- Presets are now named (`nova`, `vega`, `maia`, `lyra`, `mira`, `luma`,
  `sera`, `rhea`, ...) instead of `new-york` / `default`. `-d`/`--defaults`
  picks `base-nova`.
- The `-b/--base` component library defaults to **Base UI** (`@base-ui/react`),
  not Radix. Generated primitives import from `@base-ui/react/*` — see
  `components/ui/button.tsx` and `dropdown-menu.tsx`. Base UI's
  composition prop is `render={<Button ... />}` (children of the trigger
  become the rendered button's children), not Radix's `asChild`.
- It auto-detected Tailwind v4 and the `@/*` import alias from this
  project's existing config — no prompts needed with `-d`.

It wrote `components.json`, added `class-variance-authority`, `clsx`,
`lucide-react`, `tailwind-merge`, `tw-animate-css`, and `@base-ui/react` to
`package.json`, generated `lib/utils.ts` and `components/ui/button.tsx`,
and rewrote `app/globals.css` to import `shadcn/tailwind.css` and define
the `:root`/`.dark` CSS variable palettes shown in the diagram above.

Then the dropdown menu primitive, used by the theme toggle:

```bash
npx shadcn@latest add dropdown-menu
```

## Step 2: Fix the font variable the CLI's rewrite broke

The CLI's `globals.css` rewrite doesn't know this project names its
Google Font CSS variable `--font-geist-sans` (set via `next/font/google`
in `layout.tsx`) — it wrote a generic, **self-referencing** mapping:

```css
/* what the CLI wrote — --font-sans resolves to itself, i.e. nothing */
--font-sans: var(--font-sans);
```

Fixed by pointing it back at the actual variable `layout.tsx` sets:

```css
--font-sans: var(--font-geist-sans);
```

Anyone re-running `shadcn init` (e.g. `--force` after upgrading) should
recheck this line — the CLI will happily clobber it again.

## Step 3: `next-themes` + provider

```bash
yarn add next-themes
```

```tsx
// providers/theme-provider.tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

Mounted once in the root layout, wrapping everything else (including
`NextIntlClientProvider` — theme and locale are independent axes, nesting
order between them doesn't matter):

```tsx
<html lang={locale} className={...} suppressHydrationWarning>
  <body className="min-h-full flex flex-col">
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <NextIntlClientProvider messages={messages}>
        <QueryProvider>{children}</QueryProvider>
      </NextIntlClientProvider>
    </ThemeProvider>
  </body>
</html>
```

Two details that are easy to skip and both cause visible bugs:

- **`suppressHydrationWarning` on `<html>`.** `next-themes` sets the
  `dark`/`light` class (and `style`) on `<html>` from an inline script
  that runs *before* React hydrates, specifically so there's no
  flash-of-wrong-theme. That script running makes the server-rendered
  and client-rendered `<html>` attributes mismatch on the very first
  paint, which is expected — `suppressHydrationWarning` tells React that
  specific, deliberate mismatch is fine. It's scoped to the `<html>` tag
  only; it doesn't suppress hydration warnings anywhere else.
- **`attribute="class"`** matches how shadcn's generated CSS scopes dark
  mode (`.dark { ... }` in `globals.css`, and Tailwind's
  `@custom-variant dark (&:is(.dark *))`). The `next-themes` default is
  `attribute="data-theme"`, which would set an attribute nothing in
  `globals.css` reads — theme state would change but nothing would look
  different.

## Step 4: The toggle

```tsx
// components/theme-toggle.tsx
"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const t = useTranslations("Common");
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="icon" aria-label={t("toggleTheme")} />}
      >
        <Sun className="scale-100 rotate-0 dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute scale-0 rotate-90 dark:scale-100 dark:rotate-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {([
          { value: "light", label: t("themeLight"), Icon: Sun },
          { value: "dark", label: t("themeDark"), Icon: Moon },
          { value: "system", label: t("themeSystem"), Icon: Monitor },
        ] as const).map(({ value, label, Icon }) => (
          <DropdownMenuItem key={value} onClick={() => setTheme(value)}>
            <Icon /> {label}
            {theme === value && <Check className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

The trigger button's Sun/Moon are both always rendered and cross-faded
with `dark:` variants (`scale-0`/`rotate-90` swap) rather than picking one
icon conditionally in JS — that keeps the icon a pure CSS function of the
`dark` class next-themes already set on `<html>`, with no extra client
render triggered by `useTheme()`'s `resolvedTheme` needing to settle
post-hydration.

`useTheme()` (and thus `t("toggleTheme")`/menu labels) needs `next-intl`
and `next-themes` client context, so `ThemeToggle` is a Client Component —
matching how `LocaleSwitcher` is already structured.

## Step 5: Translations + mounting

New keys added to `messages/{en,id}/common.json`: `toggleTheme`,
`themeLight`, `themeDark`, `themeSystem` — same `Common` namespace
`LocaleSwitcher` uses, since both are chrome-level controls rather than
feature-specific text.

Mounted next to `LocaleSwitcher` wherever chrome-level nav lives:
[components/landing/landing-nav.tsx](../components/landing/landing-nav.tsx)
for the public landing page, and
[components/navigation/site-header.tsx](../components/navigation/site-header.tsx)
for the logged-in `(protected)` layout (this moved off the home page
directly once a real landing page and dashboard shell were built).

```tsx
<LocaleSwitcher />
<ThemeToggle />
```

## Brand color tokens

Since this doc was written, `app/globals.css` gained a **brand** token set,
deliberately separate from the shadcn theme tokens above:
`--brand`/`--brand-hover`/`--brand-active`/`--brand-soft`/`--brand-foreground`
and numbered steps `--brand-100`...`--brand-900`, on a golden-yellow
spectrum (`oklch(... ~94)` hue) anchored on the brand hex `#FFD51E`.
Each token is redefined under `.dark`, and `--brand-500` — the primary
brand color — resolves to the **same** `oklch(0.883 0.176 93.958)`
(`#FFD51E`) in both `:root` and `.dark`, so the brand identity doesn't
shift with the theme; only the supporting steps (used for
hover/active/soft/foreground) adjust for contrast. (An earlier
yellow→lime→green version of this block had `--brand-500` diverge between
themes — `#3BC914` in `:root` vs. `oklch(0.962 0.116 104)` in `.dark`, two
unrelated colors — despite this doc's claim; a since-reverted orange
rewrite fixed that, and the current `#FFD51E` scale keeps `--brand-500`
constant across themes too.) `--primary`/`--ring`/`--accent`/the
`sidebar-*` equivalents/`--chart-1`/`--chart-2` share the same yellow hue
so the rendered UI (buttons, focus rings, sidebar highlights) matches the
brand tokens — see e.g. `components/tagline.tsx`, which renders the brand
word via `text-primary`. Because `#FFD51E` is a light, high-luma yellow,
every `*-foreground` paired with it uses dark text (white text on this
scale fails WCAG contrast at every step) — this is why `--primary` and
`--brand-500` are the same value in `.dark` too, rather than the lighter
"bump up a step for dark backgrounds" trick used for a darker brand color.
Use `bg-brand`/`text-brand-foreground`/etc. (mapped via `@theme inline`,
same mechanism as `--color-background` → `bg-background`) rather than
introducing a new ad-hoc brand color.

## Adding a new shadcn component

```bash
npx shadcn@latest add <component>
```

This writes straight into `components/ui/`, so treat the result as this
repo's code, not a vendored dependency — edit variants/classes in place
rather than overriding them from call sites, the same way
`buttonVariants` in `button.tsx` is meant to be extended directly for a
new variant.

## Gotchas hit while wiring this up

- **`shadcn init` silently broke the font variable** (Step 2). Nothing
  errored — the page just rendered in the browser default sans-serif
  instead of Geist. If a future shadcn upgrade needs `--force`, diff
  `globals.css` afterward instead of assuming it's untouched.
- **Base UI's `render` prop, not Radix's `asChild`.** Passing a JSX
  element via `render={<Button ... />}` and putting the actual content as
  the trigger's *children* (not the button's) is easy to get backwards if
  you're used to older shadcn/Radix examples — the CLI's own
  `dropdown-menu-example` registry item (`npx shadcn@latest view
  @shadcn/dropdown-menu-example`) is the fastest way to confirm the
  current pattern for any given primitive.

## Verification performed

- `yarn tsc --noEmit`, `yarn lint`, `yarn build` — all clean.
- Drove the running `next dev` server with a headless Chromium
  (Playwright) against `/en`: clicked the toggle, selected **Dark** —
  `<html>` gained the `dark` class, the whole page (background, text,
  buttons) repainted dark with zero console errors, screenshot confirmed
  the moon icon and dark background — then selected **Light** and
  confirmed it flipped back, including the `System` item's checkmark
  moving to whichever option is actually active.

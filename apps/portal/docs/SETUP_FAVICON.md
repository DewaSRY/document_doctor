# Favicon & App Icons — As Implemented

## Who this doc is for

You don't need any prior Next.js App Router experience with icons — this
doc assumes you've only ever wired a favicon the "classic" way (a
`<link rel="icon">` tag in an HTML `<head>`, pointed at a file in a static
assets folder). [Section 0](#section-0--background-primer) covers what's
different here, since this app's Next.js version (16.3.3) generates those
tags for you from files placed in specific locations — dropping the same
files into `public/` and calling it done (the pre-existing state before
this setup) silently does nothing.

This doc is verified against the source in this repo: every file
referenced below was confirmed to exist at the stated path, and the
resulting `<head>` tags were confirmed by curling a production build
(`yarn build && yarn start`), not just read from the Next.js docs.

## Section 0 — Background Primer

| Approach | How you wire it | This app |
| --- | --- | --- |
| Classic (pre-App-Router / most other frameworks) | Put icon files anywhere under a static folder, hand-write `<link rel="icon" href="...">` tags yourself | Not used |
| Next.js App Router file convention | Name a file `favicon.ico`, `icon.png`, or `apple-icon.png` and put it in `app/` (or a nested route segment) — Next finds it at build time and generates the `<link>` tag itself, reading real `type`/`sizes` from the file | **Used** — see [Section 1](#section-1--architecture-at-a-glance) |
| Web App Manifest icons (Android "add to home screen", PWA installability) | A separate `icons` array inside a `manifest.json`/`manifest.webmanifest`, linked via `<link rel="manifest">` — not part of the `favicon`/`icon`/`apple-icon` convention at all | **Used** — see [Section 3](#section-3--the-manifest) |

**The gotcha that isn't obvious coming from the classic approach:** there
is no manual `<link>` tag to write. Next.js evaluates whatever image files
exist at the conventional names/paths during the build and injects the
tags itself — see the file conventions reference at
`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md`
(this repo's `AGENTS.md` calls out that this Next.js version's docs should
be read from `node_modules`, not assumed from training data). This is why
the raw favicon.io export — six PNGs, an `.ico`, and a `site.webmanifest`
dropped at the **project root** — did nothing on its own: none of those
paths are ones Next.js's convention resolver looks at.

## Section 1 — Architecture at a glance

The composition root is implicit: Next.js's build step itself scans
`app/` for these exact filenames — there's no code that "mounts" the
icons the way a component gets mounted in a layout.

| File | Convention | Resulting tag |
| --- | --- | --- |
| [app/favicon.ico](../app/favicon.ico) | `favicon` (must be top-level `app/`) | `<link rel="icon" href="/favicon.ico" sizes="48x48" type="image/x-icon">` |
| [app/icon.png](../app/icon.png) | `icon` | `<link rel="icon" href="/icon.png" sizes="256x256" type="image/png">` |
| [app/apple-icon.png](../app/apple-icon.png) | `apple-icon` | `<link rel="apple-touch-icon" href="/apple-icon.png" sizes="180x180" type="image/png">` |
| [app/manifest.ts](../app/manifest.ts) | `manifest` (generated) | `<link rel="manifest" href="/manifest.webmanifest">` |

All four tags were confirmed by curling a production build of `/en`
(`yarn build && yarn start`) — Next appends a content hash query string to
each (e.g. `/icon.png?icon.2nv_p51nuql_o.png`) for cache-busting, which is
generated automatically and isn't something to hand-maintain.

`app/icon.png` was already in place before this setup (`597bad6…`,
256×256) — it's the same file as
[public/icons/wallet.png](../public/icons/wallet.png), the master artwork
the rest of the icon set below was generated from. This setup didn't
replace it; it added the three files/conventions the master artwork alone
didn't cover (`favicon.ico`, `apple-icon.png`, the manifest's Android
icons).

## Section 2 — Where the source assets came from

The six PNGs, `.ico`, and `site.webmanifest` came from running
[public/icons/wallet.png](../public/icons/wallet.png) through
[favicon.io](https://favicon.io)'s generator and extracting the resulting
zip. That tool's output targets the classic setup (Section 0) — a flat
folder of files plus a hand-authored manifest — so each file had to be
moved to the specific path Next.js's convention resolver expects, or
dropped if redundant:

| Generated file | Became | Why |
| --- | --- | --- |
| `favicon.ico` | `app/favicon.ico` | `favicon` convention requires top-level `app/` |
| `apple-touch-icon.png` (180×180) | `app/apple-icon.png` | `apple-icon` convention; renamed to match |
| `android-chrome-192x192.png` | `public/icons/android-chrome-192x192.png` | referenced by `app/manifest.ts`, not a file-convention name itself |
| `android-chrome-512x512.png` | `public/icons/android-chrome-512x512.png` | same as above |
| `site.webmanifest` | replaced by `app/manifest.ts` | see [Section 3](#section-3--the-manifest) |
| `favicon-32x32.png` | **dropped** | superseded — `app/icon.png` (256×256) already serves the `icon` convention, and `.ico` files bundle multiple raster sizes internally (confirmed via `file favicon.ico` → `MS Windows icon resource - 3 icons, 16x16, 32x32, ...`), so a separate 32×32 PNG has no convention slot left to fill |
| `favicon-16x16.png` | **dropped** | same reasoning — already inside `favicon.ico` |

**Worth calling out:** dropping the two loose PNGs is a deliberate
simplification, not an oversight — Next's file-convention model has no
slot for "an extra small PNG fallback" the way a hand-written classic
`<head>` would. If a future browser/context needs a 16×16 or 32×32 PNG
specifically (rather than the sizes bundled inside `favicon.ico`), it
would need to be added manually to `metadata.icons` in
[app/[locale]/layout.tsx](../app/%5Blocale%5D/layout.tsx) — the file
convention path doesn't support numbered variants across *different* base
names, only e.g. `icon1.png`, `icon2.png` alongside `icon.png`.

## Section 3 — The manifest

[app/manifest.ts](../app/manifest.ts) replaces the generator's
`site.webmanifest` (which shipped with an empty `name`/`short_name`) with
a typed, generated manifest:

```ts
// app/manifest.ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Simple Bank",
    short_name: "Simple Bank",
    description:
      "Ledger-based core banking demo — account management and account-to-account transfers.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
```

This is the "generate icons using code" form Next.js supports for
`manifest` (a `.ts`/`.js` file exporting a default function) rather than
the static-JSON form — chosen so the name/description stay type-checked
against `MetadataRoute.Manifest` instead of hand-typed JSON that could
silently drift from the schema.

**Rough edge, called out on purpose:** `background_color`/`theme_color`
are hardcoded to `#ffffff` — the values favicon.io's generator defaulted
to. This app's actual light-mode background is a slightly warm off-white
OKLCH value (`--background` in
[app/globals.css](../app/globals.css)`:72`), not pure white, and the
brand identity color lives in `--brand-500`
([app/globals.css](../app/globals.css)`:112`). Nobody has converted those
OKLCH values to sRGB hex for the manifest yet — `#ffffff` is a safe
placeholder, not a deliberate brand decision, and is the one value in this
setup worth revisiting if the PWA install icon backdrop / mobile browser
chrome color ever gets noticed by a designer.

## Cross-feature coupling

- **None.** Icon and manifest files are read only by Next.js's own build
  step to generate `<head>` tags; nothing else in the app (no
  component, hook, or route) imports or references `app/icon.png`,
  `app/favicon.ico`, `app/apple-icon.png`, or `app/manifest.ts` directly.
  `public/icons/wallet.png` is the one exception — it's the master
  artwork `app/icon.png` is a byte-for-byte copy of, kept around as the
  regenerable source if the icon set ever needs to be redone.

## Verification performed

- `yarn build` — clean production build; confirmed `/icon.png`,
  `/apple-icon.png`, and `/manifest.webmanifest` all appear as generated
  static routes in the build output.
- `yarn start` + `curl localhost:3000/en` — confirmed all four `<head>`
  tags (`favicon.ico`, `icon.png`, `apple-icon.png`, `manifest`) render
  with the expected `sizes`/`type` attributes, and
  `curl localhost:3000/manifest.webmanifest` returns the JSON above.
- `yarn tsc --noEmit` and `yarn lint` — no new errors from any file this
  setup touched (`app/manifest.ts`, `app/favicon.ico`, `app/apple-icon.png`);
  pre-existing lint findings in unrelated files
  (`lib/logger.ts`, `lib/api/api-interceptor.ts`,
  `providers/theme-provider.tsx`) were not introduced by this change.
- Repo root cleaned up: the favicon.io zip and every extracted file that
  didn't map to a Next.js convention path (`favicon-16x16.png`,
  `favicon-32x32.png`, the loose `site.webmanifest`, and the original
  root-level copies of every moved file) were removed rather than left as
  stray files outside `app/`/`public/`.

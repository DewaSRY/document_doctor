# Internationalization (react-i18next) — As Implemented

Supported locales: `en` (default), `id`. Translations are split **per feature**
(`common`, `auth`, `transfer`) rather than one giant dictionary per language.

## Who this doc is for

Assumes comfort with React (hooks, context) and the Next.js App Router
(Server vs. Client Components, layouts). Does **not** assume prior exposure to
`i18next`/`react-i18next` — Section 0 below covers the parts of that library
that this codebase actually leans on.

This doc describes what the code does, verified against source
(file:line citations throughout) — not an idealized design. Where the
Server/Client split forces something slightly awkward (Section 2's two
different-looking translation functions, the `<Trans>` workaround in
Section 6), that's called out rather than smoothed over.

This replaces a previous `next-intl`-based setup. If you find references to
`next-intl`, `i18n/routing.ts`, `i18n/request.ts`, or `NextIntlClientProvider`
anywhere (old branches, other docs, muscle memory from a past session on this
repo), they're stale — the library was fully swapped out.

## Section 0 — Background primer: why two different "translation" APIs exist

`next-intl` (the previous library) has first-class React Server Component
support baked in — `getTranslations()` and `useTranslations()` feel like the
same API whether you're on the server or the client. `react-i18next` doesn't:
it's built around `i18next`, a framework-agnostic core, plus a thin React
binding (`react-i18next`) that exposes translations through **React context**
(`useTranslation`, `<Trans>`). Context requires hooks, and hooks require a
Client Component — so `react-i18next`'s hook-based API cannot run inside a
Server Component at all.

| Approach                                            | Where it runs                                                 | How you read a string                                                  | Typical use in this repo                                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `i18next` core instance, no React binding           | Anywhere (Server Components, Server Actions, plain `.ts`)     | `instance.getFixedT(locale, ns)("key")` — a plain function, no context | `i18n/server.ts`'s `getTranslation()`                                                                              |
| `react-i18next` hooks (`useTranslation`, `<Trans>`) | Client Components only, must be inside an `<I18nextProvider>` | `const { t } = useTranslation(ns)`                                     | Any `"use client"` component (`components/locale-switcher.tsx:16`, `components/theme-toggle.tsx`, form components) |

Gotchas that aren't obvious from the API surface:

1. **`useTranslation`/`<Trans>` throw (or silently no-op) outside a Client
   Component tree wrapped in `<I18nextProvider>`.** This is why
   `components/tagline.tsx` exists as its own tiny Client Component instead of
   calling `<Trans>` directly inside the (Server Component) home page — see
   Section 6.
2. **Server-side translation reads don't share a singleton instance.** Every
   call to `getTranslation()` (`i18n/server.ts:26`) creates a _brand new_
   `i18next` instance via `createInstance()`. This looks wasteful coming from
   `next-intl`'s request-scoped cache, but it's cheap here: the "resources"
   being loaded are just already-parsed JSON, and the instance is thrown away
   at the end of the render. See Section 2.
3. **The client instance is not recreated on locale navigation — it's
   mutated.** Switching from `/en` to `/id` doesn't remount
   `TranslationsProvider` or rebuild its `i18next` instance from scratch; an
   effect patches the existing instance in place (`addResourceBundle` +
   `changeLanguage`). See Section 3.

## Section 1 — Architecture at a glance

The composition root is `app/[locale]/layout.tsx` (`app/[locale]/layout.tsx:37`).
It validates the locale, loads that locale's messages, and hands them to
`TranslationsProvider` — but it doesn't itself know how translation loading or
the `i18next` instance lifecycle work; both are delegated.

| Concern                                            | Owner                                                                                                      | Analogy                                                       |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Locale/namespace config (source of truth for both) | `i18n/settings.ts`                                                                                         | The dictionary's table of contents                            |
| Locale param validation                            | `isAppLocale()` in `i18n/settings.ts:6`, called from every page/layout                                     | A type guard everyone repeats at the door                     |
| Server-side translation reads                      | `i18n/server.ts` (`getTranslation`, `getMessages`)                                                         | A one-shot dictionary lookup, thrown away after the render    |
| Client-side translation runtime                    | `components/translations-provider.tsx` + `react-i18next`'s `useTranslation`/`<Trans>`                      | The live dictionary Client Components subscribe to            |
| Locale-aware navigation                            | `i18n/navigation.tsx` (`Link`, `usePathname`, `useRouter`), `i18n/redirect.ts` (`redirect`, `getPathname`) | `next/link`/`next/navigation`, but locale-prefix aware        |
| Locale detection + redirect                        | `proxy.ts`                                                                                                 | The bouncer that rewrites `/` → `/en` before anything renders |
| Translation content                                | `messages/{locale}/{common,auth,transfer}.json`                                                            | The actual dictionaries                                       |

The server/client split exists because, as covered in Section 0, RSC can't use
the hook-based API at all — so server-side reads had to go around
`react-i18next` entirely and talk to a plain `i18next` instance instead. One
consequence worth flagging up front: this is why `getTranslation()` and
`useTranslation()` look like they do the same job but come from completely
different code paths (Section 2 vs. Section 3) — there's no single
"the" translation function in this codebase, there are two, chosen by
whether the calling component is a Server or Client Component.

## Section 2 — `i18n/server.ts`: reading translations in Server Components

**The problem:** a Server Component (a page, a layout, `logout-button.tsx`)
needs a translated string, but can't use `react-i18next`'s hooks.

**How it's implemented.** `loadMessages()` (`i18n/server.ts:11`) dynamically
imports all three namespace JSON files for a locale in parallel:

```ts
async function loadMessages(locale: AppLocale) {
  const entries = await Promise.all(
    namespaces.map(async (ns) => {
      const mod = await import(`../messages/${locale}/${ns}.json`);
      return [ns, mod.default] as const;
    }),
  );
  return Object.fromEntries(entries);
}
```

`getMessages()` (`i18n/server.ts:22`) just re-exports that — it's what the
root layout calls to get everything for the client provider (Section 3).

`getTranslation(locale, ns)` (`i18n/server.ts:26`) is what pages/Server
Components actually call for their own strings. It creates a fresh `i18next`
instance, loads the same messages, initializes with `initReactI18next` (still
required even though nothing here is a React hook — it's what makes the
resulting `t` compatible with `<Trans>` if the caller passes it through, see
Section 6), and returns a **fixed** translator bound to that locale/namespace:

```ts
export async function getTranslation(
  locale: AppLocale,
  ns: AppNamespace = "common",
) {
  const instance = createInstance();
  const resources = await loadMessages(locale);
  await instance.use(initReactI18next).init({
    ...getI18nOptions(locale, namespaces),
    resources: { [locale]: resources },
  });
  return { t: instance.getFixedT(locale, ns), i18n: instance };
}
```

Every page follows the same shape (e.g. `app/[locale]/(public)/page.tsx:16`):

```ts
const { t } = await getTranslation(locale, "common");
const { t: tAuth } = await getTranslation(locale, "auth");
```

Two calls, two namespaces — `getTranslation` is namespace-scoped, not
multi-namespace, so a page reading strings from both `common` and `auth`
(the home page does) makes two calls rather than one.

**Rough edge worth flagging:** `getTranslation` still loads _all three_
namespaces into the instance's `resources` even though it only returns a `t`
for one of them (`getI18nOptions(locale, namespaces)` at `i18n/server.ts:34`
passes the full `namespaces` list, not just `ns`). It's harmless — the JSON is
already in memory from `loadMessages()` — but it means the `ns` parameter only
controls which namespace `getFixedT` defaults to, not what's loaded.

## Section 3 — `components/translations-provider.tsx`: the client runtime

**The problem:** Client Components (forms, the theme toggle, the locale
switcher) need `useTranslation()`/`<Trans>` to work, which means they need to
sit inside an `<I18nextProvider>` with a live `i18next` instance — one that
stays in sync as the user navigates between `/en` and `/id`.

**How it's implemented.** The root layout calls `getMessages(locale)`
server-side and passes the result straight into `TranslationsProvider` as a
prop (`app/[locale]/layout.tsx:60`):

```tsx
const messages = await getMessages(locale);
// ...
<TranslationsProvider locale={locale} messages={messages}>
  <QueryProvider>{children}</QueryProvider>
</TranslationsProvider>;
```

`TranslationsProvider` (`components/translations-provider.tsx:23`) builds the
instance exactly once, via `useState(() => createI18nInstance(...))` — the
lazy initializer form, so the (moderately expensive) `instance.init()` call
only runs on first mount, not every render:

```tsx
const [i18n] = useState(() => createI18nInstance(locale, messages));
```

The interesting part is what happens on a locale change. Because
`app/[locale]/layout.tsx` occupies the same position in the tree for `/en/*`
and `/id/*`, React doesn't remount it when the locale segment changes — it
just re-renders with new `locale`/`messages` props, which means the `useState`
initializer above does **not** re-run. An effect handles the sync explicitly
(`components/translations-provider.tsx:30`):

```tsx
useEffect(() => {
  for (const ns of namespaces) {
    if (!i18n.hasResourceBundle(locale, ns)) {
      i18n.addResourceBundle(locale, ns, messages[ns]);
    }
  }
  if (i18n.language !== locale) {
    i18n.changeLanguage(locale);
  }
}, [i18n, locale, messages]);
```

| Step                      | What actually happens                                                                                                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hasResourceBundle` check | Skips re-adding a locale's messages if they're already loaded — matters because this effect re-runs on every render where `messages`'s reference changes, not just on an actual locale switch |
| `addResourceBundle`       | Grafts the newly-fetched locale's messages onto the _existing_ instance rather than building a new one                                                                                        |
| `changeLanguage`          | Triggers `react-i18next`'s re-render of every subscribed `useTranslation()`/`<Trans>` consumer                                                                                                |

**Divergence from what you'd expect:** there's no loading state here — the
effect assumes `messages` for the new locale already arrived by the time it
runs, which is true in practice because the Server Component re-render
(fetching the new locale's JSON) has to complete before React can even give
the client new props to diff against. If that ever stopped being true (e.g.
someone made `getMessages` genuinely async over a network call instead of a
local `import()`), this effect would need a pending-state guard it doesn't
currently have.

## Section 4 — `i18n/settings.ts`: the shared config

The single source of truth both server and client code import from:

```ts
export const locales = ["en", "id"] as const;
export const defaultLocale: AppLocale = "en";
export type AppLocale = (typeof locales)[number];

export const namespaces = ["common", "auth", "transfer"] as const;
export type AppNamespace = (typeof namespaces)[number];
```

| Export             | Used by                                                                 | Purpose                                                                                                |
| ------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `locales`          | `proxy.ts`, `generateStaticParams` in the root layout, `LocaleSwitcher` | Enumerate every supported locale                                                                       |
| `defaultLocale`    | `proxy.ts`, `i18n/redirect.ts`                                          | Fallback when no locale is known                                                                       |
| `isAppLocale()`    | Every page/layout (`if (!isAppLocale(locale)) notFound()`)              | Narrow the `string` route param to `AppLocale` before it's trusted                                     |
| `namespaces`       | `i18n/server.ts`, `components/translations-provider.tsx`                | Drive the `Promise.all` / `addResourceBundle` loops so a new namespace only has to be added here       |
| `getI18nOptions()` | Both `i18n/server.ts` and `translations-provider.tsx`                   | One shared `i18next.init()` options object, so server and client instances stay configured identically |

`interpolation: { escapeValue: false }` inside `getI18nOptions`
(`i18n/settings.ts:26`) turns off `i18next`'s default HTML-escaping of
interpolated values. React already escapes everything it renders, so
`i18next`'s own escaping would be redundant defense-in-depth at best — this
is the standard `react-i18next` recommendation, not something specific to
this app.

## Section 5 — `i18n/navigation.tsx` + `i18n/redirect.ts`: locale-aware navigation

**The problem:** every internal link/redirect/router call needs the current
locale prefixed onto it (`/login` → `/en/login`), without every call site
re-deriving that prefix by hand.

**Split into two files, for a boundary reason, not a style choice.**
`i18n/navigation.tsx` is `"use client"` — `Link`, `usePathname`, and
`useRouter` all read the active locale via `next/navigation`'s `useParams()`
hook (`i18n/navigation.tsx:9`), so they can only run in Client Components.
`i18n/redirect.ts` has no such restriction: `redirect()` and `getPathname()`
are plain functions with no hook inside them, so they're safe to import from
Server Actions and the DAL (`feature/auth/actions.ts:3`,
`feature/auth/dal.ts:4`) as well as from the client module above, which
imports `getPathname` from it internally (`i18n/navigation.tsx:7`) to build
every locale-prefixed `href` it produces.

```ts
// i18n/redirect.ts:15
export function redirect({
  href,
  locale = defaultLocale,
}: {
  href: string;
  locale?: AppLocale;
}): never {
  return nextRedirect(getPathname({ href, locale }));
}
```

`verifySession()` in the DAL uses exactly this to bounce an unauthenticated
request before render (`feature/auth/dal.ts:12-13`):

```ts
if (!token) {
  redirect({ href: "/login", locale });
}
```

On the client side, `useRouter()` (`i18n/navigation.tsx:39`) wraps
`next/navigation`'s router rather than replacing it — it spreads the real
router first, then overrides `push`/`replace` to run the target through
`getPathname()`:

```ts
return {
  ...router,
  push(href: string, options?: { locale?: AppLocale }) {
    router.push(getPathname({ href, locale: options?.locale ?? activeLocale }));
  },
  replace(href, options) {
    /* same pattern */
  },
};
```

`LocaleSwitcher` is the one place that actually passes an explicit `locale`
override — every other call site lets it default to whatever locale is
currently active:

```ts
// components/locale-switcher.tsx:20-22
function handleLocaleChange(nextLocale: AppLocale) {
  router.replace(pathname, { locale: nextLocale });
}
```

| Export        | Where                    | What it's for                                                                                           |
| ------------- | ------------------------ | ------------------------------------------------------------------------------------------------------- |
| `Link`        | `i18n/navigation.tsx:19` | Drop-in `next/link` replacement; auto-prefixes `href` unless it looks like an absolute URL              |
| `usePathname` | `i18n/navigation.tsx:29` | Returns the **locale-stripped** pathname (`/en/dashboard` → `/dashboard`)                               |
| `useRouter`   | `i18n/navigation.tsx:39` | `push`/`replace` that accept `{ locale }` to switch locale while navigating                             |
| `getPathname` | `i18n/redirect.ts:4`     | Pure `{ href, locale } → "/locale/href"` — the one function everything else in this section is built on |
| `redirect`    | `i18n/redirect.ts:15`    | Server-safe locale-prefixed redirect; throws (`never`), same contract as `next/navigation`'s `redirect` |

## Section 6 — Rich text: why `<Trans>` needed its own component

**The problem:** one string, `common.json`'s `"tagline"`
(`"Banking made <brand>simple</brand>."`), needs part of it wrapped in a
styled `<span>` — not just a plain interpolated value.

`react-i18next`'s answer to this is `<Trans>`, which parses the tag syntax in
the translation string and swaps `<brand>` for a real React element supplied
via `components`. But the home page that renders this string is a **Server
Component** (`app/[locale]/(public)/page.tsx`) — and per Section 0, `<Trans>`
depends on `react-i18next`'s hook-based context, so it cannot be called
there directly. Passing the server-obtained `t`/`i18n` down as props doesn't
work either: an `i18next` instance is a stateful class instance with methods,
which isn't something a Server Component can hand to a Client Component as a
prop (RSC boundaries only serialize plain data).

The fix, `components/tagline.tsx`, sidesteps both problems by being its own
tiny Client Component that reads from context instead of props — context it
can see because it renders somewhere under the root layout's
`TranslationsProvider`:

```tsx
"use client";
import { Trans } from "react-i18next";

export function Tagline() {
  return (
    <Trans
      i18nKey="tagline"
      ns="common"
      components={{
        brand: <span className="text-zinc-500 dark:text-zinc-400" />,
      }}
    />
  );
}
```

The home page just renders `<Tagline />` (`app/[locale]/(public)/page.tsx:57`)
in place of what would otherwise have been an inline `<Trans>` call.

**Worth knowing before you add more rich text:** this pattern — a
one-off Client Component per rich-text string — doesn't scale gracefully if
more strings need this treatment. There's no shared "RichText" abstraction
yet; each one currently gets its own file like `Tagline`.

## Cross-feature coupling

- **Auth reaches into i18n routing, not the other way around.**
  `feature/auth/dal.ts` and `feature/auth/actions.ts` both import `redirect`
  from `i18n/redirect.ts` so that an auth-driven redirect (unauthenticated
  DAL check, post-logout) still lands on the locale-prefixed URL instead of a
  bare `/login`. If someone refactors `i18n/redirect.ts`'s signature, both
  auth call sites break, even though neither file is "about" auth otherwise.
- **`proxy.ts` does locale redirect and auth redirect in the same request
  pass**, in that order (`proxy.ts:29` locale check first, then the
  auth/`SESSION_COOKIE_NAME` checks at `proxy.ts:35` onward). A request with
  no locale prefix redirects to add one _before_ the auth check ever runs —
  so an unauthenticated hit on `/dashboard` (no locale) first becomes
  `/en/dashboard` via one redirect, then `/en/login` via a second one on the
  next request, not a single combined redirect.
- **`LogoutButton` and `SiteHeader` take `locale` as an explicit prop**
  (`components/auth/logout-button.tsx:5`, `components/navigation/site-header.tsx`)
  rather than reading it from route params themselves — worth knowing if you
  move either component to a route that doesn't already have `locale` in
  scope to pass down.

## Presentational layer

`components/locale-switcher.tsx` and `components/theme-toggle.tsx` are both
plain Client Components that call `useTranslation("common")` purely for
button/menu labels (`t("language")`, `t("toggleTheme")`, etc.) — neither owns
any translation-loading logic of its own; they're consumers of the context
`TranslationsProvider` sets up. `LocaleSwitcher` additionally calls
`useRouter()`/`usePathname()` from `i18n/navigation.tsx` to actually perform
the locale switch (Section 5) — that router/pathname logic is the only part
of the component that isn't purely presentational.

## Data flow

**Initial request, no locale in the URL:**

```
GET /dashboard
  → proxy.ts: splitLocale() finds no locale prefix
  → redirect to /en/dashboard
  → app/[locale]/layout.tsx: isAppLocale("en") ✓, getMessages("en") loads all 3 namespaces
  → TranslationsProvider builds one i18next instance, seeded with those messages
  → (protected)/layout.tsx: verifySession() — no session cookie → redirect({ href: "/login", locale: "en" })
  → /en/login renders: getTranslation("en", "auth") for the page title (Server Component),
    LoginFormScreen's useTranslation("auth") for the form (Client Component, same context)
```

**Switching locale via `LocaleSwitcher` while already on a page:**

```
User clicks "ID" in the dropdown
  → handleLocaleChange("id") → router.replace(pathname, { locale: "id" })
  → i18n/navigation.tsx's useRouter.replace → next/navigation router.replace("/id" + pathname)
  → app/[locale]/layout.tsx re-renders server-side with locale="id", loads id/*.json
  → TranslationsProvider receives new locale/messages props (same instance, not remounted)
  → effect: addResourceBundle("id", ns, ...) for each namespace not already loaded, then changeLanguage("id")
  → every useTranslation()/<Trans> consumer re-renders with Indonesian strings
```

## Adding a new locale

1. Add the locale code to `locales` in `i18n/settings.ts:1`.
2. Create `messages/<locale>/{common,auth,transfer}.json` with the same keys
   as `messages/en/*.json`.
3. No other code changes — `i18n/server.ts`, `TranslationsProvider`, `proxy.ts`,
   and `generateStaticParams` in the root layout all read from `locales`.

## Adding a new feature namespace

1. Create `messages/en/<feature>.json` and `messages/id/<feature>.json`.
2. Add `"<feature>"` to the `namespaces` tuple in `i18n/settings.ts:10`.
3. Consume it with `useTranslation("<feature>")` (client) or
   `getTranslation(locale, "<feature>")` (server).

Naming convention: lowercase, singular file/namespace names
(`auth.json`/`"auth"`, not `Auth.json`/`"Auth"` — that PascalCase convention
was specific to the old `next-intl` setup and was dropped along with it).

## Final reference table

| Symbol                                                                    | File                                   | Purpose                                                            |
| ------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------ |
| `locales`, `defaultLocale`, `isAppLocale`, `namespaces`, `getI18nOptions` | `i18n/settings.ts`                     | Shared locale/namespace config                                     |
| `getTranslation`, `getMessages`                                           | `i18n/server.ts`                       | Server Component translation reads                                 |
| `TranslationsProvider`                                                    | `components/translations-provider.tsx` | Client-side `i18next` instance + `<I18nextProvider>`               |
| `Tagline`                                                                 | `components/tagline.tsx`               | `<Trans>`-based rich text, isolated as a Client Component          |
| `Link`, `usePathname`, `useRouter`                                        | `i18n/navigation.tsx`                  | Locale-aware client navigation                                     |
| `redirect`, `getPathname`                                                 | `i18n/redirect.ts`                     | Locale-aware redirect/path building, server- and client-safe       |
| `proxy` (default export)                                                  | `proxy.ts`                             | Locale detection/redirect + auth-path redirect, runs before render |
| `useTranslation`, `<Trans>`                                               | `react-i18next` (library)              | Client Component translation hooks                                 |

## Verification performed

- `yarn tsc --noEmit` — clean.
- `yarn lint` — clean (aside from two pre-existing, unrelated warnings in
  `hooks/use-mobile.ts` and `providers/theme-provider.tsx`).
- `yarn build` — succeeds; `/en` and `/id` (home, login, register) prerender
  via `generateStaticParams`, `/dashboard` stays dynamic (behind auth).
- Manual browser pass (Playwright): home page renders in `en` and `id`
  including the `<Trans>`-driven tagline; `LocaleSwitcher` updates the URL and
  every visible string instantly without a full page reload; dark mode
  toggle's labels stay translated; visiting `/en/dashboard` signed out
  redirects to `/en/login` (proxy + DAL both verified).

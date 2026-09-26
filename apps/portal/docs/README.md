# Docs

Deep-dive docs for the portal app, each written "as implemented" and cited
to file:line so they stay grep-able as the code moves (see
[`DOC_STRUCTURE.md`](DOC_STRUCTURE.md) for the style/template to follow when
adding one).

## Subsystems

| Doc | Covers |
|---|---|
| [SETUP_API_PROVIDER.md](SETUP_API_PROVIDER.md) | Axios client layer, `BaseClient`, the request/response interceptor (auth header, timezone, logging, 401 handling) |
| [SETUP_LOGGING.md](SETUP_LOGGING.md) | The winston logger: levels, format, PII/secret redaction, where it's called from |
| [SETUP_REACT_QUERY.md](SETUP_REACT_QUERY.md) | TanStack Query setup, query key conventions, SSR prefetch/hydration |
| [SETUP_AUTH_FORMS.md](SETUP_AUTH_FORMS.md) | Login/register forms |
| [SETUP_AUTH_ROUTE_GROUPS.md](SETUP_AUTH_ROUTE_GROUPS.md) | `(public)`/`(protected)` route groups, session verification |
| [SETUP_REACT_FORM.md](SETUP_REACT_FORM.md) | react-hook-form + Zod conventions |
| [FORM_ERROR_TRANSLATION.md](FORM_ERROR_TRANSLATION.md) | Mapping API/Zod validation errors to translated messages |
| [SETUP_INTERNATIONALIZATION.md](SETUP_INTERNATIONALIZATION.md) | react-i18next setup, locales, namespaces |
| [SETUP_SHADCN_THEME.md](SETUP_SHADCN_THEME.md) | shadcn/ui + Base UI, `next-themes`, brand vs theme color tokens |
| [SETUP_TOP_PROGRESS_BAR.md](SETUP_TOP_PROGRESS_BAR.md) | Route-change progress bar |
| [SETUP_NAVIGATION_GUARD.md](SETUP_NAVIGATION_GUARD.md) | "Unsaved changes" navigation guard: global store, shared confirm dialog, `beforeunload`, back/forward interception, `GuardedLink` |
| [SETUP_FAVICON.md](SETUP_FAVICON.md) | Favicon/icon/apple-icon file conventions, the web app manifest, favicon.io asset provenance |
| [SEO_GUIDE.md](SEO_GUIDE.md) | Current SEO gap audit (metadata, robots/sitemap, hreflang, noindex) and an implementation playbook to close them |
| [CREATE_ACCOUNT_MODAL.md](CREATE_ACCOUNT_MODAL.md) | `components/create-account-model/*`: the two-step create-account wizard, its Zustand store, and its navigation-guard wiring |
| [SETUP_DATA_MASKING.md](SETUP_DATA_MASKING.md) | msgpack + zlib packing of Server Action results (`runMaskingServerAction`/`unpackActionResult`): what it does and doesn't hide, the unmasked SSR prefetch path, dead/duplicate code |
| [MIGRATION_TO_FULL_SSR.md](MIGRATION_TO_FULL_SSR.md) | Not-yet-implemented plan for moving all backend calls (mutations + interactive reads) server-side via Server Actions, so the browser never talks to `../core-service` directly, and the session cookie can become `httpOnly` |

## Meta

- [IMPROVEMENT_OPPORTUNITIES.md](IMPROVEMENT_OPPORTUNITIES.md) — living list
  of known gaps/tech debt, cited to file:line. Check before "fixing"
  something that looks wrong in passing — it may be a tracked, deliberate
  tradeoff.
- [DOC_STRUCTURE.md](DOC_STRUCTURE.md) — the documentation style/template
  used across this folder.
- [archive/](archive/) — completed one-off task prompts, kept for history.

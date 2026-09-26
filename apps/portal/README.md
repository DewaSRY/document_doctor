# Portal

The Next.js frontend for **Simple Bank**, a ledger-based core banking demo.
It's a customer-facing portal for account management, deposits, and
account-to-account transfers, talking to the Go backend in
[`../core-service`](../core-service).

See the [monorepo README](../../README.md) for how the two apps fit together.

## Stack

- **Next.js 16** (App Router), React 19, TypeScript
- **TanStack Query** for server state, **Zustand** for local multi-step
  modal/wizard state
- **Axios** with a single interceptor for auth headers, request logging, and
  401 → logout handling
- **shadcn/ui** (Base UI primitives) + **Tailwind v4** + `next-themes`
  (light/dark/system)
- **react-i18next** — `en` and `id` locales
- **winston** for structured, PII-redacting server-side logging

## Getting started

1. Make sure `apps/core-service` (the backend) is running — see the
   [monorepo README](../../README.md) for `docker compose up`.
2. Set `NEXT_PUBLIC_API_URL` in `.env.local` (defaults to
   `http://localhost:8080/api/v1` if unset).
3. Install and run:

   ```bash
   yarn install
   yarn dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

Before committing, verify with:

```bash
yarn lint
yarn tsc --noEmit
yarn build
```

There's no automated test suite or CI for this app yet — these three
commands are the closest thing to a gate.

## Project structure

| Path | What lives there |
|---|---|
| `app/` | Routes. `[locale]/(public)` = logged-out pages, `[locale]/(protected)` = logged-in pages. |
| `feature/<name>/` | Domain logic per feature: API client, TanStack Query hooks, types, Zod schemas. |
| `components/` | UI, organized by feature/domain (not by component type). |
| `lib/api/` | Shared Axios instance + the one request/response interceptor. |
| `lib/logger.ts` | Structured winston logger with secret redaction. |
| `i18n/`, `messages/` | Locale config and translation JSON, one file per namespace per locale. |
| `providers/` | App-wide client providers (theme, React Query). |
| `docs/` | Deep-dive docs per subsystem — read before extending one. |

## Docs

Start with [`docs/README.md`](docs/README.md) for an index, or go straight
to [`docs/IMPROVEMENT_OPPORTUNITIES.md`](docs/IMPROVEMENT_OPPORTUNITIES.md)
for known gaps and tech debt.

For AI coding agents: project-specific conventions live in
[`AGENTS.md`](AGENTS.md) (imported by `CLAUDE.md`).

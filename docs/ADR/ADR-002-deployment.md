# ADR-002: Deploy the Portal on Cloudflare Workers and AI on EC2

## Status

Accepted — 2026-10-02

## Context

The application has two independently deployed services:

| Part | Stack | Responsibility |
| --- | --- | --- |
| Portal | Next.js 16 App Router on Cloudflare Workers via OpenNext | SEO pages, browser UI, authenticated server-side API proxy |
| AI Translation | Python/FastAPI, PyTorch, LibreOffice, PostgreSQL on AWS EC2 | Model inference and document/file processing |

The Portal uses Server Actions, streaming Route Handlers, multipart requests up to 50 MB, and synchronous translation requests that can take several minutes. Running inference on Workers is not practical; putting a long-running AI request behind Cloudflare's ordinary proxied-origin path risks a 524 timeout. The browser must not receive the backend credential or call the AI API directly.

## Decision

1. Deploy the Next.js app to Cloudflare Workers with `@opennextjs/cloudflare` and Wrangler. Keep locale redirects in Next middleware, serve public routes as build-time static pages, and keep user/document/API routes dynamic and uncached.
2. Run FastAPI, PostgreSQL, and Caddy on the existing EC2 host. Caddy obtains and renews public HTTPS certificates for a DNS-only API hostname. Do not put the API hostname behind Cloudflare's orange-cloud proxy while translations are synchronous.
3. Authenticate every AI API path except `/api/health` with a shared, high-entropy bearer token. Store the Portal copy as a Cloudflare Worker secret and the EC2 copy in SSM Parameter Store `SecureString`; EC2 receives narrowly scoped read permission through an instance role.
4. Keep uploaded documents and model files off the Worker. Stream file-tool responses and document downloads. Persist Hugging Face model files in a named Docker volume so container updates do not force redownloads.
5. Default SSH ingress to closed. If SSH is enabled, restrict it to a trusted CIDR. Keep the API and Postgres container ports off the public interface.
6. Do not add R2/ISR cache infrastructure until routes need runtime revalidation. Public pages are statically generated and fingerprinted assets are cached as immutable.

## Consequences

### Positive

- Public pages and immutable assets are delivered on Cloudflare's edge while the expensive model remains on EC2.
- Browser requests never contain the AI bearer credential; backend HTTP requests require the token and production Portal URLs require HTTPS.
- The Portal scales independently of model memory and CPU requirements. SSM keeps runtime secrets out of EC2 user data.
- Existing synchronous processing, Postgres schema, and AI service are preserved without introducing a job queue or extra application host.

### Negative and constraints

- Translation remains synchronous; callers must remain connected and the backend hostname must remain DNS-only to avoid proxy duration limits.
- The AI service and database still share one EC2 host and are a single point of failure. NLLB inference is CPU- and memory-intensive; the default `t3.xlarge` and 60 GiB gp3 volume are conservative starting values and should be measured under real load.
- The current `facebook/nllb-200-distilled-600M` checkpoint is licensed CC-BY-NC-4.0, and its model card says it is not released for production or document translation. It must not serve production commercial traffic unless separately licensed or replaced with a commercially permitted model.
- Cloudflare Workers Free has a low per-request CPU limit; use Workers Paid for production SSR and validate limits with the Worker preview and real workloads.
- Terraform state contains secret inputs and generated values. Use encrypted, access-controlled remote state with locking before applying this infrastructure in production.

## Deployment

See [DEPLOYMENT.md](../DEPLOYMENT.md) for the current setup, commands, required variables, and verification checklist. Do not use the superseded same-host Portal Docker runbook from earlier revisions of this ADR.
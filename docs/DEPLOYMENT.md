# Production Deployment

The Portal runs as a Next.js 16 Cloudflare Worker using OpenNext. The AI Translation API, PostgreSQL, and Caddy run together on EC2. The browser talks only to the Portal; the Worker calls the API over HTTPS with a shared bearer token.

## Portal: Cloudflare Workers

Use Node 20 or newer and Yarn 1.22.22. From `apps/portal`:

```sh
yarn install --frozen-lockfile
npx wrangler login
```

In the Worker settings, add the non-secret runtime variable `AI_TRANSLATION_API_URL`, including `/api/v1`, for example `https://api.example.com/api/v1`. Create the secret interactively:

```sh
npx wrangler secret put AI_TRANSLATION_API_TOKEN
```

Set `NEXT_PUBLIC_SITE_URL` to the canonical public HTTPS origin for the build. The build validates it because it is inlined into canonical URLs and the sitemap.

```sh
NEXT_PUBLIC_SITE_URL=https://www.example.com yarn deploy
```

`yarn deploy` builds with OpenNext and deploys while preserving runtime variables and secrets configured in Cloudflare. `yarn build` runs the standard Next.js build only. `yarn preview` builds and runs the app in the local Workers runtime. For local preview, create `.dev.vars` from `.dev.vars.example`; do not commit `.dev.vars`.

The app uses Next 16's `middleware.ts` convention because OpenNext currently builds it without its experimental Node Proxy path. Next 16 deprecates that filename in favor of `proxy.ts`; re-test middleware runtime support before migrating it. Public pages are statically generated. The editor and API handlers are dynamic. ISR/R2 cache resources are intentionally not provisioned because current public pages are build-time static and do not require revalidation.

## AI API: EC2

Use an AWS account, Docker Buildx, Terraform, a DNS hostname, and a Docker registry account. Set `api_domain`, `acme_email`, and a random URL-safe `portal_api_token` of at least 32 characters in `infra/terraform/terraform.tfvars`. Set the same token as the Cloudflare secret above. Replace the example SSH CIDR with your own IP, or leave SSH closed and use AWS Systems Manager Session Manager.

Create a DNS-only A record for `api_domain` pointing at the Elastic IP. Do not orange-cloud/proxy the API hostname: Caddy needs ports 80 and 443 for automatic certificates, and the Cloudflare proxy can time out on long synchronous translations. Do not expose port 8000 or PostgreSQL to the internet.

Initialize/apply once, then build, push, and redeploy the service:

```sh
make tf-init
make tf-apply
make deploy
```

Terraform stores the API token and database password in SSM Parameter Store as a `SecureString`; EC2 reads that one parameter through a narrowly scoped instance role. Protect the Terraform state: it still contains secret inputs and generated values. Prefer an encrypted, access-controlled remote state backend with locking before production use.

The instance runs NLLB-200 distilled 600M on CPU. The 16 GB `t3.xlarge` default and 60 GiB gp3 disk are conservative: the model cache persists in a named Docker volume across container replacements. The Docker image excludes development dependencies. First boot downloads the model once; subsequent restarts reuse the volume. Allow enough time for model initialization before health checks pass.

**Do not apply the EC2 production deployment with the current model.** Its model card declares CC-BY-NC-4.0, says it is not released for production, and excludes document translation. Terraform therefore blocks EC2 creation unless `model_license_allows_production` is explicitly set true. Do not set it true for the current checkpoint; first replace it with a production-authorized model or obtain an applicable license, then verify quality and runtime compatibility.

For local service testing, create `apps/ai-translation/.env` from `.env.example`, then run from the repository root:

```sh
docker compose up --build -d
curl http://127.0.0.1:8081/api/health
```

The local compose file publishes the API and PostgreSQL only on loopback.

## Runtime Configuration

Portal build-time value:

- `NEXT_PUBLIC_SITE_URL`: required canonical HTTPS origin; public by design.

Portal Worker runtime values:

- `AI_TRANSLATION_API_URL`: HTTPS origin plus `/api/v1`; not secret.
- `AI_TRANSLATION_API_TOKEN`: shared bearer secret; set as a Cloudflare Worker secret, never as `NEXT_PUBLIC_*`.

AI service values are set through Terraform and its SSM SecureString. The backend permits unauthenticated access only to `/api/health`; production Swagger/OpenAPI routes are disabled. CORS is not needed for the Worker-to-EC2 call.

## Verification

From the repository root:

```sh
yarn --cwd apps/portal lint
yarn --cwd apps/portal build
yarn --cwd apps/portal build:worker
uv run --project apps/ai-translation pytest
uv run --project apps/ai-translation ruff check apps/ai-translation
docker compose config --quiet
docker compose up --build -d
```

Cloudflare Workers Free CPU allowance is too small for reliable Next SSR; use Workers Paid and load-test long translations and concurrent uploads. Workers isolate memory is limited to 128 MiB, so keep upload/download paths streaming and avoid buffering large payloads in Server Actions.
# ADR-002: Deploy Portal and AI Service Together on One EC2 Host

## Status

Proposed — 2026-09-29

## Context

The application has two deployable parts:

| Part             | Stack                        | Deployment today                                                  |
| ---------------- | ---------------------------- | ----------------------------------------------------------------- |
| `apps/ai-translation` | Python / FastAPI, Qwen2.5-1.5B on CPU, LibreOffice | Automated: Terraform (`infra/terraform`) creates one EC2 `t3.xlarge` running ai-translation + Postgres + nginx with docker compose. `make deploy` builds, pushes and redeploys. |
| `apps/portal`    | Next.js 16 (App Router, Server Actions) | Not deployed. No Dockerfile, no hosting config.            |

The product will be **commercial and ad-supported** (e.g. Google AdSense).
That adds requirements the current setup does not meet:

1. **A real domain over HTTPS.** Ad networks will not approve a site on a
   bare IP over HTTP (today: `http://<elastic-ip>:80`).
2. **A host that allows commercial use.**
3. **Public pages that load fast and are indexable** — ad revenue follows
   search traffic, and the portal is already built for SEO (sitemap,
   hreflang, JSON-LD).
4. **Privacy obligations**: a privacy policy, a consent banner for EEA/UK
   visitors, `ads.txt`, and honouring the README's promise of no long-term
   document storage.

The code sets these constraints:

- **Translation is synchronous.** `translateDocumentAction`
  (`apps/portal/feature/translator/actions.ts`) waits for the whole
  translation. The client allows up to 15 minutes
  (`feature/translator/client.ts`), and nginx allows 900 s.
- **Large request bodies.** Documents up to 5 MB go through a Server Action
  (`bodySizeLimit: "6mb"`), and PDF merges up to 50 MB go through
  `app/api/tools/[tool]/route.ts`.
- **The portal is the only client of the AI service.** The browser never
  calls the service directly (`feature/translator/config.ts` is
  `server-only`).
- **`NEXT_PUBLIC_*` variables are fixed at build time.**
  `NEXT_PUBLIC_SITE_URL` sets every canonical URL and the sitemap, so it
  must be passed when the image is built.

## Decision

1. **Run the portal as a container on the existing EC2 host**, alongside
   ai-translation and Postgres in the same compose stack.
2. **Put nginx in front of the portal only.** ai-translation is no longer
   reachable from the internet. The portal calls it over the internal
   Docker network at `http://ai-translation:8000/v1`.
3. **Handle HTTPS on the host with Let's Encrypt.** nginx listens on 80
   (which redirects to HTTPS) and on 443.
4. **Use DNS-only records (no CDN proxy) for now**, because proxied requests
   on Cloudflare's free plan time out after 100 s.
5. **Tag images with the git SHA** rather than only `latest`, so a
   deployment can be rolled back.
6. **Show ads only on public content pages**: the landing page and tool
   pages. Never on the translation editor.

## Alternatives Considered

### Vercel for the portal, EC2 for the AI service

This is the default choice for Next.js, but it breaks on this app:

- The Hobby plan does not allow commercial use, and ads count as
  commercial use. You would need Pro (about $20/month per member).
- The request body limit for a Vercel Function is 4.5 MB. A 5 MB document
  or a 50 MB PDF merge fails before it reaches the code.
- The maximum function duration is below the 15 minutes a synchronous
  translation can take.

This becomes a good option again once translation is asynchronous and
uploads go straight to object storage. See Follow-ups.

### Cloudflare proxy (orange cloud) in front of EC2

Cloudflare gives a free CDN, TLS and DDoS protection. On non-Enterprise
plans, though, a proxied request that takes longer than 100 s fails with a
524 error. That would break every long translation.

Revisit this after the asynchronous-jobs change. Until then, use Cloudflare
(or any other registrar) as **DNS only**.

### AWS Application Load Balancer + ACM certificate

This gives managed TLS, and the idle timeout can go up to 4000 s. It costs
at least about $16–20/month more, for a single instance that doesn't need
load balancing. That goes against the project's low-cost goal.

### A separate EC2 instance for the portal

This isolates the portal from model CPU spikes, but costs a second
instance, a second Elastic IP and more Terraform. The `t3.xlarge` (16 GB)
has room for a Next.js server, which uses about 300–500 MB.

## Consequences

### Positive

- One host, one compose stack, one `make deploy`. The cheapest setup that
  meets the ad-network requirements.
- The AI service, including its FastAPI `/docs`, is no longer exposed
  publicly.
- nginx rate-limits real visitors per IP, not the portal's single IP.
- Portal-to-service calls stay on the host: no public-internet latency and
  no egress cost.

### Negative

- **Single point of failure.** If the instance goes down, the whole site is
  down.
- **Noisy neighbour.** CPU inference can slow page rendering for the
  portal. That hurts Core Web Vitals, and through them SEO and ad revenue.
- **`t3` is burstable.** Sustained inference uses up CPU credits, and in
  "unlimited" mode (the default for t3) that shows up as extra charges.
- **No CDN** for static assets until the Cloudflare proxy can be turned on.
- **TLS renewal** is now your responsibility (automated below, but it must
  be monitored).

---

## Deployment Guide (Step by Step)

Steps 1–4 are **one-time repository changes** that this decision requires.
They are not in the repo yet. Steps 5–12 are the **deployment runbook**.

### Prerequisites

- An AWS account and an IAM user with EC2 permissions. Run
  `aws configure` locally.
- Terraform ≥ 1.5, Docker with `buildx`, and `make`.
- A Docker Hub account, with `docker login` done. Images go to `sdewa/*`.
- A domain name, for example `documentdoctor.com`.
- A Hugging Face read token (optional, avoids download rate limits).

### Step 1 — Add a Dockerfile for the portal

Enable standalone output in `apps/portal/next.config.ts`, so the image
ships only the files the server needs:

```ts
const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // ...existing config
};
```

Create `apps/portal/Dockerfile`:

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* are inlined at build time — they must be build args.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_ADSENSE_CLIENT
ARG NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
ARG NEXT_PUBLIC_BING_SITE_VERIFICATION
ENV NEXT_TELEMETRY_DISABLED=1
RUN yarn build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
USER app
EXPOSE 3000
CMD ["node", "server.js"]
```

Add `apps/portal/.dockerignore` containing `node_modules`, `.next` and
`.env*`.

Add targets to `apps/portal`'s Makefile (create it). This mirrors the
backend's `docker-push`:

```make
IMAGE_NAME := sdewa/portal
IMAGE_TAG  ?= $(shell git rev-parse --short HEAD)
SITE_URL   ?= https://documentdoctor.com

docker-push:
	docker buildx build --platform linux/amd64 \
		--build-arg NEXT_PUBLIC_SITE_URL=$(SITE_URL) \
		--build-arg NEXT_PUBLIC_ADSENSE_CLIENT=$(ADSENSE_CLIENT) \
		-t $(IMAGE_NAME):$(IMAGE_TAG) -t $(IMAGE_NAME):latest --push .
```

> Build on `linux/amd64`. An image built natively on an Apple Silicon Mac
> fails on EC2 with `exec format error`.

### Step 2 — Add the portal to the production compose stack

In `infra/terraform/docker-compose.prod.yaml`, add a `portal` service and
make nginx depend on it:

```yaml
  portal:
    image: ${portal_image}
    container_name: portal
    restart: unless-stopped
    networks:
      - ai-translation-net
    environment:
      AI_TRANSLATION_API_URL: http://ai-translation:${app_port}/v1
      NODE_ENV: production
    depends_on:
      - ai-translation

  nginx:
    # ...
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
      - /var/www/certbot:/var/www/certbot:ro
    depends_on:
      - portal
```

In `main.tf`, pass `portal_image = var.portal_image` into the
`docker_compose_yml` template. Add these to `variables.tf`:

```hcl
variable "portal_image" {
  description = "Portal image (linux/amd64). Pin to a git-SHA tag for rollbacks."
  type        = string
  default     = "sdewa/portal:latest"
}

variable "domain_name" {
  description = "Public domain the portal is served on, e.g. documentdoctor.com"
  type        = string
}
```

### Step 3 — Point nginx at the portal and add HTTPS

Rewrite `infra/terraform/nginx.conf.tpl`. The upstream changes from
`ai-translation` to `portal`, and the rate limiting and 900 s timeouts
stay:

```nginx
limit_req_zone $binary_remote_addr zone=portal:10m rate=${rate_limit_rps}r/s;

server {
    listen 80;
    server_name ${domain_name} www.${domain_name};

    # Let's Encrypt HTTP-01 challenge (used by renewals).
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://${domain_name}$request_uri; }
}

server {
    listen 443 ssl;
    http2 on;
    server_name ${domain_name};

    ssl_certificate     /etc/letsencrypt/live/${domain_name}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${domain_name}/privkey.pem;

    client_max_body_size ${client_max_body_size};

    # Hashed build assets: cache hard, skip the rate limiter.
    location /_next/static/ {
        proxy_pass http://portal:3000;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        limit_req zone=portal burst=${rate_limit_burst} nodelay;
        limit_req_status 429;

        proxy_pass http://portal:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Synchronous translation inside a Server Action.
        proxy_read_timeout ${proxy_timeout_seconds}s;
        proxy_send_timeout ${proxy_timeout_seconds}s;
    }
}
```

Pass `domain_name = var.domain_name` into the `nginx_conf` templatefile.
In `main.tf`, change the security group ingress from `var.nginx_port` to
two rules, one for port **80** and one for **443**.

Then update the local `apps/nginx/nginx.conf` to match. It has to be kept
in sync by hand.

> **Rate limit — important.** After this change, every request to
> ai-translation comes from the portal container's IP. The service's own
> limiter (`RATE_LIMIT`, slowapi keyed on `get_remote_address`) then
> applies to **all users combined**. nginx now does the per-visitor
> limiting, so raise `app_rate_limit` in `terraform.tfvars` (for example
> `"1000/minute"`). Treat it as a global safety valve, not a per-user
> limit.

### Step 4 — Add the ad and compliance pieces to the portal

1. **`apps/portal/public/ads.txt`** — the line from your AdSense account:
   `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`.
   `proxy.ts` skips paths that contain a dot, so it is served as-is at
   `/ads.txt`.
2. **Ad script**: load it once in `app/[locale]/layout.tsx` with
   `next/script` (`strategy="afterInteractive"`), and only when
   `NEXT_PUBLIC_ADSENSE_CLIENT` is set. Dev builds and preview builds then
   never serve ads.
3. **An `<AdSlot>` client component** that renders
   `<ins class="adsbygoogle">` and calls `adsbygoogle.push({})` on mount.
   **Give each slot a fixed min-height**, so ads loading in don't cause
   layout shift (CLS), which hurts SEO.
4. **Placement.** Put ads on the landing page (`app/[locale]/page.tsx`) and
   the server-rendered details section of tool pages (`ToolDetails` in
   `_tools/tool-page.tsx`).
   **Do not** put ads on `/[locale]/translate/[documentId]/edit`. It shows
   the user's private document, it is `noindex`, and ad networks' policies
   forbid ads on pages without publisher content. Be careful with ads on
   the "translating…" progress screen too; check it against AdSense's
   policy on screens without content.
5. **Privacy policy and terms pages.** Add them to `PUBLIC_PATHS`, both
   locales (`messages/en`, `messages/id`), and link them in
   `landing-footer.tsx`. Disclose ad cookies and how long uploaded
   documents are kept.
6. **Consent banner.** EEA/UK/Swiss traffic needs a Google-certified CMP.
   The simplest is AdSense's own *Privacy & messaging → European
   regulations* message, turned on in the AdSense dashboard; no code
   needed.

### Step 5 — Point the domain at the server

1. Run Terraform first (step 7) to get the Elastic IP, or reuse the
   existing one: `make tf-output`.
2. At your DNS provider, create:
   - `A  documentdoctor.com      → <elastic-ip>`
   - `A  www.documentdoctor.com  → <elastic-ip>`
3. If you use Cloudflare DNS, set both records to **DNS only (grey
   cloud)**. See Alternatives Considered for why.
4. Check with `dig +short documentdoctor.com`. It should return the Elastic
   IP.

### Step 6 — Configure Terraform

```bash
cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars
```

Edit `terraform.tfvars` (it is gitignored, so never commit it):

```hcl
docker_image    = "sdewa/ai-translation:<git-sha>"
portal_image    = "sdewa/portal:<git-sha>"
domain_name     = "documentdoctor.com"
hf_token        = "hf_..."
ssh_cidr_blocks = ["<your-ip>/32"]   # do NOT leave 0.0.0.0/0 in production
app_rate_limit  = "1000/minute"      # see the Step 3 note
```

> Terraform state (`*.tfstate`) is local and gitignored. It holds the
> generated database password and the SSH key. Back it up, or move it to
> an S3 backend before anyone else deploys.

### Step 7 — Build the images and create the infrastructure

```bash
# From the repo root
make -C apps/ai-translation docker-push
make -C apps/portal docker-push SITE_URL=https://documentdoctor.com ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX

make tf-init
make tf-validate
make tf-plan      # review: 1 instance, 1 SG, 1 EIP, key pair
make tf-apply
```

The first boot takes 10–20 minutes. It installs Docker, pulls about 10 GB
of images and downloads the Qwen model. ai-translation only opens its port
once the model is loaded.

Follow the progress:

```bash
$(terraform -chdir=infra/terraform output -raw ssh_command)
sudo tail -f /var/log/cloud-init-output.log
docker compose -f /opt/ai-translation/docker-compose.yml ps
```

### Step 8 — Get the TLS certificate (first time only)

nginx can't start on 443 until a certificate exists. Get the first one in
standalone mode, while nginx is stopped:

```bash
# On the instance
sudo dnf install -y certbot
cd /opt/ai-translation
sudo docker compose stop nginx
sudo certbot certonly --standalone \
  -d documentdoctor.com -d www.documentdoctor.com \
  --agree-tos -m you@example.com --non-interactive
sudo mkdir -p /var/www/certbot
sudo docker compose up -d nginx
```

Set up automatic renewal. The certificate is valid for 90 days, and
certbot renews it when 30 days are left:

```bash
sudo tee /etc/cron.d/certbot-renew >/dev/null <<'EOF'
0 3 * * * root certbot renew --webroot -w /var/www/certbot --quiet --deploy-hook "docker exec nginx nginx -s reload"
EOF
sudo certbot renew --webroot -w /var/www/certbot --dry-run
```

> Consider moving the step 8 commands into `user_data.sh.tpl`, so a
> rebuilt instance gets its certificate without manual work.

### Step 9 — Add the document retention job

The README promises no long-term document storage. Today, originals and
translations are kept in Postgres (`LargeBinary` columns) indefinitely.
That is a privacy and disk-space risk once real traffic arrives, and your
privacy policy has to state a retention period. Delete documents after 24
hours:

```bash
sudo tee /opt/ai-translation/retention.sql >/dev/null <<'EOF'
DELETE FROM document_media       WHERE created_at < now() - interval '24 hours';
DELETE FROM document_insertions  WHERE updated_at < now() - interval '24 hours';
DELETE FROM document_segments    WHERE created_at < now() - interval '24 hours';
DELETE FROM translated_documents WHERE created_at < now() - interval '24 hours';
EOF

sudo tee /etc/cron.d/document-retention >/dev/null <<'EOF'
15 * * * * root docker exec -i postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < /opt/ai-translation/retention.sql
EOF
```

> The better long-term home for this is a scheduled task inside
> ai-translation, so it is versioned with the schema.

### Step 10 — Verify the deployment

| Check                    | Command / URL                                                    | Expected                        |
| ------------------------ | ---------------------------------------------------------------- | ------------------------------- |
| HTTPS + redirect         | `curl -I http://documentdoctor.com`                              | `301` → `https://…`             |
| Portal                   | `https://documentdoctor.com`                                     | Redirects to `/en` or `/id`     |
| AI service health        | on the instance: `curl localhost:8000/health`                    | `200`                           |
| AI service not public    | `curl -m 5 http://<elastic-ip>:8000/health`                      | times out                       |
| End-to-end translation   | Upload a small DOCX on `/en/translate`, edit it, download it    | Works                           |
| SEO                      | `/robots.txt`, `/sitemap.xml`                                    | URLs use `https://documentdoctor.com` |
| Ads                      | `/ads.txt`                                                       | Your publisher line             |
| Editor has no ads        | Open an `/edit` page                                             | No ad slots                     |

Then:

1. Submit the site and `sitemap.xml` in Google Search Console and Bing
   Webmaster Tools. Put their tokens in
   `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` /
   `NEXT_PUBLIC_BING_SITE_VERIFICATION` and rebuild the portal.
2. Apply to AdSense with the domain. Approval needs real content, the
   privacy policy and `ads.txt`, and can take days to weeks.
3. Run Lighthouse on the landing page, with ads on and off. Keep CLS
   < 0.1.

### Step 11 — Deploy updates

```bash
# Backend change
make -C apps/ai-translation docker-push     # then set docker_image to the new tag in tfvars

# Portal change
make -C apps/portal docker-push SITE_URL=https://documentdoctor.com ADSENSE_CLIENT=ca-pub-...

# Roll it out (re-runs user_data over SSH: compose pull + up -d)
make tf-redeploy
```

`make tf-redeploy` renders the current config and re-applies it over SSH.
That covers new image tags, nginx changes and env changes. Don't run
`terraform apply` to change `user_data`. `main.tf` ignores those changes
on purpose, so the instance, its model cache and its database are not
replaced.

**Rollback:** set `docker_image` / `portal_image` back to the previous git
SHA in `terraform.tfvars`, then run `make tf-redeploy`.

### Step 12 — Operate it

- **Logs:** `docker logs -f portal`, `docker logs -f ai-translation`,
  `docker logs -f nginx`.
- **Uptime:** add a free external monitor (UptimeRobot, Better Stack) on
  `https://documentdoctor.com`. Downtime now costs ad revenue.
- **Cost:** a `t3.xlarge` in `ap-southeast-1` costs roughly $150/month
  on-demand, plus about $5 for 60 GB of gp3 and the EIP. A 1-year Compute
  Savings Plan cuts about 30–40%. Watch `CPUCreditBalance` in CloudWatch.
  If it sits near zero, move to a non-burstable `m7i.xlarge`, or set
  credit specification to `standard`.
- **Backups:** turn on an EBS snapshot policy (Data Lifecycle Manager,
  daily, keep 7). With 24 h retention, documents don't need backups, but
  the volume holds the model cache and the configuration.
- **Security:** keep `ssh_cidr_blocks` locked to your IP. `terraform
  output rendered_user_data` contains secrets in plain text, so never paste
  it anywhere.

---

## Follow-ups (Revisit This ADR When…)

1. **Translation becomes asynchronous.** The `translation_jobs` table
   already exists: submit → job id → poll. That removes the 15-minute
   requests. Once they're gone, Cloudflare's proxy (free CDN, DDoS
   protection) and Vercel become options, and the portal can move off the
   inference host.
2. **Traffic outgrows one instance.** Split the portal onto its own host
   (or Vercel), move Postgres to RDS (`db_host` is already supported), and
   consider a GPU instance or a hosted inference API for the model.
3. **Uploads move to S3 with presigned URLs.** That removes the
   request-body-size constraint and the `LargeBinary` storage in Postgres.

## Related

- ADR-001: Use Python for the Translation Service
- `infra/terraform/` — main.tf, docker-compose.prod.yaml, nginx.conf.tpl,
  user_data.sh.tpl
- `Makefile` — `deploy`, `tf-redeploy`
- `apps/portal/feature/translator/` — synchronous translation client

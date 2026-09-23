# AI Translation Server Deployment — As Implemented

## Who This Doc Is For

Anyone deploying `ai-translation` for the first time — to EC2, another VM, or any
Docker host — who wants the fastest correct path from a clean checkout to a
running gRPC server, without re-deriving it from the Dockerfile and Makefile.

This doc is verified against current source (`Dockerfile`, `Makefile`,
`pyproject.toml`, `.env.example`, and the `bootstrap`/`domain` modules as of this
writing) — not an idealized deploy process. Read the "Rough Edges" section before
you go to production: two of them (no TLS, no health check) matter for how you
wire this behind a load balancer or orchestrator.

---

## Section 1 — Architecture at a Glance

There is no separate deploy tooling (no Terraform/Ansible/Helm in this repo) —
the composition root for deployment is the [Dockerfile](../Dockerfile), and
`Makefile`'s `docker-*` targets are the reference invocation. Everything else
(model selection, port, weights persistence) is env-var driven, read once at
process start via `load_dotenv()` in [server.py:14](../src/ai_translation/bootstrap/server.py#L14).

| Concern | Owner (file) | Analogy |
|---|---|---|
| Container image build | [Dockerfile](../Dockerfile) — two-stage `uv sync` build, slim runtime | The shipping crate |
| Process entry point | `pyproject.toml:23` → `ai-translation-serve` script → [server.py:13](../src/ai_translation/bootstrap/server.py#L13) `serve()` | The ignition switch |
| gRPC bind/port | [server.py:15-22](../src/ai_translation/bootstrap/server.py#L15-L22), `GRPC_PORT` env var, default `50051` | The front door |
| Model selection & loading | [nllb_translator.py:21-45](../src/ai_translation/domain/translation/nllb_translator.py#L21-L45), lazily constructed via `get_translator()` ([`__init__.py:15-19`](../src/ai_translation/domain/translation/__init__.py#L15-L19)) | The engine |
| Model weight persistence | `HF_HOME` env var (Dockerfile) + named Docker volume (Makefile `docker-run`) | The fuel tank |
| Runtime config | `.env` (gitignored), loaded via `python-dotenv` in `server.py`/`main.py` | The dashboard |

The reason model loading is lazy (`get_translator()` builds the model on first
call, not at import time) matters for deploy: the container process starts and
binds the port immediately, but the **first** `Translate` RPC after a cold start
pays the full model-load latency (multi-second to tens of seconds depending on
whether weights are already cached — see Section 4). Don't mistake "port is
listening" for "ready to serve fast."

---

## Section 2 — Building the Image

```bash
make docker-build
# equivalent to:
docker build -t sdewa/ai-translation:latest .
```

The build is two-stage ([Dockerfile:1-42](../Dockerfile)):

1. **Builder stage** (`ghcr.io/astral-sh/uv:python3.12-bookworm-slim`) — installs
   locked dependencies via `uv sync --locked --no-dev`, split into a
   dependency-only layer and a full-project layer so dependency changes don't
   bust the cache on every source edit ([Dockerfile:13-22](../Dockerfile#L13-L22)).
2. **Runtime stage** (`python:3.12-slim-bookworm`) — copies the built `/app`
   from the builder, creates a non-root `app` user, and sets the runtime env
   (`HF_HOME`, `GRPC_PORT`, `PYTHONUNBUFFERED=1`).

The image's `CMD` is `ai-translation-serve` ([Dockerfile:42](../Dockerfile#L42))
— the gRPC server, not the `main.py` demo script. `EXPOSE 50051` documents the
port but doesn't publish it; you still need `-p` on `docker run`.

**Rough edge:** the image runs as a non-root `app` user with `--create-home
--home-dir /app` ([Dockerfile:27](../Dockerfile#L27)), so any volume you mount
under `/app` (e.g. the model cache in Section 4) must be writable by that user —
a root-owned bind mount will fail silently into permission errors on first
model download, not at container start.

---

## Section 3 — Configuration Reference

Copy [.env.example](../.env.example) to `.env` and fill in values. All of these
are read via `os.environ.get(...)` with defaults baked into the code — nothing
is required to boot.

| Variable | Required | Default | Read at | Purpose |
|---|---|---|---|---|
| `HF_TOKEN` | No | — | implicitly, by `huggingface_hub` | Avoids Hub rate limits on first weight download. Get one at huggingface.co/settings/tokens. |
| `GRPC_PORT` | No | `50051` | [server.py:15](../src/ai_translation/bootstrap/server.py#L15) | Port the gRPC server binds (`add_insecure_port`). |
| `NLLB_MODEL_NAME` | No | `facebook/nllb-200-distilled-600M` | [nllb_translator.py:27](../src/ai_translation/domain/translation/nllb_translator.py#L27) | Hub model id for the active (NLLB) translator, used when `MODEL_PATH` is unset. |
| `MODEL_PATH` | No | — | [nllb_translator.py:26](../src/ai_translation/domain/translation/nllb_translator.py#L26) | Local/mounted checkpoint dir; **overrides** `NLLB_MODEL_NAME` when set. See Section 4. |

**Rough edge — `MODEL_PATH` is shared and unvalidated.** Both
`NllbTranslatorModel` and the not-yet-wired `QwanTranslatorModel`
([qwan_translator.py:12-13](../src/ai_translation/domain/translation/qwan_translator.py#L12-L13))
resolve their default model via the *same* `MODEL_PATH` env var. Today only
`NllbTranslatorModel` is actually instantiated (`get_translator()` in
[`__init__.py:15-19`](../src/ai_translation/domain/translation/__init__.py#L15-L19)),
so this collision is latent, not live — but if `QwanTranslatorModel` gets wired
in later without renaming this var, setting `MODEL_PATH` for one model will
silently redirect the other too. There is also no check that a path set in
`MODEL_PATH` actually contains a valid `save_pretrained()` checkpoint — an
empty or wrong directory fails deep inside `transformers` with a generic
Hugging Face error (`Repo id must be in the form...`), not a project-specific
one. If you don't have a self-trained checkpoint to mount, leave `MODEL_PATH`
unset.

---

## Section 4 — Model Weight Persistence

Full detail lives in [MODEL_STORAGE.md](MODEL_STORAGE.md) — summarized here for
the deploy path:

- The Dockerfile sets `HF_HOME=/app/.cache/huggingface` but mounts nothing
  there by itself. Without a mount, every `docker run --rm` cycle re-downloads
  the ~1.2GB `facebook/nllb-200-distilled-600M` weights from the Hub.
- `make docker-run` already mounts a named volume at that path
  ([Makefile:86-90](../Makefile#L86-L90)):
  ```bash
  docker run --rm --name ai-translation -p 50051:50051 \
    -v ai-translation-model-cache:/app/.cache/huggingface \
    --env-file .env \
    sdewa/ai-translation:latest
  ```
  This persists weights across container restarts as long as you stay on the
  same host and don't `docker volume rm` it.
- For multi-instance or instance-replacement deploys (ASG, blue/green), the
  named volume does **not** follow the container to a new host — use an
  EBS-backed host directory or sync from S3 instead (see MODEL_STORAGE.md
  Section 3 for both).

---

## Section 5 — Compute Requirements

Device selection is automatic and unconditional
([nllb_translator.py:30-35](../src/ai_translation/domain/translation/nllb_translator.py#L30-L35)):
CUDA → MPS → CPU, in that order, with no env var to force a specific device.

| Device | Precision used | Notes |
|---|---|---|
| CUDA GPU | `float16` | Fastest path; needs a CUDA-capable base image/host — **the current Dockerfile's runtime stage is `python:3.12-slim-bookworm` with no CUDA toolkit**, so a GPU EC2 instance (e.g. `g4dn`/`g5`) will still run on CPU inside this container unless the image is rebuilt from a CUDA base. |
| Apple Silicon (MPS) | `float16` | Only relevant for local dev on a Mac, not EC2. |
| CPU (default on plain EC2) | `float32` | Works everywhere, no rebuild needed, but slower and uses roughly double the memory of the fp16 path. Budget **at least 2–3 GB RAM** for the distilled-600M model plus request overhead; size the instance accordingly (a `t3.medium`/2GB is too tight). |

**Rough edge:** because `torch_dtype` is picked from `self.device.type` and the
Dockerfile ships no CUDA runtime, "deploy to a GPU EC2 instance" today gets you
CPU inference unless you also change the base image — don't assume the
Dockerfile is GPU-ready just because the code has a CUDA branch.

---

## Section 6 — Networking & Security Posture

- The server binds with `add_insecure_port` ([server.py:22](../src/ai_translation/bootstrap/server.py#L22)) — **plaintext gRPC, no TLS, no auth.**
  Per [API.md](API.md), this is intentional for now: the service is meant to be
  reached only by the internal Go backend on a private network, never directly
  by clients. Don't expose `GRPC_PORT` on a public-facing security group /
  ALB listener without adding TLS termination and network-level restriction in
  front of it first.
- There is no `grpc_health.v1` health-checking service and no reflection
  service wired in — a container orchestrator's health check can't ask the
  gRPC server "are you ready," only whether the port accepts a TCP connection
  (which, per Section 1, can be true before the model has finished loading).
  If you need a real readiness probe, wrap this behind a shell/`grpcurl` check
  or add health-checking support before wiring into ECS/Kubernetes probes.

---

## Section 7 — Deployment Runbook (EC2 / Docker host, single instance)

1. **Provision the host.** Plain CPU instance is sufficient today (Section 5);
   don't pay for a GPU instance expecting it to be used out of the box.
2. **Install Docker**, clone the repo, `cd apps/ai-translation`.
3. **Create the model-cache volume once** (idempotent, safe to re-run):
   ```bash
   docker volume create ai-translation-model-cache
   ```
4. **Configure `.env`** from `.env.example` — at minimum set `HF_TOKEN` to
   avoid Hub rate limiting on the first cold pull; leave `MODEL_PATH` unset
   unless you have a checkpoint to mount (Section 3).
5. **Build and run:**
   ```bash
   make docker-build
   make docker-run
   ```
6. **Verify it's listening:**
   ```bash
   make docker-logs
   # expect: "gRPC server listening on port 50051"
   ```
7. **Verify it actually serves a translation** (pays the cold-start model-load
   cost on this first call):
   ```bash
   grpcurl -plaintext -proto proto/translation/v1/translation.proto \
     localhost:50051 translation.v1.TranslationService/Translate \
     -d '{"text": "Selamat pagi", "source_language": "id", "target_language": "en"}'
   ```
8. **Redeploy** (new image, same weights): `docker-stop` → `docker-build` →
   `docker-run`. Because the model cache lives in the named volume, not the
   container, this redeploy does not re-download weights.

---

## Rough Edges Summary (read before going further)

1. **Logging is `print()`, not structured logging** — [server.py:25](../src/ai_translation/bootstrap/server.py#L25)
   and [main.py:35](../src/ai_translation/main.py#L35) write straight to stdout.
   Fine for `docker logs`, but there's no log level, request id, or JSON
   structure if you plan to ship logs to CloudWatch/ELK.
2. **No graceful shutdown handling beyond `wait_for_termination()`** — a
   `docker stop` sends SIGTERM, which grpc's default handling turns into an
   immediate stop of `wait_for_termination`; in-flight `Translate` calls are
   not deliberately drained.
3. **`MODEL_PATH` validation gap** and **shared `MODEL_PATH` across
   translators** — see Section 3.
4. **GPU base image mismatch** — see Section 5.
5. **No TLS/auth on the gRPC port** — see Section 6; acceptable only because
   the service is intended to be internal-only today.
6. **No health/reflection service** — see Section 6.

---

## Final Reference Table

| Make target | Purpose |
|---|---|
| `make docker-build` | Build the image (`sdewa/ai-translation:latest`) |
| `make docker-run` | Run with model-cache volume + `.env` mounted, port `50051` published |
| `make docker-logs` | Tail the running container's stdout |
| `make docker-stop` | Stop the named container |
| `make docker-shell` | Drop into a shell in a fresh container (bypasses `CMD`) |
| `make docker-clean` | Remove the built image |

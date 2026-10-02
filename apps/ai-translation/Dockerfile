# syntax=docker/dockerfile:1

# ============================================================
# Build
# ============================================================
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=0

WORKDIR /app

# Install dependencies first for better Docker layer caching
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync \
        --locked \
        --no-install-project \
        --no-dev

# Copy application
COPY . .

# Install the project
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync \
        --locked \
        --no-dev


# ============================================================
# Runtime
# ============================================================
FROM python:3.12-slim-bookworm AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:${PATH}" \
    HF_HOME="/models/huggingface" \
    HF_HUB_DISABLE_TELEMETRY=1 \
    NLLB_MODEL_NAME="facebook/nllb-200-distilled-600M" \
    REST_HOST="0.0.0.0" \
    REST_PORT="8000"

# ------------------------------------------------------------
# System dependencies
# ------------------------------------------------------------
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libreoffice-writer-nogui \
        fontconfig \
        fonts-liberation2 \
        fonts-dejavu-core \
        fonts-noto-core \
        fonts-noto-cjk \
    && fc-cache -f \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /var/cache/apt/*

# ------------------------------------------------------------
# Non-root user
# ------------------------------------------------------------
RUN groupadd --system app \
    && useradd \
        --system \
        --gid app \
        --create-home \
        --home-dir /app \
        app

WORKDIR /app

# Copy only what is required at runtime
COPY --from=builder --chown=app:app /app/.venv /app/.venv
COPY --from=builder --chown=app:app /app/pyproject.toml /app/pyproject.toml
COPY --from=builder --chown=app:app /app/src /app/src

# Model cache lives outside the image
RUN mkdir -p /models/huggingface \
    && chown -R app:app /models

USER app

EXPOSE 8000

CMD ["ai-translation"]
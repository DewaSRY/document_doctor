# syntax=docker/dockerfile:1

# ============================================================
# Build stage
# ============================================================
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=0

WORKDIR /app

# ------------------------------------------------------------
# Install production dependencies only
# ------------------------------------------------------------
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync \
        --locked \
        --no-install-project \
        --no-dev

# ------------------------------------------------------------
# Copy application source
# ------------------------------------------------------------
COPY . /app

# ------------------------------------------------------------
# Install application
# ------------------------------------------------------------
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync \
        --locked \
        --no-dev


# ============================================================
# Runtime stage
# ============================================================
FROM python:3.12-slim-bookworm AS runtime

# ------------------------------------------------------------
# Runtime environment
# ------------------------------------------------------------
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:${PATH}" \
    HF_HOME="/models/huggingface" \
    HF_HUB_DISABLE_TELEMETRY=1 \
    REST_HOST=0.0.0.0 \
    REST_PORT=8000 \
    QWEN_MODEL_NAME="Qwen/Qwen2.5-1.5B-Instruct"

# ------------------------------------------------------------
# LibreOffice lays out DOCX -> PDF conversions. The fonts are
# metric-compatible with Word's (Calibri, Cambria, Arial, Times
# New Roman, Courier New) so text flows and breaks as in Word,
# and Noto covers the scripts documents are translated into.
# LibreOffice comes from backports: bookworm's 7.4 drops every
# hyperlink when exporting to PDF.
# ------------------------------------------------------------
RUN echo "deb http://deb.debian.org/debian bookworm-backports main" \
        > /etc/apt/sources.list.d/backports.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends -t bookworm-backports \
        libreoffice-writer-nogui \
    && apt-get install -y --no-install-recommends \
        fontconfig \
        fonts-liberation2 \
        fonts-crosextra-carlito \
        fonts-crosextra-caladea \
        fonts-dejavu-core \
        fonts-noto-core \
        fonts-noto-cjk \
    && fc-cache -f \
    && rm -rf /var/lib/apt/lists/*

# ------------------------------------------------------------
# Create non-root user
# ------------------------------------------------------------
RUN groupadd --system app \
    && useradd \
        --system \
        --gid app \
        --create-home \
        --home-dir /app \
        app

# ------------------------------------------------------------
# Application directory
# ------------------------------------------------------------
WORKDIR /app

# ------------------------------------------------------------
# Copy application
# ------------------------------------------------------------
COPY --from=builder --chown=app:app /app /app

# ------------------------------------------------------------
# Model/cache directory
#
# The model is intentionally NOT downloaded during build.
# It will be downloaded/loaded at runtime.
# ------------------------------------------------------------
RUN mkdir -p /models/huggingface \
    && chown -R app:app /models

# ------------------------------------------------------------
# Run as non-root
# ------------------------------------------------------------
USER app

# ------------------------------------------------------------
# REST API
# ------------------------------------------------------------
EXPOSE 8000

# ------------------------------------------------------------
# Start server
# ------------------------------------------------------------
CMD ["ai-translation"]

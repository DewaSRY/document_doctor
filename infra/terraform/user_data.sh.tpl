#!/bin/bash
set -euo pipefail

dnf update -y
dnf install -y docker awscli-2
systemctl enable --now docker
usermod -aG docker ec2-user

# docker compose plugin — Amazon Linux 2023's `docker` package doesn't bundle
# it. Defaults to a pinned release (var.docker_compose_version) for
# reproducibility; set that variable to "latest" to resolve GitHub's current
# release at boot instead.
COMPOSE_VERSION="${docker_compose_version}"
if [ "$COMPOSE_VERSION" = "latest" ]; then
  COMPOSE_VERSION=$(curl -fsSL --retry 5 --retry-delay 5 --retry-connrefused \
    https://api.github.com/repos/docker/compose/releases/latest \
    | grep -m1 '"tag_name"' | cut -d '"' -f4)
  if [ -z "$COMPOSE_VERSION" ]; then
    echo "ERROR: failed to resolve the latest docker compose release from GitHub's API" >&2
    exit 1
  fi
fi

mkdir -p /usr/local/lib/docker/cli-plugins
curl -fsSL --retry 5 --retry-delay 5 --retry-connrefused \
  "https://github.com/docker/compose/releases/download/$COMPOSE_VERSION/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Fail loudly here, with a clear error in cloud-init-output.log, rather than
# silently reaching `docker compose up -d` with a broken/missing plugin.
docker compose version

mkdir -p /opt/ai-translation

# Base64 like the other two files, so secrets never pass through shell
# expansion.
echo '${app_env_base64}' | base64 -d > /opt/ai-translation/app.env
chmod 600 /opt/ai-translation/app.env

umask 077
aws ssm get-parameter \
  --name "${secrets_parameter_name}" \
  --with-decryption \
  --query 'Parameter.Value' \
  --output text \
  --region "${aws_region}" \
  > /opt/ai-translation/runtime-secrets.json
python3 - <<'PY'
import json

secret_path = "/opt/ai-translation/runtime-secrets.json"
env_path = "/opt/ai-translation/app.env"
with open(secret_path, encoding="utf-8") as source:
  secrets = json.load(source)
with open(env_path, "a", encoding="utf-8") as target:
  for name in ("PORTAL_API_TOKEN", "DB_PASSWORD", "POSTGRES_PASSWORD", "HF_TOKEN"):
    value = secrets.get(name, "")
    if "\n" in value or "\r" in value:
      raise ValueError(f"{name} must not contain newlines")
    if value:
      target.write(f"{name}={value}\n")
PY
rm /opt/ai-translation/runtime-secrets.json
chmod 600 /opt/ai-translation/app.env

echo '${caddyfile_base64}' | base64 -d > /opt/ai-translation/Caddyfile
chmod 644 /opt/ai-translation/Caddyfile

echo '${docker_compose_yml_base64}' | base64 -d > /opt/ai-translation/docker-compose.yml
chmod 644 /opt/ai-translation/docker-compose.yml

# Idempotent: pull + up -d each time, safe to rerun over SSH on an
# already-running instance (`make tf-redeploy`). --remove-orphans drops
# services that were removed from the compose file (e.g. bundled postgres
# after switching to an external db_host).
cd /opt/ai-translation
docker compose pull
docker compose up -d --remove-orphans
docker image prune -f

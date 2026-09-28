#!/bin/bash
set -euxo pipefail

dnf update -y
dnf install -y docker
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

echo '${nginx_conf_base64}' | base64 -d > /opt/ai-translation/nginx.conf
chmod 644 /opt/ai-translation/nginx.conf

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

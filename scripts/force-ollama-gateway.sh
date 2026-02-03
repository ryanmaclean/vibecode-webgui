#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${AI_GATEWAY_ENV_FILE:-$ROOT_DIR/infrastructure/services/ai-gateway/.env.local}"

mkdir -p "$(dirname "$ENV_FILE")"
touch "$ENV_FILE"

update_env() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    if command -v gsed >/dev/null 2>&1; then
      gsed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
    else
      if sed -i '' "s|^${key}=.*|${key}=${value}|" "$ENV_FILE" 2>/dev/null; then
        true
      else
        sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
      fi
    fi
  else
    printf "%s=%s\n" "$key" "$value" >> "$ENV_FILE"
  fi
}

update_env "PROVIDERS_ENABLED" "ollama,openrouter"
update_env "FORCE_PROVIDER" "ollama"
update_env "ALLOW_PROVIDER_FALLBACK" "true"

echo "Updated $ENV_FILE with Ollama-first routing."

restart_compose() {
  local compose_file="$1"
  local service="$2"
  if ! docker compose -f "$compose_file" config --services >/dev/null 2>&1; then
    return 1
  fi
  if docker compose -f "$compose_file" config --services | grep -q "^${service}$"; then
    docker compose -f "$compose_file" up -d "$service"
    echo "Restarted $service via $compose_file."
    return 0
  fi
  return 1
}

if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    restart_compose "$ROOT_DIR/config/docker/docker-compose.repo.yml" "gateway" \
      || restart_compose "$ROOT_DIR/config/docker/docker-compose.ai-gateway.yml" "ai-gateway" \
      || restart_compose "$ROOT_DIR/infrastructure/services/ai-gateway/docker-compose.yml" "ai-gateway" \
      || echo "Docker running, but no known compose service found to restart."
  else
    echo "Docker is installed but not running. Start Docker, then rerun this script to restart the gateway."
  fi
else
  echo "Docker not found. Apply env vars and restart ai-gateway via your process manager."
fi

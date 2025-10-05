#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE=${COMPOSE_FILE:-docker/code-server/docker-compose.cloud.yml}
PROJECT_NAME=${PROJECT_NAME:-codeserver}

mkdir -p workspace config

docker compose -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" up -d

echo "code-server available on http://localhost:8765 (password: ${CODE_SERVER_PASSWORD:-changeme})"

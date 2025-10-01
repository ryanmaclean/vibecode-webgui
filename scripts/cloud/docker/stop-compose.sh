#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE=${COMPOSE_FILE:-docker/code-server/docker-compose.cloud.yml}
PROJECT_NAME=${PROJECT_NAME:-codeserver}
REMOVE_VOLUMES=${REMOVE_VOLUMES:-false}

if [[ "$REMOVE_VOLUMES" == "true" ]]; then
  docker compose -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" down -v
else
  docker compose -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" down
fi

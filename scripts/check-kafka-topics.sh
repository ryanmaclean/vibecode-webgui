#!/usr/bin/env bash
set -euo pipefail

TOPICS_FILE="${1:-daemon/kafka-dsm/kafka-topics.txt}"

if [[ ! -f "$TOPICS_FILE" ]]; then
  echo "Missing topics file: $TOPICS_FILE" >&2
  exit 1
fi

bad=$(rg -n "\\." "$TOPICS_FILE" || true)
if [[ -n "$bad" ]]; then
  echo "Dot topics are not allowed:" >&2
  echo "$bad" >&2
  exit 1
fi

required=(
  tundra-lane-critical-beads
  tundra-lane-standard-beads
  tundra-lane-experimental-beads
  tundra-mayor-commands
  tundra-deacon-commands
  tundra-polecat-commands
  tundra-reaper-commands
  tundra-witness-commands
  tundra-overseer-commands
  tundra-nudges
  tundra-whispers
  tundra-mail-outbox
  tundra-mail-inbox
  tundra-beads-created
  tundra-beads-in-progress
  tundra-beads-completed
  tundra-beads-escalated
  tundra-beads-failed
)

missing=0
for topic in "${required[@]}"; do
  if ! rg -q "^${topic}$" "$TOPICS_FILE"; then
    echo "Missing topic in $TOPICS_FILE: $topic" >&2
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

echo "Kafka topic list OK: $TOPICS_FILE"

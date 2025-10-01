#!/usr/bin/env bash
# Stops a running GCP code-server workspace VM and optionally deletes the instance (but keeps the PD).

set -euo pipefail

PROJECT=${PROJECT:-$(gcloud config get-value project 2>/dev/null)}
ZONE=${ZONE:-us-central1-a}
INSTANCE_NAME=${INSTANCE_NAME:-codeserver-dev}
DELETE_INSTANCE=${DELETE_INSTANCE:-false}

if [[ -z "$PROJECT" ]]; then
  echo "ERROR: gcloud project not configured. Set PROJECT env var or run 'gcloud config set project <id>'." >&2
  exit 1
fi

gcloud compute instances stop "$INSTANCE_NAME" --zone "$ZONE" --project "$PROJECT" || true

echo "Instance $INSTANCE_NAME stopped. PD remains attached but not in use."

if [[ "$DELETE_INSTANCE" == "true" ]]; then
  echo "Deleting instance resource $INSTANCE_NAME (disk remains)."
  gcloud compute instances delete "$INSTANCE_NAME" --zone "$ZONE" --project "$PROJECT" --keep-disks data --quiet
fi

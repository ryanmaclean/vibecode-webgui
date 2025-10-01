#!/usr/bin/env bash
# Starts (or creates) a preemptible GCP VM that runs code-server with a persistent PD.
# Prerequisites: gcloud CLI authenticated, project set, docker image pushed to Artifact Registry.

set -euo pipefail

PROJECT=${PROJECT:-$(gcloud config get-value project 2>/dev/null)}
ZONE=${ZONE:-us-central1-a}
INSTANCE_NAME=${INSTANCE_NAME:-codeserver-dev}
DISK_NAME=${DISK_NAME:-${INSTANCE_NAME}-pd}
DISK_SIZE_GB=${DISK_SIZE_GB:-50}
MACHINE_TYPE=${MACHINE_TYPE:-e2-small}
IMAGE_FAMILY=${IMAGE_FAMILY:-debian-12}
IMAGE_PROJECT=${IMAGE_PROJECT:-debian-cloud}
CONTAINER_IMAGE=${CONTAINER_IMAGE:-ghcr.io/ryanmaclean/vibecode-codeserver:latest}
NETWORK_TAGS=${NETWORK_TAGS:-codeserver}
IAP_SSH=${IAP_SSH:-false}

if [[ -z "$PROJECT" ]]; then
  echo "ERROR: gcloud project not configured. Set PROJECT env var or run 'gcloud config set project <id>'." >&2
  exit 1
fi

echo "Using project: $PROJECT"

disk_exists=$(gcloud compute disks list --project "$PROJECT" --filter="name=$DISK_NAME" --format="value(name)" || true)
if [[ -z "$disk_exists" ]]; then
  echo "Creating persistent disk $DISK_NAME ($DISK_SIZE_GB GiB)..."
  gcloud compute disks create "$DISK_NAME" \
    --project "$PROJECT" \
    --size "${DISK_SIZE_GB}GiB" \
    --type pd-standard \
    --zone "$ZONE"
else
  echo "Re-using existing disk: $DISK_NAME"
fi

instance_exists=$(gcloud compute instances list --project "$PROJECT" --filter="name=$INSTANCE_NAME" --format="value(name)" || true)
if [[ -z "$instance_exists" ]]; then
  echo "Creating preemptible VM $INSTANCE_NAME..."
  gcloud compute instances create-with-container "$INSTANCE_NAME" \
    --project "$PROJECT" \
    --zone "$ZONE" \
    --container-image "$CONTAINER_IMAGE" \
    --container-restart-policy on-failure \
    --container-mount-disk mount-path=/home/coder/workspace,name="$DISK_NAME" \
    --container-env "PASSWORD=${PASSWORD:-changeme}" \
    --machine-type "$MACHINE_TYPE" \
    --network-interface subnet=default \
    --tags "$NETWORK_TAGS" \
    --service-account "$(gcloud iam service-accounts list --filter='displayName:Compute Engine default service account' --format='value(email)' --project "$PROJECT")" \
    --scopes=https://www.googleapis.com/auth/devstorage.read_write \
    --preemptible \
    --maintenance-policy TERMINATE \
    --provisioning-model SPOT \
    --boot-disk-type=pd-balanced \
    --boot-disk-size=20GB \
    --container-mount-host-path mount-path=/var/run/docker.sock,host-path=/var/run/docker.sock \
    --container-stdin --container-tty
else
  echo "Starting existing instance: $INSTANCE_NAME"
  gcloud compute instances start "$INSTANCE_NAME" --zone "$ZONE" --project "$PROJECT"
fi

if [[ "$IAP_SSH" == "true" ]]; then
  echo "Tip: To tunnel via IAP run -> gcloud compute ssh $INSTANCE_NAME --project $PROJECT --zone $ZONE -- -N -L 8765:localhost:8765"
fi

echo "Workspace available once container finishes bootstrapping."

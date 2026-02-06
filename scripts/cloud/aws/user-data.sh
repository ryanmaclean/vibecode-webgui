#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

set -euxo pipefail


# Initialize log aggregation
init_log_aggregation

apt-get update
apt-get install -y docker.io
systemctl enable --now docker

mkdir -p /home/ubuntu/workspace
chown ubuntu:ubuntu /home/ubuntu/workspace

docker run -d --restart unless-stopped \
  -e PASSWORD=${PASSWORD:-changeme} \
  -p 8765:8765 \
  -v /home/ubuntu/workspace:/home/coder/project \
  ghcr.io/ryanmaclean/vibecode-codeserver:latest

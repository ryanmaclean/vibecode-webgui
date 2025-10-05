#!/bin/bash
set -euxo pipefail

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

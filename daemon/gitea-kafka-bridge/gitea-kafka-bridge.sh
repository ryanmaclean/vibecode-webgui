#!/bin/zsh
set -euo pipefail
set -a
source /Users/studio/gt/daemon/gitea-kafka-bridge/gitea-kafka-bridge.env
set +a
cd /Users/studio/gt/daemon/gitea-kafka-bridge
exec /opt/homebrew/bin/node server.js

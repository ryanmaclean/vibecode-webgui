#!/bin/zsh
set -euo pipefail
set -a
source /Users/studio/gt/daemon/kafka-dsm/bd-kafka-producer.env
set +a
cd /Users/studio/gt/daemon/kafka-dsm
exec /opt/homebrew/bin/node bd-kafka-producer.js

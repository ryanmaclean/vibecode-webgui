#!/bin/zsh
set -euo pipefail
set -a
source /Users/studio/gt/daemon/kafka-dsm/gt-kafka-consumer.env
set +a
cd /Users/studio/gt/daemon/kafka-dsm
exec /opt/homebrew/bin/node gt-kafka-consumer.js

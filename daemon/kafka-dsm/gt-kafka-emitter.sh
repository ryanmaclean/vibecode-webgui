#!/bin/zsh
set -euo pipefail
set -a
source /Users/studio/gt/daemon/kafka-dsm/gt-kafka-emitter.env
set +a
cd /Users/studio/gt/daemon/kafka-dsm
exec /opt/homebrew/bin/node gt-kafka-emitter.js

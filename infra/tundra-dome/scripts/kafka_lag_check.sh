#!/usr/bin/env bash
set -euo pipefail

NS="${KAFKA_NAMESPACE:-tundra-dome}"
KAFKA_DEPLOY="${KAFKA_DEPLOYMENT:-kafka}"
CONSUMER_GROUPS=(tundra-observer tundra-td-event-emitter tundra-crossbar-link)

TS=$(date -u +"%Y%m%dT%H%M%SZ")
OUT_DIR="${KAFKA_LAG_OUTPUT_DIR:-/Users/studio/gt/logs}"
mkdir -p "$OUT_DIR"
OUT_FILE="$OUT_DIR/kafka-lag-$TS.txt"

{
  echo "timestamp: $TS"
  echo "namespace: $NS"
  echo "kafka_deployment: $KAFKA_DEPLOY"
  echo "groups: ${CONSUMER_GROUPS[*]}"
  echo ""
  for group in "${CONSUMER_GROUPS[@]}"; do
    echo "=== $group ==="
    set +e
    POD=$(kubectl -n "$NS" get pod -l app=$KAFKA_DEPLOY -o name 2>/dev/null | head -n 1)
    if [ -n "$POD" ]; then
      kubectl -n "$NS" exec "$POD" -c kafka -- /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group "$group"
    else
      kubectl -n "$NS" exec deployment/$KAFKA_DEPLOY -c kafka -- /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group "$group"
    fi
    set -e
    echo ""
  done
} | tee "$OUT_FILE"

echo "saved: $OUT_FILE"

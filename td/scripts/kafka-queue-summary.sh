#!/bin/sh
set -eu
BROKERS=${TD_KAFKA_BROKERS:-localhost:9092}
TOPICS=${TD_QUEUE_TOPICS:-"tundra-lane-critical-beads,tundra-lane-standard-beads,tundra-beads-failed,tundra-schema-dlq"}
OUT=""
IFS=','
for t in $TOPICS; do
  lag=$(kafka-consumer-groups --bootstrap-server "$BROKERS" --describe --group tundra-td-event-emitter 2>/dev/null | awk -v topic="$t" '$2==topic {sum+=$6} END{print sum+0}')
  OUT="$OUT $t:$lag"
 done
printf "%s" "$OUT"

#!/bin/sh
set -eu

BROKERS=${TD_KAFKA_BROKERS:-localhost:9092}
TOPICS=${TD_QUEUE_TOPICS:-"tundra-lane-critical-beads,tundra-lane-standard-beads,tundra-lane-experimental-beads,tundra-beads-created,tundra-beads-in-progress,tundra-beads-completed,tundra-beads-escalated,tundra-beads-failed,tundra-schema-dlq,tundra-mayor-commands,tundra-deacon-commands,tundra-witness-commands,tundra-overseer-commands,tundra-nudges,tundra-mail-outbox"}
GROUPS=${TD_CONSUMER_GROUPS:-"tundra-td-event-emitter,tundra-observer,gastown-bridge"}

printf "Kafka brokers: %s\n" "$BROKERS"
printf "Topics: %s\n\n" "$TOPICS"

IFS=','
for g in $GROUPS; do
  printf "== Group: %s ==\n" "$g"
  kafka-consumer-groups --bootstrap-server "$BROKERS" --describe --group "$g" 2>/dev/null || true
  printf "\n"
 done

printf "== Topic sizes ==\n"
for t in $TOPICS; do
  kafka-topics --bootstrap-server "$BROKERS" --describe --topic "$t" 2>/dev/null | awk -v topic="$t" '{print topic ":" $0}' || true
 done

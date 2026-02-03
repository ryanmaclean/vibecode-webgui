# DSM Message Capture Runbook

Use this runbook to capture Kafka messages for high-priority lanes (critical, escalated, failed).

## Prereqs
- Datadog Agent v7.70+ on a host running `kafka_consumer`
- Kafka Consumer integration enabled for the target consumer group
- Remote Configuration enabled (org + Agent)
- Permission: Data Streams Monitoring Capture Messages

## Target topics
- `tundra-lane-critical-beads`
- `tundra-beads-escalated`
- `tundra-beads-failed`

## Enable capture (high level)
1) Confirm consumer group is active for the topic.
2) In DSM > Messages, select topic + partition to capture.
3) Capture a small window around the suspected bad offsets.

## Operational checklist
- Confirm Agent version and `kafka_consumer` check status on each host.
- Verify DSM is enabled on all producer/consumer services (`DD_DATA_STREAMS_ENABLED=true`).
- Capture messages only for limited intervals to avoid volume spikes.

## Triage actions
- If message is malformed: quarantine to `tundra-beads-failed`.
- If schema mismatch: tag `schema_error=true` and route to `tundra-beads-failed`.
- If poison pill: add payload hash to `tundra-audit-actions` and notify `tundra-deacon-commands`.

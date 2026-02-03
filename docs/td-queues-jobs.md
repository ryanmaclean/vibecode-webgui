# Tundra Dome Queues + Jobs

This defines the queue primitives and job definitions for observers, witnesses, overseers, crews, deacons, beads, mail, nudges, failures, handoffs, and sessions.

## Queues (Kafka topics)

### Control plane
- `tundra-mayor-commands`
- `tundra-deacon-commands`
- `tundra-witness-commands`
- `tundra-overseer-commands`
- `tundra-reaper-commands`
- `tundra-polecat-commands`

### Work plane (bead lifecycle)
- `tundra-beads-created`
- `tundra-beads-in-progress`
- `tundra-beads-completed`
- `tundra-beads-escalated`
- `tundra-beads-failed`
- `tundra-schema-dlq`

### Lanes
- `tundra-lane-critical-beads`
- `tundra-lane-standard-beads`
- `tundra-lane-experimental-beads`

### Comms
- `tundra-nudges`
- `tundra-whispers`
- `tundra-mail-outbox`
- `tundra-mail-inbox`

### Audit + telemetry
- `tundra-audit-actions`
- `tundra-metrics-kpi`

## Jobs (Airflow DAGs)

### Existing DAGs
- `tundra_lane_router`: selects lane from KPI snapshot and writes to `tundra-lane-*-beads`
- `tundra_lane_watchdog`: escalates on failure spikes
- `tundra_role_allocator`: nudges deacon when role activity drops
- `tundra_auto_recovery`: nudges deacon on agent churn
- `tundra_escalation_gate`: escalates stale escalations
- `tundra_ci_cd_rigor`: escalates CI failure spikes
- `tundra_mail_watchdog`: nudges on mail backlog
- `tundra_nudge_watchdog`: nudges on unanswered nudges
- `tundra_convoy_watchdog`: escalates convoy stall
- `tundra_merge_watchdog`: nudges on merge backlog

## Session primitives
- CLI: `td session list|start|kill` (zellij)
- BSD: rc.d scripts in `bsd/rc.d/` for event emitter, observer, and session

## Recommended runtime mapping
- **Observer** → `tundra-observer` service
- **Witness** → `tundra-witness-commands` consumer
- **Overseer** → `tundra-overseer-commands` consumer
- **Crew** → `tundra-polecat-commands` consumers
- **Deacon** → `tundra-deacon-commands` consumer
- **Beads** → bead lifecycle topics
- **Mail/Nudges** → comms topics
- **Failures** → `tundra-beads-failed` + `tundra-schema-dlq`
- **Handoffs** → `tundra-audit-actions` + lane topics

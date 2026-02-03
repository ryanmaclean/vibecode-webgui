# Superdome Ops Model (Tundra Dome)

This document codifies the Superdome-inspired management model and how it maps to Airflow control loops + Kafka queues.

## Principles
- **Fabric vs Control Plane**: lanes are the fabric; role command topics are the control plane.
- **Adaptive Routing**: the lane router assigns work to critical/standard/experimental based on KPI snapshots.
- **Cache Coherency**: schema tracking + `tundra-schema-dlq` prevents incompatible payloads from propagating.
- **Hot‑swap chassis**: session manager (zellij) allows fast worker drain/replace.
- **Scale‑up first**: prefer fewer, bigger workers under latency pressure; scale‑out only when fabric saturation is detected.

## Control loops (Airflow DAGs)
- `tundra_lane_router` → routes to lane topics using KPI snapshot
- `tundra_lane_watchdog` → escalates on bead failure spikes
- `tundra_role_allocator` → nudges when role activity drops
- `tundra_auto_recovery` → reassigns on churn
- `tundra_escalation_gate` → escalates stale escalations
- `tundra_ci_cd_rigor` → escalates CI failure spikes
- `tundra_mail_watchdog` → nudges on mail backlog
- `tundra_nudge_watchdog` → nudges on unanswered nudges
- `tundra_convoy_watchdog` → escalates convoy stalls
- `tundra_merge_watchdog` → nudges on merge backlog

## Queue mapping
- **Fabric**: `tundra-lane-*-beads`
- **Beads**: `tundra-beads-*`
- **Control plane**: `tundra-*-commands`
- **Comms**: `tundra-nudges`, `tundra-whispers`, `tundra-mail-*`
- **Audit**: `tundra-audit-actions`
- **Schema**: `tundra-schema-dlq`

## KPIs to watch
- Bead failure rate, escalation backlog, lane throughput, merge backlog, convoy stall rate, mail backlog, unanswered nudges

## Operational policies
- **Quarantine** on schema errors → `tundra-schema-dlq`
- **Escalate** on failure spikes → mayor/deacon commands
- **Rebalance** on role inactivity → deacon command

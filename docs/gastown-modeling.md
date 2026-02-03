# Gas Town → Tundra Dome Modeling

This maps Steve Yegge’s Gas Town concepts into the Tundra Dome Kafka/Airflow model so we can monitor and orchestrate it in the Superdome style.

## Core concepts (from Gas Town)
- **Rigs** are projects; Gas Town manages multiple rigs under a single town, with some roles per-rig and others town-wide. citeturn0search1
- **Mayor** is the main concierge/dispatcher that initiates work and receives completion notifications. citeturn0search1
- **Polecats** are ephemeral per-rig workers that swarm on demand and hand work off to the merge queue. citeturn0search1
- **Refinery** handles merge-queue integration; it merges work serially and can escalate when needed. citeturn0search1
- **Witness** patrols and keeps polecats/refinery moving when GUPP stalls. citeturn0search1
- **Deacon + Dogs** patrol the town-level workflows and propagate the DYFJ signal; Dogs handle heavy patrol work. citeturn0search0
- **Beads** are the atomic unit of work; mail/messaging and orchestration all use beads. citeturn0search0
- **GUPP**: if there is work on your hook, you must run it; `gt sling` hangs work on hooks. citeturn0search0
- **Convoys** are the tracked units that bundle work for delivery. citeturn0search0
- **Patrols** are looping workflows for Refinery/Witness/Deacon with backoff when idle. citeturn0search0

## Kafka topic mapping
- **Role commands** (control plane)
  - `tundra-mayor-commands`, `tundra-deacon-commands`, `tundra-witness-commands`, `tundra-reaper-commands`, `tundra-overseer-commands`
- **Work / Beads**
  - `tundra-beads-created`, `tundra-beads-in-progress`, `tundra-beads-completed`, `tundra-beads-escalated`, `tundra-beads-failed`
- **Convoys / Lanes**
  - `tundra-lane-critical-beads`, `tundra-lane-standard-beads`, `tundra-lane-experimental-beads`
- **Mail / Nudge / Whisper**
  - `tundra-mail-outbox`, `tundra-mail-inbox`, `tundra-nudges`, `tundra-whispers`
- **Audit / Control plane telemetry**
  - `tundra-audit-actions`, `tundra-metrics-kpi`

## Airflow policy mapping (Superdome control loops)
Implemented in `airflow/dags/tundra_superdome_policies.py`:
- **Lane router**: uses KPI snapshot to choose critical/standard/experimental lane.
- **Lane watchdog**: escalates on bead failure spikes.
- **Role allocator**: nudges Deacon when role activity drops.
- **Mail watchdog**: nudges when mail backlog grows.
- **Nudge watchdog**: nudges when nudges go unanswered.
- **Convoy watchdog**: escalates when convoys stall.
- **Merge watchdog**: nudges on merge backlog.

## Monitoring alignment
- **Role activity**: any `*-commands`, `tundra-nudges`, `tundra-mail-*`.
- **Bead lifecycle**: `tundra-beads-*` (Tundra Dome is now the source of truth; Gastown feed deprecated).
- **Convoy throughput**: `convoy.started`, `convoy.completed` events.
- **Patrol health**: `role.activity` counts and watchdog actions.

## Notes
Gas Town emphasizes “Is it done?” over “Is it running?”, which mirrors our control loops focusing on bead/convoy completion rather than uptime. citeturn0search0

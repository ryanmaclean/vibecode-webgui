# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

## Tundra Dome (Superdome style)
- **Front door = Kafka slings.** Use `td sling <bead> [target] --lane <lane>` (topics: `tundra-work-intake`, lane topics) to keep low-latency ingress; Airflow is orchestrator, not the queue.
- **Airflow DAGs (in repo):**
  - `tundra_sling_ingest` – polls sling/work topics and fans out per event (requires `kafka-python` in the Airflow image; skips if missing).
  - `tundra_maintenance_drain` – drains `TUNDRA_MAINTENANCE_QUEUE` Variable (JSON list) in small batches so maintenance backlog is rate-limited.
  - `tundra_timed_jobs_template` – template for cron/timed jobs; copy for new scheduled work.
- **Backlog handling:** Put maintenance items in Airflow Variable `TUNDRA_MAINTENANCE_QUEUE`; the drain DAG processes 5 per run (every 15m by default).
- **On-demand vs timed:** On-demand → `td sling` (Kafka). Timed → Airflow schedules. Backlog → maintenance Variable + drain DAG. Keep them separated to avoid cron pileups.
- **Datadog metrics to watch:** `tundra.td_sling.emitted`, `tundra.td_sling.invoked`, `tundra.observer.processed`, `gastown.kafka_consumer.processed`; add monitors for “no data >5m” and consumer lag for `gastown-bridge`.
- **Recreate for handoff:** Copy DAGs from `airflow/dags/`, ensure `kafka-python` baked into Airflow image, set `KAFKA_BROKERS`, DD keys, and the maintenance Variable. See `docs/tundra-dome-airflow.md` for the full playbook.

# yaml-language-server: $schema=https://json.schemastore.org/yaml
---
name: tundra-dome
description: Operate the Tundra Dome stack (Kafka/Airflow/Datadog) locally and in KIND; use when deploying/validating Tundra Dome, Kafka bridges, lane routing, or TD observability.
---
# tundra-dome

Standardize bead/PR/issue flow across Gas Town → Tundra Dome.

## KIND deploy on vibecode VM
- Manifests live at `infra/tundra-dome/` (`tundra-dome.clean.yaml`, `datadog.json`).
- Bootstrap:
  ```bash
  kubectl create ns tundra-dome && kubectl create ns datadog
  kubectl -n tundra-dome create secret generic tundra-dome-secrets \
    --from-literal=DD_API_KEY=$DD_API_KEY --dry-run=client -o yaml | kubectl apply -f -
  kubectl -n datadog create secret generic tundra-dome-secrets \
    --from-literal=DD_API_KEY=$DD_API_KEY --dry-run=client -o yaml | kubectl apply -f -
  kubectl apply -f infra/tundra-dome/tundra-dome.clean.yaml
  kubectl get pods -n tundra-dome -w
  ```
- Expected pods: airflow-api-server, airflow-scheduler, airflow-dag-processor, kafka, td-event-emitter, tundra-observer, datadog-agent.

## When to use
- You need to sync GitHub/Gitea issues → beads
- You need lane routing (critical/standard/experimental)
- You need KPI snapshots + Datadog dashboard/metrics validation
- You need Kafka/launchd health + topic hygiene
- You need quick Tundra Dome rollout checks across hosts

## Prereqs (env + tools)
- `bd`, `gt`, `kafka-topics`, `kafka-consumer-groups`
- `launchctl`, `kubectl`, `kind`, `docker` (if k8s)
- `datadog-agent` CLI for check status (optional)
- GitHub dispatcher: `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_TOKEN`

## Quick actions (pick what matches the request)
1) Issue → bead sync (GitHub/Gitea)
- Dry-run first:
  - Set `GITHUB_DRY_RUN=true`
  - Run `daemon/kafka-dsm/github-issue-dispatcher.sh`
- Live:
  - Set `GITHUB_DRY_RUN=false`
  - Run `daemon/kafka-dsm/github-issue-dispatcher.sh`

2) Lane routing (labels → lanes)
- Map labels:
  - critical → `tundra-lane-critical-beads`
  - standard → `tundra-lane-standard-beads`
  - experimental → `tundra-lane-experimental-beads`
- Update:
  - `airflow/dags/tundra_gitea_cicd.py`
  - `daemon/kafka-dsm/github-issue-dispatcher.js`

3) KPI snapshot + DD checks
- Snapshot:
  - `python3 daemon/kpi_snapshot.py > logs/kpi_snapshot.json`
- Verify core counters:
  - `tundra.td_event_emitter.processed`
  - `tundra.td_event_emitter.heartbeat`
  - `tundra.observer.processed`
  - `gastown.kafka_consumer.processed`

4) Kafka health + topic hygiene
- List topics:
  - `kafka-topics --bootstrap-server localhost:9092 --list | sort`
- Delete dot topics:
  - `kafka-topics --bootstrap-server localhost:9092 --delete --topic <topic.with.dots>`
- Verify consumer groups:
  - `kafka-consumer-groups --bootstrap-server localhost:9092 --list`
  - `kafka-consumer-groups --bootstrap-server localhost:9092 --describe --group <group>`

5) Launchd service sweep
- Restart a service:
  - `launchctl kickstart -k gui/$(id -u)/<label>`
- Inspect logs:
  - `tail -n 200 logs/<service>.err.log`

6) Superdome sling (Tundra)
- Use `td-sling` to fan out lane + audit + work-intake + in-progress topics:
  - `daemon/kafka-dsm/td-sling.sh sling <bead-id> <target> --lane standard --message "..."` 

## Default topic set (add if missing)
- Commands: `tundra-mayor-commands`, `tundra-deacon-commands`, `tundra-polecat-commands`
- Comms: `tundra-nudges`, `tundra-whispers`, `tundra-mail-outbox`, `tundra-mail-inbox`
- Beads: `tundra-beads-created`, `tundra-beads-in-progress`, `tundra-beads-completed`, `tundra-beads-escalated`, `tundra-beads-failed`
- Lanes: `tundra-lane-critical-beads`, `tundra-lane-standard-beads`, `tundra-lane-experimental-beads`

7) OpenCode + OpenRouter Free Models (Dynamic Selection)
- **Auto-select best model** (tests availability first):
  - `td opencode run "Explain this error"` → tests models, picks first working
  - `td opencode spawn polecat-1` → spawns with dynamic model selection
- Manual model testing:
  - `td opencode test-models`
- List all free models:
  - `td opencode models`
- Direct with specific model:
  - `opencode-auto` → dynamic selection wrapper
  - `gt sling <bead> --agent opencode-auto` → uses dynamic selection

## OpenCode Setup (v1.1.48+)
1. Install:
   ```bash
   curl -fsSL https://opencode.ai/install | bash
   # Binary: ~/.opencode/bin/opencode
   ```

2. Config (`~/.config/opencode/opencode.json`):
   ```json
   {
     "$schema": "https://opencode.ai/config.json",
     "provider": {
       "openrouter": {
         "options": {
           "apiKey": "sk-or-v1-..."
         }
       }
     }
   }
   ```

3. Working free models (with tool use):
   - `meta-llama/llama-3.3-70b-instruct:free` - Best for coding
   - `google/gemma-3-27b-it:free` - Good general
   - `tngtech/tng-r1t-chimera:free` - Reasoning

4. Models WITHOUT tool use (don't work with OpenCode):
   - `liquid/lfm-*:free`
   - `allenai/molmo-*:free`

5. Free tier limits:
   - 50 req/day (or 1000/day with $10+ credits)
   - Models change availability throughout day - ALWAYS test first

## Notes
- Prefer hyphenated topic names (no dots).
- Keep `td-event-emitter` as the health-ping owner.
- Test free models before spawning polecats: `td opencode test-models`

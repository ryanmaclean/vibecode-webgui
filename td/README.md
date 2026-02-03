# td (Tundra Dome CLI)

MIT/Apache-2.0 friendly CLI for Tundra Dome with a minimal TUI.

## Commands
- `td sling <bead> [--lane standard] [--target ...] [--message ...]`
- `td hook <bead> [--lane standard]`
- `td done <bead> [--lane standard]`
- `td nudge <message> [--lane standard] [--target ...]`
- `td kafka status|summary|topics`
- `td airflow <subcommand>`
- `td bd <...>` (proxy to beads)
- `td gt <...>` (proxy to Gas Town)
- `td tui` (interactive)
- `td session list|start|kill`

## Env
- `TD_KAFKA_BROKERS` (default: `localhost:9092`)
- `TD_RIG`, `TD_ROLE`, `TD_LANE`
- `TD_TOPIC_WORK`, `TD_TOPIC_IN_PROGRESS`, `TD_TOPIC_CREATED`, `TD_TOPIC_COMPLETED`, `TD_TOPIC_NUDGES`
- `TD_SCHEMA_NAME`, `TD_SCHEMA_VERSION`, `TD_SCHEMA_STATUS`
- `TD_ZELLIJ_BIN`
- `TD_REPO_ROOT` (default: `/Users/studio/gt`)
- `TD_DSM_TD` (path to `daemon/kafka-dsm/td`)
- `TD_KAFKA_STATUS_SCRIPT`
- `TD_KAFKA_SUMMARY_SCRIPT`
- `TD_KAFKA_TOPICS_FILE`
- `TD_BD_BIN`
- `TD_GT_BIN`

## Build
```
cd td
./scripts/build.sh
./bin/td --help
```

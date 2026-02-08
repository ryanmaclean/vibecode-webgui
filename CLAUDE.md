# Mayor Context (mbp_m1)

> **Recovery**: Run `gt prime` after compaction, clear, or new session

Full context is injected by `gt prime` at session start.

## Proactive Monitoring

Always use the Go CLIs for Datadog and Tundra Dome operations:

```bash
# Datadog (use dd CLI, not bash scripts)
~/bin/dd apm --status error --duration 1h     # APM errors
~/bin/dd llm --service tundra-dome-polecats   # LLM observability
~/bin/dd logs --query "status:error"          # Error logs
~/bin/dd watchdog --duration 1h               # Anomalies

# Tundra Dome
td beads       # List beads
td kafka       # Kafka operations
td airflow     # Airflow DAGs
```

Run `dd apm --status error` at start of sessions to catch issues proactively.

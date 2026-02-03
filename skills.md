# Skills

This repo uses skills to capture operational workflows and migration notes.

## Tundra Dome
- `skills/tundra-dome/SKILL.md` covers:
  - Issue/bead sync via Kafka
  - Lane routing for critical/standard/experimental
  - KPI snapshots and Datadog validation
  - Airflow + Kafka DSM health checks

## Migration Notes (gt → td)
- Use `td bd ...` to proxy `bd` while tools migrate.
- Use `td gt ...` to proxy `gt` while tools migrate.
- Use `td airflow ...` and `td kafka ...` for Tundra Dome ops.

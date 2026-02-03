# Python DSM Audit

This summarizes current Python tracer/library versions based on requirements files found in the repo.

## ddtrace versions found
- `ddtrace>=2.0.0` in GitHub webhook services (alpha/bravo/charlie/delta/echo/foxtrot/golf)
- `ddtrace>=3.0.0` in `scripts/requirements-datadog.txt` for multiple dogs
- SDK `pyproject.toml` requires `ddtrace>=2.0.0` and `ddtrace[openai]>=2.0.0`

## Kafka DSM library requirements (Python)
Datadog DSM for Python expects Kafka clients:
- `confluent-kafka` >= 1.16.0 (recommended 2.11.0+)
- or `aiokafka` >= 4.1.0

No Kafka client dependency was found in the service requirements listed above.

## Action items
1) If any Python service consumes/produces Kafka, add `confluent-kafka` or `aiokafka`.
2) Ensure `DD_DATA_STREAMS_ENABLED=true` and `DD_TRACE_REMOVE_INTEGRATION_SERVICE_NAMES_ENABLED=true` are set in service envs.
3) Validate `ddtrace` runtime version in deployed environments (pip freeze).

# ADR: Metrics Tag Policy and Transport for AI Gateway

## Status
Accepted

## Context
Datadog metrics experienced risk of high cardinality due to user and full model tags.

## Decision
- Default tags use low cardinality only: `env`, `service`, `version`, plus `model_provider`, `model_family`, `operation`.
- Full model id included only under `DD_DEBUG_HIGH_CARDINALITY=true` with `DD_DEBUG_SAMPLE_RATE` (default 0.001).
- Transport defaults to HTTP series. Optional DogStatsD (`DD_USE_DOGSTATSD=true`) enables batching and histograms for latency.

## Consequences
- Lower cost and more reliable dashboards/monitors.
- Preserve deep debugging path via flagged/sampled tags.

## Implementation
- Tag helpers: `services/ai-gateway/src/services/metrics-tags.ts`.
- Client: `services/ai-gateway/src/services/datadog-metrics.ts`.
- Controllers updated to call `buildMetricTags()`.
- Dashboard/monitors pivot on provider/family.

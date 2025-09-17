# AI Gateway Latency Runbook

## When this fires
- p95 latency exceeds threshold for a given model_provider/model_family

## Possible causes
- Provider degradation or throttling
- Network issues or regional outages
- Recent deploy impacted performance

## Immediate actions
- Check Datadog dashboard: AI Gateway Observability (Provider/Family)
- Compare latency vs error metrics for the same tags
- Review last deploys and related changes

## Mitigations
- Fail over to fallback models in `services/ai-gateway/src/services/model-registry.ts`
- Reduce request concurrency / add rate limiting
- Enable DogStatsD for finer latency distributions if not already

## Follow-up
- Create incident ticket if persistent
- Update thresholds if too sensitive after analysis

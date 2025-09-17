# AI Gateway Error Runbook

## When this fires
- Error count elevated for a provider/family

## Possible causes
- Invalid inputs after a change
- Provider API incident
- Auth or quota issues

## Immediate actions
- Check errors by `error_class` and `http_status` in logs
- Review recent code changes in AI controller
- Validate provider credentials/secrets

## Mitigations
- Switch to fallback models if specific family/provider impacted
- Roll back recent change if error spike correlated

## Follow-up
- Add regression tests for the error scenario
- Update monitors thresholds after review

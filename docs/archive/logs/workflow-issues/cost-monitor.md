# Issue Draft: Evaluate `cost-monitor` Workflow

## Summary
The cost monitor currently echoes reminders weekly. We added concurrency but still need to decide whether to report real usage metrics or integrate with dashboards.

## Current Status
- Weekly cron + manual triggers send a static reminder; now guard against overlapping runs.
- No real cost data collected; no external notifications.

## Proposed Remediation
1. Hook into GitHub billing API or Datadog dashboards for actual usage.
2. Decide on notification target (Slack/email) or integrate into cost dashboards.
3. Consider replacing with a more actionable report or removing if redundant.

## Acceptance Criteria
- Workflow either gathers real metrics or is replaced/disabled with documented rationale.

## Progress Log
- **2025-09-30:** Added concurrency guard to prevent overlapping runs.
- **2025-09-30:** Added GitHub billing query and optional Slack notification; falls back to summary when token missing.

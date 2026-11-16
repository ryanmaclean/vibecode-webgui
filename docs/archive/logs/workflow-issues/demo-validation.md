# Issue Draft: Improve `demo-validation` Workflow

## Summary
The demo validation workflow builds the Go TUI, checks scripts, and runs limited integration steps. We added a concurrency guard, but flaky script timeouts and missing infra continue to produce noisy warnings. Capture enhancements before relying on the workflow for gatekeeping.

## Current Status
- Push/PR triggers plus manual dispatch; concurrency guard prevents overlapping runs.
- Integration job times out intentionally when infrastructure missing, producing noisy logs.
- No summary artifacts; shellcheck warnings tolerated.

## Proposed Remediation
1. Convert expected failures (e.g., demos requiring infra) into skipped steps or use conditional checks.
2. Upload demo binary and script logs as artifacts for PR reviewers.
3. Add a summary step indicating which validations passed/failed noisily.

## Acceptance Criteria
- Workflow clearly indicates success/warnings, avoids confusing timeouts, and provides artifacts when relevant.

## Progress Log
- **2025-09-30:** Added concurrency guard; planning log/noise cleanup next.

- **2025-09-30:** Added concurrency guard and summary/artifact support to the integration job.
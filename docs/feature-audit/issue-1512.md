# Feature Audit 1512: No Telemetry - Privacy-first design (NEXT_TELEMETRY_DISABLED=1)

## Source
- Release: VibeCode Desktop v1.5.0 - Apple Virtualization Framework & Performance (v1.5.0)
- Issue: #1512

## Summary
Audit status: **TBD**

This audit will confirm telemetry is disabled by default and document how
NEXT_TELEMETRY_DISABLED is enforced.

## Plan
- Locate telemetry/analytics configuration in mainline.
- Verify environment variable enforcement for NEXT_TELEMETRY_DISABLED.
- Update docs to reflect current behavior.
- Add/update tests once entrypoints are confirmed.

## Missing Info / Questions
- Where is telemetry configured (frontend/backend/build)?
- Are there any opt-in analytics paths?

## Tests
- TODO: Add unit/integration coverage once entrypoints are confirmed.

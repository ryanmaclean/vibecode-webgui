# Datadog Assets (ZFS Integration Merge)

This directory now combines the original Vibecode dashboards with reusable
artifacts derived from the ZFS Datadog integration work. Newly added files:

- `vibecode-telemetry-dashboard.json` – High-level dashboard skeleton showing HTTP
  request volume, synthetic smoke results, and a note panel explaining how to use
  the mock telemetry server during local runs.
- `vibecode-telemetry-monitors.json` – Query alert template for HTTP error rates,
  ported from the ZFS monitors and adapted to Vibecode naming/tagging.

The `scripts/mock-services/mock-telemetry-server.py` utility can be used together
with these templates to validate payload structure before sending data to Datadog.

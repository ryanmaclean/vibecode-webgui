# Dependabot Triage (2026-02-22)

## Snapshot
- Open alerts: 78
- Severity:
  - Critical: 3
  - High: 27
  - Medium: 35
  - Low: 13
- Ecosystems:
  - pip: 47
  - npm: 29
  - go: 1
  - rust: 1

## Immediate Priorities
1. Remove or quarantine non-production manifests that generate noisy alerts.
2. Patch critical vulnerabilities in active runtime paths.
3. Patch high-severity shared dependencies used across multiple manifests.

## Critical Alerts To Address First
- `fast-xml-parser` (GHSA-m7jm-9gc2-mpf2)
  - Affected manifests include `daemon/kafka-dsm/package-lock.json` and backup lockfiles.
- `semantic-kernel` (GHSA-xjw9-4gw8-4rqx)
  - Affected manifest: `templates/python/semantic-kernel-rag-app/requirements.txt`.

## High-Impact Repeated High Alerts
- `axios` (GHSA-43fc-jf86-j433) across multiple package-lock files.
- `python-multipart` (GHSA-wp53-j4wj-2cfg) across multiple Python template/example requirements files.
- `tar` advisories in `platforms/electron-vibecode/package-lock.json`.
- `fast-xml-parser` DoS advisory (GHSA-jmr7-xgp7-cmfj).

## Noise Sources To Clean Up
- `backups/security-patch-20260214_160432/package-lock.json` (backup artifacts should not drive security backlog).
- Template/example manifests that are not shipped or executed in production should be segregated from production risk tracking.

## Recommended Execution Plan
1. Classify manifests into `production`, `tooling`, `examples/templates`, `backups`.
2. Remove tracked backup lockfiles from default branch and keep them out of dependency scanning scope.
3. For production/tooling manifests:
   - Run targeted dependency bumps for critical/high advisories first.
   - Validate with existing CI and smoke tests.
4. For examples/templates:
   - Patch where practical.
   - If intentionally illustrative and not runnable by default, isolate from operational risk reporting.
5. Re-run alert inventory and track burn-down by severity.

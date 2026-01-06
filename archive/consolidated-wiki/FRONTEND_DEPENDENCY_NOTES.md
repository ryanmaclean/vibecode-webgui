---
title: Frontend Dependency Notes
description: Auto-generated placeholder. Update as needed.
---

# Frontend Dependency Notes

## @tremor/react Upgrade (September 16, 2025)

- Updated to `@tremor/react@4.0.0-beta-tremor-v4.4` to align with the root React 19.1.1 runtime.
- Prior versions enforced a `react@^18` peer dependency which forced `npm install --legacy-peer-deps` during upgrades.
- The beta release still emits `react-day-picker@8.x` peer warnings (expects React 18), but the package installs cleanly without bypass flags.
- Track GA availability of the v4 line and confirm when a stable release lands with React 19 peer support so we can drop the beta pin.

_Last reviewed: 2025-09-16_

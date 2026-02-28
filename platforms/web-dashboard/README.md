# VibeCode Web Dashboard (legacy / not actively developed)

> **Status: legacy / not actively developed**
>
> This directory contains a standalone Vite + React cluster-management dashboard.
> It is **not deployed, not CI-tested, and not the canonical admin UI**.
> See [`docs/ADR/frontend-surface.md`](../../docs/ADR/frontend-surface.md) for the decision record.

## Background

This dashboard was created as a lightweight standalone SPA for cluster management. The Next.js application (`src/`) was selected as the canonical frontend because it provides server-side rendering, authentication, and the full API surface required for production use.

## Canonical Frontend

All active UI development happens in the **Next.js application** at the repo root (`src/`):

```bash
npm run dev    # development server
npm run build  # production build
```

See the main [`README.md`](../../README.md) for full instructions.

## Local Experimentation (unsupported)

If you want to run this dashboard locally for reference:

```bash
cd platforms/web-dashboard
npm install
npm run dev
```

## Caveats

- Dependencies are **not kept up-to-date**; security patches are not tracked.
- This surface **does not share** authentication or API clients with the main application.
- No new features should be added here. Bring improvements into the Next.js app instead.

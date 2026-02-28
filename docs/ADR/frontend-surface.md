# ADR: Frontend/Admin Surface — Next.js app (canonical), web-dashboard (legacy)

## Status
Accepted

## Date
2026-02-25

---

## Context

VibeCode has two frontend surfaces:

1. **Next.js app** (`src/`) — The primary full-stack application, deployed to Docker/Kubernetes/Azure. Includes the admin UI, AI chat interface, user management, and all API routes.
2. **Standalone web-dashboard** (`platforms/web-dashboard/`) — A separate Vite + React SPA built for cluster management. It duplicates UI concerns already covered by the Next.js app and has its own independent dependency tree.

Maintaining both surfaces increases:

- Duplication of UI components, types, and API client code
- Dependency management burden (two separate `package.json` / lockfiles)
- Onboarding confusion ("which UI should I extend?")
- Testing surface that must be kept in sync

## Decision

**The Next.js application (`src/`) is the one canonical frontend and admin surface for VibeCode.**

- All new UI features and admin screens are implemented inside the Next.js app.
- `platforms/web-dashboard/` is preserved in the repository for reference but is **not actively developed, not CI-tested, and not deployed**.
- If any cluster-management UI improvements are needed, they should be added to the Next.js app (e.g., under `src/app/(dashboard)/`).

## Consequences

- `platforms/web-dashboard/README.md` documents its legacy/optional status.
- The `platforms/web-dashboard/` dependency tree is not kept up-to-date and security patches for it are not tracked.
- Any reusable patterns from the web-dashboard (e.g., Recharts usage, Tanstack Query patterns) should be ported into the Next.js app as needed.
- If the team decides to separate the admin surface in the future, a new ADR should supersede this one.

## Alternatives Considered

| Option | Rationale for rejection |
|--------|-------------------------|
| Remove `platforms/web-dashboard/` entirely | Premature; may contain useful reference implementations. Archiving in-place is lower risk. |
| Keep both surfaces equally supported | Doubles maintenance cost, creates user confusion over which UI to use. |
| Make web-dashboard the primary surface | It lacks auth, SSR, and the full API surface that the Next.js app provides. |

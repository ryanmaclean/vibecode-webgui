# Repository Guidelines

## Project Structure & Module Organization
- `src/app/` hosts Next.js routes/layouts, with shared UI in `src/components/`, domain utilities in `src/lib/`, and client providers in `src/providers/`.
- `server/` exposes the lightweight Node entrypoint for standalone API scenarios; `services/` encapsulates integrations (vector stores, auth, monitoring); `packages/vibecode-cli/` delivers the developer CLI.
- `tests/` groups Jest suites by domain (unit, integration, k8s, security) alongside Playwright journeys in `tests/e2e/`; fixtures live under `tests/__mocks__`.
- Assets and reference material live in `public/`, `docs/`, and `wiki/`, while deployment manifests sit in `docker/`, `helm/`, and `k8s/`.

## Build, Test, and Development Commands
- `npm run setup` primes local services (database seeds, telemetry stubs) before first boot.
- `npm run dev` starts the instrumentation-enabled Next.js server; use `npm run dev:docker` for the Compose stack, or `npm run dev:simple` when tracing is unnecessary.
- `npm run build` creates the production bundle and `npm start` serves it.
- Quality gates run via `npm run lint`, `npm run type-check`, and `npm run test`; `npm run test:e2e` triggers Playwright UI flows, and `npm run test:pre-commit` mirrors the CI smoke suite.

## Coding Style & Naming Conventions
- Write TypeScript-first React components; server components stay in `src/app/` and opt in to client mode with the `'use client';` directive.
- Follow `eslint.config.mjs` (Next.js + a11y rules) with 2-space indentation; prefer `npm run lint -- --fix` for formatting, and run Tailwind via `tailwind:restore` scripts after branch switches if styles drift.
- Use PascalCase for components/directories (e.g., `DatabaseConnectionMetrics.tsx`), camelCase for hooks/utilities, and suffix Jest specs with `.test.ts`.
- Keep Tailwind utility classes inline; promote shared patterns into composable components instead of global CSS.

## Testing Guidelines
- Use Jest for unit/integration coverage, structuring files beside source or within `tests/<domain>/` mirroring the module tree.
- Share fixtures through `tests/__mocks__` and extend the environment in `tests/setupTests.ts`.
- Maintain the enforced 80% global coverage thresholds (`npm run test:coverage`) before shipping core changes.
- Exercise Playwright journeys in `tests/e2e/*`; prefer `npm run test:e2e:headed` for debugging regressions and capture screenshots for PR context.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat:`, `fix(scope):`, `docs:`) as seen in recent history; keep commits scoped and self-testing.
- Before pushing, document validation commands in the PR description and link tracking issues or work items.
- For UI or monitoring updates, attach screenshots, logs, or dashboard URLs, and call out any new environment variables or feature flags.

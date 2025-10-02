# Repository Guidelines

## Project Structure & Module Organization
- Next.js 15 code lives in `src`; routes sit in `src/app`, shared UI in `src/components`, utilities in `src/lib`.
- Backend helpers and automation live in `server`, `services`, `scripts`, and the supporting `packages/*` modules.
- Infrastructure resides in `k8s`, `helm`, `azure`, `tofu`; static content in `public`/`docs`; the `tests` tree mirrors product scopes (unit, integration, e2e, k8s, monitoring).

## Build, Test, and Development Commands
- `npm run setup` provisions local prerequisites via `scripts/setup-development.js`.
- `npm run dev` enables instrumentation; use `npm run dev:simple` to skip Datadog tracing.
- Run `npm run build && npm run start` for production bundles and verify `npm run lint`, `npm run type-check`, `npm run test:unit` before any PR.
- `npm run test:e2e` or `npm run test:production:smoke` covers Playwright suites; `npm run test:integration` exercises API and database paths.

## Coding Style & Naming Conventions
- Write in TypeScript; components follow PascalCase filenames, hooks start with `use`, and route folders stay kebab-case for Next routing.
- ESLint (`eslint.config.mjs`) dictates style; keep the prevailing two-space indentation, single quotes, and trailing commas.
- Store primitives in `src/components/ui`, feature modules alongside their assets, and Jest mocks in nearby `__mocks__` folders.

## Testing Guidelines
- Jest (`jest.config.js`) loads shared setup via `tests/setupTests.ts` and enforces 80% coverage across branches, functions, lines, and statements.
- Name specs `*.test.ts` or `.tsx` within the appropriate `tests/<scope>` folder and reuse fixtures from `tests/__mocks__`.
- Playwright cases live in `tests/e2e`; set `BASE_URL` for staging or production targets and archive artifacts in `playwright-report/`.

## Commit & Pull Request Guidelines
- Stick to Conventional Commits (`feat:`, `fix:`, `chore:`) and keep subjects imperative and scoped.
- PRs must summarise the change, reference related issues, flag risk or rollout notes, and list verification commands.
- Request review per `CONTRIBUTING.md`, attach screenshots or logs for UX/monitoring changes, and merge only after CI succeeds.

## Environment & Security Notes
- Copy `.env.local.example` to `.env.local`; keep secrets out of git and tailor extra `.env` files per environment.
- Datadog requires `DD_API_KEY` and `DD_SITE`; validate telemetry with the `npm run monitoring:*` scripts before shipping.
- Adjust Kubernetes or Terraform defaults in `k8s/` and `tofu/terraform.tfvars` rather than editing live manifests; document credential handling in the PR.

## Micro-VM Prototype Notes (2025-10-02)
- Working tree lives in `fast-openvscode-vm/` (ignored); only docs and agent logs get checked in.
- Boot recipe, measurements, and follow-up work are documented in `docs/virtualization/openvscode-microvm.md` and `archive/agents/2025-10-02-openvscode-microvm.md`.
- Fix the HTTP reset on `/` first ([issue #552](https://github.com/ryanmaclean/vibecode-webgui/issues/552)) before chasing additional boot-time wins.
- Automate the timing harness and build the arm64 variant via [issue #553](https://github.com/ryanmaclean/vibecode-webgui/issues/553).
- When you add new findings, log them under `archive/agents/` so other agents can pick up the thread quickly.

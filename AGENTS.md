# Repository Guidelines

## Project Structure & Module Organization
- `src/app/` holds Next.js pages, layouts, and API routes; prefer co-locating route-specific assets here.
- `src/components/` stores reusable UI in PascalCase files; keep shared Tailwind patterns inside components.
- `src/lib/` contains hooks, services, and helpers in camelCase filenames such as `fetchData.util.ts`.
- `src/providers/` defines client-side context providers; add `'use client';` when a provider touches browser APIs.
- `server/services/` implements standalone API integrations; mock these in tests when stubbing external calls.
- `packages/vibecode-cli/` is the developer CLI; align CLI utilities with the web app contracts.
- `tests/` mirrors the source tree, with `tests/e2e/` hosting Playwright flows and fixtures.

## Build, Test, and Development Commands
- `npm run setup` seeds local dependencies and tooling.
- `npm run dev` starts the tracing-enabled Next.js dev server; use `npm run dev:simple` when instrumentation is unnecessary.
- `npm run dev:docker` launches the Compose stack for integration work.
- `npm run build` creates the production bundle; follow with `npm start` to verify.
- `npm run lint` runs ESLint + Prettier; append `-- --fix` to auto-format.
- `npm run type-check` executes TypeScript validation.
- `npm run test` (or `npm run test:coverage`) runs Jest suites; `npm run test:e2e` triggers Playwright.

## Coding Style & Naming Conventions
- Use 2-space indentation across TS/JS/TSX files with consistent semicolons and trailing commas where Prettier applies.
- Components follow PascalCase (`src/components/UserMenu.tsx`); hooks and utilities use camelCase with `.hook.ts` or `.util.ts` suffixes.
- Keep Tailwind classes inline; extract to components if reused.

## Testing Guidelines
- Jest powers unit/integration tests; Playwright covers end-to-end journeys.
- Maintain ≥80% global coverage via `npm run test:coverage` and enforce module-specific mocks under `tests/__mocks__/`.
- Mirror source filenames: `src/lib/useAuth.hook.ts` → `tests/lib/useAuth.hook.test.ts`.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat: add search filters`, `fix(auth): handle token refresh`).
- PRs must describe scope, link issues, list validation commands (e.g., `npm run build && npm run test`), and include screenshots or clips for UI updates.
- Note required environment variables in `.env.local` and mention secrets stay outside the repo.

## Security & Configuration Tips
- Stub outbound network calls via `server/services/` or Jest mocks; local dev blocks direct calls.
- Document new env vars within the PR and update onboarding docs when adding sensitive integrations.

---
name: project-conventions
description: >-
  VibeCode project conventions, patterns, and critical warnings.
  Preload into any agent working on this codebase.
disable-model-invocation: true
user-invocable: false
---

# VibeCode Project Conventions

## Stack
- Next.js 14 App Router + Tauri 2.9.1 desktop shell
- TypeScript strict mode, React 18, Tailwind CSS
- 321+ AI models via OpenRouter

## Page Patterns
- All pages use `'use client'` directive
- Icons from `lucide-react` (never heroicons or other icon libs)
- Styling: Tailwind CSS with dark mode (`dark:` prefix)
- Section layouts: sidebar nav with `usePathname()` active state

## API Route Patterns
- Routes at `src/app/api/**/route.ts` using `NextRequest`/`NextResponse`
- Auth: `getServerSession(authOptions)` from next-auth
- Rate limiting: `createAPIRateLimit` from `@/lib/rate-limit`
- Logging: `createServiceLogger` from `@/lib/logging`
- Error pattern: `try/catch` with `NextResponse.json({error}, {status})`

## Component Patterns
- Shared top nav: `AppNavigation` from `@/components/navigation`
- Error boundary: `ErrorBoundary` from `@/components/error/ErrorBoundary`
- Auth hook: `useAuth()` from `@/hooks/useAuth`
- Demo pages use `DemoBanner` from `@/components/ui/DemoBanner`

## Critical Warnings
- **tsconfig.json**: If deleted, `tsc` walks to parent dir config and compiles wrong files. ALWAYS verify it exists before running `tsc --noEmit`.
- **OOM prevention**: ALWAYS use `--maxWorkers=2` for Jest. Exit code 137 = OOM killed.
- **Orphaned tests**: After deleting source files or API routes, check `tests/` for files importing deleted modules.
- **node_modules in git**: This project tracks node_modules. Never modify it directly.

## File Locations
- Pages: `src/app/` (Next.js App Router)
- Components: `src/components/`
- Lib/utils: `src/lib/`
- API routes: `src/app/api/`
- Tests: `tests/unit/`, `tests/integration/`, `tests/`
- Types: `src/types/`

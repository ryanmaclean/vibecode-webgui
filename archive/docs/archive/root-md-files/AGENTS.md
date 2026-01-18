# VibeCode Web GUI Agent Instructions

This document provides guidelines for AI agents working on this codebase.

## Build, Lint, and Test

- **Lint:** `npm run lint`
- **Type Check:** `npm run type-check`
- **Test:** `npm run test`
- **Run a single test file:** `npx jest <path/to/test/file>`
- **Run E2E tests:** `npm run test:e2e`

## Code Style

- **Framework:** Next.js with React. Use functional components and hooks.
- **Language:** TypeScript. Use strict types and interfaces.
- **Styling:** Tailwind CSS. Use utility classes for styling.
- **Imports:** Organize imports: 1. React, 2. external libraries, 3. internal modules.
- **Formatting:** Follow existing code formatting. ESLint is configured.
- **Naming:** Use camelCase for variables and functions, PascalCase for components and types.
- **Error Handling:** Use try/catch blocks for async operations and handle errors gracefully.
- **Components:** Keep components small and focused on a single responsibility.
- **State Management:** Use React hooks (`useState`, `useContext`) for local state.
- **API Routes:** API logic is in `src/app/api/`.
- **Dependencies:** Add new dependencies with npm.

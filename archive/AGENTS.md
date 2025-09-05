# Agent Guidelines for vibecode-webgui

## Commands
- Build: `npm run build`
- Dev server: `npm run dev` or `npm run dev:simple`
- Lint: `npm run lint`
- Type check: `npm run type-check`
- Unit tests: `npm test` or `npm run test:unit`
- Run specific test: `npm test -- -t "test name"` or `jest path/to/test.test.ts`
- E2E tests: `npm run test:e2e`

## Code Style
- React functional components with TypeScript interfaces for props
- Import paths use `@/*` alias for `src/*` files
- Tailwind for styling with className patterns
- Unused parameters prefixed with underscore to avoid lint warnings
- Use React.FC type for components with proper TypeScript interfaces
- Strict null checks enabled, but some type strictness is relaxed
- Follow NextJS conventions for routing and API endpoints
- Error handling via try/catch with appropriate user feedback
- Prefer async/await over Promise chains
- Use Zod for data validation where appropriate
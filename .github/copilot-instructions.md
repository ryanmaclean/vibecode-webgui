# GitHub Copilot Instructions for VibeCode

This repository contains VibeCode, a containerized development platform with multiple IDE support.

## Issue Tracking

This project uses **bd (beads)** for issue tracking.
Run `bd prime` for workflow context, or install hooks (`bd hooks install`) for auto-injection.

**Quick reference:**
- `bd ready` - Find unblocked work
- `bd create "Title" --type task --priority 2` - Create issue
- `bd close <id>` - Complete work
- `bd sync` - Sync with git (run at session end)

For full workflow details: `bd prime`

## Repository Structure

```
config/       - Configuration files
docs/         - Documentation and archives
examples/     - Example code and demos
extensions/   - VS Code and IDE extensions
infrastructure/ - Ansible, Datadog, monitoring
packages/     - Monorepo packages
platforms/    - Platform-specific code (macos, docker, kubernetes, azure)
prisma/       - Database schema
public/       - Static assets
scripts/      - Build and utility scripts
src/          - Main application source (Next.js/React)
tests/        - Test files
tools/        - CLI tools and SDK
types/        - TypeScript type definitions
```

## Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes, Prisma ORM
- **Database**: PostgreSQL 17 with pgvector, Valkey (Redis-compatible)
- **Container**: Docker, Podman, Kubernetes, Apple Containers
- **Testing**: Vitest, Playwright
- **Monitoring**: Datadog APM, structured logging with Winston

## Code Style Guidelines

1. **TypeScript**: Use strict mode, prefer interfaces over types
2. **React**: Use functional components with hooks
3. **Imports**: Use absolute imports from `@/` prefix
4. **Testing**: Write tests alongside components in `__tests__/` folders
5. **Error Handling**: Use try/catch with proper error logging
6. **Security**: Never log secrets, use environment variables

## API Routes

API routes are in `src/app/api/`. Follow this pattern:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({ /* validation */ });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = schema.parse(body);
    // Handle request
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

## Database

- Use Prisma for database operations
- Schema is in `prisma/schema.prisma`
- Run `npx prisma generate` after schema changes

## Container Runtime

Use the runtime abstraction in `src/lib/runtime/container-abstraction.ts`:

```typescript
import { createRuntime, detectRuntime } from '@/lib/runtime/container-abstraction';

const runtime = createRuntime(await detectRuntime());
await runtime.start(containerId);
```

## Testing

```bash
npm test           # Run unit tests
npm run test:e2e   # Run Playwright E2E tests
```

## Common Patterns

### Agent Routing
See `src/lib/agents/routing.ts` for task-to-agent routing.

### Human-in-the-Loop
See `src/lib/workflow/hitl-manager.ts` for approval workflows.

### Security
- Credential rotation: `docs/security/credential-rotation.md`
- Security policy: `SECURITY.md`

## Do Not

- Do not commit secrets or API keys
- Do not use console.log (use Winston logger)
- Do not bypass TypeScript strict checks
- Do not add unnecessary dependencies

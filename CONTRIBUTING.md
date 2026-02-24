# Contributing to VibeCode

Thank you for your interest in contributing to VibeCode! This guide will help you understand how to set up your development environment, follow our coding standards, and submit contributions.

## Project Overview

VibeCode is an AI-native IDE and Agent Orchestrator built with:
- **Frontend**: Next.js 14 App Router with React 19 and TypeScript
- **Desktop Shell**: Tauri 2.9.1 (macOS, Linux, Windows)
- **Backend Infrastructure**: Docker, Kubernetes, PostgreSQL, Redis/Valkey
- **AI Models**: 321+ models via OpenRouter and Ollama

The application provides AI-powered development tools, agent orchestration, and advanced IDE features.

## Prerequisites

Before you begin, ensure you have:
- **Node.js**: >= 18.18.0 and < 25.0.0
- **npm**: >= 9.0.0
- **Git**: Latest version
- **Docker Desktop**: Latest (for running backend services)
- **macOS/Linux/Windows**: For Tauri desktop builds

### Optional Dependencies
- **Tauri CLI** (for desktop builds): `npm install -g @tauri-apps/cli`
- **Rust**: If building Tauri for production

## Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/ryanmaclean/vibecode.git
cd vibecode
```

### 2. Install Dependencies
```bash
npm install
```

The `postinstall` script will automatically ensure native binaries are available.

### 3. Start Development Server
```bash
npm run dev
```

This launches the Next.js development server on `http://localhost:3000`.

### 4. Run Tests
Always run tests with `--maxWorkers=2` to avoid out-of-memory errors:
```bash
npm test -- --maxWorkers=2
```

### 5. Build for Production
```bash
npm run build
npm start
```

## Project Structure

```
vibecode/
├── src/
│   ├── app/                 # Next.js App Router pages and layouts
│   │   ├── api/             # API routes (Next.js 14 route handlers)
│   │   ├── auth/            # Authentication pages
│   │   ├── chat/            # Chat and conversation pages
│   │   ├── settings/        # Settings pages
│   │   └── ...              # Other feature pages
│   ├── components/          # Reusable React components
│   │   ├── error/           # Error handling (ErrorBoundary)
│   │   ├── navigation/      # Navigation components
│   │   └── ...              # Feature-specific components
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Utility libraries and helpers
│   ├── middleware.ts        # Express/Next.js middleware
│   ├── providers/           # Context providers
│   └── styles/              # Global styles
├── tests/
│   ├── unit/                # Unit tests
│   ├── integration/         # Integration tests
│   ├── e2e/                 # End-to-end tests (Playwright)
│   └── k8s/                 # Kubernetes deployment tests
├── platforms/               # Desktop platform-specific code
│   ├── macos/               # macOS Tauri build
│   └── ...                  # Other platforms
├── scripts/                 # Build and setup scripts
├── docs/                    # Documentation
└── package.json             # Project configuration
```

## Development Workflow

### Creating a Feature Branch
```bash
git checkout -b feature/my-feature-name
```

Follow the naming convention: `feature/`, `bugfix/`, `refactor/`, or `docs/` prefix.

### Working on Code
1. Make your changes in a feature branch
2. Run tests frequently: `npm test -- --maxWorkers=2`
3. Check TypeScript: `npm run type-check`
4. Lint your code: `npm run lint`
5. Commit with clear, descriptive messages:
   ```bash
   git add src/...
   git commit -m "feat: add new feature description"
   ```

### Submitting a Pull Request
1. Push your branch to GitHub: `git push origin feature/my-feature-name`
2. Open a Pull Request with a clear title and description
3. Link related issues: `Closes #1234`
4. Ensure all CI checks pass
5. Request review from team members
6. Address feedback and re-request review

### Branch Protection and Merge Requirements

VibeCode enforces strict branch protection rules on the `main` branch to maintain code quality and prevent breaking changes from being merged.

#### Required Status Checks

All pull requests must pass the following CI checks before merging:

1. **PR Tests (`pr-test.yml`)** - Runs on every pull request
   - ✅ Node.js dependency installation
   - ✅ TypeScript type checking (`npm run type-check`)
   - ✅ ESLint code linting (`npm run lint`)
   - ✅ Next.js production build (`npm run build`)
   - ✅ Test suite execution (`npm test -- --maxWorkers=2`)

2. **Main Branch CI (`main-branch-ci.yml`)** - Additional validation
   - ✅ Code linting verification
   - ✅ TypeScript type checking
   - ✅ Unit test execution

3. **Security Scanning** (if configured)
   - ✅ Dependency vulnerability scanning
   - ✅ Code security analysis

**Note:** Optional checks (launcher tests, log uploads, test summaries) may show as warnings but won't block merging if they fail. Only the critical checks listed above are blocking.

#### Branch Protection Configuration

Repository maintainers should configure branch protection with the following settings:

**For the `main` branch:**

1. **Require pull request reviews before merging**
   - At least 1 approval required
   - Dismiss stale pull request approvals when new commits are pushed

2. **Require status checks to pass before merging**
   - Require branches to be up to date before merging
   - Required status checks:
     - `pr-test` (Node.js, TypeScript, Lint, Build, Tests)
     - `main-branch-ci` (Lint, Type-check, Unit tests)

3. **Do not allow bypassing the above settings**
   - Enforce requirements for administrators
   - This ensures even maintainers follow the same quality gates

4. **Additional recommended settings**
   - Require linear history (optional, prevents merge commits)
   - Require signed commits (optional, for enhanced security)

#### Why These Rules Matter

Branch protection rules ensure:
- **Code Quality**: TypeScript errors, linting issues, and test failures are caught before merge
- **Stability**: The `main` branch always builds successfully and passes all tests
- **Review Culture**: Every change receives human review before integration
- **Regression Prevention**: Automated tests verify new code doesn't break existing functionality

#### Troubleshooting CI Failures

If your pull request fails CI checks:

1. **Review the workflow logs**: Click "Details" next to the failed check
2. **Fix the issue locally**:
   ```bash
   npm run type-check  # Fix TypeScript errors
   npm run lint        # Fix linting issues
   npm run build       # Ensure build succeeds
   npm test -- --maxWorkers=2  # Fix failing tests
   ```
3. **Commit and push the fix**: CI will automatically re-run
4. **Need help?** See [`.github/workflows/TROUBLESHOOTING.md`](.github/workflows/TROUBLESHOOTING.md)

For detailed troubleshooting guidance on specific workflow failures, consult the [GitHub Actions Troubleshooting Guide](.github/workflows/TROUBLESHOOTING.md).

## Testing

Testing is critical to maintaining code quality. Always test your changes.

### Running Tests
```bash
# All tests with memory limit
npm test -- --maxWorkers=2

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e

# Watch mode (development)
npm run test:watch

# Coverage report
npm run test:coverage

# Kubernetes tests
npm run test:k8s
```

### Test File Naming Conventions
- Unit tests: `src/__tests__/module.test.ts` or `src/lib/__tests__/utility.test.ts`
- Integration tests: `tests/integration/feature.test.ts`
- E2E tests: `tests/e2e/feature.test.ts` (Playwright)

### Writing Tests
Use Jest for unit and integration tests, Playwright for E2E:
```typescript
// Unit test example
describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});

// API route test example
describe('GET /api/health', () => {
  it('should return 200 with health status', async () => {
    const response = await fetch('http://localhost:3000/api/health');
    expect(response.status).toBe(200);
  });
});
```

## Code Style & Standards

### TypeScript
- **Strict Mode**: TypeScript runs in strict mode for type safety
- **Null Checks**: `strictNullChecks` is enabled; handle nullable values explicitly
- **Config**: See `tsconfig.json` for full settings

### ESLint
- **Flat Config**: Uses ESLint 10 with flat config (`eslint.config.mjs`)
- **Run Linting**: Limited to critical paths by default
  ```bash
  npm run lint
  ```
- **React Version**: Explicitly configured for React 19.2

### Tailwind CSS
- **Utility-First**: Use Tailwind utilities for styling
- **Custom Colors**: Add custom colors to `tailwind.config.ts` if needed
- **Dark Mode**: Support dark mode with Tailwind's dark mode utilities

### Naming Conventions
- **Files**: Use kebab-case (`my-component.tsx`, `api-helper.ts`)
- **Components**: Use PascalCase (`MyComponent.tsx`)
- **Functions**: Use camelCase (`myUtilityFunction()`)
- **Constants**: Use SCREAMING_SNAKE_CASE (`MAX_RETRIES = 3`)

## API Route Patterns

All API routes follow Next.js 14 conventions:

### Basic Structure
```typescript
// src/app/api/my-endpoint/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

export async function GET(request: NextRequest) {
  // Authentication (if needed)
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Your logic
  const data = { message: 'Hello, World!' };
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  // Your logic
  return NextResponse.json({ success: true });
}
```

### Authentication
Use `getServerSession` with `authOptions` from the auth configuration:
```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const session = await getServerSession(authOptions);
if (!session?.user?.email) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### Logging
Use `createServiceLogger` for consistent logging:
```typescript
import { createServiceLogger } from '@/lib/logging/service-logger';

const logger = createServiceLogger('MyService');
logger.info('Action started', { userId: session.user.id });
logger.error('Action failed', { error: error.message });
```

### Rate Limiting
Apply rate limits for public endpoints:
```typescript
import { createAPIRateLimit } from '@/lib/rate-limit';

const rateLimit = createAPIRateLimit('endpoint-name');
const { allowed, response } = await rateLimit(request);
if (!allowed) return response;
```

## Key Conventions

### Pages
- Use `'use client'` directive for client-side pages
- Import lucide-react icons for UI elements
- Use ErrorBoundary for error handling
- Utilize AppNavigation for top navigation
- Sidebar layouts with `usePathname()` for active state

Example:
```typescript
'use client';

import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';

export default function Page() {
  const pathname = usePathname();
  return (
    <ErrorBoundary>
      <div className="flex">
        {/* Navigation */}
        {/* Content */}
      </div>
    </ErrorBoundary>
  );
}
```

### Components
- Keep components small and focused
- Export as named exports
- Use TypeScript for type safety
- Document complex props with JSDoc

```typescript
interface MyComponentProps {
  title: string;
  onAction?: (data: string) => void;
}

export function MyComponent({ title, onAction }: MyComponentProps) {
  return <div>{title}</div>;
}
```

### Hooks
- Store custom hooks in `src/hooks/`
- Use meaningful names prefixed with `use`
- Document hook dependencies and side effects

## Common Tasks

### Adding a New Page
1. Create directory: `src/app/my-feature/`
2. Create file: `src/app/my-feature/page.tsx`
3. Add layout if needed: `src/app/my-feature/layout.tsx`
4. Add tests: `tests/integration/my-feature.test.ts`

### Adding a New API Route
1. Create directory: `src/app/api/my-endpoint/`
2. Create file: `src/app/api/my-endpoint/route.ts`
3. Implement GET/POST/PUT/DELETE handlers
4. Add authentication and logging
5. Write tests: `tests/integration/api/my-endpoint.test.ts`

### Adding a New Component
1. Create file: `src/components/MyComponent.tsx`
2. Export named component
3. Add TypeScript types
4. Write unit tests: `tests/unit/components/MyComponent.test.ts`

## Troubleshooting

### Memory Issues During Tests
If you encounter out-of-memory errors:
```bash
# Always use maxWorkers=2
npm test -- --maxWorkers=2
```

### TypeScript Errors
```bash
# Check for type errors
npm run type-check

# Clear cache and rebuild
rm -rf .next
npm run build
```

### Build Failures
```bash
# Clear Next.js cache
rm -rf .next out

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

### ESLint Issues
```bash
# Check specific paths (configured subset)
npm run lint

# Fix auto-fixable issues
npx eslint --fix src/app/api/agents ...
```

## Performance Considerations

### Memory Management
- Jest tests limited to 2 workers to prevent OOM
- Use `--testTimeout` for longer-running tests
- Background tasks should avoid memory leaks

### Build Optimization
- Static optimization via Next.js build
- Tree-shaking enabled for production builds
- Docker builds use multi-stage approach

### Database Queries
- Paginate large result sets
- Use indexes for frequently queried fields
- Cache expensive operations

## Security Guidelines

- Never commit sensitive credentials (use environment variables)
- Validate all user input
- Sanitize HTML content
- Use HTTPS in production
- Follow OWASP guidelines
- Request code review for auth-related changes

## Getting Help

- **Documentation**: Check `docs/` directory for detailed guides
- **Issues**: Search existing GitHub issues or create a new one
- **Discussions**: Use GitHub Discussions for questions
- **Team**: Reach out to maintainers in Slack

## License

This project is licensed under the MIT License. By contributing, you agree to license your work under the same terms.

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Tauri Documentation](https://tauri.app/develop/)
- [Jest Testing Documentation](https://jestjs.io/docs/getting-started)

---

Thank you for contributing to VibeCode! We appreciate your effort to improve the project.

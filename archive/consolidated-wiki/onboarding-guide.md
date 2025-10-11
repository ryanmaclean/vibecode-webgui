---
title: Onboarding Guide
description: Auto-generated placeholder. Update as needed.
---

# Developer Onboarding Guide

Welcome to the VibeCode WebGUI development team! This guide will help you get up and running quickly with our comprehensive AI-powered development platform.

## 🚀 Day 1: Environment Setup

### Prerequisites Checklist

Before you begin, ensure you have:

- [ ] **Node.js 20+** installed ([Download here](https://nodejs.org/))
- [ ] **PostgreSQL 16+** with pgvector extension
- [ ] **Redis/Valkey 6+** (self-hosted or community-managed service)
- [ ] **Docker & Docker Compose** for local services
- [ ] **Git** configured with your credentials
- [ ] **VSCode** with recommended extensions (see below)

### VSCode Extensions Setup

Install these essential extensions for the best development experience:

```bash
# Essential extensions for VibeCode development
code --install-extension ms-vscode.vscode-typescript-next
code --install-extension bradlc.vscode-tailwindcss
code --install-extension ms-vscode.vscode-jest
code --install-extension ms-playwright.playwright
code --install-extension ms-vscode.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension ms-vscode.vscode-docker
code --install-extension ms-vscode.vscode-json
```

### Quick Start Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-org/vibecode-webgui.git
cd vibecode-webgui

# 2. Install dependencies
npm install --legacy-peer-deps

# 3. Copy environment template
cp .env.example .env.local

# 4. Start development services
docker-compose -f docker-compose.dev.yml up -d

# 5. Initialize database
npm run db:deploy
npm run db:generate

# 6. Run health check
npm run perf:health

# 7. Start development server
npm run dev
```

### Environment Variables Setup

Edit your `.env.local` file with these required values:

```bash
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/vibecode"

# Redis Cache
REDIS_URL="redis://localhost:6379"

# Authentication
NEXTAUTH_SECRET="your-super-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# AI Services
OPENAI_API_KEY="sk-your-openai-key"
ANTHROPIC_API_KEY="sk-ant-your-anthropic-key"

# LiteLLM Gateway
LITELLM_BASE_URL="http://localhost:4000"
LITELLM_API_KEY="sk-vibecode-master-key-12345"

# Monitoring (Optional)
DD_API_KEY="your-datadog-key"
DATADOG_ENABLED="false"
```

## 📚 Day 2-3: Architecture Understanding

### System Architecture Overview

```mermaid
graph TB
    Client[Web Browser] --> NextJS[Next.js App]
    NextJS --> API[API Routes]
    NextJS --> UI[UI Components]
    
    API --> Security[Security Middleware]
    API --> Cache[Redis Cache]
    API --> DB[(PostgreSQL + pgvector)]
    API --> AI[LiteLLM Gateway]
    
    Security --> Auth[NextAuth.js]
    Security --> RateLimit[Rate Limiting]
    Security --> Validation[Input Validation]
    
    AI --> OpenAI[OpenAI]
    AI --> Anthropic[Anthropic]
    AI --> Ollama[Local Models]
    
    Monitoring[Datadog] --> API
    Monitoring --> DB
    Monitoring --> AI
```

### Core Concepts

1. **Next.js App Router**: All pages and API routes use the new App Router pattern
2. **TypeScript First**: Everything is strongly typed with strict TypeScript
3. **Security Hardened**: Multiple layers of security middleware and validation
4. **Performance Optimized**: Redis caching, query optimization, and monitoring
5. **AI Unified**: Single LiteLLM gateway for all AI model access

### Key Directories

```
src/
├── app/                 # Next.js App Router pages and API routes
│   ├── api/            # All API endpoints
│   ├── (dashboard)/    # Dashboard route group
│   └── globals.css     # Global styles
├── components/         # Reusable React components
│   ├── ui/            # Base UI components (shadcn/ui)
│   ├── forms/         # Form components
│   └── layout/        # Layout components
├── lib/               # Core business logic and utilities
│   ├── ai/           # AI integration (LiteLLM client)
│   ├── auth/         # Authentication logic
│   ├── cache/        # Redis caching
│   ├── database/     # Database utilities and Prisma
│   ├── monitoring/   # Performance and health monitoring
│   ├── security/     # Security middleware and validation
│   └── utils/        # General utilities
└── hooks/            # Custom React hooks
```

## 🛠️ Day 4-5: Development Workflow

### Daily Development Commands

```bash
# Start your day
npm run dev                    # Start development server
npm run perf:health           # Check system health

# During development
npm run type-check            # TypeScript validation
npm run lint                  # Code quality check
npm run test:unit            # Run unit tests
npm run test:e2e             # Run E2E tests (slower)

# When working with database
npm run db:status            # Check migration status
npm run db:generate          # Generate Prisma client
npm run db:push              # Push schema changes

# When working with AI
npm run ai:status            # Check AI gateway health
npm run ai:models            # List available models
npm run ai:costs             # Check usage costs

# Documentation updates
npm run docs:build           # Regenerate all documentation
npm run docs:validate        # Validate documentation
```

### Code Style Guidelines

#### TypeScript Patterns

```typescript
// ✅ Good: Proper typing and error handling
export async function getUser(id: string): Promise<User | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      include: { workspaces: true }
    });
    return user;
  } catch (error) {
    logger.error('Failed to get user:', error);
    throw new Error('User not found');
  }
}

// ❌ Bad: No typing and poor error handling
export async function getUser(id) {
  const user = await prisma.user.findUnique({
    where: { id }
  });
  return user;
}
```

#### React Component Patterns

```typescript
// ✅ Good: Proper component structure with TypeScript
interface UserCardProps {
  user: User;
  onEdit?: (user: User) => void;
  className?: string;
}

export function UserCard({ user, onEdit, className }: UserCardProps) {
  return (
    <Card className={cn("p-4", className)}>
      <CardHeader>
        <CardTitle>{user.name}</CardTitle>
        <CardDescription>{user.email}</CardDescription>
      </CardHeader>
      {onEdit && (
        <CardFooter>
          <Button onClick={() => onEdit(user)}>
            Edit User
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

// ❌ Bad: No typing and unclear props
export function UserCard({ user, onEdit }) {
  return <div>...</div>;
}
```

#### API Route Patterns

```typescript
// ✅ Good: Proper API route with validation and error handling
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = await getToken({ req: request });
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const user = await getUser(params.id);
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: user,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ❌ Bad: No authentication, validation, or proper error handling
export async function GET(request, { params }) {
  const user = await prisma.user.findUnique({
    where: { id: params.id }
  });
  return NextResponse.json(user);
}
```

### Testing Patterns

#### Unit Testing

```typescript
// tests/unit/lib/utils.test.ts
import { formatCurrency, validateEmail } from '@/lib/utils';

describe('Utils', () => {
  describe('formatCurrency', () => {
    it('formats USD currency correctly', () => {
      expect(formatCurrency(123.45)).toBe('$123.45');
      expect(formatCurrency(0)).toBe('$0.00');
    });
  });

  describe('validateEmail', () => {
    it('validates email addresses', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('invalid-email')).toBe(false);
    });
  });
});
```

#### Integration Testing

```typescript
// tests/integration/api/users.test.ts
import { createMocks } from 'node-mocks-http';
import { GET } from '@/app/api/users/route';

describe('/api/users', () => {
  it('returns users list for authenticated request', async () => {
    const { req } = createMocks({
      method: 'GET',
      headers: {
        authorization: 'Bearer valid-token'
      }
    });

    const response = await GET(req as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });
});
```

#### E2E Testing

```typescript
// tests/e2e/auth/authentication.test.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('user can sign in and access dashboard', async ({ page }) => {
    await page.goto('/auth/signin');
    
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="signin-button"]');
    
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Dashboard');
    
    // Check if user menu is visible
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });
});
```

## 🔧 Common Development Tasks

### Adding a New API Endpoint

1. **Create the route file:**

```typescript
// src/app/api/workspaces/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request });
  
  if (!token) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const workspaces = await prisma.workspace.findMany({
    where: { userId: parseInt(token.sub!) },
    orderBy: { createdAt: 'desc' }
  });

  return NextResponse.json({
    success: true,
    data: workspaces
  });
}
```

2. **Add validation schema:**

```typescript
// src/lib/validations/workspace.ts
import { z } from 'zod';

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  isPublic: z.boolean().default(false)
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
```

3. **Update API client:**

```typescript
// src/lib/api/workspaces.ts
export async function getWorkspaces(): Promise<Workspace[]> {
  const response = await fetch('/api/workspaces');
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error);
  }
  
  return data.data;
}
```

4. **Add tests:**

```typescript
// tests/integration/api/workspaces.test.ts
describe('/api/workspaces', () => {
  it('returns user workspaces', async () => {
    // Test implementation
  });
});
```

### Adding a New UI Component

1. **Create the component:**

```typescript
// src/components/workspace-card.tsx
interface WorkspaceCardProps {
  workspace: Workspace;
  onSelect?: (workspace: Workspace) => void;
  className?: string;
}

export function WorkspaceCard({ 
  workspace, 
  onSelect, 
  className 
}: WorkspaceCardProps) {
  return (
    <Card 
      className={cn("cursor-pointer hover:shadow-md transition-shadow", className)}
      onClick={() => onSelect?.(workspace)}
    >
      <CardHeader>
        <CardTitle>{workspace.name}</CardTitle>
        <CardDescription>{workspace.description}</CardDescription>
      </CardHeader>
      <CardFooter className="text-sm text-muted-foreground">
        Created {formatDate(workspace.createdAt)}
      </CardFooter>
    </Card>
  );
}
```

2. **Add Storybook story (if using Storybook):**

```typescript
// src/components/workspace-card.stories.ts
export default {
  title: 'Components/WorkspaceCard',
  component: WorkspaceCard,
};

export const Default = {
  args: {
    workspace: {
      id: 1,
      name: 'My Workspace',
      description: 'A sample workspace',
      createdAt: new Date(),
    },
  },
};
```

3. **Add component tests:**

```typescript
// src/components/__tests__/workspace-card.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkspaceCard } from '../workspace-card';

const mockWorkspace = {
  id: 1,
  name: 'Test Workspace',
  description: 'Test description',
  createdAt: new Date(),
};

describe('WorkspaceCard', () => {
  it('renders workspace information', () => {
    render(<WorkspaceCard workspace={mockWorkspace} />);
    
    expect(screen.getByText('Test Workspace')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('calls onSelect when clicked', () => {
    const onSelect = jest.fn();
    render(<WorkspaceCard workspace={mockWorkspace} onSelect={onSelect} />);
    
    fireEvent.click(screen.getByRole('article'));
    expect(onSelect).toHaveBeenCalledWith(mockWorkspace);
  });
});
```

### Working with AI Features

```typescript
// Example: Adding a new AI-powered feature
import { litellmClient } from '@/lib/ai/litellm-client';

export async function generateCodeSuggestions(
  context: string,
  language: string,
  userId: string
): Promise<string[]> {
  const response = await litellmClient.chatCompletion({
    model: 'gpt-4o-mini', // Cost-effective model for code suggestions
    messages: [
      {
        role: 'system',
        content: `You are a helpful code assistant. Generate code suggestions for ${language}.`
      },
      {
        role: 'user',
        content: `Context: ${context}\n\nGenerate 3 code suggestions.`
      }
    ],
    temperature: 0.7
  }, userId);

  const suggestions = response.choices[0].message.content
    .split('\n')
    .filter(line => line.trim())
    .slice(0, 3);

  return suggestions;
}
```

## 🚨 Common Troubleshooting

### Database Issues

```bash
# Database connection issues
npm run db:validate

# Reset database (destructive)
npm run db:reset

# Check migration status
npm run db:status
```

### Cache Issues

```bash
# Clear Redis cache
npm run perf:cache

# Check cache health
curl http://localhost:3000/api/monitoring/performance?action=cache
```

### AI Gateway Issues

```bash
# Check LiteLLM status
npm run ai:status

# View available models
npm run ai:models

# Check usage and costs
npm run ai:usage && npm run ai:costs
```

### Performance Issues

```bash
# Check system health
npm run perf:health

# Monitor performance metrics
npm run perf:monitor

# Check database performance
npm run perf:database
```

## 📖 Resources and Documentation

### Essential Reading

1. **[Developer Guide](./DEVELOPER_GUIDE.md)** - Comprehensive technical documentation
2. **[API Documentation](./API.md)** - Auto-generated API reference
3. **[Security Guide](./security-guide.md)** - Security best practices
4. **[Performance Guide](./performance-guide.md)** - Optimization strategies

### External Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [LiteLLM Documentation](https://docs.litellm.ai)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com)

### Team Communication

- **Daily Standups**: 9 AM EST
- **Code Reviews**: Required for all pull requests
- **Architecture Discussions**: Thursdays 2 PM EST
- **Slack Channel**: #vibecode-development

## ✅ Your First Week Checklist

### Day 1-2: Setup
- [ ] Complete environment setup
- [ ] Run all health checks successfully
- [ ] Browse the codebase and understand structure
- [ ] Read core documentation

### Day 3-4: Small Contributions
- [ ] Fix a small bug or typo
- [ ] Add a unit test
- [ ] Update documentation
- [ ] Submit your first pull request

### Day 5: Understanding
- [ ] Complete a code review
- [ ] Add a new component or API endpoint
- [ ] Run the full test suite
- [ ] Deploy to a development environment

### Week 1 Goals
- [ ] Understand the overall architecture
- [ ] Know how to run and debug the application
- [ ] Be comfortable with the development workflow
- [ ] Make meaningful contributions to the codebase

## 🤝 Getting Help

Don't hesitate to ask for help! Here are the best ways:

1. **Slack**: Post in #vibecode-development
2. **GitHub Issues**: Create an issue for bugs or feature requests
3. **Code Reviews**: Tag experienced team members
4. **Pair Programming**: Schedule sessions with senior developers
5. **Documentation**: Check existing guides first

Welcome to the team! 🎉

---
name: testing-guide
description: >-
  VibeCode test conventions, Jest configuration, mock patterns, and known issues.
  Preload into test-fixer and quality-sweep agents.
disable-model-invocation: true
user-invocable: false
---

# VibeCode Testing Guide

## Framework
- Jest with ts-jest transform
- Test files: `*.test.ts`, `*.test.tsx`
- Locations: `tests/unit/`, `tests/integration/`, `tests/`

## Running Tests
```bash
# Full suite (ALWAYS use --maxWorkers=2)
npx jest --maxWorkers=2 --passWithNoTests

# Single file
npx jest --maxWorkers=2 path/to/file.test.ts

# With coverage
npx jest --maxWorkers=2 --coverage

# Pattern match
npx jest --maxWorkers=2 --testPathPattern="auth"
```

## Test Patterns
```typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

describe('ModuleName', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('functionName', () => {
    it('should handle normal input correctly', () => {
      // arrange, act, assert
    });

    it('should throw on invalid input', () => {
      expect(() => fn(null)).toThrow();
    });
  });
});
```

## Mock Patterns
- Mock next-auth: `jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))`
- Mock prisma: `jest.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: jest.fn() } } }))`
- Mock env vars: `process.env.X = 'value'` in beforeEach, cleanup in afterEach
- Mock fetch: `global.fetch = jest.fn().mockResolvedValue({ json: () => ({}) })`

## Known Pre-Existing Failures (do NOT fix, do NOT block on)
- `tests/feature-audit/issue-1527.test.ts`
- `tests/unit/components/AppNavigation.test.tsx`
- `tests/unit/lib/auth-password.test.ts` (2 failures)
- Several page-level tests with route-metrics issues

## Critical Rules
- NEVER use `--maxWorkers` > 2 (OOM, exit 137)
- NEVER delete tests to make suite pass
- After deleting source files, grep for orphaned test imports
- Mock external dependencies, never make real API/DB calls

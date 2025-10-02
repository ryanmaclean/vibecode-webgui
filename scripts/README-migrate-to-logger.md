# Console.log to Structured Logger Migration Guide

This guide explains how to use the migration script to replace `console.log` statements with our Winston-based structured logger.

## Overview

The migration script (`migrate-to-logger.js`) provides two modes:
- **Analyze mode**: Scan and report (safe, no changes)
- **Transform mode**: Apply changes automatically

## Quick Start

### 1. Analyze Your Code

Before making any changes, run an analysis to see what needs migration:

```bash
# Analyze all source files
node scripts/migrate-to-logger.js src/

# Analyze specific directory
node scripts/migrate-to-logger.js src/lib/

# Analyze specific file
node scripts/migrate-to-logger.js src/lib/unified-ai-client.ts
```

### 2. Review the Report

The script shows:
- Total files scanned and files with console statements
- Breakdown by log level (error, warn, info, debug)
- Line-by-line suggestions with context
- Recommended migration strategy

### 3. Generate Detailed Report

Save the analysis to a file for later review:

```bash
node scripts/migrate-to-logger.js -o migration-report.txt src/
```

### 4. Transform Files

Once you're ready, apply the transformations:

```bash
# Transform single file
node scripts/migrate-to-logger.js -t src/lib/unified-ai-client.ts

# Transform directory
node scripts/migrate-to-logger.js -t src/lib/

# Transform all source files
node scripts/migrate-to-logger.js -t src/
```

## What the Script Does

### Automatic Import Addition

The script automatically adds the logger import if it doesn't exist:

```typescript
import { logger } from '@/lib/logger';
```

Or uses the appropriate relative path:

```typescript
import { logger } from '../lib/logger';
import { logger } from '../../lib/logger';
```

### Console Method Mapping

| Console Method | Logger Method | Log Level |
|---------------|---------------|-----------|
| `console.error()` | `logger.error()` | error |
| `console.warn()` | `logger.warn()` | warn |
| `console.info()` | `logger.info()` | info |
| `console.log()` | `logger.info()` | info |
| `console.debug()` | `logger.debug()` | debug |

### Example Transformations

**Simple string:**
```typescript
// Before
console.log('User logged in');

// After
logger.info('User logged in');
```

**With variable:**
```typescript
// Before
console.error('Database error:', error);

// After
logger.error('Database error:', error);
```

**Template literal:**
```typescript
// Before
console.warn(`Failed to connect to ${provider}`);

// After
logger.warn(`Failed to connect to ${provider}`);
```

**Multiple arguments:**
```typescript
// Before
console.log('User:', userId, 'Action:', action);

// After
logger.info('User:', userId, 'Action:', action);
```

## Recommended Workflow

### Option 1: File-by-File (Safest)

Best for critical files or when you want maximum control:

```bash
# 1. Transform one file
node scripts/migrate-to-logger.js -t src/lib/unified-ai-client.ts

# 2. Review changes
git diff src/lib/unified-ai-client.ts

# 3. Test
npm test

# 4. Commit
git add src/lib/unified-ai-client.ts
git commit -m "migrate: Replace console.log with logger in unified-ai-client"
```

### Option 2: Directory-by-Directory

Good for migrating related functionality together:

```bash
# 1. Transform directory
node scripts/migrate-to-logger.js -t src/lib/vector-db/

# 2. Review changes
git diff src/lib/vector-db/

# 3. Test
npm test

# 4. Commit
git add src/lib/vector-db/
git commit -m "migrate: Replace console.log with logger in vector-db"
```

### Option 3: Batch Migration

Fastest approach, requires thorough testing:

```bash
# 1. Transform everything
node scripts/migrate-to-logger.js -t src/

# 2. Review changes
git diff

# 3. Run full test suite
npm test
npm run lint
npm run type-check

# 4. Commit
git add src/
git commit -m "migrate: Replace all console.log with structured logger"
```

## Migration Priority

### High Priority (Core Infrastructure)

These files have many console statements and should be migrated first:

1. `src/lib/vector-db/migration-helper.ts` (22 occurrences)
2. `src/lib/vector-store.ts` (20 occurrences)
3. `src/lib/monitoring/opentelemetry-config.ts` (19 occurrences)
4. `src/lib/vector-db/azure-postgres-connection.ts` (18 occurrences)
5. `src/lib/vector-db/postgres-vector-database-adapter.ts` (14 occurrences)

### Medium Priority (API Routes)

API routes benefit from structured logging for observability:

- `src/app/api/**/*` directories
- `src/lib/services/**/*` directories

### Low Priority (UI Components)

UI components can be migrated last (but still important):

- `src/components/**/*` directories
- `src/app/**/*` page files

## Quality Checks

After transformation, always run:

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Tests
npm test

# Full verification
npm run check && npm test
```

## Troubleshooting

### Import Path Issues

If the import path looks wrong after transformation, manually adjust:

```typescript
// The script calculates relative paths, but you can adjust if needed
import { logger } from '../lib/logger';  // Auto-generated
import { logger } from '@/lib/logger';   // Preferred alias
```

### Complex Console Statements

The script handles most cases, but some complex statements may need manual adjustment:

```typescript
// Before
console.log('Data:', { complex: obj.prop?.nested });

// After (may need manual review)
logger.info('Data:', { data: { complex: obj.prop?.nested } });
```

### Test Files

The script excludes test files by default. For test files, consider:
- Keeping `console.log` for debugging during development
- Using test-specific logging utilities
- Only migrating production code

## Command Reference

```bash
# Show help
node scripts/migrate-to-logger.js --help

# Analyze (dry-run, default)
node scripts/migrate-to-logger.js [paths...]
node scripts/migrate-to-logger.js --dry-run [paths...]
node scripts/migrate-to-logger.js -d [paths...]

# Transform (apply changes)
node scripts/migrate-to-logger.js --transform [paths...]
node scripts/migrate-to-logger.js -t [paths...]

# Generate report file
node scripts/migrate-to-logger.js --output report.txt [paths...]
node scripts/migrate-to-logger.js -o report.txt [paths...]

# Multiple options
node scripts/migrate-to-logger.js -t -o results.txt src/lib/
```

## Benefits of Structured Logging

After migration, you'll benefit from:

### 1. Environment-Aware Logging
- Production: JSON format, file rotation
- Development: Colorized, human-readable
- Test: Minimal output (errors only)

### 2. Log Levels
```typescript
logger.error('Critical error');     // Always logged
logger.warn('Warning message');     // Production + dev
logger.info('Informational');       // Production + dev
logger.debug('Debug details');      // Dev only
```

### 3. Structured Metadata
```typescript
logger.info('User action', {
  userId: '123',
  action: 'login',
  ip: req.ip,
  timestamp: Date.now()
});
```

### 4. Performance Logging
```typescript
import { logPerformance } from '@/lib/logger';

const start = Date.now();
await operation();
logPerformance('operation', Date.now() - start, { userId });
```

### 5. API Request Logging
```typescript
import { logApiRequest } from '@/lib/logger';

logApiRequest('GET', '/api/users', 200, 45, { userId: '123' });
```

## Support

For issues or questions:
- Check the [migration report](../migration-report.txt) for analysis
- Review [logger implementation](../src/lib/logger.ts)
- See [GitHub Issue #448](https://github.com/ryanmaclean/vibecode-webgui/issues/448)

## Current Status

**Project-wide Analysis:**
- Files scanned: 529
- Files with console: 276
- Total occurrences: 1,198
- Ready for migration: ✅

**Breakdown:**
- console.error(): 606 occurrences
- console.info(): 455 occurrences
- console.warn(): 131 occurrences
- console.debug(): 6 occurrences

# Guidelines: Avoiding Circular Dependencies

## Quick Reference

### ✅ DO

1. **Use Dependency Injection**
   ```typescript
   // Good
   class UserService {
     constructor(private db: DatabaseService) {}
   }
   ```

2. **Separate Interfaces from Implementations**
   ```typescript
   // types/user.interface.ts
   export interface IUserService { ... }

   // services/user.service.ts
   export class UserService implements IUserService { ... }
   ```

3. **Create Shared Type Files**
   ```typescript
   // types/common.ts
   export interface UserData { ... }
   export type UserId = string;
   ```

4. **Use Factory Pattern for Complex Dependencies**
   ```typescript
   // factories/service.factory.ts
   export class ServiceFactory {
     static create(): Service {
       return new Service(new DependencyA(), new DependencyB());
     }
   }
   ```

5. **Follow One-Way Import Flow**
   ```
   app/ → lib/ → types/
          ↓
        utils/
   ```

### ❌ DON'T

1. **Import from Index Files That Re-export You**
   ```typescript
   // BAD
   // index.ts
   export * from './moduleA';

   // moduleA.ts
   import { something } from './index'; // CIRCULAR!
   ```

2. **Create Bidirectional Service Dependencies**
   ```typescript
   // BAD
   // serviceA.ts
   import { ServiceB } from './serviceB';

   // serviceB.ts
   import { ServiceA } from './serviceA'; // CIRCULAR!
   ```

3. **Import Parent Modules from Children**
   ```typescript
   // BAD
   // parent/index.ts
   import { Child } from './child';

   // parent/child.ts
   import { Parent } from './index'; // CIRCULAR!
   ```

## Common Patterns

### Pattern 1: Service with Dependencies

```typescript
// types/embedding.types.ts
export interface EmbeddingConfig {
  apiKey: string;
  model: string;
}

export interface IEmbeddingService {
  generateEmbedding(text: string): Promise<number[]>;
}

// services/embedding.service.ts
import { IEmbeddingService, EmbeddingConfig } from '../types/embedding.types';

export class EmbeddingService implements IEmbeddingService {
  constructor(private config: EmbeddingConfig) {}

  async generateEmbedding(text: string): Promise<number[]> {
    // Implementation
  }
}

// factories/embedding.factory.ts
import { EmbeddingService } from '../services/embedding.service';
import { EmbeddingConfig } from '../types/embedding.types';

export class EmbeddingFactory {
  static create(config: EmbeddingConfig): EmbeddingService {
    return new EmbeddingService(config);
  }
}
```

### Pattern 2: Breaking Circular Dependencies

**Before (Circular):**
```typescript
// userService.ts
import { OrderService } from './orderService';

export class UserService {
  getOrders() {
    return OrderService.getForUser(this.id);
  }
}

// orderService.ts
import { UserService } from './userService'; // CIRCULAR!

export class OrderService {
  getUser() {
    return UserService.getById(this.userId);
  }
}
```

**After (Fixed with Events):**
```typescript
// events/user.events.ts
export interface UserOrderRequest {
  userId: string;
}

// userService.ts
import { eventBus } from './eventBus';

export class UserService {
  getOrders() {
    return eventBus.emit('user:getOrders', { userId: this.id });
  }
}

// orderService.ts
import { eventBus } from './eventBus';

export class OrderService {
  constructor() {
    eventBus.on('user:getOrders', this.handleGetOrders);
  }

  handleGetOrders(data: UserOrderRequest) {
    // Handle request
  }
}
```

**After (Fixed with Dependency Injection):**
```typescript
// interfaces/services.interface.ts
export interface IUserService {
  getById(id: string): Promise<User>;
}

export interface IOrderService {
  getForUser(userId: string): Promise<Order[]>;
}

// userService.ts
import { IOrderService } from './interfaces/services.interface';

export class UserService {
  constructor(private orderService: IOrderService) {}

  async getOrders() {
    return this.orderService.getForUser(this.id);
  }
}

// orderService.ts
import { IUserService } from './interfaces/services.interface';

export class OrderService {
  constructor(private userService: IUserService) {}

  async getUser() {
    return this.userService.getById(this.userId);
  }
}
```

### Pattern 3: Proper Type Organization

```
src/
├── types/
│   ├── models/          # Data models
│   │   ├── user.ts
│   │   └── order.ts
│   ├── services/        # Service interfaces
│   │   ├── user.interface.ts
│   │   └── order.interface.ts
│   └── common.ts        # Shared types
├── lib/
│   ├── services/        # Service implementations
│   │   ├── user.service.ts
│   │   └── order.service.ts
│   └── factories/       # Factory classes
│       └── service.factory.ts
└── app/
    └── api/             # API routes (top level)
```

## Checking for Circular Dependencies

### Manual Check
```bash
# Check for circular dependencies
npm run check:circular

# Or run directly
npx madge --circular --extensions ts,tsx src/
```

### Automated Check (Add to package.json)
```json
{
  "scripts": {
    "check:circular": "madge --circular --extensions ts,tsx src/",
    "precommit": "npm run check:circular",
    "prebuild": "npm run check:circular"
  }
}
```

### Pre-commit Hook
```bash
#!/bin/bash
# .husky/pre-commit

echo "Checking for circular dependencies..."
npx madge --circular --extensions ts,tsx src/

if [ $? -ne 0 ]; then
  echo "❌ Circular dependencies detected!"
  echo "Please fix circular dependencies before committing."
  exit 1
fi

echo "✅ No circular dependencies found"
```

## Debugging Circular Dependencies

### Step 1: Identify the Cycle
```bash
npx madge --circular --extensions ts,tsx src/ --warning
```

### Step 2: Visualize Dependencies
```bash
# Generate dependency graph
npx madge --image deps-graph.svg src/

# Generate only circular dependencies
npx madge --circular --image circular.svg src/
```

### Step 3: Analyze Import Chain
Use dpdm for detailed import chain analysis:
```bash
npx dpdm --circular --tree 'src/**/*.ts' 'src/**/*.tsx'
```

### Step 4: Fix Patterns

1. **Extract Shared Types** → Move to `types/` folder
2. **Use Interfaces** → Create interface file
3. **Dependency Injection** → Pass dependencies via constructor
4. **Event-Driven** → Use event bus for loose coupling
5. **Factory Pattern** → Centralize instantiation

## Architecture Guidelines

### Layer Hierarchy (Always Import Downward)

```
┌─────────────────────────────────────┐
│          App Layer (Routes)         │  ← Never import from here
├─────────────────────────────────────┤
│      Service Layer (Business Logic) │  ← Can import from below
├─────────────────────────────────────┤
│     Data Layer (DB, Cache, API)     │  ← Can import from below
├─────────────────────────────────────┤
│         Types (Interfaces, Models)  │  ← Can be imported by all
├─────────────────────────────────────┤
│         Utils (Pure functions)      │  ← Can be imported by all
└─────────────────────────────────────┘
```

### Module Independence

Each module should:
1. ✅ Have a clear, single responsibility
2. ✅ Define its public interface via types
3. ✅ Import from lower layers only
4. ✅ Not know about modules that import it

## Real Examples from This Project

### ✅ Good: Embedding Service Architecture
```
types/embedding.types.ts              ← Shared types
     ↑
     ├─ embedding-service.ts          ← Interface definition
     ↑
     ├─ azure-embedding-service.ts    ← Implementation
     ↑
     └─ embeddingServiceFactory.ts    ← Factory (imports all above)
```

### ❌ Bad: Original Issue (Now Fixed)
```
azureEmbeddingService.ts → embeddingServiceFactory.ts
        ↑                           ↓
        └───────────────────────────┘
        (Circular via .js wrappers - REMOVED)
```

## Testing for Circular Dependencies

### Unit Test Example
```typescript
// __tests__/dependencies.test.ts
describe('Dependency Architecture', () => {
  it('should not have circular dependencies', () => {
    const { exec } = require('child_process');

    exec('npx madge --circular --extensions ts,tsx src/', (error, stdout) => {
      expect(stdout).toContain('No circular dependency found');
    });
  });
});
```

## Resources

- [madge documentation](https://github.com/pahen/madge)
- [dpdm documentation](https://github.com/acrazing/dpdm)
- [Dependency Inversion Principle](https://en.wikipedia.org/wiki/Dependency_inversion_principle)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)

## Getting Help

If you encounter circular dependencies:

1. Run `npx madge --circular --extensions ts,tsx src/ --warning`
2. Identify the cycle in the output
3. Check this guide for the appropriate fix pattern
4. Consult `/docs/DEPENDENCY_ANALYSIS_REPORT.md` for detailed examples
5. Ask for code review if unsure

## Version History

- **2025-11-06:** Initial guidelines created after resolving all circular dependencies
- Current Status: ✅ Zero circular dependencies in project

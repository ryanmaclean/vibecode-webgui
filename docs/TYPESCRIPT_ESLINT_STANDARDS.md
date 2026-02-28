# TypeScript & ESLint Standards

## Overview

The VibeCode Platform enforces strict TypeScript and ESLint configurations to prevent type-unsafe code and maintain consistent code quality across all projects. This document explains the rationale for each rule, acceptable exceptions, and best practices for proper typing.

## Philosophy

**Strict typing from day one is easier than retrofitting later.**

We prioritize:
- Type safety over convenience
- Explicit over implicit
- Compile-time safety over runtime errors
- Consistency over individual preference

## TypeScript Configuration

### Base Configuration: `config/typescript/tsconfig.base.json`

All projects should extend this base configuration:

```json
{
  "extends": "../config/typescript/tsconfig.base.json"
}
```

### Strict Mode Flags

#### `"strict": true`

**What it does:** Enables all strict type-checking options simultaneously.

**Rationale:** Catches type errors early and prevents common JavaScript pitfalls.

**Individual flags enabled:**

##### `"noImplicitAny": true`

**What it does:** Errors when TypeScript cannot infer a type and defaults to `any`.

**Rationale:** `any` disables type checking and defeats the purpose of TypeScript.

**Instead of:**
```typescript
function processData(data) {  // ❌ Implicit 'any'
  return data.value;
}
```

**Write:**
```typescript
interface Data {
  value: string;
}

function processData(data: Data): string {  // ✅ Explicit types
  return data.value;
}
```

**Acceptable exception:** None. Always provide explicit types.

##### `"strictNullChecks": true`

**What it does:** `null` and `undefined` are not assignable to other types unless explicitly allowed.

**Rationale:** Prevents "Cannot read property of null/undefined" runtime errors.

**Instead of:**
```typescript
function getUser(id: string): User {  // ❌ Might return null
  return users.find(u => u.id === id);
}
```

**Write:**
```typescript
function getUser(id: string): User | undefined {  // ✅ Explicit nullability
  return users.find(u => u.id === id);
}

// Usage with proper null checking
const user = getUser('123');
if (user !== undefined) {
  console.log(user.name);  // Safe access
}
```

##### `"strictFunctionTypes": true`

**What it does:** Function parameter types are checked contravariantly instead of bivariantly.

**Rationale:** Prevents type-unsafe function assignments.

**Example:**
```typescript
type EventHandler = (event: MouseEvent) => void;
type ClickHandler = (event: Event) => void;

const handler: EventHandler = (event) => {
  console.log(event.clientX);  // Safe - MouseEvent has clientX
};

// ❌ This would fail with strictFunctionTypes
// const generic: ClickHandler = handler;  // Error: Event might not have clientX
```

##### `"strictBindCallApply": true`

**What it does:** Enforces correct types for `.bind()`, `.call()`, and `.apply()`.

**Rationale:** Prevents runtime errors from incorrect function invocation.

##### `"strictPropertyInitialization": true`

**What it does:** Class properties must be initialized in the constructor or have a definite assignment assertion.

**Rationale:** Prevents accessing uninitialized properties.

**Instead of:**
```typescript
class UserManager {
  private currentUser: User;  // ❌ Not initialized

  setUser(user: User) {
    this.currentUser = user;
  }
}
```

**Write:**
```typescript
class UserManager {
  private currentUser: User | null = null;  // ✅ Initialized

  setUser(user: User): void {
    this.currentUser = user;
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }
}
```

**Acceptable exception:** Use `!` assertion when you know initialization happens outside constructor:
```typescript
class Component {
  private element!: HTMLElement;  // Initialized in mount()

  mount(selector: string): void {
    this.element = document.querySelector(selector)!;
  }
}
```

##### `"noImplicitThis": true`

**What it does:** Errors when `this` has an implicit `any` type.

**Rationale:** Prevents confusion about `this` context in JavaScript.

**Write:**
```typescript
function logName(this: { name: string }): void {  // ✅ Explicit 'this' type
  console.log(this.name);
}
```

##### `"alwaysStrict": true`

**What it does:** Emits `"use strict"` in all JavaScript output files.

**Rationale:** Enforces strict mode runtime behavior.

### Additional Strict Checks

##### `"noUnusedLocals": true`

**What it does:** Errors on unused local variables.

**Rationale:** Dead code indicates bugs or incomplete refactoring.

**Acceptable exception:** Prefix with `_` for intentionally unused variables:
```typescript
function handler(_event: Event): void {  // ✅ Intentionally unused
  console.log('Handler called');
}
```

##### `"noUnusedParameters": true`

**What it does:** Errors on unused function parameters.

**Rationale:** Same as `noUnusedLocals`.

**Acceptable exception:** Use `_` prefix or configure in function signature:
```typescript
const map = items.map((_item, index) => index);  // ✅ Intentionally unused
```

##### `"noImplicitReturns": true`

**What it does:** All code paths in a function must explicitly return a value.

**Rationale:** Prevents accidental `undefined` returns.

**Instead of:**
```typescript
function getStatus(code: number): string {
  if (code === 200) {
    return 'OK';
  }
  // ❌ Implicitly returns undefined
}
```

**Write:**
```typescript
function getStatus(code: number): string {
  if (code === 200) {
    return 'OK';
  }
  return 'Error';  // ✅ All paths return
}
```

##### `"noFallthroughCasesInSwitch": true`

**What it does:** Errors on switch case fallthrough without explicit `break` or `return`.

**Rationale:** Fallthrough is usually a bug, not intentional.

##### `"noUncheckedIndexedAccess": true`

**What it does:** Accessing array/object properties returns `T | undefined` instead of `T`.

**Rationale:** Array/object access might not find the key.

**Instead of:**
```typescript
const items: string[] = ['a', 'b'];
const first = items[0];  // Type: string | undefined
console.log(first.toUpperCase());  // ❌ Might be undefined
```

**Write:**
```typescript
const items: string[] = ['a', 'b'];
const first = items[0];
if (first !== undefined) {
  console.log(first.toUpperCase());  // ✅ Safe access
}

// Or use optional chaining
console.log(items[0]?.toUpperCase());  // ✅ Returns undefined if not found
```

## ESLint Configuration

### Base Configuration: `config/eslint/eslint.base.mjs`

Import and extend this configuration in project-specific ESLint configs:

```javascript
import baseConfig from '../../config/eslint/eslint.base.mjs';

export default [
  ...baseConfig,
  // Project-specific overrides
];
```

### Strict Type Safety Rules

#### `@typescript-eslint/no-explicit-any: error`

**Rationale:** `any` disables all type checking. It's a type escape hatch that should be avoided.

**Instead of:**
```typescript
function processData(data: any): any {  // ❌ No type safety
  return data.result;
}
```

**Write:**
```typescript
// Define proper types
interface ApiResponse<T> {
  result: T;
  status: number;
}

function processData<T>(data: ApiResponse<T>): T {  // ✅ Type-safe
  return data.result;
}
```

**When you must use `any`:** (very rare)
```typescript
// External library with no types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const legacyLib: any = require('legacy-untyped-lib');
```

**Better alternatives:**
1. Create a `.d.ts` declaration file
2. Use `unknown` and type guards
3. Use generics

**Using `unknown` instead of `any`:**
```typescript
function parseJson(jsonString: string): unknown {  // ✅ Safe unknown
  return JSON.parse(jsonString);
}

const result = parseJson('{"name":"Alice"}');

// Must use type guard
if (typeof result === 'object' && result !== null && 'name' in result) {
  console.log((result as { name: string }).name);
}
```

#### `@typescript-eslint/no-unsafe-assignment: error`

**Rationale:** Assigning `any` to typed variables defeats type safety.

**Instead of:**
```typescript
const data: any = await fetch('/api/users');
const user: User = data;  // ❌ Unsafe assignment
```

**Write:**
```typescript
const response = await fetch('/api/users');
const data: unknown = await response.json();

// Validate and type guard
if (isUser(data)) {
  const user: User = data;  // ✅ Type-safe
}

function isUser(obj: unknown): obj is User {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj &&
    typeof (obj as User).name === 'string'
  );
}
```

#### `@typescript-eslint/no-unsafe-member-access: error`

**Rationale:** Accessing properties on `any` bypasses type checking.

**Write type guards:**
```typescript
function processResponse(response: unknown): void {
  if (
    typeof response === 'object' &&
    response !== null &&
    'data' in response
  ) {
    console.log(response.data);  // ✅ Safe after guard
  }
}
```

#### `@typescript-eslint/no-unsafe-call: error`

**Rationale:** Calling functions with `any` type can cause runtime errors.

#### `@typescript-eslint/no-unsafe-return: error`

**Rationale:** Returning `any` from typed functions defeats type safety.

#### `@typescript-eslint/no-unsafe-argument: error`

**Rationale:** Passing `any` to typed parameters bypasses validation.

### Async/Promise Safety

#### `@typescript-eslint/no-floating-promises: error`

**Rationale:** Unhandled promise rejections can crash the application.

**Instead of:**
```typescript
async function saveData(): Promise<void> {
  // ...
}

saveData();  // ❌ Promise not awaited or handled
```

**Write:**
```typescript
// Option 1: await
await saveData();  // ✅ Awaited

// Option 2: explicit handling
saveData().catch(error => {  // ✅ Handled
  console.error('Save failed:', error);
});

// Option 3: void for fire-and-forget
void saveData();  // ✅ Explicitly ignored
```

#### `@typescript-eslint/no-misused-promises: error`

**Rationale:** Prevents using promises in synchronous contexts (e.g., if conditions).

**Instead of:**
```typescript
if (fetchUser()) {  // ❌ Promise in boolean context
  // ...
}
```

**Write:**
```typescript
const user = await fetchUser();  // ✅ Await first
if (user) {
  // ...
}
```

#### `@typescript-eslint/await-thenable: error`

**Rationale:** Only await actual promises, not non-promise values.

#### `@typescript-eslint/promise-function-async: error`

**Rationale:** Functions returning promises should be marked `async` for clarity.

### Code Quality Rules

#### `@typescript-eslint/no-unused-vars: error`

**Configuration:**
```javascript
{
  argsIgnorePattern: '^_',      // Ignore _param
  varsIgnorePattern: '^_',      // Ignore _variable
  ignoreRestSiblings: true      // Ignore rest in destructuring
}
```

**Examples:**
```typescript
const { used, ...rest } = obj;  // ✅ rest is ignored
console.log(used);

function handler(_event: Event): void {  // ✅ _event ignored
  console.log('handled');
}
```

#### `@typescript-eslint/no-non-null-assertion: error`

**Rationale:** `!` operator bypasses null safety and can cause runtime errors.

**Instead of:**
```typescript
const element = document.querySelector('.button')!;  // ❌ Might be null
element.click();
```

**Write:**
```typescript
const element = document.querySelector('.button');
if (element) {
  element.click();  // ✅ Safe
}

// Or throw explicitly
const element = document.querySelector('.button');
if (!element) {
  throw new Error('Button not found');
}
element.click();  // ✅ Safe after guard
```

**Acceptable exception:** When TypeScript inference is wrong:
```typescript
const config = loadConfig();
// We know config.api exists from validation
const apiUrl = config.api!.url;  // Sometimes necessary
```

#### `@typescript-eslint/prefer-nullish-coalescing: error`

**Rationale:** `??` is safer than `||` for default values.

**Instead of:**
```typescript
const count = input || 0;  // ❌ Treats '' and 0 as falsy
```

**Write:**
```typescript
const count = input ?? 0;  // ✅ Only null/undefined trigger default
```

#### `@typescript-eslint/prefer-optional-chain: error`

**Rationale:** Optional chaining is safer and more readable.

**Instead of:**
```typescript
const street = user && user.address && user.address.street;  // ❌ Verbose
```

**Write:**
```typescript
const street = user?.address?.street;  // ✅ Concise and safe
```

#### `@typescript-eslint/strict-boolean-expressions: error`

**Rationale:** Only use actual booleans in conditions, preventing truthy/falsy bugs.

**Instead of:**
```typescript
if (count) {  // ❌ 0 is falsy
  // ...
}

if (message) {  // ❌ '' is falsy
  // ...
}
```

**Write:**
```typescript
if (count > 0) {  // ✅ Explicit check
  // ...
}

if (message !== '') {  // ✅ Explicit check
  // ...
}

// For nullable values
if (user !== null && user !== undefined) {  // ✅ Explicit
  // ...
}

// Or shorter
if (user != null) {  // ✅ Checks both null and undefined
  // ...
}
```

#### `@typescript-eslint/explicit-function-return-type: error`

**Rationale:** Explicit return types catch errors and improve readability.

**Configuration:** Allows expressions and higher-order functions for convenience.

**Write:**
```typescript
// ✅ Explicit return type
function getUser(id: string): User | undefined {
  return users.find(u => u.id === id);
}

// ✅ Arrow function expression (allowed)
const double = (n: number) => n * 2;

// ✅ Typed function expression (allowed)
const handler: EventHandler = (event) => {
  console.log(event.type);
};
```

#### `@typescript-eslint/explicit-module-boundary-types: error`

**Rationale:** Exported functions should have explicit types for API clarity.

**Write:**
```typescript
// ✅ Exported function with explicit types
export function parseConfig(raw: string): Config {
  return JSON.parse(raw);
}
```

#### `@typescript-eslint/no-unnecessary-type-assertion: error`

**Rationale:** Unnecessary assertions add noise and might hide real issues.

#### `@typescript-eslint/no-unnecessary-condition: error`

**Rationale:** Conditions that are always true/false indicate logic errors.

**Instead of:**
```typescript
const value: string = 'hello';
if (value !== undefined) {  // ❌ Always true
  // ...
}
```

## Test Files: Relaxed Rules

Test files have relaxed type safety rules for pragmatic testing:

**Patterns that match test files:**
- `**/*.test.ts`
- `**/*.test.tsx`
- `**/__tests__/**/*.ts`
- `**/__tests__/**/*.tsx`
- `**/*.spec.ts`
- `**/*.spec.tsx`

**Relaxed rules:**
- `@typescript-eslint/no-explicit-any: warn` (instead of error)
- Unsafe operations: `warn` instead of `error`
- `explicit-function-return-type: off`
- `explicit-module-boundary-types: off`
- `strict-boolean-expressions: off`

**Rationale:** Tests often interact with mock objects and external libraries where strict typing is impractical.

**Still maintain good practices:**
```typescript
// ✅ Good test typing
test('should parse user data', () => {
  const mockData = { id: '1', name: 'Alice' };
  const result = parseUser(mockData);
  expect(result.name).toBe('Alice');
});

// ⚠️ Acceptable in tests
test('should handle any legacy format', () => {
  const legacyData: any = getLegacyFormat();  // Warning, not error
  const result = migrate(legacyData);
  expect(result).toBeDefined();
});
```

## Common Patterns and Solutions

### Working with External APIs

**Problem:** API responses are untyped.

**Solution:** Define types and validate:

```typescript
interface ApiUser {
  id: string;
  name: string;
  email: string;
}

function isApiUser(obj: unknown): obj is ApiUser {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj &&
    'email' in obj &&
    typeof (obj as ApiUser).id === 'string' &&
    typeof (obj as ApiUser).name === 'string' &&
    typeof (obj as ApiUser).email === 'string'
  );
}

async function fetchUser(id: string): Promise<ApiUser> {
  const response = await fetch(`/api/users/${id}`);
  const data: unknown = await response.json();

  if (!isApiUser(data)) {
    throw new Error('Invalid user data from API');
  }

  return data;
}
```

### Working with `JSON.parse`

**Problem:** `JSON.parse` returns `any`.

**Solution:** Type guard after parsing:

```typescript
function parseConfig(jsonString: string): Config {
  const parsed: unknown = JSON.parse(jsonString);

  if (!isConfig(parsed)) {
    throw new Error('Invalid config JSON');
  }

  return parsed;
}

function isConfig(obj: unknown): obj is Config {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'apiUrl' in obj &&
    typeof (obj as Config).apiUrl === 'string'
  );
}
```

### Working with Third-Party Libraries

**Problem:** Library has no TypeScript types.

**Solutions:**

1. **Install DefinitelyTyped definitions:**
```bash
npm install --save-dev @types/library-name
```

2. **Create a local declaration file** (`types/library-name.d.ts`):
```typescript
declare module 'legacy-library' {
  export function doSomething(input: string): Promise<Result>;

  export interface Result {
    success: boolean;
    data: unknown;
  }
}
```

3. **Use `unknown` and type guards:**
```typescript
import * as legacyLib from 'legacy-library';

function useLegacy(input: string): ProcessedResult {
  const result: unknown = legacyLib.process(input);

  if (isValidResult(result)) {
    return transformResult(result);
  }

  throw new Error('Unexpected result from legacy library');
}
```

### Event Handlers

**Problem:** Event types vary.

**Solution:** Use specific event types:

```typescript
// ✅ Specific event type
function handleClick(event: MouseEvent): void {
  console.log(event.clientX, event.clientY);
}

// ✅ React synthetic events
function handleChange(event: React.ChangeEvent<HTMLInputElement>): void {
  console.log(event.target.value);
}

// ✅ Custom event with type guard
function handleCustomEvent(event: Event): void {
  if (event instanceof CustomEvent) {
    console.log(event.detail);
  }
}
```

### Dynamic Object Properties

**Problem:** Need to dynamically access properties.

**Solution:** Use index signatures or type guards:

```typescript
// Option 1: Index signature
interface FlexibleConfig {
  [key: string]: string | number | boolean;
  required: string;
}

// Option 2: Type guard for dynamic access
function getProperty<T extends object, K extends keyof T>(
  obj: T,
  key: K
): T[K] {
  return obj[key];
}

// Option 3: Record type
type ConfigMap = Record<string, string>;

const config: ConfigMap = {
  apiUrl: 'https://api.example.com',
  timeout: '5000',
};
```

## Migration Strategy

When migrating existing code to strict mode:

1. **Fix one file at a time** - Don't try to fix everything at once
2. **Start with leaf modules** - Files with no dependencies
3. **Add types incrementally** - Replace `any` with `unknown`, then refine
4. **Use type assertions temporarily** - Add `// TODO: proper typing` comments
5. **Run type-check frequently** - Catch new errors early

### Temporary Escape Hatches (Use Sparingly)

```typescript
// For gradual migration, mark TODOs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const temp: any = legacyFunction(); // TODO: Add proper types

// Or use unknown with casting
const temp = legacyFunction() as unknown as TemporaryType;
```

## Enforcement

### Local Development

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Both with zero tolerance
npm run lint -- --max-warnings 0
```

### CI/CD

GitHub Actions will enforce:
- Zero TypeScript errors
- Zero ESLint warnings or errors
- All projects pass type-check and lint

### Pre-commit Hooks

Consider adding:
```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run type-check && npm run lint"
    }
  }
}
```

## Summary

### Key Principles

1. **Explicit is better than implicit** - Always specify types
2. **Safety over convenience** - Type checks prevent runtime errors
3. **No `any` in production code** - Use `unknown` and type guards
4. **Handle nullability explicitly** - Check for null/undefined
5. **Await promises properly** - No floating promises
6. **Use strict boolean expressions** - No truthy/falsy shortcuts

### When in Doubt

- **Can I use `any`?** → No, use `unknown` or generics
- **Can I use `!` assertion?** → Rarely, prefer type guards
- **Can I skip return types?** → No, always explicit
- **Can I use `||` for defaults?** → Use `??` instead
- **Can I ignore promises?** → No, await or `.catch()` or `void`

### Getting Help

When you encounter a strict mode error you can't solve:

1. Read the error message carefully - TypeScript errors are informative
2. Check this document for patterns
3. Search for the specific rule in the ESLint/TypeScript docs
4. Ask the team in #engineering-help
5. Create a type guard or validation function

---

**Remember:** These rules exist to catch bugs before they reach production. The initial learning curve pays dividends in code reliability and maintainability.

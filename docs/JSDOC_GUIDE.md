# JSDoc Style Guide for VibeCode WebGUI

This guide establishes consistent JSDoc documentation standards across the VibeCode WebGUI codebase.

## Overview

JSDoc comments provide inline documentation for TypeScript/JavaScript code, improving IDE intellisense, code maintainability, and developer onboarding. This guide covers our conventions for documenting functions, classes, interfaces, and modules.

## Basic Syntax

```typescript
/**
 * Brief one-line description of the function or class
 *
 * Optional longer description that provides additional context,
 * usage notes, or implementation details. Can span multiple lines.
 *
 * @param paramName - Description of the parameter
 * @returns Description of the return value
 * @throws Description of errors that may be thrown
 * @example
 * // Example usage code
 * const result = myFunction('value');
 */
```

## Core Principles

1. **Clarity Over Brevity**: Write clear, helpful descriptions that aid understanding
2. **Focus on Why, Not What**: Explain purpose and context, not obvious implementation details
3. **Include Examples**: Add usage examples for complex functions or non-obvious APIs
4. **Document Edge Cases**: Note important edge cases, error conditions, and security considerations
5. **Keep Current**: Update JSDoc when changing function signatures or behavior

## Required Documentation

### Functions and Methods

All exported functions and public methods must include:
- Brief description (one line)
- `@param` tags for all parameters
- `@returns` tag if function returns a value
- `@throws` tag if function throws specific errors

```typescript
/**
 * Generates a secure bcrypt hash for password storage
 *
 * Uses bcrypt with configurable salt rounds (default: 12).
 * Higher salt rounds increase security but require more CPU time.
 *
 * @param plain - The plaintext password to hash
 * @param saltRounds - Number of bcrypt salt rounds (4-31, default: 12)
 * @returns Promise resolving to the bcrypt hash string
 * @throws {Error} If password is empty or salt rounds are invalid
 *
 * @example
 * const hash = await hashPassword('mySecurePassword123');
 * // Returns: $2b$12$eUlS0dNKrMxLdkPgDJZdpu...
 */
export async function hashPassword(
  plain: string,
  saltRounds: number = DEFAULT_SALT_ROUNDS
): Promise<string> {
  // Implementation
}
```

### Classes

Classes should document:
- Purpose and responsibility
- Constructor parameters
- Important public methods
- Usage examples for complex classes

```typescript
/**
 * Manages a pool of database connections for efficient resource utilization
 *
 * Implements connection pooling with automatic scaling, health checks,
 * and idle connection cleanup. Supports min/max pool sizing and configurable
 * timeouts for connection acquisition.
 *
 * @example
 * const pool = new ConnectionPool({
 *   min: 2,
 *   max: 10,
 *   idleTimeoutMs: 30000
 * });
 *
 * const connection = await pool.acquire();
 * try {
 *   await connection.query('SELECT * FROM users');
 * } finally {
 *   pool.release(connection);
 * }
 */
export class ConnectionPool {
  /**
   * Creates a new connection pool
   *
   * @param config - Pool configuration options
   */
  constructor(config?: Partial<ConnectionPoolConfig>) {
    // Implementation
  }
}
```

### Interfaces and Types

Document interfaces with:
- Purpose and usage context
- Property descriptions for non-obvious fields
- Examples for complex structures

```typescript
/**
 * Configuration options for AI model clients
 *
 * Supports multiple AI providers including OpenRouter, Azure OpenAI,
 * Anthropic Claude, and local models via Ollama.
 */
export interface AIModelConfig {
  /** AI provider to use (openrouter, azure-openai, anthropic, etc.) */
  provider: AIProvider;

  /** Model identifier (e.g., 'gpt-4', 'claude-3-opus') */
  model: string;

  /** Maximum tokens in generated response (default: model-specific) */
  maxTokens?: number;

  /** Sampling temperature 0.0-2.0 (default: 0.7) */
  temperature?: number;

  /** API key for authentication */
  apiKey?: string;
}
```

## Tag Reference

### Essential Tags

- `@param {type} name - Description`: Document function parameters
- `@returns {type} Description`: Document return values
- `@throws {ErrorType} Description`: Document thrown errors
- `@example`: Provide usage examples

### Optional Tags

- `@deprecated Message`: Mark deprecated code
- `@internal`: Mark internal-only APIs
- `@see Reference`: Link to related documentation
- `@since Version`: Document when feature was added
- `@todo Description`: Note planned improvements

### Specialized Tags

- `@security`: Note security considerations
- `@performance`: Note performance characteristics
- `@async`: Explicitly document async behavior (optional in TypeScript)

## Parameter Documentation

### Basic Parameters

```typescript
/**
 * @param email - User email address (normalized to lowercase)
 * @param password - Plaintext password for verification
 */
```

### Optional Parameters

```typescript
/**
 * @param timeout - Request timeout in milliseconds (default: 30000)
 * @param retries - Maximum retry attempts (default: 3)
 */
```

### Complex Types

```typescript
/**
 * @param config - Database configuration options
 * @param config.host - Database host address
 * @param config.port - Database port number
 * @param config.ssl - Enable SSL connection
 */
```

### Callback Parameters

```typescript
/**
 * @param onSuccess - Called when operation completes successfully
 * @param onError - Called when operation fails with error details
 */
```

## Return Value Documentation

### Simple Returns

```typescript
/**
 * @returns The user's full name
 */
```

### Complex Returns

```typescript
/**
 * @returns Promise resolving to connection result with status and metadata
 * @returns {Promise<{ success: boolean; connection?: PrismaClient; error?: Error }>}
 */
```

### Void Functions

```typescript
/**
 * Logs an error message to the console (no return value)
 */
function logError(message: string): void {
  // Implementation
}
```

## Error Documentation

Document specific error types and conditions:

```typescript
/**
 * Verifies a password against a bcrypt hash
 *
 * @param plain - Plaintext password to verify
 * @param hash - Bcrypt hash to compare against
 * @returns Promise resolving to true if password matches
 * @throws {Error} If hash format is invalid
 * @throws {Error} If bcrypt verification fails internally
 */
```

## Examples

### Good Example

```typescript
/**
 * Fetches data from an API endpoint with automatic retry and timeout
 *
 * Implements exponential backoff with jitter for retries. Automatically
 * retries on network errors and 5xx server errors. Respects configurable
 * timeout and maximum retry attempts.
 *
 * @param url - API endpoint URL
 * @param options - Fetch options including retry configuration
 * @param options.retries - Maximum retry attempts (default: 3)
 * @param options.timeout - Request timeout in ms (default: 30000)
 * @returns Promise resolving to the fetch Response object
 * @throws {Error} If all retry attempts fail
 * @throws {Error} If request times out
 *
 * @example
 * const response = await fetchWithRetry('https://api.example.com/data', {
 *   retries: 5,
 *   timeout: 10000
 * });
 * const data = await response.json();
 */
```

### Bad Example (Avoid)

```typescript
/**
 * Does a fetch
 * @param url the url
 * @param options options
 */
```

## Security Documentation

For security-sensitive code, explicitly document security considerations:

```typescript
/**
 * Validates and decodes a JWT token
 *
 * @security This function verifies the token signature using NEXTAUTH_SECRET.
 * Never call this function with user-supplied secret keys. Always use the
 * application's configured secret to prevent token forgery attacks.
 *
 * @param token - JWT token string
 * @returns Decoded token payload if valid
 * @throws {Error} If token signature is invalid
 * @throws {Error} If token is expired
 */
```

## Performance Documentation

For performance-critical code:

```typescript
/**
 * Processes a large batch of embeddings with parallel execution
 *
 * @performance Processes batches in parallel with configurable concurrency.
 * Default batch size of 20 and concurrency of 5 prevents API rate limiting
 * while maximizing throughput. Adjust these values based on API limits.
 *
 * @param texts - Array of texts to generate embeddings for
 * @returns Promise resolving to array of embedding vectors
 */
```

## Deprecation

```typescript
/**
 * Legacy authentication method using plaintext passwords
 *
 * @deprecated Since version 2.0. Use {@link hashPassword} instead.
 * This method will be removed in version 3.0.
 *
 * @param password - Password to authenticate
 * @returns True if password matches
 */
```

## Module Documentation

Add file-level documentation at the top of modules:

```typescript
/**
 * @module auth/password
 *
 * Password hashing and verification utilities using bcrypt.
 * Provides secure password storage and timing-safe verification
 * to prevent timing attacks on authentication.
 *
 * @see {@link https://github.com/kelektiv/node.bcrypt.js} bcrypt documentation
 */
```

## Tools and Automation

### IDE Support

- VS Code: Built-in JSDoc support with IntelliSense
- WebStorm/IntelliJ: Full JSDoc support with quick documentation
- Neovim: LSP provides JSDoc hover information

### Linting

Configure ESLint to enforce JSDoc standards:

```json
{
  "rules": {
    "jsdoc/require-jsdoc": ["warn", {
      "require": {
        "FunctionDeclaration": true,
        "ClassDeclaration": true,
        "MethodDefinition": true
      }
    }],
    "jsdoc/require-param": "warn",
    "jsdoc/require-returns": "warn",
    "jsdoc/check-types": "warn"
  }
}
```

## Checklist

Before committing code, verify:

- [ ] All exported functions have JSDoc comments
- [ ] All parameters are documented with `@param`
- [ ] Return values are documented with `@returns`
- [ ] Error conditions are documented with `@throws`
- [ ] Complex functions include `@example` usage
- [ ] Security-sensitive code includes security notes
- [ ] Deprecated code is marked with `@deprecated`

## Resources

- [JSDoc Official Documentation](https://jsdoc.app/)
- [TypeScript JSDoc Support](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html)
- [Google JavaScript Style Guide - Comments](https://google.github.io/styleguide/jsguide.html#jsdoc)

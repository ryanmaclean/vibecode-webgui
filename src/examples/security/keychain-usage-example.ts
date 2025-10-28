/**
 * Example: Using macOS Keychain for Secure Secret Management
 *
 * This file demonstrates how to migrate from process.env to Keychain-based secrets
 */

import { loadSecret, isKeychainAvailable } from '@/lib/security/macos-keychain'

// ============================================
// BEFORE: Using plaintext environment variables
// ============================================

// ❌ OLD WAY (Insecure - plaintext in .env files)
export function getOpenAIClientOld() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  return {
    apiKey,
    // ... rest of client config
  }
}

// ❌ OLD WAY (Database credentials in plaintext)
export function getDatabaseConfigOld() {
  return {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD, // ❌ Plaintext password
    database: process.env.DATABASE_NAME || 'vibecode',
  }
}

// ============================================
// AFTER: Using macOS Keychain (Secure)
// ============================================

// ✅ NEW WAY (Secure - stored in macOS Keychain)
export async function getOpenAIClientNew() {
  // Automatically uses Keychain on macOS, falls back to process.env on other platforms
  const apiKey = await loadSecret('OPENAI_API_KEY')

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  return {
    apiKey,
    // ... rest of client config
  }
}

// ✅ NEW WAY (Secure database credentials)
export async function getDatabaseConfigNew() {
  // Load password from Keychain (or .env as fallback)
  const password = await loadSecret('DATABASE_PASSWORD')

  return {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    user: process.env.DATABASE_USER || 'postgres',
    password, // ✅ Loaded from Keychain
    database: process.env.DATABASE_NAME || 'vibecode',
  }
}

// ============================================
// Advanced: Connection String Parsing
// ============================================

/**
 * ✅ RECOMMENDED: Parse DATABASE_URL from Keychain
 *
 * Store entire connection string in Keychain instead of individual credentials
 */
export async function getDatabaseUrlFromKeychain() {
  // Try Keychain first, fallback to environment variable
  const databaseUrl = await loadSecret('DATABASE_URL')

  if (!databaseUrl) {
    throw new Error('DATABASE_URL not configured in Keychain or environment')
  }

  return databaseUrl
}

// ============================================
// Platform-Aware Usage
// ============================================

/**
 * Example: Different behavior on macOS vs Docker/Linux
 */
export async function getApiKeyPlatformAware() {
  if (isKeychainAvailable()) {
    console.log('Running on macOS - using Keychain')
    return await loadSecret('OPENAI_API_KEY')
  } else {
    console.log('Running on Linux/Docker - using environment variables')
    return process.env.OPENAI_API_KEY
  }
}

// ============================================
// Migration Pattern for Existing Code
// ============================================

/**
 * Step-by-step migration pattern:
 *
 * 1. Run migration script:
 *    npm run security:migrate-keychain
 *
 * 2. Change code from:
 *    const apiKey = process.env.OPENAI_API_KEY
 *
 * 3. To:
 *    const apiKey = await loadSecret('OPENAI_API_KEY')
 *
 * 4. Handle async nature (convert to async function or use top-level await)
 *
 * 5. Test on both macOS and Docker to ensure fallback works
 *
 * 6. Remove secrets from .env files after validation
 */

// ============================================
// Real-World Example: API Route Handler
// ============================================

/**
 * Example Next.js API route using Keychain secrets
 */
export async function apiRouteHandlerExample(req: any, res: any) {
  try {
    // Load secrets from Keychain (with fallback to .env)
    const [openaiKey, anthropicKey] = await Promise.all([
      loadSecret('OPENAI_API_KEY'),
      loadSecret('ANTHROPIC_API_KEY'),
    ])

    if (!openaiKey && !anthropicKey) {
      return res.status(500).json({
        error: 'No AI API keys configured',
        hint: 'Run: npm run security:migrate-keychain'
      })
    }

    // Use the keys securely...
    // ...

    res.status(200).json({ success: true })
  } catch (error) {
    console.error('Failed to load secrets:', error)
    res.status(500).json({ error: 'Secret loading failed' })
  }
}

// ============================================
// Testing Support
// ============================================

/**
 * In tests, you can mock the keychain module:
 */
export const testExample = {
  // In Jest test:
  setupMock: () => {
    jest.mock('@/lib/security/macos-keychain', () => ({
      loadSecret: jest.fn((key: string) => {
        const mockSecrets: Record<string, string> = {
          OPENAI_API_KEY: 'test-key-openai',
          ANTHROPIC_API_KEY: 'test-key-anthropic',
        }
        return Promise.resolve(mockSecrets[key])
      }),
      isKeychainAvailable: jest.fn(() => false), // Simulate non-macOS
    }))
  }
}

// ============================================
// Deployment Considerations
// ============================================

/**
 * PRODUCTION DEPLOYMENT:
 *
 * 1. macOS Development:
 *    - Secrets in Keychain
 *    - FileVault enabled
 *    - Secure Enclave protection (T2/Apple Silicon)
 *
 * 2. Docker/Kubernetes:
 *    - Use Kubernetes Secrets
 *    - Mount as environment variables
 *    - Code automatically falls back to process.env
 *
 * 3. CI/CD:
 *    - GitHub Actions: Use encrypted secrets
 *    - Azure DevOps: Use variable groups
 *    - Code falls back to process.env automatically
 */

export const deploymentGuide = {
  macOS: 'Keychain → Secure Enclave → FileVault',
  docker: 'Kubernetes Secrets → env vars → process.env',
  cicd: 'GitHub Secrets → env vars → process.env',
}

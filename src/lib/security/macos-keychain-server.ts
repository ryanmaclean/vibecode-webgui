/**
 * Server-only macOS Keychain Integration
 * This version avoids Edge Runtime compatibility issues
 */

// Server-only imports (not available in Edge Runtime)
let execSync: typeof import('child_process').execSync
if (typeof window === 'undefined') {
  try {
    execSync = require('child_process').execSync
  } catch (error) {
    // Fallback to environment variables
  }
}

// Keychain configuration
const KEYCHAIN_SERVICE = 'com.vibecode.secrets'

/**
 * Synchronous version of loadSecret for compatibility
 * Falls back to environment variables if keychain is not available
 */
export function loadSecret(key: string): string | null {
  try {
    // Check if running on macOS and execSync is available
    if (typeof process === 'undefined' || !execSync) {
      return process?.env?.[key] || null
    }

    // Use security command to retrieve from keychain
    const command = `security find-generic-password -s "${key}" -a "${KEYCHAIN_SERVICE}" -w`
    const result = execSync(command, { 
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim()

    if (result) {
      return result
    }

    return null
  } catch (error) {
    // Fall back to environment variable
    return process?.env?.[key] || null
  }
}

/**
 * Check if running on macOS with Keychain support
 */
export function isKeychainAvailable(): boolean {
  try {
    if (typeof process === 'undefined' || !execSync) {
      return false
    }
    execSync('which security', { encoding: 'utf8', stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * Store secret in macOS Keychain
 */
export async function setSecret(key: string, value: string): Promise<boolean> {
  try {
    if (!isKeychainAvailable()) {
      return false
    }

    const command = [
      'security',
      'add-generic-password',
      '-s', key,
      '-a', KEYCHAIN_SERVICE,
      '-w', value,
      '-U' // Update if exists
    ]

    execSync(command.join(' '), { 
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    return true
  } catch (error) {
    return false
  }
}

/**
 * Delete secret from macOS Keychain
 */
export async function deleteSecret(key: string): Promise<boolean> {
  try {
    if (!isKeychainAvailable()) {
      return false
    }

    const command = [
      'security',
      'delete-generic-password',
      '-s', key,
      '-a', KEYCHAIN_SERVICE
    ]

    execSync(command.join(' '), { 
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    return true
  } catch (error) {
    return false
  }
}

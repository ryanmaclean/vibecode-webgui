/**
 * Mock for macOS Keychain Server (for testing)
 */

export function loadSecret(key: string): string | null {
  // Return environment variable or null
  return process.env[key] || null;
}

export function isKeychainAvailable(): boolean {
  return false;
}

export async function setSecret(key: string, value: string): Promise<boolean> {
  return false;
}

export async function deleteSecret(key: string): Promise<boolean> {
  return false;
}

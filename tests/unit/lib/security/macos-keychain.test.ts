/**
 * Unit Tests for macOS Keychain Integration
 * Tests secure secret storage, retrieval, deletion, and error handling
 */

import { jest } from '@jest/globals'
import { execSync } from 'child_process'

// Mock child_process before importing the module
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}))

// Mock logger
jest.mock('@/lib/logger', () => ({
  createChildLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}))

// Import after mocks
import * as keychain from '@/lib/security/macos-keychain'

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>

describe('macOS Keychain Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset process.platform for each test
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('isKeychainAvailable', () => {
    it('should return true on macOS with security command', () => {
      mockExecSync.mockReturnValue('')
      Object.defineProperty(process, 'platform', { value: 'darwin' })

      const result = keychain.isKeychainAvailable()

      expect(result).toBe(true)
      expect(mockExecSync).toHaveBeenCalledWith('which security', expect.objectContaining({
        encoding: 'utf8',
        stdio: 'ignore',
      }))
    })

    it('should return false on non-macOS platforms', () => {
      mockExecSync.mockReturnValue('')
      Object.defineProperty(process, 'platform', { value: 'linux' })

      const result = keychain.isKeychainAvailable()

      expect(result).toBe(false)
    })

    it('should return false when security command is not available', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Command not found')
      })

      const result = keychain.isKeychainAvailable()

      expect(result).toBe(false)
    })
  })

  describe('setSecret', () => {
    it('should store a secret successfully', async () => {
      mockExecSync.mockReturnValue('')

      await keychain.setSecret('test-key', 'test-value')

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('security add-generic-password'),
        expect.objectContaining({
          encoding: 'utf8',
          shell: '/bin/bash',
        })
      )
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('-s com.vibecode.secrets'),
        expect.any(Object)
      )
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('-a test-key'),
        expect.any(Object)
      )
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('-U'),
        expect.any(Object)
      )
    })

    it('should properly escape special characters in secret value', async () => {
      mockExecSync.mockReturnValue('')

      await keychain.setSecret('test-key', "test'value")

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining("test'\\\\''value"),
        expect.any(Object)
      )
    })

    it('should handle keychain errors', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Keychain is locked')
      })

      await expect(keychain.setSecret('test-key', 'test-value')).rejects.toThrow(
        'Keychain storage failed for test-key'
      )
    })

    it('should support custom service names', async () => {
      mockExecSync.mockReturnValue('')

      await keychain.setSecret('test-key', 'test-value', {
        service: 'custom.service'
      })

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('-s custom.service'),
        expect.any(Object)
      )
    })

    it('should support access groups', async () => {
      mockExecSync.mockReturnValue('')

      await keychain.setSecret('test-key', 'test-value', {
        accessGroup: 'TEAM123.shared'
      })

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('-G'),
        expect.any(Object)
      )
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('TEAM123.shared'),
        expect.any(Object)
      )
    })
  })

  describe('getSecret', () => {
    it('should retrieve a secret successfully', async () => {
      mockExecSync.mockReturnValue('secret-value\n')

      const result = await keychain.getSecret('test-key')

      expect(result).toBe('secret-value')
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('security find-generic-password'),
        expect.objectContaining({
          encoding: 'utf8',
          shell: '/bin/bash',
        })
      )
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('-w'),
        expect.any(Object)
      )
    })

    it('should return null when secret is not found', async () => {
      mockExecSync.mockImplementation(() => {
        const error = new Error('could not be found')
        throw error
      })

      const result = await keychain.getSecret('nonexistent-key')

      expect(result).toBeNull()
    })

    it('should throw on other keychain errors', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Keychain access denied')
      })

      await expect(keychain.getSecret('test-key')).rejects.toThrow(
        'Keychain retrieval failed for test-key'
      )
    })

    it('should trim whitespace from retrieved values', async () => {
      mockExecSync.mockReturnValue('  secret-value  \n')

      const result = await keychain.getSecret('test-key')

      expect(result).toBe('secret-value')
    })
  })

  describe('deleteSecret', () => {
    it('should delete a secret successfully', async () => {
      mockExecSync.mockReturnValue('')

      await keychain.deleteSecret('test-key')

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('security delete-generic-password'),
        expect.objectContaining({
          encoding: 'utf8',
          shell: '/bin/bash',
        })
      )
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('-s com.vibecode.secrets'),
        expect.any(Object)
      )
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('-a test-key'),
        expect.any(Object)
      )
    })

    it('should handle deletion errors', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Secret not found')
      })

      await expect(keychain.deleteSecret('test-key')).rejects.toThrow(
        'Keychain deletion failed for test-key'
      )
    })
  })

  describe('migrateSecretsToKeychain', () => {
    const originalEnv = process.env

    beforeEach(() => {
      process.env = { ...originalEnv }
      mockExecSync.mockReturnValue('')
    })

    afterEach(() => {
      process.env = originalEnv
    })

    it('should skip migration when keychain is not available', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not available')
      })

      await keychain.migrateSecretsToKeychain()

      // Should call isKeychainAvailable but not attempt to store
      expect(mockExecSync).toHaveBeenCalledWith('which security', expect.any(Object))
      expect(mockExecSync).not.toHaveBeenCalledWith(
        expect.stringContaining('add-generic-password'),
        expect.any(Object)
      )
    })

    it('should migrate existing environment secrets', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key'
      process.env.NEXTAUTH_SECRET = 'test-secret'
      mockExecSync.mockReturnValue('')

      await keychain.migrateSecretsToKeychain()

      // Should call add-generic-password for each secret
      const calls = mockExecSync.mock.calls.filter(call =>
        typeof call[0] === 'string' && call[0].includes('add-generic-password')
      )
      expect(calls.length).toBeGreaterThan(0)
    })

    it('should skip secrets that are not set in environment', async () => {
      mockExecSync.mockReturnValue('')

      await keychain.migrateSecretsToKeychain()

      // Should complete without errors even with no secrets
      expect(mockExecSync).toHaveBeenCalledWith('which security', expect.any(Object))
    })

    it('should handle migration errors gracefully', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key'
      mockExecSync.mockImplementation((cmd) => {
        if (typeof cmd === 'string' && cmd.includes('add-generic-password')) {
          throw new Error('Keychain error')
        }
        return ''
      })

      // Should not throw, just log errors
      await expect(keychain.migrateSecretsToKeychain()).resolves.not.toThrow()
    })
  })

  describe('loadSecret', () => {
    const originalEnv = process.env

    beforeEach(() => {
      process.env = { ...originalEnv }
    })

    afterEach(() => {
      process.env = originalEnv
    })

    it('should load from keychain when available', async () => {
      mockExecSync.mockReturnValue('keychain-value\n')
      process.env.TEST_KEY = 'env-value'

      const result = await keychain.loadSecret('TEST_KEY')

      expect(result).toBe('keychain-value')
      expect(mockExecSync).toHaveBeenCalledWith('which security', expect.any(Object))
    })

    it('should fallback to environment variable when keychain fails', async () => {
      mockExecSync.mockImplementation((cmd) => {
        if (typeof cmd === 'string' && cmd.includes('find-generic-password')) {
          throw new Error('Not found')
        }
        return ''
      })
      process.env.TEST_KEY = 'env-value'

      const result = await keychain.loadSecret('TEST_KEY')

      expect(result).toBe('env-value')
    })

    it('should return undefined when secret is not found anywhere', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not found')
      })

      const result = await keychain.loadSecret('NONEXISTENT_KEY')

      expect(result).toBeUndefined()
    })
  })

  describe('rotateSecret', () => {
    it('should rotate a secret with new generated value', async () => {
      mockExecSync.mockReturnValue('')
      const generator = jest.fn(() => 'new-secret-value')

      await keychain.rotateSecret('test-key', generator)

      expect(generator).toHaveBeenCalled()
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('add-generic-password'),
        expect.any(Object)
      )
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('new-secret-value'),
        expect.any(Object)
      )
    })

    it('should throw when rotation fails', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Keychain error')
      })
      const generator = jest.fn(() => 'new-secret-value')

      await expect(keychain.rotateSecret('test-key', generator)).rejects.toThrow()
      expect(generator).toHaveBeenCalled()
    })
  })

  describe('listSecrets', () => {
    it('should return empty array when keychain is not available', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not available')
      })

      const result = await keychain.listSecrets()

      expect(result).toEqual([])
    })

    it('should list secrets from keychain', async () => {
      mockExecSync.mockReturnValue('secret1\nsecret2\nsecret3\n')

      const result = await keychain.listSecrets()

      expect(result).toEqual(['secret1', 'secret2', 'secret3'])
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('security dump-keychain'),
        expect.any(Object)
      )
    })

    it('should filter empty lines', async () => {
      mockExecSync.mockReturnValue('secret1\n\n\nsecret2\n\n')

      const result = await keychain.listSecrets()

      expect(result).toEqual(['secret1', 'secret2'])
    })

    it('should return empty array on errors', async () => {
      mockExecSync.mockImplementation((cmd) => {
        if (typeof cmd === 'string' && cmd.includes('dump-keychain')) {
          throw new Error('Access denied')
        }
        return ''
      })

      const result = await keychain.listSecrets()

      expect(result).toEqual([])
    })
  })
})

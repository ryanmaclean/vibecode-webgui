/**
 * Unit Tests for Server-Only macOS Keychain Integration
 * Tests Edge Runtime compatibility and environment fallbacks
 *
 * @jest-environment node
 */

import { jest } from '@jest/globals'

// Mock child_process module
jest.mock('child_process')

// Don't auto-mock our module - we want the real implementation
jest.unmock('@/lib/security/macos-keychain-server')

describe('macOS Keychain Server-Only Integration', () => {
  let mockExecSync: jest.Mock
  let originalProcess: NodeJS.Process

  beforeEach(() => {
    // Get reference to the mocked execSync using require (same as production code)
    const childProcess = require('child_process')
    mockExecSync = childProcess.execSync

    jest.clearAllMocks()
    originalProcess = global.process

    // Ensure process.env is defined
    if (!global.process.env) {
      global.process.env = {} as NodeJS.ProcessEnv
    }
  })

  afterEach(() => {
    global.process = originalProcess
    // Ensure process.env is always restored
    if (!global.process.env) {
      global.process.env = originalProcess.env
    }
    // Clean up test keys if env exists
    if (process.env && process.env.TEST_KEY) {
      delete process.env.TEST_KEY
    }
  })

  describe('loadSecret', () => {
    it('should load secret from keychain when available', () => {
      mockExecSync.mockReturnValue('keychain-secret\n')

      const { loadSecret } = require('@/lib/security/macos-keychain-server')
      const result = loadSecret('TEST_KEY')

      expect(result).toBe('keychain-secret')
    })

    it('should fallback to environment variable when keychain fails', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Keychain unavailable')
      })
      process.env.TEST_KEY = 'env-secret'

      const { loadSecret } = require('@/lib/security/macos-keychain-server')
      const result = loadSecret('TEST_KEY')

      expect(result).toBe('env-secret')
    })

    it('should return null when secret is not found', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not found')
      })
      delete process.env.TEST_KEY

      const { loadSecret } = require('@/lib/security/macos-keychain-server')
      const result = loadSecret('NONEXISTENT')

      expect(result).toBeNull()
    })

    it('should handle edge runtime without execSync', () => {
      // This test is tricky because we can't easily un-mock child_process
      // We'll test the fallback behavior instead
      mockExecSync.mockImplementation(() => {
        throw new Error('Module not found')
      })

      process.env.TEST_KEY = 'env-value'
      const { loadSecret } = require('@/lib/security/macos-keychain-server')
      const result = loadSecret('TEST_KEY')

      expect(result).toBe('env-value')
    })

    it('should handle timeout errors', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Timeout')
      })
      process.env.TEST_KEY = 'env-secret'

      const { loadSecret } = require('@/lib/security/macos-keychain-server')
      const result = loadSecret('TEST_KEY')

      expect(result).toBe('env-secret')
    })
  })

  describe('isKeychainAvailable', () => {
    it('should return true when security command exists', () => {
      mockExecSync.mockReturnValue('')

      const { isKeychainAvailable } = require('@/lib/security/macos-keychain-server')
      const result = isKeychainAvailable()

      expect(result).toBe(true)
      expect(mockExecSync).toHaveBeenCalledWith('which security', expect.any(Object))
    })

    it('should return false when security command does not exist', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Command not found')
      })

      const { isKeychainAvailable } = require('@/lib/security/macos-keychain-server')
      const result = isKeychainAvailable()

      expect(result).toBe(false)
    })

    it('should return false when process is undefined', () => {
      const originalProcess = global.process
      // @ts-ignore - Testing edge case
      global.process = undefined

      const { isKeychainAvailable } = require('@/lib/security/macos-keychain-server')
      const result = isKeychainAvailable()

      expect(result).toBe(false)
      global.process = originalProcess
    })
  })

  describe('setSecret', () => {
    it('should store secret when keychain is available', async () => {
      mockExecSync.mockReturnValue('')

      const { setSecret } = require('@/lib/security/macos-keychain-server')
      const result = await setSecret('test-key', 'test-value')

      expect(result).toBe(true)
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('add-generic-password'),
        expect.any(Object)
      )
    })

    it('should return false when keychain is unavailable', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not available')
      })

      const { setSecret } = require('@/lib/security/macos-keychain-server')
      const result = await setSecret('test-key', 'test-value')

      expect(result).toBe(false)
    })

    it('should return false on storage errors', async () => {
      mockExecSync.mockImplementation((cmd) => {
        if (typeof cmd === 'string' && cmd.includes('add-generic-password')) {
          throw new Error('Storage error')
        }
        return ''
      })

      const { setSecret } = require('@/lib/security/macos-keychain-server')
      const result = await setSecret('test-key', 'test-value')

      expect(result).toBe(false)
    })

    it('should use update flag to replace existing secrets', async () => {
      mockExecSync.mockReturnValue('')

      const { setSecret } = require('@/lib/security/macos-keychain-server')
      await setSecret('test-key', 'test-value')

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('-U'),
        expect.any(Object)
      )
    })
  })

  describe('deleteSecret', () => {
    it('should delete secret when keychain is available', async () => {
      mockExecSync.mockReturnValue('')

      const { deleteSecret } = require('@/lib/security/macos-keychain-server')
      const result = await deleteSecret('test-key')

      expect(result).toBe(true)
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('delete-generic-password'),
        expect.any(Object)
      )
    })

    it('should return false when keychain is unavailable', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not available')
      })

      const { deleteSecret } = require('@/lib/security/macos-keychain-server')
      const result = await deleteSecret('test-key')

      expect(result).toBe(false)
    })

    it('should return false when secret does not exist', async () => {
      mockExecSync.mockImplementation((cmd) => {
        if (typeof cmd === 'string' && cmd.includes('delete-generic-password')) {
          throw new Error('Not found')
        }
        return ''
      })

      const { deleteSecret } = require('@/lib/security/macos-keychain-server')
      const result = await deleteSecret('nonexistent')

      expect(result).toBe(false)
    })
  })

  describe('Environment Compatibility', () => {
    it('should work in server environment', () => {
      mockExecSync.mockReturnValue('secret\n')

      // @ts-ignore - Testing server environment
      global.window = undefined

      const { loadSecret } = require('@/lib/security/macos-keychain-server')
      const result = loadSecret('TEST_KEY')

      expect(result).toBe('secret')
    })

    it('should handle missing process.env gracefully', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Keychain unavailable')
      })

      const originalEnv = process.env
      // @ts-ignore - Testing edge case
      delete process.env

      const { loadSecret } = require('@/lib/security/macos-keychain-server')
      const result = loadSecret('TEST_KEY')

      expect(result).toBeNull()
      process.env = originalEnv
    })
  })

  describe('Error Handling', () => {
    it('should handle keychain locked errors', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Keychain is locked')
      })
      process.env.TEST_KEY = 'fallback'

      const { loadSecret } = require('@/lib/security/macos-keychain-server')
      const result = loadSecret('TEST_KEY')

      expect(result).toBe('fallback')
    })

    it('should handle permission denied errors', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Permission denied')
      })
      process.env.TEST_KEY = 'fallback'

      const { loadSecret } = require('@/lib/security/macos-keychain-server')
      const result = loadSecret('TEST_KEY')

      expect(result).toBe('fallback')
    })

    it('should handle timeout errors gracefully', () => {
      mockExecSync.mockImplementation(() => {
        const error: any = new Error('Timeout')
        error.code = 'ETIMEDOUT'
        throw error
      })
      process.env.TEST_KEY = 'fallback'

      const { loadSecret } = require('@/lib/security/macos-keychain-server')
      const result = loadSecret('TEST_KEY')

      expect(result).toBe('fallback')
    })
  })
})

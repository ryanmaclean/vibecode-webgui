/**
 * Claude CLI Integration Unit Tests
 * 
 * Unit tests for Claude Code CLI integration functionality
 * Tests terminal-based Claude Code command execution and session management
 * 
 * Staff Engineer Implementation - Production-ready CLI testing
 */

const { describe, test, expect, beforeEach, afterEach, jest } = require('@jest/globals')

// Mock child_process for testing
const mockSpawn = jest.fn()
const mockChildProcess = {
  stdout: {
    on: jest.fn(),
    once: jest.fn()
  },
  stderr: {
    on: jest.fn()
  },
  stdin: {
    write: jest.fn(),
    end: jest.fn()
  },
  on: jest.fn(),
  kill: jest.fn()
}

jest.mock('child_process', () => ({
  spawn: mockSpawn.mockReturnValue(mockChildProcess)
}))

// Mock fs/promises
const mockFs = {
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  unlink: jest.fn(),
  rm: jest.fn()
}

jest.mock('fs/promises', () => mockFs)

const { ClaudeCliIntegration, getClaudeCliInstance } = require('../../src/lib/claude-cli-integration')

describe('Claude CLI Integration Unit Tests', () => {
  let claudeCli
  const mockConfig = {
    apiKey: 'test-api-key',
    model: 'claude-3-5-sonnet-20241022',
    workingDirectory: '/test/workspace',
    timeout: 5000
  }

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks()
    
    // Reset mock implementations
    mockSpawn.mockReturnValue(mockChildProcess)
    mockFs.readFile.mockResolvedValue('test file content')
    mockFs.writeFile.mockResolvedValue(undefined)
    mockFs.mkdir.mockResolvedValue(undefined)
    mockFs.unlink.mockResolvedValue(undefined)
    mockFs.rm.mockResolvedValue(undefined)
    
    // Create new instance for each test
    claudeCli = new ClaudeCliIntegration(mockConfig)
  })

  afterEach(async () => {
    if (claudeCli) {
      await claudeCli.destroy()
    }
  })

  describe('Constructor and Configuration', () => {
    test('should initialize with correct configuration', () => {
      expect(claudeCli.config).toEqual(mockConfig)
      expect(claudeCli.sessionId).toMatch(/^claude_\d+_[a-z0-9]+$/)
    })

    test('should generate unique session IDs', () => {
      const cli1 = new ClaudeCliIntegration(mockConfig)
      const cli2 = new ClaudeCliIntegration(mockConfig)
      
      expect(cli1.sessionId).not.toBe(cli2.sessionId)
    })
  })

  describe('Command Execution', () => {
    test('should build correct Claude command for code generation', async () => {
      const request = {
        command: 'generate',
        input: 'Create a function that adds two numbers',
        files: ['test.js'],
        options: { language: 'javascript' }
      }

      // Mock successful command execution
      mockChildProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10)
        }
      })

      mockChildProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          setTimeout(() => callback('{"success": true, "code": "function add(a, b) { return a + b; }"}'), 5)
        }
      })

      await claudeCli.executeCommand(request)

      expect(mockSpawn).toHaveBeenCalledWith('claude-code', [
        'generate',
        '--api-key', 'test-api-key',
        '--model', 'claude-3-5-sonnet-20241022',
        '--file', 'test.js',
        '--language', 'javascript',
        '--output', 'json'
      ], {
        cwd: '/test/workspace',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: expect.objectContaining({
          ANTHROPIC_API_KEY: 'test-api-key'
        })
      })
    })

    test('should handle command execution success', async () => {
      const request = {
        command: 'explain',
        input: 'Explain this code'
      }

      // Mock successful execution
      mockChildProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10)
        }
      })

      mockChildProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          setTimeout(() => callback('This function adds two numbers together'), 5)
        }
      })

      const result = await claudeCli.executeCommand(request)

      expect(result.success).toBe(true)
      expect(result.output).toBe('This function adds two numbers together')
      expect(result.metadata.responseTime).toBeGreaterThan(0)
    })

    test('should handle command execution failure', async () => {
      const request = {
        command: 'analyze',
        input: 'Analyze this code'
      }

      // Mock failed execution
      mockChildProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(1), 10)
        }
      })

      mockChildProcess.stderr.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          setTimeout(() => callback('Command failed'), 5)
        }
      })

      const result = await claudeCli.executeCommand(request)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Command failed')
    })
  })

  describe('Interactive Sessions', () => {
    test('should start interactive session successfully', async () => {
      // Mock successful session start
      mockChildProcess.stdout.once.mockImplementation((event, callback) => {
        if (event === 'data') {
          setTimeout(() => callback('Claude session ready'), 10)
        }
      })

      const sessionId = await claudeCli.startInteractiveSession()

      expect(sessionId).toMatch(/^claude_\d+_[a-z0-9]+$/)
      expect(mockSpawn).toHaveBeenCalledWith('claude-code', [
        '--interactive',
        '--session-id', expect.any(String)
      ], expect.any(Object))
    })

    test('should send messages to active session', async () => {
      // Start session first
      mockChildProcess.stdout.once.mockImplementation((event, callback) => {
        if (event === 'data') {
          setTimeout(() => callback('Claude session ready'), 10)
        }
      })

      const sessionId = await claudeCli.startInteractiveSession()

      // Mock successful write
      mockChildProcess.stdin.write.mockImplementation((data, callback) => {
        callback()
      })

      await expect(
        claudeCli.sendToSession(sessionId, 'Hello Claude')
      ).resolves.not.toThrow()

      expect(mockChildProcess.stdin.write).toHaveBeenCalledWith(
        'Hello Claude\n',
        expect.any(Function)
      )
    })

    test('should close session successfully', async () => {
      // Start session first
      mockChildProcess.stdout.once.mockImplementation((event, callback) => {
        if (event === 'data') {
          setTimeout(() => callback('Claude session ready'), 10)
        }
      })

      const sessionId = await claudeCli.startInteractiveSession()

      await claudeCli.closeSession(sessionId)

      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM')
    })

    test('should handle session start timeout', async () => {
      // Don't trigger the ready callback to simulate timeout
      mockChildProcess.stdout.once.mockImplementation(() => {})

      await expect(claudeCli.startInteractiveSession()).rejects.toThrow(
        'Claude Code session failed to start within timeout'
      )
    })
  })

  describe('Code Analysis Methods', () => {
    beforeEach(() => {
      // Mock successful command execution for all analysis methods
      mockChildProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10)
        }
      })

      mockChildProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          setTimeout(() => callback('Analysis complete'), 5)
        }
      })
    })

    test('should generate code with prompt and file path', async () => {
      const result = await claudeCli.generateCode('Create a function', 'test.js')

      expect(result.success).toBe(true)
      expect(result.output).toBe('Analysis complete')
      expect(mockSpawn).toHaveBeenCalledWith('claude-code', 
        expect.arrayContaining(['generate', '--file', 'test.js']),
        expect.any(Object)
      )
    })

    test('should explain code with language context', async () => {
      const result = await claudeCli.explainCode('function test() {}', 'javascript')

      expect(result.success).toBe(true)
      expect(mockFs.writeFile).toHaveBeenCalled()
      expect(mockFs.unlink).toHaveBeenCalled()
    })

    test('should analyze code for issues', async () => {
      const result = await claudeCli.analyzeCode('const x = 1', 'javascript')

      expect(result.success).toBe(true)
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.js'),
        'const x = 1',
        'utf-8'
      )
    })

    test('should debug code with error message', async () => {
      const result = await claudeCli.debugCode('function test() {}', 'TypeError: undefined')

      expect(result.success).toBe(true)
      expect(mockChildProcess.stdin.write).toHaveBeenCalledWith(
        expect.stringContaining('TypeError: undefined')
      )
    })

    test('should generate tests for code', async () => {
      const result = await claudeCli.generateTests('function add(a, b) {}', 'javascript')

      expect(result.success).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith('claude-code',
        expect.arrayContaining(['test']),
        expect.any(Object)
      )
    })

    test('should optimize code performance', async () => {
      const result = await claudeCli.optimizeCode('for (let i = 0; i < 1000; i++) {}', 'javascript')

      expect(result.success).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith('claude-code',
        expect.arrayContaining(['optimize']),
        expect.any(Object)
      )
    })
  })

  describe('File Handling', () => {
    test('should create temporary files with correct extensions', async () => {
      mockChildProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') callback(0)
      })
      mockChildProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') callback('result')
      })

      await claudeCli.explainCode('const x = 1', 'typescript')

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('.claude'),
        { recursive: true }
      )
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.ts'),
        'const x = 1',
        'utf-8'
      )
    })

    test('should cleanup temporary files after use', async () => {
      mockChildProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') callback(0)
      })
      mockChildProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') callback('result')
      })

      await claudeCli.explainCode('test code', 'python')

      expect(mockFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('.py')
      )
    })

    test('should handle file read errors gracefully', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'))

      const context = await claudeCli.getFileContext('nonexistent.js')

      expect(context).toBeUndefined()
    })

    test('should get correct file extensions for different languages', () => {
      const extensions = {
        javascript: 'js',
        typescript: 'ts',
        python: 'py',
        unknown: 'txt'
      }

      Object.entries(extensions).forEach(([lang, ext]) => {
        const filename = claudeCli.getFileExtension(lang === 'unknown' ? undefined : lang)
        expect(filename).toBe(ext)
      })
    })
  })

  describe('Error Handling', () => {
    test('should handle spawn errors', async () => {
      mockSpawn.mockImplementation(() => {
        const errorProcess = { ...mockChildProcess }
        errorProcess.on.mockImplementation((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Spawn failed')), 5)
          }
        })
        return errorProcess
      })

      const result = await claudeCli.executeCommand({
        command: 'generate',
        input: 'test'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Spawn failed')
    })

    test('should handle stdin write errors', async () => {
      mockChildProcess.stdout.once.mockImplementation((event, callback) => {
        if (event === 'data') callback('ready')
      })

      const sessionId = await claudeCli.startInteractiveSession()

      mockChildProcess.stdin.write.mockImplementation((data, callback) => {
        callback(new Error('Write failed'))
      })

      await expect(
        claudeCli.sendToSession(sessionId, 'test message')
      ).rejects.toThrow('Write failed')
    })

    test('should handle command timeout', async () => {
      // Don't call the close callback to simulate hanging process
      mockChildProcess.on.mockImplementation(() => {})

      const shortTimeoutCli = new ClaudeCliIntegration({
        ...mockConfig,
        timeout: 100 // Very short timeout
      })

      const result = await shortTimeoutCli.executeCommand({
        command: 'generate',
        input: 'test'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('timed out')
    })
  })

  describe('Singleton Instance Management', () => {
    test('should create singleton instance with config', () => {
      const instance1 = getClaudeCliInstance(mockConfig)
      const instance2 = getClaudeCliInstance()

      expect(instance1).toBe(instance2)
    })

    test('should throw error when getting instance without config', () => {
      // Clear the singleton first
      require('../../src/lib/claude-cli-integration').destroyClaudeCliInstance()

      expect(() => getClaudeCliInstance()).toThrow(
        'Claude CLI instance not initialized'
      )
    })
  })

  describe('Resource Cleanup', () => {
    test('should cleanup all resources on destroy', async () => {
      // Start a session to have resources to cleanup
      mockChildProcess.stdout.once.mockImplementation((event, callback) => {
        if (event === 'data') callback('ready')
      })

      await claudeCli.startInteractiveSession()

      await claudeCli.destroy()

      expect(mockChildProcess.kill).toHaveBeenCalled()
      expect(mockFs.rm).toHaveBeenCalledWith(
        expect.stringContaining('.claude'),
        { recursive: true, force: true }
      )
    })

    test('should handle cleanup errors gracefully', async () => {
      mockFs.rm.mockRejectedValue(new Error('Cleanup failed'))

      // Should not throw even if cleanup fails
      await expect(claudeCli.destroy()).resolves.not.toThrow()
    })
  })
})
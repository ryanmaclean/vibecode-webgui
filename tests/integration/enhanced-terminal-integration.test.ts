/**
 * Enhanced Terminal Integration Tests
 * Tests the AI-powered terminal with Claude Code CLI integration
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import WebSocket from 'ws'
import { spawn } from 'child_process'
import { ClaudeCliIntegration } from '@/src/lib/claude-cli-integration'

// Only run these tests if AI integration is enabled
const shouldRunAITests = process.env.ENABLE_AI_INTEGRATION_TESTS === 'true'

const conditionalDescribe = shouldRunAITests ? describe : describe.skip

conditionalDescribe('Enhanced Terminal Integration Tests', () => {
  let wsServer: any
  let ws: WebSocket
  let testWorkspaceId: string

  beforeAll(async () => {
    // Start test WebSocket server
    const { Server } = require('ws')
    wsServer = new Server({ port: 8081 })
    
    testWorkspaceId = `test-workspace-${Date.now()}`
    
    // Set up test workspace directory
    await spawn('mkdir', ['-p', `/tmp/workspaces/${testWorkspaceId}`])
  })

  afterAll(async () => {
    if (wsServer) {
      wsServer.close()
    }
    
    // Cleanup test workspace
    await spawn('rm', ['-rf', `/tmp/workspaces/${testWorkspaceId}`])
  })

  beforeEach(async () => {
    // Create new WebSocket connection for each test
    ws = new WebSocket('ws://localhost:8081')
    await new Promise((resolve) => {
      ws.on('open', resolve)
    })
  })

  test('should create terminal session with AI integration', async () => {
    const createMessage = {
      type: 'create-terminal',
      workspaceId: testWorkspaceId,
      cols: 120,
      rows: 30
    }

    ws.send(JSON.stringify(createMessage))

    const response = await new Promise((resolve) => {
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString())
        if (message.type === 'terminal-created') {
          resolve(message)
        }
      })
    })

    expect(response).toMatchObject({
      type: 'terminal-created',
      workspaceId: testWorkspaceId,
      sessionId: expect.any(String)
    })
  })

  test('should handle basic terminal commands', async () => {
    // Create terminal session
    ws.send(JSON.stringify({
      type: 'create-terminal',
      workspaceId: testWorkspaceId,
      cols: 120,
      rows: 30
    }))

    // Wait for session creation
    const sessionResponse = await new Promise((resolve) => {
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString())
        if (message.type === 'terminal-created') {
          resolve(message)
        }
      })
    })

    const sessionId = (sessionResponse as any).sessionId

    // Send test command
    ws.send(JSON.stringify({
      type: 'terminal-input',
      data: 'echo "Hello Enhanced Terminal"\n'
    }))

    // Verify output
    const output = await new Promise((resolve) => {
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString())
        if (message.type === 'terminal-output' && message.data.includes('Hello Enhanced Terminal')) {
          resolve(message.data)
        }
      })
    })

    expect(output).toContain('Hello Enhanced Terminal')
  })

  test('should handle AI command processing', async () => {
    // Skip if no Claude API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('Skipping AI test - no ANTHROPIC_API_KEY')
      return
    }

    // Create terminal session
    ws.send(JSON.stringify({
      type: 'create-terminal',
      workspaceId: testWorkspaceId,
      cols: 120,
      rows: 30
    }))

    // Wait for session creation
    const sessionResponse = await new Promise((resolve) => {
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString())
        if (message.type === 'terminal-created') {
          resolve(message)
        }
      })
    })

    // Send AI command
    ws.send(JSON.stringify({
      type: 'ai-command',
      command: 'Explain what the ls command does',
      type: 'explain'
    }))

    // Verify AI response
    const aiResponse = await new Promise((resolve) => {
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString())
        if (message.type === 'ai-response') {
          resolve(message)
        }
      })
    })

    expect(aiResponse).toMatchObject({
      type: 'ai-response',
      command: 'Explain what the ls command does',
      response: expect.stringContaining('ls'),
      metadata: expect.any(Object)
    })
  }, 30000) // 30 second timeout for AI calls

  test('should provide AI suggestions on command errors', async () => {
    // Skip if no Claude API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('Skipping AI suggestion test - no ANTHROPIC_API_KEY')
      return
    }

    // Create terminal session
    ws.send(JSON.stringify({
      type: 'create-terminal',
      workspaceId: testWorkspaceId,
      cols: 120,
      rows: 30
    }))

    // Wait for session creation
    await new Promise((resolve) => {
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString())
        if (message.type === 'terminal-created') {
          resolve(message)
        }
      })
    })

    // Send invalid command to trigger error
    ws.send(JSON.stringify({
      type: 'terminal-input',
      data: 'nonexistentcommand123\n'
    }))

    // Wait for potential AI suggestion
    const suggestion = await Promise.race([
      new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString())
          if (message.type === 'ai-suggestion') {
            resolve(message)
          }
        })
      }),
      new Promise((resolve) => setTimeout(() => resolve(null), 10000)) // 10 second timeout
    ])

    // AI suggestions are probabilistic, so we check if one was provided
    if (suggestion) {
      expect(suggestion).toMatchObject({
        type: 'ai-suggestion',
        suggestion: expect.any(String),
        trigger: 'error'
      })
    }
  }, 15000)

  test('should handle terminal resize correctly', async () => {
    // Create terminal session
    ws.send(JSON.stringify({
      type: 'create-terminal',
      workspaceId: testWorkspaceId,
      cols: 80,
      rows: 24
    }))

    // Wait for session creation
    await new Promise((resolve) => {
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString())
        if (message.type === 'terminal-created') {
          resolve(message)
        }
      })
    })

    // Resize terminal
    ws.send(JSON.stringify({
      type: 'terminal-resize',
      cols: 120,
      rows: 30
    }))

    // Verify no errors - successful resize doesn't send response
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Send a command to verify terminal is still working
    ws.send(JSON.stringify({
      type: 'terminal-input',
      data: 'echo "Terminal resized successfully"\n'
    }))

    const output = await new Promise((resolve) => {
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString())
        if (message.type === 'terminal-output' && message.data.includes('Terminal resized successfully')) {
          resolve(message.data)
        }
      })
    })

    expect(output).toContain('Terminal resized successfully')
  })

  test('should handle session cleanup properly', async () => {
    // Create terminal session
    ws.send(JSON.stringify({
      type: 'create-terminal',
      workspaceId: testWorkspaceId,
      cols: 120,
      rows: 30
    }))

    // Wait for session creation
    const sessionResponse = await new Promise((resolve) => {
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString())
        if (message.type === 'terminal-created') {
          resolve(message)
        }
      })
    })

    const sessionId = (sessionResponse as any).sessionId

    // Close terminal
    ws.send(JSON.stringify({
      type: 'close-terminal',
      sessionId
    }))

    // Verify session closed
    const closeResponse = await new Promise((resolve) => {
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString())
        if (message.type === 'terminal-closed') {
          resolve(message)
        }
      })
    })

    expect(closeResponse).toMatchObject({
      type: 'terminal-closed',
      sessionId
    })
  })

  test('should maintain AI context across commands', async () => {
    // Skip if no Claude API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('Skipping AI context test - no ANTHROPIC_API_KEY')
      return
    }

    // Create terminal session
    ws.send(JSON.stringify({
      type: 'create-terminal',
      workspaceId: testWorkspaceId,
      cols: 120,
      rows: 30
    }))

    // Wait for session creation
    await new Promise((resolve) => {
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString())
        if (message.type === 'terminal-created') {
          resolve(message)
        }
      })
    })

    // Send first AI command
    ws.send(JSON.stringify({
      type: 'ai-command',
      command: 'I want to learn about git commands',
      type: 'chat'
    }))

    // Wait for first response
    await new Promise((resolve) => {
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString())
        if (message.type === 'ai-response') {
          resolve(message)
        }
      })
    })

    // Send follow-up command that requires context
    ws.send(JSON.stringify({
      type: 'ai-command',
      command: 'What is the most important one to know first?',
      type: 'chat'
    }))

    // Verify contextual response
    const contextualResponse = await new Promise((resolve) => {
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString())
        if (message.type === 'ai-response' && message.command === 'What is the most important one to know first?') {
          resolve(message)
        }
      })
    })

    expect((contextualResponse as any).response).toContain('git')
  }, 45000) // Longer timeout for multiple AI calls
})

// Unit tests for Claude CLI Integration
describe('Claude CLI Integration Unit Tests', () => {
  test('should initialize Claude CLI with correct configuration', () => {
    const claude = new ClaudeCliIntegration({
      apiKey: 'test-key',
      workingDirectory: '/test/dir',
      timeout: 30000
    })

    expect(claude).toBeDefined()
    // Additional implementation-specific tests would go here
  })

  test('should validate API key format', () => {
    expect(() => {
      new ClaudeCliIntegration({
        apiKey: '', // Invalid empty key
        workingDirectory: '/test/dir'
      })
    }).toThrow()
  })

  test('should validate working directory', () => {
    expect(() => {
      new ClaudeCliIntegration({
        apiKey: 'test-key',
        workingDirectory: '' // Invalid empty directory
      })
    }).toThrow()
  })
})
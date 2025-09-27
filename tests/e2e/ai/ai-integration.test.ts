/**
 * E2E Tests for AI Integration
 * Tests AI chat, code generation, project creation, and RAG functionality
 */

import { test, expect } from '@playwright/test'
import TestHelpers from '../utils/test-helpers'
import testData from '../fixtures/test-data.json'

test.describe('AI Integration', () => {
  let testUser: any
  let testWorkspace: any

  test.beforeEach(async ({ page }) => {
    await TestHelpers.cleanup()
    testUser = await TestHelpers.createTestUser(testData.users.user)
    testWorkspace = await TestHelpers.createTestWorkspace(testUser.id, testData.workspaces.personal)
    await TestHelpers.loginAsTestUser(page, 'user')
  })

  test.afterEach(async ({ page }) => {
    await TestHelpers.cleanup()
  })

  test('should display AI chat interface correctly', async ({ page }) => {
    await page.goto(`/workspaces/${testWorkspace.id}`)
    
    // Open AI chat
    await page.click('[data-testid="ai-chat-toggle"]')
    
    // Verify chat interface elements
    await expect(page.locator('[data-testid="ai-chat-panel"]')).toBeVisible()
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="send-message"]')).toBeVisible()
    await expect(page.locator('[data-testid="chat-history"]')).toBeVisible()
    
    // Check for welcome message
    await expect(page.locator('[data-testid="welcome-message"]'))
      .toContainText('How can I help you today?')
  })

  test('should handle AI chat conversation', async ({ page }) => {
    await page.goto(`/workspaces/${testWorkspace.id}`)
    await page.click('[data-testid="ai-chat-toggle"]')
    
    // Send a message
    const userMessage = testData.aiPrompts.codeGeneration.prompt
    await TestHelpers.sendChatMessage(page, userMessage)
    
    // Verify message appears in chat
    await expect(page.locator('[data-testid="user-message"]').last())
      .toContainText(userMessage)
    
    // Wait for AI response
    await TestHelpers.waitForAIResponse(page)
    
    // Verify AI response
    const aiResponse = page.locator('[data-testid="ai-message"]').last()
    await expect(aiResponse).toBeVisible()
    
    // Check that response contains expected keywords for code generation
    const responseText = await aiResponse.textContent()
    const expectedKeywords = testData.aiPrompts.codeGeneration.expectedKeywords
    
    expectedKeywords.forEach(keyword => {
      expect(responseText?.toLowerCase()).toContain(keyword.toLowerCase())
    })
  })

  test('should handle code explanation requests', async ({ page }) => {
    await page.goto(`/workspaces/${testWorkspace.id}`)
    await page.click('[data-testid="ai-chat-toggle"]')
    
    const explanationPrompt = testData.aiPrompts.codeExplanation.prompt
    await TestHelpers.sendChatMessage(page, explanationPrompt)
    
    await TestHelpers.waitForAIResponse(page)
    
    const aiResponse = page.locator('[data-testid="ai-message"]').last()
    const responseText = await aiResponse.textContent()
    
    // Verify explanation contains key concepts
    testData.aiPrompts.codeExplanation.expectedKeywords.forEach(keyword => {
      expect(responseText?.toLowerCase()).toContain(keyword.toLowerCase())
    })
  })

  test('should handle debugging assistance', async ({ page }) => {
    await page.goto(`/workspaces/${testWorkspace.id}`)
    await page.click('[data-testid="ai-chat-toggle"]')
    
    const debuggingPrompt = testData.aiPrompts.debugging.prompt
    await TestHelpers.sendChatMessage(page, debuggingPrompt)
    
    await TestHelpers.waitForAIResponse(page)
    
    const aiResponse = page.locator('[data-testid="ai-message"]').last()
    const responseText = await aiResponse.textContent()
    
    // Verify debugging response contains helpful keywords
    testData.aiPrompts.debugging.expectedKeywords.forEach(keyword => {
      expect(responseText?.toLowerCase()).toContain(keyword.toLowerCase())
    })
  })

  test('should generate AI project from description', async ({ page }) => {
    await page.goto('/workspaces')
    
    // Start AI project generation
    await page.click('[data-testid="create-ai-project-button"]')
    
    // Fill project description
    const projectDescription = 'Create a simple todo app with React and TypeScript'
    await page.fill('[data-testid="project-description"]', projectDescription)
    await page.selectOption('[data-testid="workspace-select"]', testWorkspace.id.toString())
    
    await page.click('[data-testid="generate-project-button"]')
    
    // Wait for generation to complete
    await page.waitForSelector('[data-testid="generation-complete"]', { timeout: 30000 })
    
    // Verify project was created
    await TestHelpers.assertNotification(page, 'AI project generated successfully')
    
    // Check that project files were created
    await expect(page.locator('[data-testid="generated-files-list"]')).toBeVisible()
    await expect(page.locator('[data-testid="file-package.json"]')).toBeVisible()
    await expect(page.locator('[data-testid="file-src/App.tsx"]')).toBeVisible()
    await expect(page.locator('[data-testid="file-src/components/TodoList.tsx"]')).toBeVisible()
  })

  test('should handle AI project generation errors', async ({ page }) => {
    await page.goto('/workspaces')
    await page.click('[data-testid="create-ai-project-button"]')
    
    // Submit with empty description
    await page.click('[data-testid="generate-project-button"]')
    
    await TestHelpers.assertErrorMessage(page, 'Project description is required')
    
    // Try with very short description
    await page.fill('[data-testid="project-description"]', 'app')
    await page.click('[data-testid="generate-project-button"]')
    
    await TestHelpers.assertErrorMessage(page, 'Please provide a more detailed description')
  })

  test('should integrate with RAG system for context-aware responses', async ({ page }) => {
    // First create some files in the workspace for context
    await page.goto(`/workspaces/${testWorkspace.id}`)
    
    // Create a context file
    await page.click('[data-testid="create-file-button"]')
    await page.fill('[data-testid="file-name-input"]', 'UserModel.ts')
    await page.fill('[data-testid="file-content-editor"]', testData.files.typescript.content)
    await page.click('[data-testid="save-file-button"]')
    
    // Wait for file to be indexed
    await page.waitForTimeout(2000)
    
    // Open AI chat and ask about the code
    await page.click('[data-testid="ai-chat-toggle"]')
    
    const contextQuery = 'What interfaces are defined in my TypeScript files?'
    await TestHelpers.sendChatMessage(page, contextQuery)
    
    await TestHelpers.waitForAIResponse(page)
    
    const aiResponse = page.locator('[data-testid="ai-message"]').last()
    const responseText = await aiResponse.textContent()
    
    // Response should reference the User interface from our context
    expect(responseText).toContain('User')
    expect(responseText?.toLowerCase()).toContain('interface')
  })

  test('should handle AI chat with file uploads', async ({ page }) => {
    await page.goto(`/workspaces/${testWorkspace.id}`)
    await page.click('[data-testid="ai-chat-toggle"]')
    
    // Upload file to chat
    await page.click('[data-testid="upload-file-to-chat"]')
    
    // Mock file upload
    await page.evaluate(() => {
      const dataTransfer = new DataTransfer()
      const file = new File(['const x = 1;'], 'test.js', { type: 'text/javascript' })
      dataTransfer.items.add(file)
      
      const fileInput = document.querySelector('[data-testid="chat-file-input"]')
      if (fileInput) {
        fileInput.files = dataTransfer.files
        fileInput.dispatchEvent(new Event('change', { bubbles: true }))
      }
    })
    
    await TestHelpers.sendChatMessage(page, 'Please analyze this JavaScript file')
    
    await TestHelpers.waitForAIResponse(page)
    
    // Verify AI can analyze the uploaded file
    const aiResponse = page.locator('[data-testid="ai-message"]').last()
    await expect(aiResponse).toContainText('JavaScript')
  })

  test('should handle AI model selection', async ({ page }) => {
    await page.goto(`/workspaces/${testWorkspace.id}`)
    await page.click('[data-testid="ai-chat-toggle"]')
    
    // Open model selection
    await page.click('[data-testid="ai-model-selector"]')
    
    // Verify available models
    await expect(page.locator('[data-testid="model-claude-3.5-sonnet"]')).toBeVisible()
    await expect(page.locator('[data-testid="model-gpt-4"]')).toBeVisible()
    
    // Select different model
    await page.click('[data-testid="model-gpt-4"]')
    
    // Verify model selection persists
    await expect(page.locator('[data-testid="current-model"]')).toContainText('GPT-4')
    
    // Send message with new model
    await TestHelpers.sendChatMessage(page, 'Hello, what model are you?')
    await TestHelpers.waitForAIResponse(page)
    
    // Response should indicate it's using the selected model
    const aiResponse = page.locator('[data-testid="ai-message"]').last()
    const responseText = await aiResponse.textContent()
    expect(responseText?.toLowerCase()).toContain('gpt')
  })

  test('should handle AI cost tracking', async ({ page }) => {
    await page.goto(`/workspaces/${testWorkspace.id}`)
    await page.click('[data-testid="ai-chat-toggle"]')
    
    // Check initial cost display
    await expect(page.locator('[data-testid="ai-cost-tracker"]')).toBeVisible()
    
    const initialCost = await page.locator('[data-testid="session-cost"]').textContent()
    
    // Send a message
    await TestHelpers.sendChatMessage(page, 'Generate a simple function')
    await TestHelpers.waitForAIResponse(page)
    
    // Cost should have increased
    await page.waitForTimeout(1000) // Wait for cost update
    const updatedCost = await page.locator('[data-testid="session-cost"]').textContent()
    
    expect(updatedCost).not.toBe(initialCost)
    
    // Check cost breakdown
    await page.click('[data-testid="cost-breakdown-toggle"]')
    await expect(page.locator('[data-testid="input-tokens-cost"]')).toBeVisible()
    await expect(page.locator('[data-testid="output-tokens-cost"]')).toBeVisible()
  })

  test('should handle AI conversation history', async ({ page }) => {
    await page.goto(`/workspaces/${testWorkspace.id}`)
    await page.click('[data-testid="ai-chat-toggle"]')
    
    // Send multiple messages
    const messages = [
      'What is React?',
      'How do I create a component?',
      'Show me an example'
    ]
    
    for (const message of messages) {
      await TestHelpers.sendChatMessage(page, message)
      await TestHelpers.waitForAIResponse(page)
      await page.waitForTimeout(1000)
    }
    
    // Verify all messages are in history
    const userMessages = page.locator('[data-testid="user-message"]')
    const aiMessages = page.locator('[data-testid="ai-message"]')
    
    await expect(userMessages).toHaveCount(3)
    await expect(aiMessages).toHaveCount(3)
    
    // Clear conversation
    await page.click('[data-testid="clear-conversation"]')
    await page.click('[data-testid="confirm-clear"]')
    
    // History should be empty
    await expect(page.locator('[data-testid="user-message"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="ai-message"]')).toHaveCount(0)
  })

  test('should handle AI performance monitoring', async ({ page }) => {
    await page.goto(`/workspaces/${testWorkspace.id}`)
    await page.click('[data-testid="ai-chat-toggle"]')
    
    const startTime = Date.now()
    
    // Send message and measure response time
    await TestHelpers.sendChatMessage(page, 'Simple question')
    await TestHelpers.waitForAIResponse(page)
    
    const endTime = Date.now()
    const responseTime = endTime - startTime
    
    // Check performance metrics display
    await expect(page.locator('[data-testid="response-time"]')).toBeVisible()
    
    const displayedTime = await page.locator('[data-testid="response-time"]').textContent()
    expect(displayedTime).toContain('ms')
    
    // Verify reasonable response time (less than 30 seconds)
    expect(responseTime).toBeLessThan(30000)
  })
})
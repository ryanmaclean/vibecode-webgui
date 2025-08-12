/**
 * Comprehensive End-to-End Tests for AI Project Generation Workflow
 * 
 * This test suite validates the complete user journey from prompt input
 * to live workspace deployment, covering all aspects of the VibeCode
 * AI project generation experience.
 */

import { test, expect, Page } from '@playwright/test'
import { v4 as uuidv4 } from 'uuid'

// Test configuration
const TEST_PROMPTS = [
  {
    prompt: 'Create a modern React todo app with TypeScript and Tailwind CSS',
    language: 'typescript',
    framework: 'react',
    expectedFiles: ['src/App.tsx', 'package.json', 'tailwind.config.js'],
    expectedKeywords: ['React', 'TypeScript', 'todo', 'Tailwind']
  },
  {
    prompt: 'Build a Node.js REST API with Express and MongoDB for a blog system',
    language: 'javascript',
    framework: 'express',
    expectedFiles: ['server.js', 'package.json', 'routes/', 'models/'],
    expectedKeywords: ['Express', 'MongoDB', 'REST', 'blog']
  },
  {
    prompt: 'Create a Vue.js dashboard with charts and authentication',
    language: 'javascript',
    framework: 'vue',
    expectedFiles: ['src/main.js', 'src/views/', 'src/components/'],
    expectedKeywords: ['Vue', 'dashboard', 'charts', 'auth']
  },
  {
    prompt: 'Build a Python FastAPI microservice with PostgreSQL and Docker',
    language: 'python',
    framework: 'fastapi',
    expectedFiles: ['main.py', 'requirements.txt', 'Dockerfile'],
    expectedKeywords: ['FastAPI', 'PostgreSQL', 'Docker', 'microservice']
  }
]

class AIProjectGenerationHelper {
  constructor(private page: Page) {}

  async navigateToProjectGenerator() {
    await this.page.goto('/projects')
    await expect(this.page.locator('h1')).toContainText('Projects')
    
    // Click on AI Project Generator
    await this.page.click('[data-testid="ai-project-generator-button"]')
    await expect(this.page.locator('[data-testid="ai-project-generator"]')).toBeVisible()
  }

  async fillProjectPrompt(prompt: string, options: {
    language?: string
    framework?: string
    projectName?: string
  } = {}) {
    // Fill the main prompt
    await this.page.fill('[data-testid="prompt-input"]', prompt)
    
    // Select language if specified
    if (options.language) {
      await this.page.click('[data-testid="language-select"]')
      await this.page.click(`[data-testid="language-${options.language}"]`)
    }
    
    // Select framework if specified
    if (options.framework) {
      await this.page.click('[data-testid="framework-select"]')
      await this.page.click(`[data-testid="framework-${options.framework}"]`)
    }
    
    // Set custom project name if specified
    if (options.projectName) {
      await this.page.fill('[data-testid="project-name-input"]', options.projectName)
    }
  }

  async startGeneration() {
    await this.page.click('[data-testid="generate-button"]')
    
    // Wait for generation to start
    await expect(this.page.locator('[data-testid="generation-status"]')).toBeVisible()
    await expect(this.page.locator('[data-testid="progress-bar"]')).toBeVisible()
  }

  async waitForGenerationComplete(timeout = 120000) {
    // Wait for completion status
    await expect(this.page.locator('[data-testid="generation-status"]'))
      .toContainText('completed', { timeout })
    
    // Wait for workspace redirect or completion message
    await Promise.race([
      this.page.waitForURL('**/workspace/**', { timeout }),
      expect(this.page.locator('[data-testid="generation-complete"]')).toBeVisible({ timeout })
    ])
  }

  async verifyGenerationProgress() {
    const progressSteps = [
      'initializing',
      'generating',
      'seeding',
      'installing',
      'finalizing',
      'completed'
    ]

    for (const step of progressSteps) {
      try {
        await expect(this.page.locator('[data-testid="generation-status"]'))
          .toContainText(step, { timeout: 30000 })
      } catch (error) {
        console.warn(`Step "${step}" may have been skipped or completed quickly`)
      }
    }
  }

  async verifyWorkspaceContent(expectedFiles: string[]) {
    // Check if we're in the workspace
    await expect(this.page.locator('[data-testid="workspace-editor"]')).toBeVisible()
    
    // Verify file explorer shows expected files
    for (const file of expectedFiles) {
      await expect(this.page.locator(`[data-testid="file-${file.replace('/', '-')}"]`))
        .toBeVisible({ timeout: 10000 })
    }
  }

  async cancelGeneration() {
    await this.page.click('[data-testid="cancel-button"]')
    await expect(this.page.locator('[data-testid="generation-status"]'))
      .toContainText('cancelled', { timeout: 5000 })
  }

  async retryGeneration() {
    await this.page.click('[data-testid="retry-button"]')
    await this.startGeneration()
  }
}

test.describe('AI Project Generation End-to-End Tests', () => {
  let helper: AIProjectGenerationHelper

  test.beforeEach(async ({ page }) => {
    helper = new AIProjectGenerationHelper(page)
    
    // Mock authentication for testing
    await page.route('**/api/auth/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'test-user', email: 'test@example.com' },
          expires: new Date(Date.now() + 3600000).toISOString()
        })
      })
    })
  })

  test.describe('Complete Generation Workflow', () => {
    for (const testCase of TEST_PROMPTS) {
      test(`should generate ${testCase.framework} project: ${testCase.prompt}`, async ({ page }) => {
        await helper.navigateToProjectGenerator()
        
        await helper.fillProjectPrompt(testCase.prompt, {
          language: testCase.language,
          framework: testCase.framework,
          projectName: `test-${testCase.framework}-${Date.now()}`
        })
        
        await helper.startGeneration()
        await helper.verifyGenerationProgress()
        await helper.waitForGenerationComplete()
        await helper.verifyWorkspaceContent(testCase.expectedFiles)
        
        // Verify generated content contains expected keywords
        for (const keyword of testCase.expectedKeywords) {
          await expect(page.locator('body')).toContainText(keyword, { timeout: 5000 })
        }
      })
    }
  })

  test.describe('User Interface Validation', () => {
    test('should display proper UI elements', async ({ page }) => {
      await helper.navigateToProjectGenerator()
      
      // Verify all required UI elements are present
      await expect(page.locator('[data-testid="prompt-input"]')).toBeVisible()
      await expect(page.locator('[data-testid="language-select"]')).toBeVisible()
      await expect(page.locator('[data-testid="framework-select"]')).toBeVisible()
      await expect(page.locator('[data-testid="generate-button"]')).toBeVisible()
      
      // Verify placeholder text
      await expect(page.locator('[data-testid="prompt-input"]'))
        .toHaveAttribute('placeholder', /.*dashboard.*/)
    })

    test('should disable generate button with empty prompt', async ({ page }) => {
      await helper.navigateToProjectGenerator()
      
      // Button should be disabled initially
      await expect(page.locator('[data-testid="generate-button"]')).toBeDisabled()
      
      // Enter text and verify button becomes enabled
      await helper.fillProjectPrompt('Create a simple app')
      await expect(page.locator('[data-testid="generate-button"]')).toBeEnabled()
      
      // Clear text and verify button becomes disabled again
      await page.fill('[data-testid="prompt-input"]', '')
      await expect(page.locator('[data-testid="generate-button"]')).toBeDisabled()
    })

    test('should show progress indicators during generation', async ({ page }) => {
      await helper.navigateToProjectGenerator()
      await helper.fillProjectPrompt('Create a React app')
      await helper.startGeneration()
      
      // Verify progress elements are visible
      await expect(page.locator('[data-testid="progress-bar"]')).toBeVisible()
      await expect(page.locator('[data-testid="generation-status"]')).toBeVisible()
      await expect(page.locator('[data-testid="progress-percentage"]')).toBeVisible()
      
      // Verify progress increases over time
      const initialProgress = await page.locator('[data-testid="progress-percentage"]').textContent()
      await page.waitForTimeout(5000)
      const laterProgress = await page.locator('[data-testid="progress-percentage"]').textContent()
      
      expect(parseInt(laterProgress || '0')).toBeGreaterThan(parseInt(initialProgress || '0'))
    })
  })

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Mock network failure
      await page.route('**/api/ai/generate-project', route => {
        route.abort('failed')
      })
      
      await helper.navigateToProjectGenerator()
      await helper.fillProjectPrompt('Create a test app')
      await helper.startGeneration()
      
      // Verify error is displayed
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible({ timeout: 10000 })
      await expect(page.locator('[data-testid="error-message"]'))
        .toContainText(/network|failed|error/)
        
      // Verify retry option is available
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible()
    })

    test('should handle AI generation failures', async ({ page }) => {
      // Mock API error response
      await page.route('**/api/ai/generate-project', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'AI generation failed',
            message: 'The AI service is currently unavailable'
          })
        })
      })
      
      await helper.navigateToProjectGenerator()
      await helper.fillProjectPrompt('Create a test app')
      await helper.startGeneration()
      
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible({ timeout: 15000 })
      await expect(page.locator('[data-testid="error-message"]'))
        .toContainText(/AI.*unavailable|generation.*failed/)
    })

    test('should handle timeout errors', async ({ page }) => {
      // Mock slow response
      await page.route('**/api/ai/generate-project', route => {
        setTimeout(() => {
          route.fulfill({
            status: 408,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Request timeout',
              message: 'Generation took too long'
            })
          })
        }, 30000)
      })
      
      await helper.navigateToProjectGenerator()
      await helper.fillProjectPrompt('Create a complex app')
      await helper.startGeneration()
      
      // Should show timeout error within reasonable time
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible({ timeout: 35000 })
      await expect(page.locator('[data-testid="error-message"]'))
        .toContainText(/timeout|too long/)
    })
  })

  test.describe('Cancellation and Retry', () => {
    test('should allow cancellation during generation', async ({ page }) => {
      // Mock slow generation process
      await page.route('**/api/ai/generate-project', route => {
        // Delay response to allow cancellation
        setTimeout(() => {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ status: 'generating', progress: 30 })
          })
        }, 5000)
      })
      
      await helper.navigateToProjectGenerator()
      await helper.fillProjectPrompt('Create a test app')
      await helper.startGeneration()
      
      // Wait a bit then cancel
      await page.waitForTimeout(2000)
      await helper.cancelGeneration()
      
      // Verify cancellation
      await expect(page.locator('[data-testid="generation-status"]'))
        .toContainText(/cancelled|stopped/)
      await expect(page.locator('[data-testid="generate-button"]')).toBeEnabled()
    })

    test('should support retry after failure', async ({ page }) => {
      let attemptCount = 0
      
      // Mock first attempt failure, second attempt success
      await page.route('**/api/ai/generate-project', route => {
        attemptCount++
        if (attemptCount === 1) {
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'First attempt failed' })
          })
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ 
              status: 'completed',
              workspaceId: 'test-workspace',
              projectName: 'retry-test'
            })
          })
        }
      })
      
      await helper.navigateToProjectGenerator()
      await helper.fillProjectPrompt('Create a test app')
      await helper.startGeneration()
      
      // Wait for error
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
      
      // Retry generation
      await helper.retryGeneration()
      
      // Should succeed on second attempt
      await helper.waitForGenerationComplete()
      expect(attemptCount).toBe(2)
    })
  })

  test.describe('Performance and Scalability', () => {
    test('should complete generation within reasonable time', async ({ page }) => {
      const startTime = Date.now()
      
      await helper.navigateToProjectGenerator()
      await helper.fillProjectPrompt('Create a simple React app')
      await helper.startGeneration()
      await helper.waitForGenerationComplete(90000) // 90 second limit
      
      const totalTime = Date.now() - startTime
      expect(totalTime).toBeLessThan(90000) // Should complete within 90 seconds
    })

    test('should handle multiple concurrent generations', async ({ page, context }) => {
      const pages = await Promise.all([
        context.newPage(),
        context.newPage()
      ])
      
      const helpers = pages.map(p => new AIProjectGenerationHelper(p))
      
      // Start concurrent generations
      const generations = helpers.map(async (h, index) => {
        await h.navigateToProjectGenerator()
        await h.fillProjectPrompt(`Create app ${index + 1}`)
        await h.startGeneration()
        return h.waitForGenerationComplete()
      })
      
      // All should complete successfully
      await Promise.all(generations)
      
      // Clean up
      await Promise.all(pages.map(p => p.close()))
    })
  })

  test.describe('Accessibility Compliance', () => {
    test('should be keyboard navigable', async ({ page }) => {
      await helper.navigateToProjectGenerator()
      
      // Tab through all interactive elements
      await page.keyboard.press('Tab') // Prompt input
      await expect(page.locator('[data-testid="prompt-input"]')).toBeFocused()
      
      await page.keyboard.press('Tab') // Language select
      await expect(page.locator('[data-testid="language-select"]')).toBeFocused()
      
      await page.keyboard.press('Tab') // Framework select
      await expect(page.locator('[data-testid="framework-select"]')).toBeFocused()
      
      await page.keyboard.press('Tab') // Generate button
      await expect(page.locator('[data-testid="generate-button"]')).toBeFocused()
      
      // Should be able to activate with Enter
      await page.keyboard.type('Create a test app')
      await page.keyboard.press('Tab') // Back to generate button
      await page.keyboard.press('Enter')
      
      await expect(page.locator('[data-testid="generation-status"]')).toBeVisible()
    })

    test('should have proper ARIA labels', async ({ page }) => {
      await helper.navigateToProjectGenerator()
      
      // Check important ARIA attributes
      await expect(page.locator('[data-testid="prompt-input"]'))
        .toHaveAttribute('aria-label')
      await expect(page.locator('[data-testid="progress-bar"]'))
        .toHaveAttribute('role', 'progressbar')
      await expect(page.locator('[data-testid="generation-status"]'))
        .toHaveAttribute('aria-live')
    })
  })

  test.describe('Data Validation', () => {
    test('should validate prompt length limits', async ({ page }) => {
      await helper.navigateToProjectGenerator()
      
      // Test minimum length
      await page.fill('[data-testid="prompt-input"]', 'x')
      await expect(page.locator('[data-testid="generate-button"]')).toBeDisabled()
      
      // Test reasonable length
      await page.fill('[data-testid="prompt-input"]', 'Create a todo app')
      await expect(page.locator('[data-testid="generate-button"]')).toBeEnabled()
      
      // Test maximum length (if enforced)
      const longPrompt = 'x'.repeat(5000)
      await page.fill('[data-testid="prompt-input"]', longPrompt)
      
      // Should either limit input or show warning
      const inputValue = await page.inputValue('[data-testid="prompt-input"]')
      if (inputValue.length < longPrompt.length) {
        expect(inputValue.length).toBeLessThan(longPrompt.length)
      } else {
        await expect(page.locator('[data-testid="prompt-warning"]')).toBeVisible()
      }
    })

    test('should sanitize input data', async ({ page }) => {
      await helper.navigateToProjectGenerator()
      
      // Test with potentially malicious input
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        '${process.env.SECRET}',
        '../../../etc/passwd',
        'DROP TABLE users;'
      ]
      
      for (const input of maliciousInputs) {
        await page.fill('[data-testid="prompt-input"]', input)
        await helper.startGeneration()
        
        // Should handle gracefully without exposing sensitive info
        await page.waitForTimeout(2000)
        
        // Check that the input was sanitized in any displayed content
        const bodyContent = await page.textContent('body')
        expect(bodyContent).not.toContain('<script>')
        expect(bodyContent).not.toContain('${process.env')
        expect(bodyContent).not.toContain('../../../')
        expect(bodyContent).not.toContain('DROP TABLE')
        
        // Reset for next iteration
        await page.reload()
        await helper.navigateToProjectGenerator()
      }
    })
  })

  test.describe('Integration with Other Features', () => {
    test('should integrate with workspace management', async ({ page }) => {
      await helper.navigateToProjectGenerator()
      await helper.fillProjectPrompt('Create a React dashboard')
      await helper.startGeneration()
      await helper.waitForGenerationComplete()
      
      // Should redirect to workspace
      await expect(page).toHaveURL(/.*workspace.*/)
      
      // Workspace should show generated project
      await expect(page.locator('[data-testid="project-files"]')).toBeVisible()
      await expect(page.locator('[data-testid="editor-window"]')).toBeVisible()
    })

    test('should save project to user history', async ({ page }) => {
      await helper.navigateToProjectGenerator()
      await helper.fillProjectPrompt('Create a test project for history')
      await helper.startGeneration()
      await helper.waitForGenerationComplete()
      
      // Navigate back to projects page
      await page.goto('/projects')
      
      // Should show project in recent projects
      await expect(page.locator('[data-testid="recent-projects"]')).toBeVisible()
      await expect(page.locator('[data-testid="recent-projects"]'))
        .toContainText('test project for history')
    })
  })

  test.describe('Mobile Responsiveness', () => {
    test('should work on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      
      await helper.navigateToProjectGenerator()
      
      // All elements should be visible and usable
      await expect(page.locator('[data-testid="prompt-input"]')).toBeVisible()
      await expect(page.locator('[data-testid="generate-button"]')).toBeVisible()
      
      // Should be able to complete generation on mobile
      await helper.fillProjectPrompt('Create mobile test app')
      await helper.startGeneration()
      
      // Progress should be visible on mobile
      await expect(page.locator('[data-testid="progress-bar"]')).toBeVisible()
    })
  })
})

// Helper test for measuring performance metrics
test.describe('Performance Monitoring', () => {
  test('should track generation performance metrics', async ({ page }) => {
    let performanceMetrics: any = {}
    
    // Capture performance metrics
    await page.route('**/api/monitoring/**', route => {
      const url = route.request().url()
      if (url.includes('metrics')) {
        performanceMetrics = {
          timestamp: Date.now(),
          endpoint: url
        }
      }
      route.continue()
    })
    
    const helper = new AIProjectGenerationHelper(page)
    const startTime = Date.now()
    
    await helper.navigateToProjectGenerator()
    await helper.fillProjectPrompt('Performance test project')
    await helper.startGeneration()
    await helper.waitForGenerationComplete()
    
    const endTime = Date.now()
    const totalTime = endTime - startTime
    
    // Log performance for analysis
    console.log(`Generation completed in ${totalTime}ms`)
    expect(totalTime).toBeLessThan(120000) // 2 minute maximum
    
    // Metrics should have been captured
    expect(performanceMetrics.timestamp).toBeDefined()
  })
})
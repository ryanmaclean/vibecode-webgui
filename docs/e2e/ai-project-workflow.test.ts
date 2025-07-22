/**
 * End-to-end tests for the complete AI project generation workflow
 * Tests the user journey from project idea to live workspace
 */

import { test, expect, Page } from '@playwright/test'

test.describe('AI Project Generation Workflow', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
    
    // Mock the external APIs
    await page.route('https://openrouter.ai/api/v1/chat/completions', async (route) => {
      await route.fulfill({
        json: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  name: 'todo-app',
                  description: 'A simple todo application',
                  files: [
                    {
                      path: 'src/App.js',
                      content: 'import React from "react";\n\nfunction App() {\n  return <div>Todo App</div>;\n}\n\nexport default App;',
                      type: 'file',
                    },
                    {
                      path: 'src/components/TodoList.js',
                      content: 'import React from "react";\n\nexport const TodoList = () => {\n  return <div>Todo List</div>;\n};',
                      type: 'file',
                    },
                  ],
                  scripts: {
                    start: 'react-scripts start',
                    build: 'react-scripts build',
                    test: 'react-scripts test',
                  },
                  dependencies: {
                    react: '^18.0.0',
                    'react-dom': '^18.0.0',
                  },
                  devDependencies: {
                    '@testing-library/react': '^13.0.0',
                  },
                  envVars: [
                    {
                      name: 'REACT_APP_API_URL',
                      value: 'http://localhost:3001',
                      description: 'API base URL',
                    },
                  ],
                }),
              },
            },
          ],
        },
      })
    })

    // Mock code-server session API
    await page.route('**/api/code-server/session', async (route) => {
      await route.fulfill({
        json: {
          id: 'cs-test-123',
          workspaceId: 'ai-project-test-123',
          url: 'http://localhost:8080',
          status: 'ready',
          userId: 'test-user-123',
          createdAt: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
        },
      })
    })

    // Mock file sync API
    await page.route('**/api/files/sync', async (route) => {
      await route.fulfill({
        json: {
          success: true,
          filesUploaded: 4,
          workspaceId: 'ai-project-test-123',
        },
      })
    })

    // Mock authentication
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        json: {
          user: {
            id: 'test-user-123',
            email: 'test@example.com',
            name: 'Test User',
          },
        },
      })
    })

    // Navigate to projects page
    await page.goto('http://localhost:3000/projects')
  })

  test('should complete the AI project generation workflow', async () => {
    // Should start on AI Generator tab
    await expect(page.getByText('AI Project Generator')).toBeVisible()
    await expect(page.getByText('Describe your project idea and let AI generate a complete, production-ready codebase')).toBeVisible()

    // Fill in the project description
    await page.getByPlaceholderText(/Describe your project idea/).fill('Create a React todo app with user authentication')

    // Optionally fill in project name
    await page.getByPlaceholderText(/my-awesome-project/).fill('my-todo-app')

    // Select language
    await page.getByRole('combobox', { name: /Preferred Language/i }).click()
    await page.getByText('React').click()

    // Select framework
    await page.getByRole('combobox', { name: /Framework/i }).click()
    await page.getByText('React').click()

    // Select features
    await page.getByText('Authentication').click()
    await page.getByText('Database').click()
    await page.getByText('Testing').click()

    // Verify features are selected
    await expect(page.getByText('Authentication')).toHaveClass(/bg-blue-600/)
    await expect(page.getByText('Database')).toHaveClass(/bg-blue-600/)
    await expect(page.getByText('Testing')).toHaveClass(/bg-blue-600/)

    // Generate the project
    await page.getByRole('button', { name: /Generate Project/i }).click()

    // Should show loading state
    await expect(page.getByText('Generating Project...')).toBeVisible()
    await expect(page.getByText('Generating project...')).toBeVisible()

    // Should show progress bar
    await expect(page.getByRole('progressbar')).toBeVisible()

    // Wait for generation to complete
    await expect(page.getByText('Project "my-todo-app" generated successfully!')).toBeVisible()

    // Should show generated project information
    await expect(page.getByText('my-todo-app')).toBeVisible()
    await expect(page.getByText('A simple todo application')).toBeVisible()
    await expect(page.getByText('2 files')).toBeVisible()

    // Should have "Open in Code Editor" button
    const openEditorButton = page.getByRole('button', { name: /Open in Code Editor/i })
    await expect(openEditorButton).toBeVisible()

    // Click to open in editor
    await openEditorButton.click()

    // Should redirect to workspace
    await expect(page).toHaveURL(/\/workspace\/ai-project-test-123/)
  })

  test('should handle template-based project creation', async () => {
    // Switch to Templates tab
    await page.getByRole('tab', { name: /Templates/i }).click()

    // Should show template selection
    await expect(page.getByText('Browse Templates')).toBeVisible()

    // Select a template (assuming there's a React template)
    await page.getByText('React App').first().click()

    // Should show template details
    await expect(page.getByText('React App')).toBeVisible()
    await expect(page.getByRole('button', { name: /Start Building/i })).toBeVisible()

    // Click to start building
    await page.getByRole('button', { name: /Start Building/i }).click()

    // Should switch to Customize tab
    await expect(page.getByText('AI-Powered Project Scaffolder')).toBeVisible()

    // Generate the project
    await page.getByRole('button', { name: /Generate Project Files/i }).click()

    // Wait for generation
    await expect(page.getByText('Generated Project Files')).toBeVisible()

    // Should have "Open in Editor" button
    const openEditorButton = page.getByRole('button', { name: /Open in Editor/i })
    await expect(openEditorButton).toBeVisible()

    // Click to open in editor
    await openEditorButton.click()

    // Should redirect to workspace
    await expect(page).toHaveURL(/\/workspace\//)
  })

  test('should validate required fields', async () => {
    // Generate button should be disabled without description
    await expect(page.getByRole('button', { name: /Generate Project/i })).toBeDisabled()

    // Fill in description
    await page.getByPlaceholderText(/Describe your project idea/).fill('Create a todo app')

    // Generate button should now be enabled
    await expect(page.getByRole('button', { name: /Generate Project/i })).not.toBeDisabled()

    // Clear description
    await page.getByPlaceholderText(/Describe your project idea/).clear()

    // Generate button should be disabled again
    await expect(page.getByRole('button', { name: /Generate Project/i })).toBeDisabled()
  })

  test('should handle errors gracefully', async () => {
    // Mock API error
    await page.route('**/api/ai/generate-project', async (route) => {
      await route.fulfill({
        status: 500,
        json: {
          error: 'Failed to generate project',
        },
      })
    })

    // Fill in description and generate
    await page.getByPlaceholderText(/Describe your project idea/).fill('Create a todo app')
    await page.getByRole('button', { name: /Generate Project/i }).click()

    // Should show error message
    await expect(page.getByText('Failed to generate project')).toBeVisible()

    // Should not redirect
    await expect(page).toHaveURL(/\/projects/)
  })

  test('should show authentication error when not signed in', async () => {
    // Mock unauthenticated response
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        json: {},
      })
    })

    // Fill in description and generate
    await page.getByPlaceholderText(/Describe your project idea/).fill('Create a todo app')
    await page.getByRole('button', { name: /Generate Project/i }).click()

    // Should show authentication error
    await expect(page.getByText('Please sign in to generate projects')).toBeVisible()
  })

  test('should display example project ideas', async () => {
    // Should show example section
    await expect(page.getByText('Example Project Ideas:')).toBeVisible()

    // Should show example prompts
    await expect(page.getByText('"Create a task management app with drag-and-drop functionality"')).toBeVisible()
    await expect(page.getByText('"Build a real-time chat application with user authentication"')).toBeVisible()
    await expect(page.getByText('"Generate a blog platform with markdown support and comments"')).toBeVisible()
    await expect(page.getByText('"Create an e-commerce site with product catalog and payment integration"')).toBeVisible()
  })

  test('should handle feature selection', async () => {
    // All features should start unselected
    await expect(page.getByText('Authentication')).not.toHaveClass(/bg-blue-600/)
    await expect(page.getByText('Database')).not.toHaveClass(/bg-blue-600/)

    // Select authentication
    await page.getByText('Authentication').click()
    await expect(page.getByText('Authentication')).toHaveClass(/bg-blue-600/)

    // Select database
    await page.getByText('Database').click()
    await expect(page.getByText('Database')).toHaveClass(/bg-blue-600/)

    // Deselect authentication
    await page.getByText('Authentication').click()
    await expect(page.getByText('Authentication')).not.toHaveClass(/bg-blue-600/)

    // Database should still be selected
    await expect(page.getByText('Database')).toHaveClass(/bg-blue-600/)
  })

  test('should auto-redirect to workspace after generation', async () => {
    // Fill in description and generate
    await page.getByPlaceholderText(/Describe your project idea/).fill('Create a todo app')
    await page.getByRole('button', { name: /Generate Project/i }).click()

    // Wait for generation to complete
    await expect(page.getByText('Project "todo-app" generated successfully!')).toBeVisible()

    // Should auto-redirect after 2 seconds
    await page.waitForTimeout(2500)
    await expect(page).toHaveURL(/\/workspace\/ai-project-test-123/)
  })

  test('should handle tab navigation', async () => {
    // Should start on AI Generator tab
    await expect(page.getByText('AI Project Generator')).toBeVisible()

    // Switch to Templates tab
    await page.getByRole('tab', { name: /Templates/i }).click()
    await expect(page.getByText('Browse Templates')).toBeVisible()

    // Customize tab should be disabled initially
    await expect(page.getByRole('tab', { name: /Customize/i })).toBeDisabled()

    // Go back to AI Generator
    await page.getByRole('tab', { name: /AI Generator/i }).click()
    await expect(page.getByText('AI Project Generator')).toBeVisible()
  })
})
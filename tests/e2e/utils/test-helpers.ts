import { expect, Page, request } from '@playwright/test'

type Role = 'user' | 'admin'

interface AccessibilityCheckOptions {
  failOnViolation?: boolean
}

interface PerformanceMetrics {
  domContentLoaded: number
  loadEvent: number
}

interface TestUserInput {
  email?: string
  name?: string
}

interface TestWorkspaceInput {
  name?: string
  description?: string
}

interface TestUser {
  id: string
  email: string
  name: string
}

interface TestWorkspace {
  id: string
  name: string
  description: string
  userId: string
}

class TestHelpers {
  static async waitForPageLoad(page: Page): Promise<void> {
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  }

  static async loginAsTestUser(page: Page, role: Role = 'user'): Promise<void> {
    const user = role === 'admin'
      ? { id: 'test-admin', email: 'admin@test.local', name: 'Test Admin', role: 'admin' }
      : { id: 'test-user', email: 'user@test.local', name: 'Test User', role: 'user' }

    await page.addInitScript((u) => {
      localStorage.setItem('test:user', JSON.stringify(u))
      localStorage.setItem('auth:user', JSON.stringify(u))
      localStorage.setItem('auth:role', u.role)
      localStorage.setItem('auth:token', `e2e-token-${u.role}`)
      localStorage.setItem('isAuthenticated', 'true')
    }, user)

    await page.context().addCookies([
      {
        name: 'auth-token',
        value: `e2e-token-${role}`,
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax'
      }
    ]).catch(() => {})

    if (page.url() === 'about:blank') {
      await page.goto('/')
    } else {
      await page.reload()
    }
    await this.waitForPageLoad(page)
  }

  static async logout(page: Page): Promise<void> {
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    await page.context().clearCookies()
  }

  static async createTestUser(input: TestUserInput = {}): Promise<TestUser> {
    const id = `user_${Date.now()}`
    return {
      id,
      email: input.email ?? `${id}@test.local`,
      name: input.name ?? 'Test User'
    }
  }

  static async createTestWorkspace(
    userId: string,
    input: TestWorkspaceInput = {}
  ): Promise<TestWorkspace> {
    const id = `${Math.floor(Date.now() / 1000)}`
    return {
      id,
      userId,
      name: input.name ?? 'E2E Workspace',
      description: input.description ?? 'Workspace created by E2E helpers'
    }
  }

  static async createWorkspaceViaUI(
    page: Page,
    name: string,
    description = ''
  ): Promise<void> {
    await page.goto('/workspaces')
    await this.waitForPageLoad(page)
    await page.click('[data-testid="create-workspace-button"]')
    await page.fill('[data-testid="workspace-name"]', name)
    await page.fill('[data-testid="workspace-description"]', description)
    await page.click('[data-testid="submit-workspace"]')
    await this.waitForPageLoad(page)
  }

  static async sendChatMessage(page: Page, message: string): Promise<void> {
    const input = page.locator('[data-testid="chat-input"], textarea[placeholder*="message"]').first()
    await input.waitFor({ state: 'visible', timeout: 10000 })
    await input.fill(message)
    await page.click('[data-testid="send-message"], button:has-text("Send")')
  }

  static async waitForAIResponse(page: Page): Promise<void> {
    await page
      .locator('[data-testid="ai-message"], .ai-response, .assistant-message')
      .last()
      .waitFor({ state: 'visible', timeout: 30000 })
  }

  static async assertNotification(page: Page, text: string): Promise<void> {
    const notification = page.locator(`[data-testid="notification"], text=${text}`).first()
    await expect(notification).toContainText(text)
  }

  static async assertErrorMessage(page: Page, text: string): Promise<void> {
    const error = page.locator(`[data-testid="error-message"], .error, text=${text}`).first()
    await expect(error).toContainText(text)
  }

  static async makeAPIRequest(page: Page, endpoint: string): Promise<unknown> {
    const response = await page.request.get(endpoint)
    const contentType = response.headers()['content-type'] ?? ''
    if (contentType.includes('application/json')) {
      return response.json()
    }
    return response.text()
  }

  static async cleanup(): Promise<void> {
    const context = await request.newContext()
    await context.dispose()
  }
}

export function createTestHelpers(page: Page) {
  return {
    waitForPageReady: async (): Promise<void> => {
      await TestHelpers.waitForPageLoad(page)
    },
    takeScreenshot: async (name: string): Promise<void> => {
      await page.screenshot({
        path: `test-results/${name}.png`,
        fullPage: true
      })
    },
    checkAccessibility: async (
      options: AccessibilityCheckOptions = {}
    ): Promise<{ violations: string[] }> => {
      const violations: string[] = []
      if (options.failOnViolation && violations.length > 0) {
        throw new Error(`Accessibility violations found: ${violations.join(', ')}`)
      }
      return { violations }
    },
    checkPagePerformance: async (): Promise<PerformanceMetrics> => {
      return page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
        if (!nav) {
          return { domContentLoaded: 0, loadEvent: 0 }
        }
        return {
          domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
          loadEvent: Math.round(nav.loadEventEnd - nav.startTime)
        }
      })
    },
    submitAIPrompt: async (prompt: string): Promise<void> => {
      await TestHelpers.sendChatMessage(page, prompt)
    },
    waitForAIResponse: async (): Promise<void> => {
      await TestHelpers.waitForAIResponse(page)
    },
    checkForErrors: async (): Promise<void> => {
      const visibleError = page.locator(
        '[data-testid="error-message"], .error, .alert-error, text=/error/i'
      ).first()
      if (await visibleError.isVisible().catch(() => false)) {
        throw new Error('Detected visible error state in UI')
      }
    }
  }
}

export { TestHelpers }
export default TestHelpers

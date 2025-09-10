/**
 * MCP Playwright Page Objects
 * Implementation of the Page Object Model pattern for Playwright tests
 */

import { Page, Locator } from '@playwright/test';

/**
 * Base Page Object class for all page objects
 */
export abstract class BasePage {
  /**
   * Constructor for the BasePage class
   * @param page Playwright page object
   */
  constructor(protected readonly page: Page) {}
  
  /**
   * Navigate to the page
   * @param params Optional navigation parameters
   */
  abstract goto(params?: any): Promise<void>;
  
  /**
   * Get the page title
   * @returns The page title
   */
  async getTitle(): Promise<string> {
    return await this.page.title();
  }
  
  /**
   * Get the current URL
   * @returns The current URL
   */
  async getUrl(): Promise<string> {
    return this.page.url();
  }
  
  /**
   * Wait for the page to load
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }
}

/**
 * Login Page Object
 */
export class LoginPage extends BasePage {
  // Locators
  private readonly usernameInput: Locator;
  private readonly passwordInput: Locator;
  private readonly submitButton: Locator;
  private readonly errorMessage: Locator;
  
  /**
   * Constructor for the LoginPage class
   * @param page Playwright page object
   */
  constructor(page: Page) {
    super(page);
    
    // Initialize locators
    this.usernameInput = page.locator('[data-testid="username-input"]');
    this.passwordInput = page.locator('[data-testid="password-input"]');
    this.submitButton = page.locator('[data-testid="login-button"]');
    this.errorMessage = page.locator('[data-testid="error-message"]');
  }
  
  /**
   * Navigate to the login page
   */
  async goto(): Promise<void> {
    await this.page.goto('/auth/login');
    await this.waitForPageLoad();
  }
  
  /**
   * Login with the provided credentials
   * @param username Username
   * @param password Password
   */
  async login(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
  
  /**
   * Check if there is an error message
   * @returns True if there is an error message, false otherwise
   */
  async hasError(): Promise<boolean> {
    return await this.errorMessage.isVisible();
  }
  
  /**
   * Get the error message text
   * @returns The error message text
   */
  async getErrorMessage(): Promise<string | null> {
    if (await this.hasError()) {
      return await this.errorMessage.textContent();
    }
    return null;
  }
}

/**
 * Create a LoginPage object
 * @param page Playwright page object
 * @returns LoginPage object
 */
export function createLoginPage(page: Page): LoginPage {
  return new LoginPage(page);
}

/**
 * Dashboard Page Object
 */
export class DashboardPage extends BasePage {
  // Locators
  private readonly welcomeMessage: Locator;
  private readonly userMenu: Locator;
  private readonly logoutButton: Locator;
  
  /**
   * Constructor for the DashboardPage class
   * @param page Playwright page object
   */
  constructor(page: Page) {
    super(page);
    
    // Initialize locators
    this.welcomeMessage = page.locator('[data-testid="welcome-message"]');
    this.userMenu = page.locator('[data-testid="user-menu"]');
    this.logoutButton = page.locator('[data-testid="logout-button"]');
  }
  
  /**
   * Navigate to the dashboard page
   */
  async goto(): Promise<void> {
    await this.page.goto('/dashboard');
    await this.waitForPageLoad();
  }
  
  /**
   * Get the welcome message text
   * @returns The welcome message text
   */
  async getWelcomeMessage(): Promise<string | null> {
    return await this.welcomeMessage.textContent();
  }
  
  /**
   * Open the user menu
   */
  async openUserMenu(): Promise<void> {
    await this.userMenu.click();
  }
  
  /**
   * Logout
   */
  async logout(): Promise<void> {
    await this.openUserMenu();
    await this.logoutButton.click();
  }
}

/**
 * Create a DashboardPage object
 * @param page Playwright page object
 * @returns DashboardPage object
 */
export function createDashboardPage(page: Page): DashboardPage {
  return new DashboardPage(page);
}
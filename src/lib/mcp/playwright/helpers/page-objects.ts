/**
 * MCP Playwright Page Objects
 * Helper classes for implementing the Page Object Model pattern
 */

import { Page, Locator, expect } from '@playwright/test';

/**
 * Base page object class
 */
export class BasePage {
  readonly page: Page;
  readonly path: string;
  
  /**
   * Creates a new base page object
   * @param page Playwright page
   * @param path Page path
   */
  constructor(page: Page, path: string) {
    this.page = page;
    this.path = path;
  }
  
  /**
   * Navigate to the page
   */
  async goto() {
    await this.page.goto(this.path);
  }
  
  /**
   * Wait for page to be loaded
   */
  async waitForLoaded() {
    await this.page.waitForLoadState('networkidle');
  }
}

/**
 * Component interface for reusable UI components
 */
export interface Component {
  readonly root: Locator;
  isVisible(): Promise<boolean>;
}

/**
 * Base component class
 */
export class BaseComponent implements Component {
  readonly root: Locator;
  readonly page: Page;
  
  /**
   * Creates a new base component
   * @param page Playwright page
   * @param selector Root selector for the component
   */
  constructor(page: Page, selector: string) {
    this.page = page;
    this.root = page.locator(selector);
  }
  
  /**
   * Check if component is visible
   * @returns Visibility status
   */
  async isVisible(): Promise<boolean> {
    return await this.root.isVisible();
  }
  
  /**
   * Wait for component to be visible
   * @param timeout Optional timeout in milliseconds
   */
  async waitForVisible(timeout?: number) {
    await this.root.waitFor({ state: 'visible', timeout });
  }
}

/**
 * Navigation component
 */
export class Navigation extends BaseComponent {
  /**
   * Creates a new navigation component
   * @param page Playwright page
   * @param selector Root selector (defaults to main navigation)
   */
  constructor(page: Page, selector: string = 'nav') {
    super(page, selector);
  }
  
  /**
   * Navigate to a section by text
   * @param text Link text
   */
  async navigateTo(text: string) {
    await this.root.getByText(text).click();
  }
  
  /**
   * Check if a navigation item exists
   * @param text Link text
   * @returns Whether the item exists
   */
  async hasItem(text: string): Promise<boolean> {
    const count = await this.root.getByText(text).count();
    return count > 0;
  }
}

/**
 * Form component
 */
export class Form extends BaseComponent {
  /**
   * Creates a new form component
   * @param page Playwright page
   * @param selector Root selector (defaults to form element)
   */
  constructor(page: Page, selector: string = 'form') {
    super(page, selector);
  }
  
  /**
   * Fill a form field
   * @param label Field label text
   * @param value Value to fill
   */
  async fillField(label: string, value: string) {
    await this.root.getByLabel(label).fill(value);
  }
  
  /**
   * Click a button in the form
   * @param text Button text
   */
  async clickButton(text: string) {
    await this.root.getByRole('button', { name: text }).click();
  }
  
  /**
   * Submit the form
   */
  async submit() {
    await this.root.evaluate(form => (form as HTMLFormElement).submit());
  }
  
  /**
   * Get error message if present
   * @returns Error message text or null if not found
   */
  async getErrorMessage(): Promise<string | null> {
    const errorElement = this.root.locator('.error-message');
    if (await errorElement.isVisible()) {
      return await errorElement.textContent();
    }
    return null;
  }
}

/**
 * Table component
 */
export class Table extends BaseComponent {
  /**
   * Creates a new table component
   * @param page Playwright page
   * @param selector Root selector (defaults to table element)
   */
  constructor(page: Page, selector: string = 'table') {
    super(page, selector);
  }
  
  /**
   * Get all rows in the table
   * @returns Array of row locators
   */
  getRows(): Locator {
    return this.root.locator('tbody > tr');
  }
  
  /**
   * Get cell text by row and column
   * @param rowIndex Row index (0-based)
   * @param colIndex Column index (0-based)
   * @returns Cell text
   */
  async getCellText(rowIndex: number, colIndex: number): Promise<string | null> {
    const cell = this.root.locator(`tbody > tr:nth-child(${rowIndex + 1}) > td:nth-child(${colIndex + 1})`);
    return await cell.textContent();
  }
  
  /**
   * Find row by text in a specific column
   * @param text Text to search for
   * @param columnIndex Column index (0-based)
   * @returns Row locator or null if not found
   */
  async findRowByText(text: string, columnIndex: number): Promise<Locator | null> {
    const rows = this.getRows();
    const count = await rows.count();
    
    for (let i = 0; i < count; i++) {
      const cellText = await this.getCellText(i, columnIndex);
      if (cellText === text) {
        return rows.nth(i);
      }
    }
    
    return null;
  }
}

/**
 * Factory function to create a page object
 * @param page Playwright page
 * @param PageClass Page class to instantiate
 * @param path Page path
 * @returns Page object instance
 */
export function createPage<T extends BasePage>(
  page: Page,
  PageClass: new (page: Page, path: string) => T,
  path: string
): T {
  return new PageClass(page, path);
}
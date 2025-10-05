/**
 * WCAG 2.1 AA Compliance Checker
 * Automated accessibility validation utilities
 */

export interface WCAGViolation {
  rule: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  element: string;
  message: string;
  wcagCriterion: string;
  helpUrl: string;
}

export interface AccessibilityReport {
  passed: boolean;
  violations: WCAGViolation[];
  warnings: WCAGViolation[];
  score: number; // 0-100
  timestamp: Date;
  testedElements: number;
}

/**
 * Color contrast checker (WCAG 1.4.3)
 */
export class ContrastChecker {
  /**
   * Calculate relative luminance of a color
   */
  static getLuminance(hex: string): number {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return 0;

    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((c) => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /**
   * Convert hex to RGB
   */
  static hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }

  /**
   * Calculate contrast ratio
   */
  static getContrastRatio(foreground: string, background: string): number {
    const l1 = this.getLuminance(foreground);
    const l2 = this.getLuminance(background);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Check if contrast meets WCAG AA
   */
  static meetsWCAGAA(ratio: number, isLargeText: boolean = false): boolean {
    return isLargeText ? ratio >= 3.0 : ratio >= 4.5;
  }

  /**
   * Check if contrast meets WCAG AAA
   */
  static meetsWCAGAAA(ratio: number, isLargeText: boolean = false): boolean {
    return isLargeText ? ratio >= 4.5 : ratio >= 7.0;
  }

  /**
   * Get contrast rating
   */
  static getContrastRating(
    ratio: number,
    isLargeText: boolean = false
  ): 'AAA' | 'AA' | 'Fail' {
    if (this.meetsWCAGAAA(ratio, isLargeText)) return 'AAA';
    if (this.meetsWCAGAA(ratio, isLargeText)) return 'AA';
    return 'Fail';
  }
}

/**
 * Keyboard accessibility checker (WCAG 2.1.1)
 */
export class KeyboardAccessibilityChecker {
  /**
   * Check if element is keyboard accessible
   */
  static isKeyboardAccessible(element: HTMLElement): boolean {
    const tagName = element.tagName.toLowerCase();
    const tabIndex = element.getAttribute('tabindex');
    const role = element.getAttribute('role');

    // Naturally focusable elements
    const nativelyFocusable = [
      'a',
      'button',
      'input',
      'textarea',
      'select',
    ].includes(tagName);

    // Elements with tabindex >= 0
    const hasTabIndex = tabIndex !== null && parseInt(tabIndex) >= 0;

    // Elements with interactive roles
    const hasInteractiveRole = ['button', 'link', 'tab', 'menuitem'].includes(
      role || ''
    );

    return nativelyFocusable || hasTabIndex || hasInteractiveRole;
  }

  /**
   * Check if element has visible focus indicator
   */
  static hasVisibleFocusIndicator(element: HTMLElement): boolean {
    const styles = window.getComputedStyle(element);

    const hasOutline = styles.outline !== 'none' && styles.outlineWidth !== '0px';
    const hasBoxShadow = styles.boxShadow !== 'none';
    const hasBorder =
      styles.borderWidth !== '0px' &&
      styles.borderStyle !== 'none' &&
      styles.borderColor !== 'transparent';

    return hasOutline || hasBoxShadow || hasBorder;
  }

  /**
   * Get all focusable elements in container
   */
  static getFocusableElements(container: HTMLElement): HTMLElement[] {
    const selector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
      (el) => {
        // Filter out hidden elements
        return el.offsetParent !== null;
      }
    );
  }
}

/**
 * ARIA checker (WCAG 4.1.2, 4.1.3)
 */
export class ARIAChecker {
  /**
   * Valid ARIA attributes
   */
  private static readonly VALID_ARIA_ATTRIBUTES = [
    'aria-label',
    'aria-labelledby',
    'aria-describedby',
    'aria-hidden',
    'aria-live',
    'aria-atomic',
    'aria-relevant',
    'aria-busy',
    'aria-controls',
    'aria-expanded',
    'aria-haspopup',
    'aria-pressed',
    'aria-checked',
    'aria-selected',
    'aria-required',
    'aria-invalid',
    'aria-disabled',
    'aria-readonly',
    'aria-valuemin',
    'aria-valuemax',
    'aria-valuenow',
    'aria-valuetext',
    'aria-orientation',
    'aria-modal',
    'aria-current',
  ];

  /**
   * Valid ARIA roles
   */
  private static readonly VALID_ROLES = [
    'alert',
    'alertdialog',
    'application',
    'article',
    'banner',
    'button',
    'checkbox',
    'columnheader',
    'combobox',
    'complementary',
    'contentinfo',
    'dialog',
    'directory',
    'document',
    'feed',
    'figure',
    'form',
    'grid',
    'gridcell',
    'group',
    'heading',
    'img',
    'link',
    'list',
    'listbox',
    'listitem',
    'log',
    'main',
    'marquee',
    'math',
    'menu',
    'menubar',
    'menuitem',
    'menuitemcheckbox',
    'menuitemradio',
    'navigation',
    'none',
    'note',
    'option',
    'presentation',
    'progressbar',
    'radio',
    'radiogroup',
    'region',
    'row',
    'rowgroup',
    'rowheader',
    'scrollbar',
    'search',
    'searchbox',
    'separator',
    'slider',
    'spinbutton',
    'status',
    'switch',
    'tab',
    'table',
    'tablist',
    'tabpanel',
    'term',
    'textbox',
    'timer',
    'toolbar',
    'tooltip',
    'tree',
    'treegrid',
    'treeitem',
  ];

  /**
   * Check if element has valid ARIA attributes
   */
  static hasValidARIA(element: HTMLElement): {
    valid: boolean;
    invalidAttributes: string[];
  } {
    const attributes = Array.from(element.attributes)
      .filter((attr) => attr.name.startsWith('aria-'))
      .map((attr) => attr.name);

    const invalidAttributes = attributes.filter(
      (attr) => !this.VALID_ARIA_ATTRIBUTES.includes(attr)
    );

    return {
      valid: invalidAttributes.length === 0,
      invalidAttributes,
    };
  }

  /**
   * Check if role is valid
   */
  static hasValidRole(element: HTMLElement): boolean {
    const role = element.getAttribute('role');
    if (!role) return true; // No role is valid

    return this.VALID_ROLES.includes(role);
  }

  /**
   * Check if element has proper ARIA label
   */
  static hasProperLabel(element: HTMLElement): boolean {
    const hasAriaLabel = element.hasAttribute('aria-label');
    const hasAriaLabelledby = element.hasAttribute('aria-labelledby');
    const hasTitle = element.hasAttribute('title');

    // Check for associated label
    const id = element.id;
    const hasLabel = id && document.querySelector(`label[for="${id}"]`) !== null;

    // Interactive elements should have a label
    const tagName = element.tagName.toLowerCase();
    const interactiveElements = ['button', 'a', 'input', 'textarea', 'select'];

    if (interactiveElements.includes(tagName)) {
      return hasAriaLabel || hasAriaLabelledby || hasLabel || hasTitle;
    }

    return true;
  }
}

/**
 * Semantic HTML checker (WCAG 1.3.1)
 */
export class SemanticHTMLChecker {
  /**
   * Check if page has proper landmark structure
   */
  static hasProperLandmarks(container: HTMLElement): {
    valid: boolean;
    missing: string[];
  } {
    const requiredLandmarks = ['main', 'header', 'nav'];
    const missing: string[] = [];

    requiredLandmarks.forEach((landmark) => {
      const hasElement =
        container.querySelector(landmark) !== null ||
        container.querySelector(`[role="${landmark}"]`) !== null;

      if (!hasElement) {
        missing.push(landmark);
      }
    });

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * Check heading hierarchy
   */
  static hasProperHeadingHierarchy(container: HTMLElement): {
    valid: boolean;
    issues: string[];
  } {
    const headings = Array.from(
      container.querySelectorAll('h1, h2, h3, h4, h5, h6')
    );
    const issues: string[] = [];

    if (headings.length === 0) {
      issues.push('No headings found');
      return { valid: false, issues };
    }

    // Check first heading is h1
    const firstHeading = headings[0];
    if (firstHeading.tagName.toLowerCase() !== 'h1') {
      issues.push('First heading should be h1');
    }

    // Check for skipped levels
    let previousLevel = 1;
    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName.charAt(1));

      if (index > 0 && level > previousLevel + 1) {
        issues.push(
          `Heading level ${level} skips level ${previousLevel + 1} at ${heading.textContent?.substring(0, 30)}`
        );
      }

      previousLevel = level;
    });

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Check for proper list structure
   */
  static hasProperListStructure(container: HTMLElement): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check that li elements are inside ul/ol
    const listItems = Array.from(container.querySelectorAll('li'));
    listItems.forEach((li) => {
      const parent = li.parentElement;
      if (parent && !['ul', 'ol'].includes(parent.tagName.toLowerCase())) {
        issues.push('li element not inside ul or ol');
      }
    });

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}

/**
 * Form accessibility checker (WCAG 3.3.2)
 */
export class FormAccessibilityChecker {
  /**
   * Check if form input has proper label
   */
  static hasProperLabel(input: HTMLInputElement | HTMLTextAreaElement): boolean {
    const id = input.id;
    const hasLabel = id && document.querySelector(`label[for="${id}"]`) !== null;
    const hasAriaLabel = input.hasAttribute('aria-label');
    const hasAriaLabelledby = input.hasAttribute('aria-labelledby');

    return hasLabel || hasAriaLabel || hasAriaLabelledby;
  }

  /**
   * Check if required field is marked
   */
  static hasRequiredIndicator(input: HTMLInputElement | HTMLTextAreaElement): boolean {
    const isRequired = input.required;
    const hasAriaRequired = input.getAttribute('aria-required') === 'true';

    return isRequired || hasAriaRequired;
  }

  /**
   * Check if error message is associated
   */
  static hasAssociatedErrorMessage(
    input: HTMLInputElement | HTMLTextAreaElement
  ): boolean {
    const ariaDescribedby = input.getAttribute('aria-describedby');
    const ariaInvalid = input.getAttribute('aria-invalid') === 'true';

    if (ariaInvalid && ariaDescribedby) {
      const errorElement = document.getElementById(ariaDescribedby);
      return errorElement !== null;
    }

    return true; // No error, so it's valid
  }

  /**
   * Validate entire form
   */
  static validateForm(form: HTMLFormElement): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    const inputs = Array.from(
      form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'input, textarea, select'
      )
    );

    inputs.forEach((input) => {
      if (!this.hasProperLabel(input)) {
        issues.push(`Input "${input.name || input.id}" missing label`);
      }

      if (input.required && !this.hasRequiredIndicator(input)) {
        issues.push(`Required input "${input.name || input.id}" not marked as required`);
      }

      if (!this.hasAssociatedErrorMessage(input)) {
        issues.push(
          `Input "${input.name || input.id}" has aria-invalid but no associated error message`
        );
      }
    });

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}

/**
 * Main accessibility validator
 */
export class AccessibilityValidator {
  /**
   * Run comprehensive accessibility check
   */
  static async validate(container: HTMLElement): Promise<AccessibilityReport> {
    const violations: WCAGViolation[] = [];
    const warnings: WCAGViolation[] = [];

    // Check landmarks
    const landmarksCheck = SemanticHTMLChecker.hasProperLandmarks(container);
    if (!landmarksCheck.valid) {
      violations.push({
        rule: 'landmark-structure',
        severity: 'critical',
        element: 'document',
        message: `Missing required landmarks: ${landmarksCheck.missing.join(', ')}`,
        wcagCriterion: '2.4.1 Bypass Blocks',
        helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/bypass-blocks',
      });
    }

    // Check heading hierarchy
    const headingsCheck = SemanticHTMLChecker.hasProperHeadingHierarchy(container);
    if (!headingsCheck.valid) {
      violations.push({
        rule: 'heading-hierarchy',
        severity: 'serious',
        element: 'headings',
        message: headingsCheck.issues.join('; '),
        wcagCriterion: '1.3.1 Info and Relationships',
        helpUrl:
          'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships',
      });
    }

    // Check keyboard accessibility
    const interactiveElements = KeyboardAccessibilityChecker.getFocusableElements(
      container
    );

    interactiveElements.forEach((element) => {
      if (!KeyboardAccessibilityChecker.isKeyboardAccessible(element)) {
        violations.push({
          rule: 'keyboard-accessible',
          severity: 'critical',
          element: element.tagName.toLowerCase(),
          message: 'Element not keyboard accessible',
          wcagCriterion: '2.1.1 Keyboard',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/keyboard',
        });
      }

      if (!KeyboardAccessibilityChecker.hasVisibleFocusIndicator(element)) {
        warnings.push({
          rule: 'focus-visible',
          severity: 'moderate',
          element: element.tagName.toLowerCase(),
          message: 'Element may not have visible focus indicator',
          wcagCriterion: '2.4.7 Focus Visible',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/focus-visible',
        });
      }
    });

    // Check ARIA
    const elementsWithARIA = Array.from(
      container.querySelectorAll<HTMLElement>('[role], [aria-label], [aria-labelledby]')
    );

    elementsWithARIA.forEach((element) => {
      const ariaCheck = ARIAChecker.hasValidARIA(element);
      if (!ariaCheck.valid) {
        violations.push({
          rule: 'aria-valid',
          severity: 'serious',
          element: element.tagName.toLowerCase(),
          message: `Invalid ARIA attributes: ${ariaCheck.invalidAttributes.join(', ')}`,
          wcagCriterion: '4.1.2 Name, Role, Value',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value',
        });
      }

      if (!ARIAChecker.hasValidRole(element)) {
        violations.push({
          rule: 'aria-role-valid',
          severity: 'serious',
          element: element.tagName.toLowerCase(),
          message: 'Invalid ARIA role',
          wcagCriterion: '4.1.2 Name, Role, Value',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value',
        });
      }

      if (!ARIAChecker.hasProperLabel(element)) {
        warnings.push({
          rule: 'aria-label',
          severity: 'moderate',
          element: element.tagName.toLowerCase(),
          message: 'Interactive element missing accessible label',
          wcagCriterion: '4.1.2 Name, Role, Value',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value',
        });
      }
    });

    // Check forms
    const forms = Array.from(container.querySelectorAll<HTMLFormElement>('form'));
    forms.forEach((form) => {
      const formCheck = FormAccessibilityChecker.validateForm(form);
      if (!formCheck.valid) {
        formCheck.issues.forEach((issue) => {
          violations.push({
            rule: 'form-label',
            severity: 'serious',
            element: 'form',
            message: issue,
            wcagCriterion: '3.3.2 Labels or Instructions',
            helpUrl:
              'https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions',
          });
        });
      }
    });

    // Calculate score
    const testedElements = interactiveElements.length + elementsWithARIA.length;
    const totalIssues = violations.length + warnings.length * 0.5;
    const score = Math.max(0, 100 - (totalIssues / testedElements) * 100);

    return {
      passed: violations.length === 0,
      violations,
      warnings,
      score: Math.round(score),
      timestamp: new Date(),
      testedElements,
    };
  }

  /**
   * Generate accessibility report as text
   */
  static generateTextReport(report: AccessibilityReport): string {
    let output = `\n=== Accessibility Report ===\n`;
    output += `Generated: ${report.timestamp.toISOString()}\n`;
    output += `Tested Elements: ${report.testedElements}\n`;
    output += `Score: ${report.score}/100\n`;
    output += `Status: ${report.passed ? 'PASSED ✓' : 'FAILED ✗'}\n\n`;

    if (report.violations.length > 0) {
      output += `VIOLATIONS (${report.violations.length}):\n`;
      report.violations.forEach((v, i) => {
        output += `\n${i + 1}. [${v.severity.toUpperCase()}] ${v.rule}\n`;
        output += `   Element: ${v.element}\n`;
        output += `   Message: ${v.message}\n`;
        output += `   WCAG: ${v.wcagCriterion}\n`;
        output += `   Help: ${v.helpUrl}\n`;
      });
    }

    if (report.warnings.length > 0) {
      output += `\nWARNINGS (${report.warnings.length}):\n`;
      report.warnings.forEach((w, i) => {
        output += `\n${i + 1}. [${w.severity.toUpperCase()}] ${w.rule}\n`;
        output += `   Element: ${w.element}\n`;
        output += `   Message: ${w.message}\n`;
        output += `   WCAG: ${w.wcagCriterion}\n`;
      });
    }

    if (report.passed) {
      output += `\n✓ No critical accessibility violations found!\n`;
    }

    return output;
  }
}

/**
 * Accessibility testing configuration for WCAG 2.1 AA compliance
 * 
 * This configuration defines the rules and settings for automated
 * accessibility testing across the VibeCode platform.
 */

module.exports = {
  // WCAG 2.1 AA Rules Configuration
  wcagConfig: {
    rules: {
      // Level A Rules (required for AA compliance)
      'area-alt': { enabled: true },
      'aria-allowed-attr': { enabled: true },
      'aria-required-attr': { enabled: true },
      'aria-required-children': { enabled: true },
      'aria-required-parent': { enabled: true },
      'aria-roles': { enabled: true },
      'aria-valid-attr': { enabled: true },
      'aria-valid-attr-value': { enabled: true },
      'audio-caption': { enabled: true },
      'blink': { enabled: true },
      'button-name': { enabled: true },
      'bypass': { enabled: true },
      'document-title': { enabled: true },
      'duplicate-id': { enabled: true },
      'empty-heading': { enabled: true },
      'form-field-multiple-labels': { enabled: true },
      'frame-title': { enabled: true },
      'html-has-lang': { enabled: true },
      'html-lang-valid': { enabled: true },
      'image-alt': { enabled: true },
      'input-image-alt': { enabled: true },
      'keyboard': { enabled: true },
      'label': { enabled: true },
      'link-name': { enabled: true },
      'list': { enabled: true },
      'listitem': { enabled: true },
      'marquee': { enabled: true },
      'meta-refresh': { enabled: true },
      'object-alt': { enabled: true },
      'role-img-alt': { enabled: true },
      'scope': { enabled: true },
      'server-side-image-map': { enabled: true },
      'valid-lang': { enabled: true },
      'video-caption': { enabled: true },

      // Level AA Rules
      'autocomplete-valid': { enabled: true },
      'avoid-inline-spacing': { enabled: true },
      'color-contrast': { enabled: true },
      'focus-order-semantics': { enabled: true },
      'frame-tested': { enabled: true },
      'heading-order': { enabled: true },
      'hidden-content': { enabled: true },
      'label-title-only': { enabled: true },
      'landmark-banner-is-top-level': { enabled: true },
      'landmark-complementary-is-top-level': { enabled: true },
      'landmark-contentinfo-is-top-level': { enabled: true },
      'landmark-main-is-top-level': { enabled: true },
      'landmark-no-duplicate-banner': { enabled: true },
      'landmark-no-duplicate-contentinfo': { enabled: true },
      'landmark-no-duplicate-main': { enabled: true },
      'landmark-one-main': { enabled: true },
      'landmark-unique': { enabled: true },
      'link-in-text-block': { enabled: true },
      'no-autoplay-audio': { enabled: true },
      'page-has-heading-one': { enabled: true },
      'region': { enabled: true },
      'scroll-element-content': { enabled: true },
      'timing-adjustable': { enabled: true },

      // Disable AAA rules (not required for AA compliance)
      'color-contrast-enhanced': { enabled: false },
      'focus-order-meaning': { enabled: false },
      'help': { enabled: false },
      'link-in-text-block-style': { enabled: false },
      'meta-refresh-no-exceptions': { enabled: false }
    },
    tags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
    
    // Include experimental rules that may become part of WCAG
    experimental: false,
    
    // Reporter configuration
    reporter: 'v2',
    
    // Performance settings
    performanceTimer: true,
    
    // Output format
    outputFormat: 'json'
  },

  // Playwright configuration for accessibility testing
  playwrightConfig: {
    timeout: 30000,
    actionTimeout: 5000,
    navigationTimeout: 30000,
    
    // Browser settings for accessibility testing
    browsers: ['chromium', 'firefox', 'webkit'],
    
    // Viewport sizes to test
    viewports: [
      { width: 1920, height: 1080 }, // Desktop
      { width: 1366, height: 768 },  // Laptop
      { width: 768, height: 1024 },  // Tablet
      { width: 375, height: 667 }    // Mobile
    ],
    
    // Color schemes to test
    colorSchemes: ['light', 'dark'],
    
    // Reduced motion setting
    reducedMotion: ['reduce', 'no-preference'],
    
    // High contrast mode
    forcedColors: ['active', 'none']
  },

  // Component-specific accessibility rules
  componentRules: {
    // Chat interface specific rules
    chat: {
      'aria-live-region': { enabled: true },
      'role-log': { enabled: true },
      'message-accessibility': { enabled: true }
    },
    
    // Form-specific rules
    forms: {
      'form-field-multiple-labels': { enabled: true },
      'label-content-name-mismatch': { enabled: true },
      'required-field-indicator': { enabled: true }
    },
    
    // Data table rules
    tables: {
      'table-caption': { enabled: true },
      'table-headers': { enabled: true },
      'table-scope': { enabled: true }
    },
    
    // Navigation rules
    navigation: {
      'skip-link': { enabled: true },
      'landmark-navigation': { enabled: true },
      'breadcrumb': { enabled: true }
    }
  },

  // Test data for accessibility testing
  testData: {
    // Sample content for testing
    sampleText: {
      short: 'Quick test',
      medium: 'This is a medium length text for testing purposes.',
      long: 'This is a much longer text that spans multiple lines and provides a comprehensive example for testing text content accessibility features including reading flow, contrast ratios, and screen reader compatibility.'
    },
    
    // Color combinations to test
    colorCombinations: [
      { foreground: '#000000', background: '#FFFFFF', name: 'Black on White' },
      { foreground: '#FFFFFF', background: '#000000', name: 'White on Black' },
      { foreground: '#2563EB', background: '#FFFFFF', name: 'Blue on White' },
      { foreground: '#FFFFFF', background: '#2563EB', name: 'White on Blue' },
      { foreground: '#16A34A', background: '#FFFFFF', name: 'Green on White' },
      { foreground: '#DC2626', background: '#FFFFFF', name: 'Red on White' },
      { foreground: '#6B7280', background: '#F9FAFB', name: 'Gray on Light Gray' }
    ],
    
    // Form validation messages
    validationMessages: {
      required: 'This field is required',
      email: 'Please enter a valid email address',
      minLength: 'Must be at least 3 characters long',
      maxLength: 'Must be no more than 100 characters long',
      pattern: 'Please match the requested format'
    },
    
    // ARIA labels and descriptions
    ariaLabels: {
      chatInput: 'Type your message to the AI assistant',
      fileUpload: 'Upload files to share with the AI',
      sendButton: 'Send message to AI assistant',
      clearChat: 'Clear chat history',
      settings: 'Open chat settings',
      modelSelect: 'Select AI model to use'
    }
  },

  // Reporting configuration
  reporting: {
    // Output directory for reports
    outputDir: './tests/accessibility/reports',
    
    // Report formats to generate
    formats: ['json', 'html', 'csv'],
    
    // Include screenshots in reports
    screenshots: true,
    
    // Group violations by severity
    groupBySeverity: true,
    
    // Include detailed help text
    includeHelp: true,
    
    // Save raw axe results
    saveRawResults: true
  },

  // Continuous integration settings
  ci: {
    // Fail build on accessibility violations
    failOnViolations: true,
    
    // Minimum severity level to fail on
    failOnSeverity: 'serious', // minor, moderate, serious, critical
    
    // Maximum number of violations allowed
    maxViolations: {
      critical: 0,
      serious: 0,
      moderate: 5,
      minor: 10
    },
    
    // Generate badges for documentation
    generateBadges: true,
    
    // Upload results to external service
    uploadResults: false
  },

  // Performance thresholds for accessibility testing
  performance: {
    // Maximum time for accessibility scan
    maxScanTime: 10000, // 10 seconds
    
    // Maximum memory usage
    maxMemoryUsage: '512MB',
    
    // Parallel test execution
    parallel: true,
    maxWorkers: 4
  },

  // Custom accessibility rules for VibeCode
  customRules: [
    {
      id: 'vibecode-model-selection-accessible',
      description: 'AI model selection should be accessible',
      selector: '[data-testid="model-selector"]',
      evaluate: function(node) {
        const hasLabel = node.getAttribute('aria-label') || 
                        node.getAttribute('aria-labelledby') ||
                        node.querySelector('label');
        return hasLabel !== null;
      },
      impact: 'serious',
      tags: ['custom', 'vibecode']
    },
    {
      id: 'vibecode-chat-message-accessible',
      description: 'Chat messages should be accessible to screen readers',
      selector: '[data-testid="chat-message"]',
      evaluate: function(node) {
        const hasRole = node.getAttribute('role') === 'article' ||
                       node.getAttribute('role') === 'listitem';
        const hasHeading = node.querySelector('h1, h2, h3, h4, h5, h6, [role="heading"]');
        return hasRole && hasHeading;
      },
      impact: 'moderate',
      tags: ['custom', 'vibecode', 'chat']
    },
    {
      id: 'vibecode-progress-indicator-accessible',
      description: 'Progress indicators should be accessible',
      selector: '[role="progressbar"], .progress',
      evaluate: function(node) {
        const hasValueNow = node.getAttribute('aria-valuenow');
        const hasValueMin = node.getAttribute('aria-valuemin');
        const hasValueMax = node.getAttribute('aria-valuemax');
        const hasLabel = node.getAttribute('aria-label') || 
                        node.getAttribute('aria-labelledby');
        return hasValueNow && hasValueMin && hasValueMax && hasLabel;
      },
      impact: 'serious',
      tags: ['custom', 'vibecode', 'progress']
    }
  ],

  // Environment-specific configurations
  environments: {
    development: {
      verbose: true,
      showPassingTests: true,
      detailedReporting: true
    },
    
    staging: {
      verbose: false,
      showPassingTests: false,
      detailedReporting: true,
      uploadResults: true
    },
    
    production: {
      verbose: false,
      showPassingTests: false,
      detailedReporting: false,
      monitoringOnly: true
    }
  }
};
// Import the jest-dom library for DOM testing (only in jsdom environment)
if (typeof window !== 'undefined') {
  require('@testing-library/jest-dom');
}

// Mock UnifiedAIClient EARLY to prevent OOM during module loading
jest.mock('@/lib/unified-ai-client');

// Only set up browser-specific mocks when in jsdom environment
if (typeof window !== 'undefined') {
  // Mock the global ResizeObserver which is used by CodeMirror
  class ResizeObserver {
    constructor(callback: any) {
      this.callback = callback;
      this.observe = jest.fn();
      this.unobserve = jest.fn();
      this.disconnect = jest.fn();
    }

    callback = () => {};
    observe = jest.fn();
    unobserve = jest.fn();
    disconnect = jest.fn();
  }

  // Add ResizeObserver to the global scope
  (window as any).ResizeObserver = ResizeObserver;

  // Mock the matchMedia API
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  // Mock the IntersectionObserver API
  class IntersectionObserver {
    root = null;
    rootMargin = '';
    thresholds = [];

    constructor() {}

    disconnect() {
      return null;
    }

    observe() {
      return null;
    }

    takeRecords() {
      return [];
    }

    unobserve() {
      return null;
    }
  }

  // Add IntersectionObserver to the global scope
  (window as any).IntersectionObserver = IntersectionObserver;

  // Mock the scrollIntoView method
  if (typeof Element !== 'undefined') {
    Element.prototype.scrollIntoView = jest.fn();
  }

  // Mock the getComputedStyle function
  const originalGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = (elt: Element) => ({
    getPropertyValue: jest.fn(),
    display: 'block',
    visibility: 'visible',
    opacity: '1',
    position: 'static',
    ...originalGetComputedStyle(elt)
  });
}

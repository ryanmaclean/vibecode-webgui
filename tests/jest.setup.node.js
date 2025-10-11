// Jest setup for Node.js environment tests
// This setup file is used for backend/API tests that don't need DOM mocking

// Mock console methods to reduce test noise
const originalConsoleError = console.error;
console.error = jest.fn((message, ...args) => {
  if (
    typeof message === 'string' &&
    (message.includes('The above error occurred in the') ||
      message.includes('Consider adding an error boundary'))
  ) {
    return;
  }
  originalConsoleError(message, ...args);
});

const originalConsoleWarn = console.warn;
console.warn = jest.fn((message, ...args) => {
  if (
    typeof message === 'string' &&
    message.includes('The `value` prop is required for the `Context`')
  ) {
    return;
  }
  originalConsoleWarn(message, ...args);
});

// Mock performance for Node.js environment
if (typeof global.performance === 'undefined') {
  global.performance = {
    now: () => Date.now()
  };
}

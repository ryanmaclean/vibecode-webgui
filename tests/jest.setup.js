import '@testing-library/jest-dom';

// Mock scrollIntoView for components that use it
window.HTMLElement.prototype.scrollIntoView = jest.fn();

// Stable default fetch mock across tests (resetMocks is enabled)
beforeEach(() => {
  const defaultImpl = (url) => {
    const nowIso = new Date().toISOString();
    // AI LiteLLM route requires auth by default
    if (typeof url === 'string' && url.includes('/api/ai/litellm')) {
      return Promise.resolve({
        ok: false,
        status: 401,
        headers: new Headers(),
        json: async () => ({ error: 'Unauthorized' }),
        text: async () => 'Unauthorized'
      });
    }
    // Health endpoint stub
    if (typeof url === 'string' && url.includes('/api/monitoring/health')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          status: 'healthy',
          timestamp: nowIso,
          uptime: 12345,
          checks: {}
        }),
        text: async () => ''
      });
    }
    // Metrics endpoint stub
    if (typeof url === 'string' && url.includes('/api/monitoring/metrics')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          timestamp: nowIso,
          system: { cpu: 10, memory: 20, disk: 30 },
          performance: { responseTime: 100, errorRate: 0.01 },
          users: { activeUsers: 5, activeWorkspaces: 3 },
          requests: { total: 100, failed: 0 }
        }),
        text: async () => ''
      });
    }
    // Generic OK response
    return Promise.resolve({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({}),
      text: async () => ''
    });
  };

  if (!global.fetch || typeof global.fetch !== 'function' || !('mockImplementation' in global.fetch)) {
    global.fetch = jest.fn(defaultImpl);
  } else {
    global.fetch.mockImplementation(defaultImpl);
  }
});





// Mock window.speechSynthesis for voice tests
Object.defineProperty(window, 'speechSynthesis', {
  value: {
    speak: jest.fn(),
    cancel: jest.fn(),
    getVoices: jest.fn(() => [
      { lang: 'en-US', name: 'Google US English' },
      { lang: 'en-GB', name: 'Google UK English Female' },
    ]),
  },
  writable: true,
});

// Mock window.SpeechRecognition for voice input tests
Object.defineProperty(window, 'SpeechRecognition', {
  value: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    onresult: jest.fn(),
    onerror: jest.fn(),
    onend: jest.fn(),
  })),
  writable: true,
});

// Mock MediaDevices and MediaRecorder for audio recording tests
if (typeof window.navigator.mediaDevices === 'undefined') {
  Object.defineProperty(window.navigator, 'mediaDevices', {
    value: {
      getUserMedia: jest.fn(() => Promise.resolve({
        getTracks: () => [{
          stop: jest.fn(),
        }],
      })),
    },
    writable: true,
  });
}

if (typeof window.MediaRecorder === 'undefined') {
  Object.defineProperty(window, 'MediaRecorder', {
    value: jest.fn().mockImplementation(() => ({
      start: jest.fn(),
      stop: jest.fn(),
      ondataavailable: jest.fn(),
      onerror: jest.fn(),
      state: 'inactive',
      mimeType: 'audio/webm',
    })),
    writable: true,
  });
}

// Mock URL.createObjectURL for file handling tests
if (typeof URL.createObjectURL === 'undefined') {
  URL.createObjectURL = jest.fn(() => 'mock-blob-url');
}

// Mock ResizeObserver and IntersectionObserver for layout-dependent components
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Suppress specific console errors and warnings to reduce test noise
const originalConsoleError = console.error;
console.error = jest.fn((message, ...args) => {
  if (
    typeof message === 'string' &&
    (message.includes('The above error occurred in the') ||
      message.includes('Consider adding an error boundary') ||
      message.includes('Warning: validateDOMNesting(...)'))
  ) {
    return;
  }
  originalConsoleError(message, ...args);
});

const originalConsoleWarn = console.warn;
console.warn = jest.fn((message, ...args) => {
  if (
    typeof message === 'string' &&
    (message.includes('The `value` prop is required for the `Context`') ||
      message.includes('should be wrapped in an <form>'))
  ) {
    return;
  }
  originalConsoleWarn(message, ...args);
});

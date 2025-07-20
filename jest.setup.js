import '@testing-library/jest-dom';

// Mock window.speechSynthesis for voice tests
Object.defineProperty(window, 'speechSynthesis', {
  writable: true,
  value: {
    speak: jest.fn(),
    cancel: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    getVoices: jest.fn(() => []),
  },
});

// Mock window.SpeechRecognition for voice input tests
Object.defineProperty(window, 'SpeechRecognition', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    continuous: false,
    interimResults: false,
    lang: 'en-US',
    start: jest.fn(),
    stop: jest.fn(),
    abort: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    onresult: null,
    onerror: null,
    onend: null,
  })),
});

Object.defineProperty(window, 'webkitSpeechRecognition', {
  writable: true,
  value: window.SpeechRecognition,
});

// Mock MediaDevices for audio recording tests
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: jest.fn(() => [
        {
          stop: jest.fn(),
        },
      ]),
    }),
  },
});

// Mock MediaRecorder for audio recording
global.MediaRecorder = jest.fn().mockImplementation(() => ({
  start: jest.fn(),
  stop: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  ondataavailable: null,
  onstop: null,
  onerror: null,
  state: 'inactive',
}));

// Mock Blob constructor for audio/image tests
global.Blob = jest.fn().mockImplementation((content, options) => ({
  size: content ? content.length : 0,
  type: options?.type || 'application/octet-stream',
  arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
  stream: jest.fn(),
  text: jest.fn().mockResolvedValue(''),
  slice: jest.fn(),
}));

// Mock File constructor
global.File = jest.fn().mockImplementation((content, name, options) => ({
  ...global.Blob(content, options),
  name: name || 'test-file',
  lastModified: Date.now(),
  lastModifiedDate: new Date(),
  webkitRelativePath: '',
}));

// Mock URL.createObjectURL for file handling
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock crypto.randomUUID for ID generation
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(() => 'mock-uuid-' + Math.random().toString(36).substr(2, 9)),
  },
});

// Mock ResizeObserver for UI components
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver for UI components
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock fetch for API calls
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true }),
    text: () => Promise.resolve(''),
    blob: () => Promise.resolve(new Blob()),
  })
);

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn((message) => {
    // Only suppress React testing warnings, keep actual errors
    if (typeof message === 'string' && 
        (message.includes('Warning:') || message.includes('ReactDOMTestUtils'))) {
      return;
    }
    originalConsoleError(message);
  });
  
  console.warn = jest.fn((message) => {
    // Suppress common warnings during testing
    if (typeof message === 'string' && 
        (message.includes('Warning:') || message.includes('deprecated'))) {
      return;
    }
    originalConsoleWarn(message);
  });
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Clean up between tests
afterEach(() => {
  jest.clearAllMocks();
});

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.NEXT_PUBLIC_OPENROUTER_API_KEY = 'test-openrouter-key';
process.env.DD_API_KEY = 'test-datadog-key';

// Increase timeout for integration tests
jest.setTimeout(30000); 
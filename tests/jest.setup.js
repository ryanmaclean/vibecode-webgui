import '@testing-library/jest-dom';

// Mock scrollIntoView for components that use it
window.HTMLElement.prototype.scrollIntoView = jest.fn();





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

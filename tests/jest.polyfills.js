// Jest Polyfills for Browser APIs
// ==============================

// Add setImmediate polyfill for Winston and other Node.js modules
global.setImmediate = global.setImmediate || ((fn, ...args) => setTimeout(fn, 0, ...args));
global.clearImmediate = global.clearImmediate || clearTimeout;

// Mock fetch API for tests
global.fetch = jest.fn();

// Mock TextEncoder/TextDecoder for streaming tests
global.TextEncoder = jest.fn().mockImplementation(() => ({
  encode: jest.fn((text) => new Uint8Array(Buffer.from(text, 'utf8')))
}));

global.TextDecoder = jest.fn().mockImplementation(() => ({
  decode: jest.fn((buffer) => Buffer.from(buffer).toString('utf8'))
}));

// Mock AbortSignal for timeout tests
global.AbortSignal = {
  timeout: jest.fn((ms) => ({
    aborted: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  }))
};

// Mock Headers for request headers
global.Headers = jest.fn().mockImplementation((init) => {
  const headers = {};
  if (init) {
    if (typeof init === 'object') {
      Object.assign(headers, init);
    }
  }
  return {
    ...headers,
    get: jest.fn((name) => headers[name]),
    set: jest.fn((name, value) => { headers[name] = value; }),
    has: jest.fn((name) => name in headers),
    delete: jest.fn((name) => { delete headers[name]; }),
    append: jest.fn((name, value) => { 
      headers[name] = headers[name] ? `${headers[name]}, ${value}` : value;
    }),
    forEach: jest.fn((callback) => {
      Object.entries(headers).forEach(([key, value]) => callback(value, key));
    }),
    entries: jest.fn(() => Object.entries(headers)),
    keys: jest.fn(() => Object.keys(headers)),
    values: jest.fn(() => Object.values(headers))
  };
});

// Mock ReadableStream for streaming responses
global.ReadableStream = jest.fn().mockImplementation((underlyingSource) => {
  return {
    getReader: jest.fn(() => ({
      read: jest.fn().mockResolvedValue({ done: true, value: undefined }),
      cancel: jest.fn(),
      releaseLock: jest.fn()
    })),
    cancel: jest.fn(),
    locked: false,
    pipeTo: jest.fn(),
    pipeThrough: jest.fn(),
    tee: jest.fn()
  };
});

// Mock Response for fetch responses
global.Response = jest.fn().mockImplementation((body, init = {}) => ({
  ok: init.status >= 200 && init.status < 300,
  status: init.status || 200,
  statusText: init.statusText || 'OK',
  headers: new Headers(init.headers),
  body: body,
  text: jest.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
  json: jest.fn().mockResolvedValue(typeof body === 'string' ? JSON.parse(body) : body),
  blob: jest.fn().mockResolvedValue(new Blob([body])),
  arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
  formData: jest.fn().mockResolvedValue(new FormData()),
  clone: jest.fn().mockReturnThis(),
  url: '',
  redirected: false,
  type: 'basic'
}));

// Mock Request for fetch requests
global.Request = jest.fn().mockImplementation((input, init = {}) => ({
  url: typeof input === 'string' ? input : input.url,
  method: init.method || 'GET',
  headers: new Headers(init.headers),
  body: init.body,
  mode: init.mode || 'cors',
  credentials: init.credentials || 'same-origin',
  cache: init.cache || 'default',
  redirect: init.redirect || 'follow',
  referrer: init.referrer || 'about:client',
  referrerPolicy: init.referrerPolicy || '',
  integrity: init.integrity || '',
  keepalive: init.keepalive || false,
  signal: init.signal,
  clone: jest.fn().mockReturnThis()
})); 
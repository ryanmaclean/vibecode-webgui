// Jest Polyfills for Browser APIs
// ==============================
// SINGLE SOURCE OF TRUTH for browser API polyfills in Jest tests.
// This file is loaded via setupFiles in jest.config.mjs before any tests run.
//
// NOTE: Do not mock these globals in other setup files or tests unless you need
// to override specific behavior for a test. The implementations here are designed
// to work consistently across all tests.
//
// Related files:
// - tests/jest.setup.js: Configures Jest environment after polyfills are loaded
// - tests/setup.js: Legacy setup file for configs not using jest.polyfills.js
// ==============================

// Add setImmediate polyfill for Winston and other Node.js modules
global.setImmediate = global.setImmediate || ((fn, ...args) => setTimeout(fn, 0, ...args));
global.clearImmediate = global.clearImmediate || clearTimeout;

// Do not define a default fetch here; jest.setup.js provides a default mock and restores it per-test.

// Minimal TextEncoder/TextDecoder implementations (non-mocked)
global.TextEncoder = class TextEncoder {
  encode(text) {
    return new Uint8Array(Buffer.from(String(text), 'utf8'));
  }
};

global.TextDecoder = class TextDecoder {
  decode(buffer) {
    return Buffer.from(buffer).toString('utf8');
  }
};

// Mock AbortSignal for timeout tests
global.AbortSignal = {
  timeout: jest.fn((_ms) => ({
    aborted: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  }))
};

// Minimal Headers implementation (non-mocked)
global.Headers = class Headers {
  constructor(init) {
    // Make internal map non-enumerable to avoid being copied/overwritten during initialization
    Object.defineProperty(this, '_headers', {
      value: {},
      writable: true,
      configurable: true,
      enumerable: false,
    });
    if (init) {
      // If initialized with another Headers instance, copy its entries
      if (init instanceof Headers || (typeof init.forEach === 'function' && typeof init.get === 'function')) {
        // Use forEach(value, key) signature
        init.forEach((value, key) => {
          const keyOrig = String(key);
          const keyLower = keyOrig.toLowerCase();
          const val = String(value);
          this._headers[keyLower] = val;
          this[keyOrig] = val;
        });
      } else if (Array.isArray(init)) {
        // Array of [key, value] tuples
        init.forEach((pair) => {
          if (!pair || pair.length < 2) return;
          const [k, v] = pair;
          const keyOrig = String(k);
          const keyLower = keyOrig.toLowerCase();
          const val = String(v);
          this._headers[keyLower] = val;
          this[keyOrig] = val;
        });
      } else if (typeof init === 'object') {
        // Plain object map
        Object.entries(init).forEach(([k, v]) => {
          // Skip internal/private props
          if (String(k).startsWith('_')) return;
          const keyOrig = String(k);
          const keyLower = keyOrig.toLowerCase();
          const val = String(v);
          this._headers[keyLower] = val;
          this[keyOrig] = val;
        });
      }
    }
  }
  get(name) {
    return this._headers[String(name).toLowerCase()] ?? null;
  }
  set(name, value) {
    const keyLower = String(name).toLowerCase();
    const val = String(value);
    this._headers[keyLower] = val;
    this[name] = val;
  }
  has(name) {
    return Object.prototype.hasOwnProperty.call(this._headers, String(name).toLowerCase());
  }
  delete(name) {
    delete this._headers[String(name).toLowerCase()];
    delete this[name];
  }
  append(name, value) {
    const keyLower = String(name).toLowerCase();
    const keyOrig = String(name);
    const val = String(value);
    if (this._headers[keyLower]) {
      this._headers[keyLower] = `${this._headers[keyLower]}, ${val}`;
      this[keyOrig] = `${this[keyOrig]}, ${val}`;
    } else {
      this._headers[keyLower] = val;
      this[keyOrig] = val;
    }
  }
  forEach(callback) {
    Object.entries(this._headers).forEach(([k, v]) => callback(v, k));
  }
  entries() {
    return Object.entries(this._headers);
  }
  keys() {
    return Object.keys(this._headers);
  }
  values() {
    return Object.values(this._headers);
  }
};

// Minimal ReadableStream implementation (supports constructor with underlyingSource)
global.ReadableStream = class ReadableStream {
  constructor(underlyingSource = {}) {
    this._controller = {
      enqueue: (chunk) => {
        // In a real implementation, this would add chunk to the stream
        // For testing, we'll just store it
        if (!this._chunks) this._chunks = [];
        this._chunks.push(chunk);
      },
      close: () => {
        this._closed = true;
      },
      error: (error) => {
        this._error = error;
      }
    };
    
    this._chunks = [];
    this._closed = false;
    this._error = null;
    
    // Call the start method if provided
    if (underlyingSource.start) {
      try {
        underlyingSource.start(this._controller);
      } catch (error) {
        this._error = error;
      }
    }
  }
  
  getReader() {
    return {
      read: async () => {
        if (this._error) throw this._error;
        if (this._chunks.length > 0) {
          return { done: false, value: this._chunks.shift() };
        }
        return { done: true, value: undefined };
      },
      cancel: () => {},
      releaseLock: () => {},
    };
  }
  
  cancel() {}
  pipeTo() {}
  pipeThrough() {}
  tee() {}
  
  get locked() { return false; }
};

// Minimal WHATWG Response implementation (non-mocked)
global.Response = class Response {
  constructor(body, init = {}) {
    this.ok = typeof init.status === 'number' ? init.status >= 200 && init.status < 300 : true;
    this.status = typeof init.status === 'number' ? init.status : 200;
    this.statusText = init.statusText || 'OK';
    this.headers = new Headers(init.headers);
    this._body = body;
    this.url = '';
    this.redirected = false;
    this.type = 'basic';
  }
  async text() {
    return typeof this._body === 'string' ? this._body : JSON.stringify(this._body);
  }
  async json() {
    return typeof this._body === 'string' ? JSON.parse(this._body) : this._body;
  }
  async blob() {
    return new Blob([await this.text()]);
  }
  async arrayBuffer() {
    return new ArrayBuffer(0);
  }
  async formData() {
    return new FormData();
  }
  clone() {
    return new Response(this._body, { status: this.status, statusText: this.statusText, headers: this.headers });
  }
};

// Minimal WHATWG Request implementation (non-mocked)
global.Request = class Request {
  constructor(input, init = {}) {
    this._url = typeof input === 'string' ? input : input.url;
    this.method = init.method || 'GET';
    this.headers = new Headers(init.headers);
    this.body = init.body;
    this.mode = init.mode || 'cors';
    this.credentials = init.credentials || 'same-origin';
    this.cache = init.cache || 'default';
    this.redirect = init.redirect || 'follow';
    this.referrer = init.referrer || 'about:client';
    this.referrerPolicy = init.referrerPolicy || '';
    this.integrity = init.integrity || '';
    this.keepalive = init.keepalive || false;
    this.signal = init.signal;
  }
  
  get url() {
    return this._url;
  }
  clone() {
    return new Request(this.url, {
      method: this.method,
      headers: this.headers,
      body: this.body,
      mode: this.mode,
      credentials: this.credentials,
      cache: this.cache,
      redirect: this.redirect,
      referrer: this.referrer,
      referrerPolicy: this.referrerPolicy,
      integrity: this.integrity,
      keepalive: this.keepalive,
      signal: this.signal,
    });
  }
  async json() {
    if (typeof this.body === 'string') {
      return JSON.parse(this.body);
    }
    return this.body;
  }
  async text() {
    if (typeof this.body === 'string') {
      return this.body;
    }
    return typeof this.body === 'undefined' ? '' : JSON.stringify(this.body);
  }
};

// Add Response.json polyfill for API tests
if (!Response.json) {
  Response.json = function(data, init = {}) {
    return new Response(JSON.stringify(data), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init.headers
      }
    });
  };
}
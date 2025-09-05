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

// Minimal Headers implementation (non-mocked)
global.Headers = class Headers {
  constructor(init) {
    this._headers = {};
    if (init && typeof init === 'object') {
      Object.entries(init).forEach(([k, v]) => {
        this._headers[String(k).toLowerCase()] = String(v);
      });
    }
  }
  get(name) {
    return this._headers[String(name).toLowerCase()] ?? null;
  }
  set(name, value) {
    this._headers[String(name).toLowerCase()] = String(value);
  }
  has(name) {
    return Object.prototype.hasOwnProperty.call(this._headers, String(name).toLowerCase());
  }
  delete(name) {
    delete this._headers[String(name).toLowerCase()];
  }
  append(name, value) {
    const key = String(name).toLowerCase();
    if (this._headers[key]) {
      this._headers[key] = `${this._headers[key]}, ${String(value)}`;
    } else {
      this._headers[key] = String(value);
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

// Minimal ReadableStream stub (non-mocked)
global.ReadableStream = function ReadableStream() {
  return {
    getReader: () => ({
      read: async () => ({ done: true, value: undefined }),
      cancel: () => {},
      releaseLock: () => {},
    }),
    cancel: () => {},
    locked: false,
    pipeTo: () => {},
    pipeThrough: () => {},
    tee: () => {},
  };
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
    this.url = typeof input === 'string' ? input : input.url;
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
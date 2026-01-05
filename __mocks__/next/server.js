/**
 * Mock for next/server module
 * This provides working NextRequest and NextResponse implementations for Jest tests
 */

// Minimal WHATWG Response implementation (non-mocked)
class Response {
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
}

// NextResponse extends Response with additional static methods
class NextResponse extends Response {
  static next(init) {
    return new NextResponse(null, {
      status: 200,
      ...init,
    });
  }

  static redirect(url, init) {
    const urlObj = typeof url === 'string' ? new URL(url) : url;
    return new NextResponse(null, {
      status: 307,
      ...init,
      headers: {
        Location: urlObj.toString(),
        ...init?.headers,
      },
    });
  }

  static json(data, init) {
    return new NextResponse(JSON.stringify(data), {
      status: 200,
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
  }
}

// Use the global Request if available, otherwise provide a minimal implementation
const NextRequest = global.Request || class NextRequest {
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

    // Next.js specific properties
    Object.defineProperty(this, 'nextUrl', {
      value: new URL(this._url),
      writable: false,
      enumerable: true
    });
    Object.defineProperty(this, 'cookies', {
      value: {
        get: jest.fn(() => null),
        getAll: jest.fn(() => []),
        has: jest.fn(() => false),
        set: jest.fn(),
        delete: jest.fn(),
        clear: jest.fn(),
      },
      writable: false,
      enumerable: true
    });
    Object.defineProperty(this, 'geo', {
      value: {},
      writable: false,
      enumerable: true
    });
    Object.defineProperty(this, 'ip', {
      value: '',
      writable: false,
      enumerable: true
    });
  }

  get url() {
    return this._url;
  }
  clone() {
    return new NextRequest(this.url, {
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

module.exports = {
  NextRequest,
  NextResponse,
};

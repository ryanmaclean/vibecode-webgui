/**
 * Mock implementation of Next.js Edge Runtime (next/server)
 * Provides NextRequest, NextResponse, and related utilities for testing
 */

// Mock Headers class (Web API standard)
class MockHeaders {
  private headers: Map<string, string>;

  constructor(init?: HeadersInit) {
    this.headers = new Map();
    if (init) {
      if (init instanceof MockHeaders) {
        init.forEach((value, key) => this.set(key, value));
      } else if (Array.isArray(init)) {
        init.forEach(([key, value]) => this.set(key, value));
      } else if (typeof init === 'object') {
        Object.entries(init).forEach(([key, value]) => this.set(key, value));
      }
    }
  }

  append(name: string, value: string): void {
    const existing = this.get(name);
    this.set(name, existing ? `${existing}, ${value}` : value);
  }

  delete(name: string): void {
    this.headers.delete(name.toLowerCase());
  }

  get(name: string): string | null {
    return this.headers.get(name.toLowerCase()) || null;
  }

  has(name: string): boolean {
    return this.headers.has(name.toLowerCase());
  }

  set(name: string, value: string): void {
    this.headers.set(name.toLowerCase(), value);
  }

  forEach(callback: (value: string, key: string, parent: Headers) => void): void {
    this.headers.forEach((value, key) => callback(value, key, this as any));
  }

  entries(): IterableIterator<[string, string]> {
    return this.headers.entries();
  }

  keys(): IterableIterator<string> {
    return this.headers.keys();
  }

  values(): IterableIterator<string> {
    return this.headers.values();
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    return this.headers.entries();
  }
}

// Mock RequestCookies for NextRequest
class MockRequestCookies {
  private cookies: Map<string, { name: string; value: string }>;

  constructor(headers?: MockHeaders) {
    this.cookies = new Map();
    if (headers) {
      const cookieHeader = headers.get('cookie');
      if (cookieHeader) {
        this.parseCookieHeader(cookieHeader);
      }
    }
  }

  private parseCookieHeader(header: string): void {
    header.split(';').forEach(cookie => {
      const [name, ...valueParts] = cookie.trim().split('=');
      if (name) {
        const value = valueParts.join('=');
        this.cookies.set(name, { name, value });
      }
    });
  }

  get(name: string): { name: string; value: string } | undefined {
    return this.cookies.get(name);
  }

  getAll(): Array<{ name: string; value: string }> {
    return Array.from(this.cookies.values());
  }

  has(name: string): boolean {
    return this.cookies.has(name);
  }

  set(name: string, value: string): void {
    this.cookies.set(name, { name, value });
  }

  delete(name: string): void {
    this.cookies.delete(name);
  }

  clear(): void {
    this.cookies.clear();
  }
}

// Mock NextURL
class MockNextURL extends URL {
  constructor(url: string | URL, base?: string | URL) {
    super(url, base);
  }

  clone(): MockNextURL {
    return new MockNextURL(this.href);
  }
}

// Mock NextRequest
export class NextRequest {
  public url: string;
  public method: string;
  public headers: MockHeaders;
  public cookies: MockRequestCookies;
  public nextUrl: MockNextURL;
  public body: any;
  public bodyUsed: boolean = false;
  public cache?: RequestCache;
  public credentials?: RequestCredentials;
  public destination?: string;
  public integrity?: string;
  public keepalive?: boolean;
  public mode?: RequestMode;
  public redirect?: RequestRedirect;
  public referrer?: string;
  public referrerPolicy?: ReferrerPolicy;
  public signal?: AbortSignal;

  constructor(input: string | URL | Request, init?: RequestInit) {
    if (typeof input === 'string' || input instanceof URL) {
      this.url = input.toString();
      this.method = init?.method || 'GET';
      this.headers = new MockHeaders(init?.headers);
      this.body = init?.body;
    } else {
      // Request object
      this.url = input.url;
      this.method = input.method;
      this.headers = new MockHeaders(input.headers);
      this.body = (input as any).body;
    }

    // Initialize cookies from headers
    this.cookies = new MockRequestCookies(this.headers);

    // Initialize nextUrl
    this.nextUrl = new MockNextURL(this.url);

    // Copy other request properties
    if (init) {
      this.cache = init.cache;
      this.credentials = init.credentials;
      this.integrity = init.integrity;
      this.keepalive = init.keepalive;
      this.mode = init.mode;
      this.redirect = init.redirect;
      this.referrer = init.referrer;
      this.referrerPolicy = init.referrerPolicy;
      this.signal = init.signal;
    }
  }

  async json(): Promise<any> {
    if (this.bodyUsed) {
      throw new TypeError('Body has already been consumed');
    }
    this.bodyUsed = true;

    if (typeof this.body === 'string') {
      return JSON.parse(this.body);
    }
    return this.body || {};
  }

  async text(): Promise<string> {
    if (this.bodyUsed) {
      throw new TypeError('Body has already been consumed');
    }
    this.bodyUsed = true;

    if (typeof this.body === 'string') {
      return this.body;
    }
    return JSON.stringify(this.body || {});
  }

  async formData(): Promise<FormData> {
    if (this.bodyUsed) {
      throw new TypeError('Body has already been consumed');
    }
    this.bodyUsed = true;
    // If body is already a FormData instance, return it
    if (this.body instanceof FormData) {
      return this.body;
    }
    return new FormData();
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    if (this.bodyUsed) {
      throw new TypeError('Body has already been consumed');
    }
    this.bodyUsed = true;
    const text = await this.text();
    const encoder = new TextEncoder();
    return encoder.encode(text).buffer;
  }

  async blob(): Promise<Blob> {
    if (this.bodyUsed) {
      throw new TypeError('Body has already been consumed');
    }
    this.bodyUsed = true;
    return new Blob([this.body || '']);
  }

  clone(): NextRequest {
    return new NextRequest(this.url, {
      method: this.method,
      headers: this.headers,
      body: this.body,
      cache: this.cache,
      credentials: this.credentials,
      integrity: this.integrity,
      keepalive: this.keepalive,
      mode: this.mode,
      redirect: this.redirect,
      referrer: this.referrer,
      referrerPolicy: this.referrerPolicy,
      signal: this.signal
    });
  }
}

// Mock ResponseCookies for NextResponse
class MockResponseCookies {
  private cookies: Map<string, { name: string; value: string; options?: any }>;
  private headers: MockHeaders;

  constructor(headers: MockHeaders) {
    this.cookies = new Map();
    this.headers = headers;
  }

  private serializeCookie(name: string, value: string, options?: any): string {
    let cookie = `${name}=${value}`;

    if (options) {
      if (options.httpOnly) cookie += '; HttpOnly';
      if (options.secure) cookie += '; Secure';
      if (options.sameSite) cookie += `; SameSite=${options.sameSite.charAt(0).toUpperCase() + options.sameSite.slice(1)}`;
      if (options.path) cookie += `; Path=${options.path}`;
      if (options.maxAge) cookie += `; Max-Age=${options.maxAge}`;
      if (options.domain) cookie += `; Domain=${options.domain}`;
      if (options.expires) cookie += `; Expires=${new Date(options.expires).toUTCString()}`;
    }

    return cookie;
  }

  private updateSetCookieHeader(): void {
    const cookieStrings = Array.from(this.cookies.values()).map(cookie =>
      this.serializeCookie(cookie.name, cookie.value, cookie.options)
    );

    if (cookieStrings.length > 0) {
      // For simplicity in tests, join multiple cookies with comma
      // In real HTTP, these would be separate Set-Cookie headers
      this.headers.set('set-cookie', cookieStrings.join(', '));
    }
  }

  set(name: string, value: string, options?: any): void {
    this.cookies.set(name, { name, value, options });
    this.updateSetCookieHeader();
  }

  get(name: string): { name: string; value: string; options?: any } | undefined {
    return this.cookies.get(name);
  }

  delete(name: string): void {
    this.cookies.delete(name);
    this.updateSetCookieHeader();
  }

  getAll(): Array<{ name: string; value: string; options?: any }> {
    return Array.from(this.cookies.values());
  }

  has(name: string): boolean {
    return this.cookies.has(name);
  }

  clear(): void {
    this.cookies.clear();
    this.headers.delete('set-cookie');
  }
}

// Mock NextResponse
export class NextResponse extends Response {
  public cookies: MockResponseCookies;
  public headers: Headers;

  constructor(body?: BodyInit | null, init?: ResponseInit) {
    // Create a proper Response object
    super(body, init);

    // Create a MockHeaders instance that will be shared with cookies
    const mockHeaders = new MockHeaders(init?.headers);

    // Override the headers property with our mock that syncs with cookies
    this.headers = mockHeaders as any as Headers;

    // Pass MockHeaders to cookies so they can sync
    this.cookies = new MockResponseCookies(mockHeaders);
  }

  static json(data: any, init?: ResponseInit): NextResponse {
    const body = JSON.stringify(data);
    const headers = new MockHeaders(init?.headers);
    headers.set('content-type', 'application/json');

    const response = new NextResponse(body, {
      ...init,
      headers: headers as any
    });

    return response;
  }

  static redirect(url: string | URL, init?: number | ResponseInit): NextResponse {
    const status = typeof init === 'number' ? init : init?.status || 307;
    const headers = new MockHeaders(typeof init === 'object' ? init?.headers : undefined);
    headers.set('location', url.toString());

    return new NextResponse(null, {
      status,
      headers: headers as any
    });
  }

  static rewrite(destination: string | URL, init?: ResponseInit): NextResponse {
    const headers = new MockHeaders(init?.headers);
    headers.set('x-middleware-rewrite', destination.toString());

    return new NextResponse(null, {
      ...init,
      headers: headers as any
    });
  }

  static next(init?: ResponseInit): NextResponse {
    return new NextResponse(null, {
      ...init,
      status: 200
    });
  }
}

// Export utility functions
export function NextRequest_prototype_get_cookies() {
  return new MockRequestCookies();
}

export function NextResponse_prototype_get_cookies() {
  return new MockResponseCookies();
}

// Export for compatibility
export { MockHeaders as Headers };

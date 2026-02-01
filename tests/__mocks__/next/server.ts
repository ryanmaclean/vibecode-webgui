/**
 * Mock for next/server module
 * Provides mock implementations for Next.js server components
 */

import { ReadonlyURLSearchParams } from 'next/navigation';

// Mock Response class
class MockResponse {
  private _body: unknown;
  private _init: ResponseInit;
  public headers: Headers;
  public status: number;
  public statusText: string;
  public ok: boolean;
  public redirected: boolean;
  public type: ResponseType;
  public url: string;
  public bodyUsed: boolean;

  constructor(body?: BodyInit | null, init?: ResponseInit) {
    this._body = body;
    this._init = init || {};
    this.headers = new Headers(init?.headers);
    this.status = init?.status || 200;
    this.statusText = init?.statusText || 'OK';
    this.ok = this.status >= 200 && this.status < 300;
    this.redirected = false;
    this.type = 'basic';
    this.url = '';
    this.bodyUsed = false;
  }

  async json() {
    this.bodyUsed = true;
    if (typeof this._body === 'string') {
      return JSON.parse(this._body);
    }
    return this._body;
  }

  async text() {
    this.bodyUsed = true;
    if (typeof this._body === 'string') {
      return this._body;
    }
    return JSON.stringify(this._body);
  }

  async blob(): Promise<Blob> {
    this.bodyUsed = true;
    return new Blob([typeof this._body === 'string' ? this._body : JSON.stringify(this._body)]);
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    this.bodyUsed = true;
    const blob = await this.blob();
    return blob.arrayBuffer();
  }

  async formData(): Promise<FormData> {
    this.bodyUsed = true;
    return new FormData();
  }

  clone(): MockResponse {
    return new MockResponse(
      typeof this._body === 'string' ? this._body : JSON.stringify(this._body),
      this._init
    );
  }

  get body(): ReadableStream<Uint8Array> | null {
    return null;
  }
}

// Mock NextResponse class
class MockNextResponse extends MockResponse {
  public cookies: {
    set: (name: string, value: string, options?: unknown) => void;
    delete: (name: string) => void;
    get: (name: string) => { name: string; value: string } | undefined;
    getAll: () => { name: string; value: string }[];
    has: (name: string) => boolean;
  };

  constructor(body?: BodyInit | null, init?: ResponseInit) {
    super(body, init);

    const cookieStore = new Map<string, string>();

    this.cookies = {
      set: (name: string, value: string) => {
        cookieStore.set(name, value);
      },
      delete: (name: string) => {
        cookieStore.delete(name);
      },
      get: (name: string) => {
        const value = cookieStore.get(name);
        return value ? { name, value } : undefined;
      },
      getAll: () => {
        return Array.from(cookieStore.entries()).map(([name, value]) => ({ name, value }));
      },
      has: (name: string) => {
        return cookieStore.has(name);
      },
    };
  }

  static json(data: unknown, init?: ResponseInit): MockNextResponse {
    const body = JSON.stringify(data);
    const headers = new Headers(init?.headers);
    headers.set('content-type', 'application/json');

    return new MockNextResponse(body, {
      ...init,
      headers,
    });
  }

  static redirect(url: string | URL, status: number = 307): MockNextResponse {
    const headers = new Headers();
    headers.set('Location', url.toString());
    return new MockNextResponse(null, { status, headers });
  }

  static rewrite(url: string | URL): MockNextResponse {
    const headers = new Headers();
    headers.set('x-middleware-rewrite', url.toString());
    return new MockNextResponse(null, { headers });
  }

  static next(): MockNextResponse {
    return new MockNextResponse(null, { status: 200 });
  }
}

// Mock NextRequest class - doesn't extend Request due to readonly property issues
class MockNextRequest {
  public url: string;
  public method: string;
  public headers: Headers;
  public nextUrl: URL;
  public cookies: {
    get: (name: string) => { name: string; value: string } | undefined;
    getAll: () => { name: string; value: string }[];
    set: (name: string, value: string) => void;
    delete: (name: string) => void;
    has: (name: string) => boolean;
  };
  public geo?: {
    city?: string;
    country?: string;
    region?: string;
    latitude?: string;
    longitude?: string;
  };
  public ip?: string;
  private _body: unknown;

  constructor(input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    this.url = url;
    this.method = init?.method || 'GET';
    this.headers = new Headers(init?.headers);
    this.nextUrl = new URL(url);
    this._body = init?.body;

    const cookieStore = new Map<string, string>();
    const cookieHeader = this.headers.get('cookie');
    if (cookieHeader) {
      cookieHeader.split(';').forEach((cookie) => {
        const [name, value] = cookie.trim().split('=');
        if (name && value) {
          cookieStore.set(name, value);
        }
      });
    }

    this.cookies = {
      get: (name: string) => {
        const value = cookieStore.get(name);
        return value ? { name, value } : undefined;
      },
      getAll: () => {
        return Array.from(cookieStore.entries()).map(([name, value]) => ({ name, value }));
      },
      set: (name: string, value: string) => {
        cookieStore.set(name, value);
      },
      delete: (name: string) => {
        cookieStore.delete(name);
      },
      has: (name: string) => {
        return cookieStore.has(name);
      },
    };

    this.geo = {
      city: 'San Francisco',
      country: 'US',
      region: 'CA',
    };

    this.ip = '127.0.0.1';
  }

  async json() {
    if (typeof this._body === 'string') {
      return JSON.parse(this._body);
    }
    return this._body;
  }

  async text() {
    if (typeof this._body === 'string') {
      return this._body;
    }
    return JSON.stringify(this._body);
  }
}

// Export all mock classes
export const NextResponse = MockNextResponse;
export const NextRequest = MockNextRequest;

// Default export for compatibility
export default {
  NextResponse: MockNextResponse,
  NextRequest: MockNextRequest,
};

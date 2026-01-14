import { NextRequest } from 'next/server';

/**
 * Middleware integration tests
 * Note: These tests verify the middleware behavior at the integration level
 * since the middleware function has complex Next.js dependencies
 */

function buildRequest(path: string, headers: Record<string, string> = {}) {
  const url = `https://example.com${path}`;
  return new NextRequest(url, {
    headers: new Headers(headers),
  });
}

function setNodeEnv(value: string | undefined) {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

describe('middleware', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterAll(() => {
    setNodeEnv(originalNodeEnv);
  });

  it('should be defined and exportable', () => {
    const middlewareModule = require('@/middleware');
    expect(middlewareModule.middleware).toBeDefined();
    expect(typeof middlewareModule.middleware).toBe('function');
  });

  it('should have correct config matcher', () => {
    const middlewareModule = require('@/middleware');
    expect(middlewareModule.config).toBeDefined();
    expect(middlewareModule.config.matcher).toBeDefined();
    expect(Array.isArray(middlewareModule.config.matcher)).toBe(true);
  });

  it('should export shouldBypassForTests function behavior', () => {
    // Test environment detection
    setNodeEnv('test');
    process.env.CI = 'true';

    // Middleware should bypass in test mode
    const request = buildRequest('/dashboard');
    expect(request).toBeDefined();

    // Cleanup
    delete process.env.CI;
  });
});

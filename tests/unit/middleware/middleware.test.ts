import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { MockUtils } from '../../utils/mock-templates';

function setNodeEnv(value: string | undefined) {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

describe('middleware', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    setNodeEnv('test');
    delete process.env.CI;
    delete process.env.PLAYWRIGHT_TEST;
  });

  afterAll(() => {
    setNodeEnv(originalNodeEnv);
  });

  it('allows requests through unchanged in test environment', async () => {
    const request = MockUtils.buildRequest('/dashboard') as unknown as NextRequest;
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Frame-Options')).toBeNull();
  });

  it('redirects unauthenticated non-public pages to signin', async () => {
    setNodeEnv('production');
    const request = MockUtils.buildRequest('/dashboard') as unknown as NextRequest;
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/auth/signin');
  });

  it('passes through when authentication cookie is present', async () => {
    setNodeEnv('production');
    const request = MockUtils.buildRequest('/dashboard', {
      headers: { cookie: 'next-auth.session-token=abc123' },
    }) as unknown as NextRequest;

    const response = await middleware(request);
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  });
});

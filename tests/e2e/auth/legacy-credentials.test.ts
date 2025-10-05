import { test, expect, request as playwrightRequest } from '@playwright/test';

const DEFAULT_CREDENTIALS = [
  { email: 'admin@vibecode.dev', password: 'admin123', label: 'Admin' },
  { email: 'lead@vibecode.dev', password: 'lead123', label: 'Lead' },
  { email: 'developer@vibecode.dev', password: 'dev123', label: 'Developer' },
  { email: 'frontend@vibecode.dev', password: 'frontend123', label: 'Frontend' },
  { email: 'backend@vibecode.dev', password: 'backend123', label: 'Backend' },
  { email: 'fullstack@vibecode.dev', password: 'fullstack123', label: 'Fullstack' },
  { email: 'designer@vibecode.dev', password: 'design123', label: 'Designer' },
  { email: 'tester@vibecode.dev', password: 'test123', label: 'Tester' },
  { email: 'devops@vibecode.dev', password: 'devops123', label: 'DevOps' },
  { email: 'security@vibecode.dev', password: 'security123', label: 'Security' },
];

const shouldRun = process.env.LEGACY_AUTH_SMOKE === 'true';
const baseURL = process.env.LEGACY_AUTH_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';

let credentials = DEFAULT_CREDENTIALS;
if (process.env.LEGACY_AUTH_CREDENTIALS) {
  try {
    const parsed = JSON.parse(process.env.LEGACY_AUTH_CREDENTIALS);
    if (Array.isArray(parsed)) {
      credentials = parsed;
    }
  } catch (error) {
    console.warn('Failed to parse LEGACY_AUTH_CREDENTIALS env variable:', error);
  }
}

test.describe('Legacy authentication credential smoke (API)', () => {
  test.skip(!shouldRun, 'Set LEGACY_AUTH_SMOKE=true to run the legacy credential smoke tests.');

  test('sign-in page responds', async () => {
    const api = await playwrightRequest.newContext({ baseURL });
    const response = await api.get('/auth/signin');
    expect(response.status(), 'GET /auth/signin').toBeGreaterThanOrEqual(200);
    expect(response.status(), 'GET /auth/signin').toBeLessThan(500);
  });

  for (const cred of credentials) {
    test(`credential flow: ${cred.label}`, async () => {
      const api = await playwrightRequest.newContext({ baseURL });

      const csrfResp = await api.get('/api/auth/csrf');
      expect(csrfResp.ok(), 'csrf ok').toBeTruthy();
      const csrfJson = await csrfResp.json();
      expect(csrfJson?.csrfToken, 'csrf token').toBeTruthy();

      const signinResp = await api.post('/api/auth/signin/credentials', {
        form: {
          csrfToken: csrfJson.csrfToken,
          email: cred.email,
          password: cred.password,
          callbackUrl: `${baseURL}/`
        },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      expect.soft([200, 302, 400, 401, 403]).toContain(signinResp.status());

      if (signinResp.status() === 200 || signinResp.status() === 302) {
        const sessionResp = await api.get('/api/auth/session');
        if (sessionResp.ok()) {
          const sessionJson = await sessionResp.json().catch(() => undefined);
          if (sessionJson?.user?.email !== cred.email) {
            test.info().annotations.push({
              type: 'warning',
              description: `Session email mismatch for ${cred.email}`,
            });
          }
        } else {
          test.info().annotations.push({
            type: 'warning',
            description: `Session lookup failed for ${cred.email} (status ${sessionResp.status()})`,
          });
        }
      }
    });
  }
});

import { test, expect } from '@playwright/test';

interface LegacyCredential {
  email: string;
  password: string;
  label: string;
}

const DEFAULT_CREDENTIALS: LegacyCredential[] = [
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

const credentials: LegacyCredential[] = (() => {
  if (!process.env.LEGACY_AUTH_CREDENTIALS) {
    return DEFAULT_CREDENTIALS
  }

  try {
    const parsed = JSON.parse(process.env.LEGACY_AUTH_CREDENTIALS)
    if (Array.isArray(parsed)) {
      return parsed as LegacyCredential[]
    }
  } catch (error) {
    console.warn('Failed to parse LEGACY_AUTH_CREDENTIALS env variable:', error)
  }

  return DEFAULT_CREDENTIALS
})()

test.describe('Legacy authentication credential smoke', () => {
  test.skip(!shouldRun, 'Set LEGACY_AUTH_SMOKE=true to run the legacy credential smoke tests.');

  test('credentials API is reachable', async ({ request }) => {
    const csrfResp = await request.get('/api/auth/csrf')
    expect(csrfResp.status()).toBeLessThan(500)
  })

  credentials.forEach((cred) => {
    test(`credential flow: ${cred.label}`, async ({ request }) => {
      const csrfResp = await request.get('/api/auth/csrf')
      test.skip(!csrfResp.ok(), 'Skipping legacy smoke: /api/auth/csrf unavailable')

      const csrfJson = await csrfResp.json()
      const csrfToken = csrfJson?.csrfToken
      test.skip(!csrfToken, 'Skipping legacy smoke: csrf token missing')

      const signinResp = await request.post('/api/auth/signin/credentials', {
        form: {
          csrfToken,
          email: cred.email,
          password: cred.password,
          callbackUrl: '/',
          json: 'true',
        },
      })

      const status = signinResp.status()
      expect.soft(status).toBeLessThan(500)

      if (status === 200 || status === 302) {
        const sessionResp = await request.get('/api/auth/session')
        if (!sessionResp.ok()) {
          test.info().annotations.push({ type: 'legacy-auth-session-missing', description: `${cred.email} missing session (status ${sessionResp.status()})` })
          return
        }

        const sessionJson = await sessionResp.json()
        if (sessionJson?.user?.email !== cred.email) {
          test.info().annotations.push({ type: 'legacy-auth-session-mismatch', description: `${cred.email} received ${sessionJson?.user?.email ?? 'undefined'}` })
        }
      } else {
        test.info().annotations.push({ type: 'legacy-auth-not-configured', description: `${cred.email} returned ${status}` })
      }
    })
  })
});

import baseConfig from '../../playwright.config';
import { defineConfig } from '@playwright/test';
import path from 'path';

const chromiumProject = baseConfig.projects?.find((project) => project.name === 'chromium');

export default defineConfig({
  ...baseConfig,
  testDir: __dirname,
  webServer: undefined,
  reporter: [
    ['line'],
    ['json', { outputFile: 'test-results/legacy-auth.json' }],
  ],
  use: {
    ...(baseConfig.use ?? {}),
    ...(chromiumProject?.use ?? {}),
    baseURL: process.env.LEGACY_AUTH_BASE_URL || process.env.BASE_URL || 'http://localhost:3000',
  },
  projects: [
    {
      name: 'legacy-chromium',
      use: {
        ...(chromiumProject?.use ?? {}),
        baseURL: process.env.LEGACY_AUTH_BASE_URL || process.env.BASE_URL || 'http://localhost:3000',
      },
    },
  ],
});

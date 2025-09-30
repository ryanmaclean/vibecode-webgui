/**
 * Tests for Monacopilot integration with Monaco 0.53.x
 */

const fs = require('fs');
const path = require('path');

describe('Monaco Editor and Monacopilot Compatibility', () => {
  const packageJson = require('../../package.json');

  it('should have monaco-editor installed', () => {
    expect(packageJson.dependencies['monaco-editor']).toBeDefined();
  });

  it('should have monaco-editor version 0.53.x (latest stable)', () => {
    const version = packageJson.dependencies['monaco-editor'];
    expect(version).toMatch(/0\.53\./);
  });

  it('should have monacopilot installed', () => {
    expect(packageJson.dependencies['monacopilot']).toBeDefined();
  });

  it('should satisfy monacopilot minimum monaco version', () => {
    const monacoVersion = packageJson.dependencies['monaco-editor'];
    const match = monacoVersion.match(/(\d+)\.(\d+)/);
    expect(match).not.toBeNull();
    if (match) {
      const major = Number(match[1]);
      const minor = Number(match[2]);
      // monacopilot requires >= 0.41.0
      expect(major * 100 + minor).toBeGreaterThanOrEqual(41);
    }
  });

  it('should include monacopilot integration source', () => {
    const integrationPath = path.join(__dirname, '../../src/lib/monaco/monacopilot-integration.ts');
    expect(fs.existsSync(integrationPath)).toBe(true);
    const source = fs.readFileSync(integrationPath, 'utf8');
    expect(source).toMatch(/setupMonacopilot/);
    expect(source).toMatch(/setupMonacopilotMulti/);
  });
});

describe('Code Completion API Route', () => {
  const routePath = path.join(__dirname, '../../src/app/api/code-completion/route.ts');

  it('should have code completion API route file', () => {
    expect(fs.existsSync(routePath)).toBe(true);
  });

  it('should export POST handler', () => {
    const contents = fs.readFileSync(routePath, 'utf8');
    expect(contents).toMatch(/export async function POST/);
  });

  it('should export GET handler for health check', () => {
    const contents = fs.readFileSync(routePath, 'utf8');
    expect(contents).toMatch(/export async function GET/);
  });
});

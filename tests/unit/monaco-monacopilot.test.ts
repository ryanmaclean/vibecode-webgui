/**
 * Tests for Monacopilot integration with Monaco 0.52.2
 */

describe('Monaco Editor and Monacopilot Compatibility', () => {
  it('should have monaco-editor installed', () => {
    const packageJson = require('../../package.json');
    expect(packageJson.dependencies['monaco-editor']).toBeDefined();
  });

  it('should have monaco-editor version 0.53.x (latest stable)', () => {
    const packageJson = require('../../package.json');
    const version = packageJson.dependencies['monaco-editor'];
    expect(version).toMatch(/0\.53\./);
  });

  it('should have monacopilot installed', () => {
    const packageJson = require('../../package.json');
    expect(packageJson.dependencies['monacopilot']).toBeDefined();
  });

  it('should have monacopilot peer dependency satisfied by monaco 0.52', () => {
    // Monacopilot requires monaco-editor >=0.41.0
    // We have 0.52.2, which satisfies this requirement
    const packageJson = require('../../package.json');
    const monacoVersion = packageJson.dependencies['monaco-editor'];
    const majorMinor = monacoVersion.match(/(\d+)\.(\d+)/);
    
    if (majorMinor) {
      const major = parseInt(majorMinor[1]);
      const minor = parseInt(majorMinor[2]);
      const versionNumber = major * 100 + minor;
      
      // 0.52 = 52, should be >= 41
      expect(versionNumber).toBeGreaterThanOrEqual(41);
    }
  });

  it('should not have @codeium/react-code-editor installed', () => {
    // This package is incompatible with Monaco 0.52
    const packageJson = require('../../package.json');
    expect(packageJson.dependencies['@codeium/react-code-editor']).toBeUndefined();
  });

  it('should have monacopilot integration file', () => {
    expect(() => {
      require('../../src/lib/monaco/monacopilot-integration');
    }).not.toThrow();
  });

  it('should export setupMonacopilot function', () => {
    const integration = require('../../src/lib/monaco/monacopilot-integration');
    expect(typeof integration.setupMonacopilot).toBe('function');
  });

  it('should export setupMonacopilotMulti function', () => {
    const integration = require('../../src/lib/monaco/monacopilot-integration');
    expect(typeof integration.setupMonacopilotMulti).toBe('function');
  });
});

describe('Code Completion API Route', () => {
  it('should have code completion API route file', () => {
    expect(() => {
      require('../../src/app/api/code-completion/route');
    }).not.toThrow();
  });

  it('should export POST handler', () => {
    const route = require('../../src/app/api/code-completion/route');
    expect(typeof route.POST).toBe('function');
  });

  it('should export GET handler for health check', () => {
    const route = require('../../src/app/api/code-completion/route');
    expect(typeof route.GET).toBe('function');
  });
});

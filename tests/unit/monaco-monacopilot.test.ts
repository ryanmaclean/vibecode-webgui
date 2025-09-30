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

  it('should have monacopilot integration file', () => {
    // Check if the file exists
    const fs = require('fs');
    const path = require('path');
    const integrationPath = path.join(__dirname, '../../src/lib/monaco/monacopilot-integration.ts');
    expect(fs.existsSync(integrationPath)).toBe(true);
  });

  it('should export setupMonacopilot function', () => {
    // Check the file content instead of requiring
    const fs = require('fs');
    const path = require('path');
    const integrationPath = path.join(__dirname, '../../src/lib/monaco/monacopilot-integration.ts');
    const content = fs.readFileSync(integrationPath, 'utf8');
    expect(content).toContain('export const setupMonacopilot');
  });

  it('should export setupMonacopilotMulti function', () => {
    // Check the file content instead of requiring
    const fs = require('fs');
    const path = require('path');
    const integrationPath = path.join(__dirname, '../../src/lib/monaco/monacopilot-integration.ts');
    const content = fs.readFileSync(integrationPath, 'utf8');
    expect(content).toContain('export const setupMonacopilotMulti');
  });
});

describe('Monacopilot TypeScript Types', () => {
  it('should have monacopilot types file', () => {
    // Just check the file exists by checking if it can be accessed
    const fs = require('fs');
    const path = require('path');
    const typesPath = path.join(__dirname, '../../src/types/monacopilot.d.ts');
    expect(fs.existsSync(typesPath)).toBe(true);
  });

  it('should export comprehensive type definitions', () => {
    // Types are compile-time only, so we validate by checking the file content
    const fs = require('fs');
    const path = require('path');
    const typesPath = path.join(__dirname, '../../src/types/monacopilot.d.ts');
    const content = fs.readFileSync(typesPath, 'utf8');
    
    // Check for key type exports
    expect(content).toContain('export type AIProvider');
    expect(content).toContain('export type MistralModel');
    expect(content).toContain('export interface EnhancedMonacopilotConfig');
    expect(content).toContain('export interface MonacopilotConfig');
  });

  it('should include all required AI providers', () => {
    const fs = require('fs');
    const path = require('path');
    const typesPath = path.join(__dirname, '../../src/types/monacopilot.d.ts');
    const content = fs.readFileSync(typesPath, 'utf8');
    
    // Check for provider types
    expect(content).toContain("'openai'");
    expect(content).toContain("'mistral'");
    expect(content).toContain("'anthropic'");
    expect(content).toContain("'groq'");
    expect(content).toContain("'cohere'");
  });
});

describe('Code Completion API Route', () => {
  it('should have code completion API route file', () => {
    const fs = require('fs');
    const path = require('path');
    const routePath = path.join(__dirname, '../../src/app/api/code-completion/route.ts');
    expect(fs.existsSync(routePath)).toBe(true);
  });

  it('should export POST handler', () => {
    const fs = require('fs');
    const path = require('path');
    const routePath = path.join(__dirname, '../../src/app/api/code-completion/route.ts');
    const content = fs.readFileSync(routePath, 'utf8');
    expect(content).toContain('export async function POST');
  });

  it('should export GET handler for health check', () => {
    const fs = require('fs');
    const path = require('path');
    const routePath = path.join(__dirname, '../../src/app/api/code-completion/route.ts');
    const content = fs.readFileSync(routePath, 'utf8');
    expect(content).toContain('export async function GET');
  });
});

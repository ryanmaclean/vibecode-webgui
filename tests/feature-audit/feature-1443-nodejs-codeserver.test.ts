import fs from 'fs';
import path from 'path';

describe('feature audit 1443: vibecode-nodejs-codeserver', () => {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const configPath = path.join(repoRoot, 'config', 'cloud-init', 'codeserver-user-data.yaml');

  it('provisions code-server with Node.js dependencies', () => {
    const content = fs.readFileSync(configPath, 'utf-8');
    expect(content).toContain('code-server');
    expect(content).toContain('nodejs');
  });
});

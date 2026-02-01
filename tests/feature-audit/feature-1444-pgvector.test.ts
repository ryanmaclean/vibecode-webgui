import fs from 'fs';
import path from 'path';

describe('feature audit 1444: vibecode-pgvector', () => {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const configPath = path.join(repoRoot, 'config', 'lima', 'postgresql-pgvector-vm.yaml');

  it('defines a 20GiB root disk and pgvector setup', () => {
    const content = fs.readFileSync(configPath, 'utf-8');
    expect(content).toContain('disk: "20GiB"');
    expect(content.toLowerCase()).toContain('pgvector');
    expect(content).toContain('PostgreSQL');
  });
});

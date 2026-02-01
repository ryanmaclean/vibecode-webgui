import fs from 'fs';
import path from 'path';

describe('feature audit 1449: Datadog integration', () => {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const scriptPath = path.join(repoRoot, 'scripts', 'start-lima-vms-with-datadog.sh');
  const configPath = path.join(repoRoot, 'infrastructure', 'datadog', 'vibecode-valkey.datadog.yaml');

  it('includes Lima Datadog install script and service config', () => {
    const script = fs.readFileSync(scriptPath, 'utf-8');
    const config = fs.readFileSync(configPath, 'utf-8');
    expect(script).toContain('datadog');
    expect(config).toContain('vibecode-valkey');
  });
});

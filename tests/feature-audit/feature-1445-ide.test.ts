import fs from 'fs';
import path from 'path';

describe('feature audit 1445: vibecode-ide', () => {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const scriptPath = path.join(repoRoot, 'scripts', 'setup-ide-vm.sh');

  it('references vibecode-ide VM artifacts', () => {
    const content = fs.readFileSync(scriptPath, 'utf-8');
    expect(content).toContain('vibecode-ide');
    expect(content).toContain('vibecode-ide.img');
  });
});

import fs from 'fs';
import path from 'path';

describe('feature audit: vfkit boot tracking', () => {
  it('documents boot timing via console log tracking', () => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'vfkit', 'compare-boot-times.sh');
    const contents = fs.readFileSync(scriptPath, 'utf8');

    expect(contents).toMatch(/console\.log|CONSOLE_LOG/);
    expect(contents.toLowerCase()).toContain('boot');
  });
});

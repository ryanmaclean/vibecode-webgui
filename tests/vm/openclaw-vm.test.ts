import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * OpenClaw VM Integration Tests (Ruthless Edition)
 * Verifies the Ubuntu/vfkit pivot scripts.
 */
describe('OpenClaw VM (Ubuntu/vfkit)', () => {
  const scriptsDir = path.join(process.cwd(), 'scripts');
  const launchScript = path.join(scriptsDir, 'launch_ubuntu_vm.py');
  const ralphLoopScript = path.join(scriptsDir, 'ralph_loop.py');

  it('should have the launch script', () => {
    expect(fs.existsSync(launchScript)).toBe(true);
  });

  it('should have the ralph loop script', () => {
    expect(fs.existsSync(ralphLoopScript)).toBe(true);
  });

  it('launch script should be executable (simulation mode)', () => {
    // We expect it to run. If vfkit is missing, it should exit 0 with a warning (sim mode)
    // or exit 1 if it crashes. My script handles missing vfkit gracefully.
    const result = spawnSync('python3', [launchScript], { encoding: 'utf-8' });
    
    // It might output "vfkit not found" or "Launching", but shouldn't crash.
    expect(result.status).toBe(0);
    expect(result.stdout + result.stderr).toMatch(/vfkit not found|Launching Ubuntu VM/);
  });

  it('ralph loop should run and report status', () => {
    // Run ralph loop for a single iteration (it might loop, so we need to handle that if it's infinite)
    // Actually ralph_loop.py as written runs one cycle and exits if not wrapped in loop.sh?
    // Let's check ralph_loop.py content again. It has `run_loop()` called once in `if __name__`.
    // So it runs one cycle.
    
    const result = spawnSync('python3', [ralphLoopScript], { encoding: 'utf-8' });
    
    expect(result.status).toBe(0);
    expect(result.stderr).toContain('Ralph Loop Cycle Starting');
    expect(result.stderr).toContain('Loop Cycle Complete');
  });
});

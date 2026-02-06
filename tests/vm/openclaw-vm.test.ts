import { spawnSync, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * OpenClaw VM Integration Tests (Ruthless Edition)
 * Verifies the Ubuntu/vfkit pivot scripts.
 *
 * Test Isolation: These tests check for dependencies before running and skip
 * gracefully if the required dependencies are not available.
 */
describe('OpenClaw VM (Ubuntu/vfkit)', () => {
  const scriptsDir = path.join(process.cwd(), 'scripts');
  const launchScript = path.join(scriptsDir, 'launch_ubuntu_vm.py');
  const ralphLoopScript = path.join(scriptsDir, 'ralph_loop.py');

  // Track whether Python3 and required modules are available
  let pythonAvailable = false;
  let requestsModuleAvailable = false;

  beforeAll(() => {
    // Check Python3 availability
    try {
      const pythonResult = spawnSync('python3', ['--version'], { encoding: 'utf-8', timeout: 5000 });
      pythonAvailable = pythonResult.status === 0;
    } catch {
      pythonAvailable = false;
    }

    // Check if requests module is available (required by ralph_loop.py)
    if (pythonAvailable) {
      try {
        const requestsResult = spawnSync('python3', ['-c', 'import requests'], {
          encoding: 'utf-8',
          timeout: 5000
        });
        requestsModuleAvailable = requestsResult.status === 0;
      } catch {
        requestsModuleAvailable = false;
      }
    }
  });

  it('should have the launch script', () => {
    expect(fs.existsSync(launchScript)).toBe(true);
  });

  it('should have the ralph loop script', () => {
    expect(fs.existsSync(ralphLoopScript)).toBe(true);
  });

  it('launch script should be executable (simulation mode)', () => {
    if (!pythonAvailable) {
      console.warn('Skipping test: Python3 not available');
      return;
    }

    // We expect it to run. If vfkit is missing, it should exit 0 with a warning (sim mode)
    // or exit 1 if it crashes. My script handles missing vfkit gracefully.
    const result = spawnSync('python3', [launchScript], {
      encoding: 'utf-8',
      timeout: 30000 // 30 second timeout for safety
    });

    // It might output "vfkit not found" or "Launching", but shouldn't crash.
    expect(result.status).toBe(0);
    expect(result.stdout + result.stderr).toMatch(/vfkit not found|Launching Ubuntu VM/);
  });

  it('ralph loop should run and report status', () => {
    if (!pythonAvailable) {
      console.warn('Skipping test: Python3 not available');
      return;
    }

    // Run ralph loop for a single iteration (it might loop, so we need to handle that if it's infinite)
    // Actually ralph_loop.py as written runs one cycle and exits if not wrapped in loop.sh?
    // Let's check ralph_loop.py content again. It has `run_loop()` called once in `if __name__`.
    // So it runs one cycle.

    const result = spawnSync('python3', [ralphLoopScript], {
      encoding: 'utf-8',
      timeout: 30000 // 30 second timeout for safety
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toContain('Ralph Loop Cycle Starting');
    expect(result.stderr).toContain('Loop Cycle Complete');

    // If requests module is missing, the script should still complete but log an error
    if (!requestsModuleAvailable) {
      expect(result.stderr).toContain('Gateway Check Skipped');
    }
  });
});

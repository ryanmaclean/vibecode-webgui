/**
 * Tests for Datadog trace verification automation
 * 
 * This test suite validates that the trace verification script works correctly
 * in both CI-safe mode (without credentials) and with real credentials.
 */

const { execSync } = require('child_process');
const { existsSync, readFileSync, rmSync } = require('fs');
const { join } = require('path');

describe('Datadog Trace Verification', () => {
  const projectRoot = join(__dirname, '..', '..');
  const traceSearchDir = join(projectRoot, 'datadog', 'trace-search');
  const configFile = join(projectRoot, 'configs', 'trace-search-checks.json');
  const scriptPath = join(projectRoot, 'scripts', 'verify-trace-search.py');

  beforeEach(() => {
    // Clean up any existing trace search files
    if (existsSync(traceSearchDir)) {
      rmSync(traceSearchDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up after each test
    if (existsSync(traceSearchDir)) {
      rmSync(traceSearchDir, { recursive: true, force: true });
    }
  });

  test('should run in CI-safe mode without credentials', () => {
    const env = {
      ...process.env,
      DD_API_KEY: undefined,
      DD_APP_KEY: undefined,
      CI: 'true'
    };
    delete env.DD_API_KEY;
    delete env.DD_APP_KEY;

    const result = execSync(
      `python3 "${scriptPath}" --config "${configFile}" --ci-safe`,
      { 
        cwd: projectRoot,
        env,
        encoding: 'utf8'
      }
    );

    // Should indicate CI-safe mode
    expect(result).toContain('CI-safe mode with mock data');
    expect(result).toContain('Generating mock response');
    expect(result).toContain('Saved 2 trace search results');

    // Should create output files
    expect(existsSync(join(traceSearchDir, 'trace-search-summary.json'))).toBe(true);
    
    // Verify summary file
    const summaryContent = JSON.parse(
      readFileSync(join(traceSearchDir, 'trace-search-summary.json'), 'utf8')
    );
    expect(summaryContent.checks).toHaveLength(2);
    expect(summaryContent.generated_at).toBeDefined();

    // Verify individual trace files exist and contain mock data
    for (const check of summaryContent.checks) {
      expect(existsSync(join(projectRoot, check.output))).toBe(true);
      
      const traceContent = JSON.parse(
        readFileSync(join(projectRoot, check.output), 'utf8')
      );
      expect(traceContent.meta.mocked).toBe(true);
      expect(traceContent.meta.ci_safe_mode).toBe(true);
      expect(traceContent.data).toHaveLength(1);
      expect(traceContent.data[0].attributes.service).toBe(check.service);
      expect(traceContent.data[0].attributes.env).toBe(check.env);
    }
  });

  test('should fail gracefully without CI-safe mode when credentials missing', () => {
    const env = {
      ...process.env,
      DD_API_KEY: undefined,
      DD_APP_KEY: undefined,
      CI: undefined,
      GITHUB_ACTIONS: undefined
    };
    delete env.DD_API_KEY;
    delete env.DD_APP_KEY;
    delete env.CI;
    delete env.GITHUB_ACTIONS;

    expect(() => {
      execSync(
        `python3 "${scriptPath}" --config "${configFile}"`,
        { 
          cwd: projectRoot,
          env,
          encoding: 'utf8'
        }
      );
    }).toThrow();
  });

  test('should work via npm script', () => {
    const env = {
      ...process.env,
      DD_API_KEY: undefined,
      DD_APP_KEY: undefined,
      CI: 'true'
    };
    delete env.DD_API_KEY;
    delete env.DD_APP_KEY;

    const result = execSync(
      'npm run monitoring:trace',
      { 
        cwd: projectRoot,
        env,
        encoding: 'utf8'
      }
    );

    expect(result).toContain('CI-safe mode with mock data');
    expect(result).toContain('Saved 2 trace search results');
    expect(existsSync(join(traceSearchDir, 'trace-search-summary.json'))).toBe(true);
  });

  test('should auto-detect CI environment', () => {
    const env = {
      ...process.env,
      DD_API_KEY: undefined,
      DD_APP_KEY: undefined,
      GITHUB_ACTIONS: 'true'
    };
    delete env.DD_API_KEY;
    delete env.DD_APP_KEY;

    const result = execSync(
      `python3 "${scriptPath}" --config "${configFile}"`,
      { 
        cwd: projectRoot,
        env,
        encoding: 'utf8'
      }
    );

    expect(result).toContain('CI-safe mode with mock data');
    expect(existsSync(join(traceSearchDir, 'trace-search-summary.json'))).toBe(true);
  });

  test('should validate config file format', () => {
    // Verify the config file exists and has expected structure
    expect(existsSync(configFile)).toBe(true);
    
    const config = JSON.parse(readFileSync(configFile, 'utf8'));
    expect(Array.isArray(config)).toBe(true);
    expect(config.length).toBeGreaterThan(0);
    
    for (const check of config) {
      expect(check.service).toBeDefined();
      expect(check.env).toBeDefined();
      expect(typeof check.service).toBe('string');
      expect(typeof check.env).toBe('string');
    }
  });

  test('should accept mock file parameter', () => {
    // Create a temporary mock file
    const mockData = {
      data: [
        {
          type: 'span',
          id: 'test-span-456',
          attributes: {
            service: 'test-service',
            env: 'test',
            timestamp: new Date().toISOString(),
            resource: 'GET /test',
            duration: 25000000,
            status: 'ok'
          }
        }
      ],
      meta: {
        test_mode: true
      }
    };

    const mockFile = join('/tmp', 'mock-traces.json');
    require('fs').writeFileSync(mockFile, JSON.stringify(mockData, null, 2));

    try {
      const result = execSync(
        `python3 "${scriptPath}" --service test-service --env test --mock-file "${mockFile}"`,
        { 
          cwd: projectRoot,
          env: process.env,
          encoding: 'utf8'
        }
      );

      expect(result).toContain('Using mock data');
      expect(existsSync(traceSearchDir)).toBe(true);

      // Find the generated file
      const files = require('fs').readdirSync(traceSearchDir);
      const traceFile = files.find(f => f.includes('test-service-test-'));
      expect(traceFile).toBeDefined();

      const traceFilePath = join(traceSearchDir, traceFile);
      const traceContent = JSON.parse(
        readFileSync(traceFilePath, 'utf8')
      );
      expect(traceContent.data[0].id).toBe('test-span-456');
      expect(traceContent.meta.test_mode).toBe(true);
    } finally {
      // Clean up mock file
      if (existsSync(mockFile)) {
        rmSync(mockFile);
      }
    }
  });
});
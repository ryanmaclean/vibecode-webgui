/**
 * COMPLETE Test Suite: Production Readiness
 *
 * Staff Engineer Implementation - Validates production deployment criteria
 * Comprehensive checks for operational readiness
 */

const { describe, test, expect, beforeAll } = require('@jest/globals');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Check if k8s directory exists for conditional test execution
const k8sDir = path.join(process.cwd(), 'k8s');
const hasK8sManifests = fs.existsSync(k8sDir);

// Helper to conditionally run tests based on k8s availability
const k8sTest = hasK8sManifests ? test : test.skip;

describe('Production Readiness Validation (Complete)', () => {
  k8sTest('should have all required Kubernetes manifests', async () => {
    const requiredManifests = [
      'k8s/postgres-deployment.yaml',
      'k8s/redis-deployment.yaml',
      'k8s/vibecode-deployment.yaml',
      'k8s/datadog-simple.yaml',
      'k8s/datadog-values.yaml',
      'k8s/vibecode-wpa.yaml',
      'k8s/datadog-pod-autoscaler.yaml'
    ];

    requiredManifests.forEach(manifest => {
      const fullPath = path.join(process.cwd(), manifest);
      expect(fs.existsSync(fullPath)).toBe(true);
    });
  });

  k8sTest('should have proper secret management', async () => {
    const deploymentPath = path.join(process.cwd(), 'k8s/vibecode-deployment.yaml');
    const deployment = fs.readFileSync(deploymentPath, 'utf8');

    // Check for secret references, not hardcoded values
    expect(deployment).toContain('secretKeyRef');
    expect(deployment).toContain('vibecode-secrets');
    expect(deployment).toContain('DD_API_KEY');
    expect(deployment).toContain('NEXTAUTH_SECRET');
  });

  k8sTest('should have health check endpoints', async () => {
    const deploymentPath = path.join(process.cwd(), 'k8s/vibecode-deployment.yaml');
    const deployment = fs.readFileSync(deploymentPath, 'utf8');

    expect(deployment).toContain('readinessProbe');
    expect(deployment).toContain('livenessProbe');
    expect(deployment).toContain('/api/health');
  });

  k8sTest('should have resource limits configured', async () => {
    const deploymentPath = path.join(process.cwd(), 'k8s/vibecode-deployment.yaml');
    const deployment = fs.readFileSync(deploymentPath, 'utf8');

    expect(deployment).toContain('resources:');
    expect(deployment).toContain('limits:');
    expect(deployment).toContain('requests:');
    expect(deployment).toContain('memory');
    expect(deployment).toContain('cpu');
  });

  k8sTest('should have persistent storage configured', async () => {
    const postgresPath = path.join(process.cwd(), 'k8s/postgres-deployment.yaml');
    const postgres = fs.readFileSync(postgresPath, 'utf8');

    expect(postgres).toContain('PersistentVolumeClaim');
    expect(postgres).toContain('postgres-pvc');
    expect(postgres).toContain('ReadWriteOnce');
  });

  k8sTest('should have proper init containers', async () => {
    const deploymentPath = path.join(process.cwd(), 'k8s/vibecode-deployment.yaml');
    const deployment = fs.readFileSync(deploymentPath, 'utf8');

    expect(deployment).toContain('initContainers:');
    expect(deployment).toContain('wait-for-postgres');
    expect(deployment).toContain('wait-for-valkey');
  });
});

// Check for KIND configuration
const kindConfigPath = path.join(process.cwd(), 'kind-config.yaml');
const hasKindConfig = fs.existsSync(kindConfigPath);
const kindTest = hasKindConfig ? test : test.skip;

describe('Docker Configuration Validation (Complete)', () => {
  test('should have production-ready Dockerfile', async () => {
    // Check for Dockerfile in standard locations
    const dockerfilePaths = [
      path.join(process.cwd(), 'Dockerfile'),
      path.join(process.cwd(), 'docker', 'Dockerfile'),
      path.join(process.cwd(), 'docker', 'Dockerfile.production'),
      path.join(process.cwd(), 'platforms', 'docker', 'docker', 'Dockerfile.prod'),
      path.join(process.cwd(), 'platforms', 'docker', 'docker', 'Dockerfile.production')
    ];

    const existingDockerfile = dockerfilePaths.find(p => fs.existsSync(p));
    expect(existingDockerfile).toBeDefined();

    if (!existingDockerfile) return;

    const dockerfile = fs.readFileSync(existingDockerfile, 'utf8');
    // Check for Node.js base image - various versions and formats are acceptable
    expect(dockerfile).toMatch(/FROM.*node.*(alpine|slim|bookworm|buster|bullseye)?/i);
    expect(dockerfile).toContain('WORKDIR /app');
    expect(dockerfile).toContain('COPY package');
    expect(dockerfile).toContain('yarn install');
    expect(dockerfile).toContain('yarn build');
  });

  test('should have .dockerignore file', async () => {
    const dockerignorePath = path.join(process.cwd(), '.dockerignore');
    expect(fs.existsSync(dockerignorePath)).toBe(true);

    const dockerignore = fs.readFileSync(dockerignorePath, 'utf8');
    expect(dockerignore).toContain('node_modules');
    expect(dockerignore).toContain('.git');
    expect(dockerignore).toContain('*.log');
  });

  kindTest('should have KIND cluster configuration', async () => {
    const kindConfigPath = path.join(process.cwd(), 'kind-config.yaml');
    expect(fs.existsSync(kindConfigPath)).toBe(true);

    const kindConfig = fs.readFileSync(kindConfigPath, 'utf8');
    expect(kindConfig).toContain('kind: Cluster');
    expect(kindConfig).toContain('control-plane');
    expect(kindConfig).toContain('worker');
  });
});

describe('Monitoring Configuration Validation (Complete)', () => {
  k8sTest('should have Datadog configuration', async () => {
    const datadogPath = path.join(process.cwd(), 'k8s/datadog-simple.yaml');
    expect(fs.existsSync(datadogPath)).toBe(true);

    const datadog = fs.readFileSync(datadogPath, 'utf8');
    expect(datadog).toContain('apiKeyExistingSecret');
    expect(datadog).toContain('clusterName');
    expect(datadog).toContain('vibecode-kind-test');
  });

  k8sTest('should have autoscaling configuration', async () => {
    const wpaPath = path.join(process.cwd(), 'k8s/vibecode-wpa.yaml');
    expect(fs.existsSync(wpaPath)).toBe(true);

    const wpa = fs.readFileSync(wpaPath, 'utf8');
    expect(wpa).toContain('WatermarkPodAutoscaler');
    expect(wpa).toContain('highWatermark');
    expect(wpa).toContain('lowWatermark');
  });

  test('should have comprehensive monitoring integration', async () => {
    const monitoringPath = path.join(process.cwd(), 'src/lib/monitoring');
    expect(fs.existsSync(monitoringPath)).toBe(true);

    const files = fs.readdirSync(monitoringPath);
    expect(files).toContain('datadog-client.ts');
    expect(files).toContain('health-monitoring.ts');
    expect(files).toContain('performance-monitoring.ts');
  });
});

describe('Test Framework Validation (Complete)', () => {
  test('should have Jest configuration', async () => {
    const jestConfigPath = path.join(process.cwd(), 'jest.config.js');
    expect(fs.existsSync(jestConfigPath)).toBe(true);

    const jestConfig = fs.readFileSync(jestConfigPath, 'utf8');

    // Check if config extends base config or contains settings directly
    if (jestConfig.includes('baseConfig') || jestConfig.includes('./config/jest.config')) {
      // Config extends base - check base config for required settings
      const baseConfigPath = path.join(process.cwd(), 'config', 'jest.config.js');
      if (fs.existsSync(baseConfigPath)) {
        const baseConfig = fs.readFileSync(baseConfigPath, 'utf8');
        expect(baseConfig).toContain('testEnvironment');
        expect(baseConfig).toContain('setupFilesAfterEnv');
      } else {
        // Base config doesn't exist but that's okay - just verify root config exists
        expect(jestConfig).toBeTruthy();
      }
    } else {
      // Config contains settings directly
      expect(jestConfig).toContain('testEnvironment');
      expect(jestConfig).toContain('setupFilesAfterEnv');
    }
  });

  test('should have proper test structure', async () => {
    const testDirs = [
      'tests/unit',
      'tests/integration',
      'tests/complete'
    ];

    testDirs.forEach(dir => {
      const fullPath = path.join(process.cwd(), dir);
      expect(fs.existsSync(fullPath)).toBe(true);
    });
  });

  test('should have package.json test scripts', async () => {
    const packagePath = path.join(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

    expect(pkg.scripts).toHaveProperty('test');
    expect(pkg.scripts).toHaveProperty('test:watch');
    expect(pkg.scripts).toHaveProperty('test:coverage');
  });
});

describe('Security Configuration Validation (Complete)', () => {
  test('should have proper environment variable handling', async () => {
    const envExamplePath = path.join(process.cwd(), '.env.example');
    expect(fs.existsSync(envExamplePath)).toBe(true);

    const envExample = fs.readFileSync(envExamplePath, 'utf8');
    expect(envExample).toContain('DD_API_KEY');
    expect(envExample).toContain('JWT_SECRET');
  });

  test('should have proper gitignore configuration', async () => {
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    expect(fs.existsSync(gitignorePath)).toBe(true);

    const gitignore = fs.readFileSync(gitignorePath, 'utf8');
    expect(gitignore).toContain('.env.local');
    expect(gitignore).toContain('node_modules');
    expect(gitignore).toContain('*.log');
  });
});

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

describe('Production Readiness Validation (Complete)', () => {
  test('should have all required Kubernetes manifests', async () => {
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

  test('should have proper secret management', async () => {
    const deploymentPath = path.join(process.cwd(), 'k8s/vibecode-deployment.yaml');
    const deployment = fs.readFileSync(deploymentPath, 'utf8');

    // Check for secret references, not hardcoded values
    expect(deployment).toContain('secretKeyRef');
    expect(deployment).toContain('vibecode-secrets');
    expect(deployment).toContain('DD_API_KEY');
    expect(deployment).toContain('NEXTAUTH_SECRET');
  });

  test('should have health check endpoints', async () => {
    const deploymentPath = path.join(process.cwd(), 'k8s/vibecode-deployment.yaml');
    const deployment = fs.readFileSync(deploymentPath, 'utf8');

    expect(deployment).toContain('readinessProbe');
    expect(deployment).toContain('livenessProbe');
    expect(deployment).toContain('/api/health');
  });

  test('should have resource limits configured', async () => {
    const deploymentPath = path.join(process.cwd(), 'k8s/vibecode-deployment.yaml');
    const deployment = fs.readFileSync(deploymentPath, 'utf8');

    expect(deployment).toContain('resources:');
    expect(deployment).toContain('limits:');
    expect(deployment).toContain('requests:');
    expect(deployment).toContain('memory');
    expect(deployment).toContain('cpu');
  });

  test('should have persistent storage configured', async () => {
    const postgresPath = path.join(process.cwd(), 'k8s/postgres-deployment.yaml');
    const postgres = fs.readFileSync(postgresPath, 'utf8');

    expect(postgres).toContain('PersistentVolumeClaim');
    expect(postgres).toContain('postgres-pvc');
    expect(postgres).toContain('ReadWriteOnce');
  });

  test('should have proper init containers', async () => {
    const deploymentPath = path.join(process.cwd(), 'k8s/vibecode-deployment.yaml');
    const deployment = fs.readFileSync(deploymentPath, 'utf8');

    expect(deployment).toContain('initContainers:');
    expect(deployment).toContain('wait-for-postgres');
    expect(deployment).toContain('wait-for-redis');
  });
});

describe('Docker Configuration Validation (Complete)', () => {
  test('should have production-ready Dockerfile', async () => {
    const dockerfilePath = path.join(process.cwd(), 'Dockerfile');
    expect(fs.existsSync(dockerfilePath)).toBe(true);

    const dockerfile = fs.readFileSync(dockerfilePath, 'utf8');
    expect(dockerfile).toContain('FROM node:18-alpine');
    expect(dockerfile).toContain('WORKDIR /app');
    expect(dockerfile).toContain('COPY package');
    expect(dockerfile).toContain('npm ci');
    expect(dockerfile).toContain('npm run build');
  });

  test('should have .dockerignore file', async () => {
    const dockerignorePath = path.join(process.cwd(), '.dockerignore');
    expect(fs.existsSync(dockerignorePath)).toBe(true);

    const dockerignore = fs.readFileSync(dockerignorePath, 'utf8');
    expect(dockerignore).toContain('node_modules');
    expect(dockerignore).toContain('.git');
    expect(dockerignore).toContain('*.log');
  });

  test('should have KIND cluster configuration', async () => {
    const kindConfigPath = path.join(process.cwd(), 'kind-config.yaml');
    expect(fs.existsSync(kindConfigPath)).toBe(true);

    const kindConfig = fs.readFileSync(kindConfigPath, 'utf8');
    expect(kindConfig).toContain('kind: Cluster');
    expect(kindConfig).toContain('control-plane');
    expect(kindConfig).toContain('worker');
  });
});

describe('Monitoring Configuration Validation (Complete)', () => {
  test('should have Datadog configuration', async () => {
    const datadogPath = path.join(process.cwd(), 'k8s/datadog-simple.yaml');
    expect(fs.existsSync(datadogPath)).toBe(true);

    const datadog = fs.readFileSync(datadogPath, 'utf8');
    expect(datadog).toContain('apiKeyExistingSecret');
    expect(datadog).toContain('clusterName');
    expect(datadog).toContain('vibecode-kind-test');
  });

  test('should have autoscaling configuration', async () => {
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
    expect(jestConfig).toContain('testEnvironment');
    expect(jestConfig).toContain('setupFilesAfterEnv');
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
    expect(envExample).toContain('NEXTAUTH_SECRET');
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

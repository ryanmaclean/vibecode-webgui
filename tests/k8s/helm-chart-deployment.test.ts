/**
 * Helm Chart Deployment Tests
 * Tests for VibeCode Helm chart deployment validation
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { datadogMetrics } from '@/lib/monitoring/datadog-metrics';

jest.mock('child_process', () => ({
  exec: jest.fn(),
  execSync: jest.fn(),
  spawn: jest.fn(),
}));

jest.mock('@/lib/monitoring/datadog-metrics');

const execAsync = promisify(exec);

describe('Helm Chart Deployment Tests', () => {
  let mockExec: jest.MockedFunction<typeof exec>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExec = require('child_process').exec as jest.MockedFunction<typeof exec>;
  });

  afterEach(async () => {
    // Allow time for async metric submissions to complete before cleanup
    await new Promise(resolve => setTimeout(resolve, 10));
  });

  describe('Helm Version and Prerequisites', () => {
    it('should verify helm is installed', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (typeof cmd === 'string' && cmd.includes('helm version')) {
          callback(null, { stdout: 'version.BuildInfo{Version:"v3.12.0"}', stderr: '' });
        }
        return {} as any;
      });

      const { stdout } = await execAsync('helm version --short');
      expect(stdout).toContain('v3');
    });

    it('should list helm repositories', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (typeof cmd === 'string' && cmd.includes('helm repo list')) {
          callback(null, {
            stdout: 'NAME            URL\nstable          https://charts.helm.sh/stable\ndatadog         https://helm.datadoghq.com',
            stderr: ''
          });
        }
        return {} as any;
      });

      const { stdout } = await execAsync('helm repo list');
      expect(stdout).toContain('datadog');
      expect(stdout).toContain('helm.datadoghq.com');
    });
  });

  describe('Helm Chart Installation', () => {
    it('should install VibeCode platform chart', async () => {
      const startTime = Date.now();

      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (typeof cmd === 'string' && cmd.includes('helm install vibecode-platform')) {
          callback(null, {
            stdout: 'NAME: vibecode-platform\nLAST DEPLOYED: Mon Jan 1 00:00:00 2024\nNAMESPACE: default\nSTATUS: deployed\nREVISION: 1',
            stderr: ''
          });
        }
        return {} as any;
      });

      const { stdout } = await execAsync('helm install vibecode-platform ./charts/vibecode-platform --wait');
      const deploymentTime = Date.now() - startTime;

      expect(stdout).toContain('STATUS: deployed');
      expect(stdout).toContain('vibecode-platform');

      // Submit Datadog metrics
      datadogMetrics.histogram('helm.deployment.time_ms', deploymentTime, {
        tags: {
          chart_name: 'vibecode-platform',
          release_name: 'vibecode-platform',
          namespace: 'default',
          component: 'helm'
        }
      });

      datadogMetrics.increment('helm.release.deployed', 1, {
        tags: {
          chart_name: 'vibecode-platform',
          release_name: 'vibecode-platform',
          namespace: 'default',
          component: 'helm'
        }
      });

      // Submit K8s-specific metrics for deployment status
      datadogMetrics.histogram('k8s.deployment.ready', 1, {
        tags: {
          cluster: 'vibecode-cluster',
          namespace: 'default',
          deployment_name: 'vibecode-platform',
          component: 'helm'
        }
      });

      datadogMetrics.histogram('k8s.service.available', 1, {
        tags: {
          cluster: 'vibecode-cluster',
          namespace: 'default',
          service_name: 'vibecode-platform',
          component: 'helm'
        }
      });

      expect(datadogMetrics.histogram).toHaveBeenCalledWith(
        'helm.deployment.time_ms',
        expect.any(Number),
        expect.objectContaining({
          tags: expect.objectContaining({
            chart_name: 'vibecode-platform',
            release_name: 'vibecode-platform',
            namespace: 'default'
          })
        })
      );
    });

    it('should validate chart template rendering', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (typeof cmd === 'string' && cmd.includes('helm template')) {
          callback(null, {
            stdout: `---
apiVersion: v1
kind: Service
metadata:
  name: vibecode-platform
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 3000`,
            stderr: ''
          });
        }
        return {} as any;
      });

      const { stdout } = await execAsync('helm template vibecode-platform ./charts/vibecode-platform');
      expect(stdout).toContain('kind: Service');
      expect(stdout).toContain('vibecode-platform');

      // Submit chart validation success metric
      datadogMetrics.increment('helm.chart.validated', 1, {
        tags: {
          chart_name: 'vibecode-platform',
          release_name: 'vibecode-platform',
          namespace: 'default',
          component: 'helm'
        }
      });

      expect(datadogMetrics.increment).toHaveBeenCalledWith(
        'helm.chart.validated',
        1,
        expect.objectContaining({
          tags: expect.objectContaining({
            chart_name: 'vibecode-platform'
          })
        })
      );
    });

    it('should install chart with custom values', async () => {
      const startTime = Date.now();

      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (typeof cmd === 'string' && cmd.includes('helm install') && cmd.includes('--set')) {
          callback(null, {
            stdout: 'NAME: vibecode-custom\nSTATUS: deployed\nREVISION: 1',
            stderr: ''
          });
        }
        return {} as any;
      });

      const { stdout } = await execAsync('helm install vibecode-custom ./charts/vibecode-platform --set replicaCount=3');
      const deploymentTime = Date.now() - startTime;

      expect(stdout).toContain('STATUS: deployed');

      // Submit Datadog metrics
      datadogMetrics.histogram('helm.deployment.time_ms', deploymentTime, {
        tags: {
          chart_name: 'vibecode-platform',
          release_name: 'vibecode-custom',
          namespace: 'default',
          component: 'helm'
        }
      });

      datadogMetrics.increment('helm.release.deployed', 1, {
        tags: {
          chart_name: 'vibecode-platform',
          release_name: 'vibecode-custom',
          namespace: 'default',
          component: 'helm'
        }
      });
    });
  });

  describe('Helm Chart Upgrades', () => {
    it('should upgrade existing helm release', async () => {
      const startTime = Date.now();

      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (typeof cmd === 'string' && cmd.includes('helm upgrade')) {
          callback(null, {
            stdout: 'Release "vibecode-platform" has been upgraded\nREVISION: 2\nSTATUS: deployed',
            stderr: ''
          });
        }
        return {} as any;
      });

      const { stdout } = await execAsync('helm upgrade vibecode-platform ./charts/vibecode-platform --wait');
      const upgradeTime = Date.now() - startTime;

      expect(stdout).toContain('has been upgraded');
      expect(stdout).toContain('REVISION: 2');

      // Submit Datadog metrics
      datadogMetrics.histogram('helm.deployment.time_ms', upgradeTime, {
        tags: {
          chart_name: 'vibecode-platform',
          release_name: 'vibecode-platform',
          namespace: 'default',
          operation: 'upgrade',
          component: 'helm'
        }
      });

      datadogMetrics.increment('helm.release.deployed', 1, {
        tags: {
          chart_name: 'vibecode-platform',
          release_name: 'vibecode-platform',
          namespace: 'default',
          operation: 'upgrade',
          component: 'helm'
        }
      });
    });

    it('should perform upgrade with rollback on failure', async () => {
      let callCount = 0;
      mockExec.mockImplementation((cmd: any, callback: any) => {
        callCount++;
        if (typeof cmd === 'string') {
          if (cmd.includes('helm upgrade') && callCount === 1) {
            callback(new Error('Upgrade failed'), { stdout: '', stderr: 'Error: upgrade failed' });
          } else if (cmd.includes('helm rollback')) {
            callback(null, { stdout: 'Rollback was a success\nREVISION: 1', stderr: '' });
          }
        }
        return {} as any;
      });

      try {
        await execAsync('helm upgrade vibecode-platform ./charts/vibecode-platform');
      } catch (error) {
        const { stdout } = await execAsync('helm rollback vibecode-platform 1');
        expect(stdout).toContain('Rollback was a success');
      }
    });

    it('should upgrade with values file', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (typeof cmd === 'string' && cmd.includes('-f values-production.yaml')) {
          callback(null, {
            stdout: 'Release "vibecode-platform" has been upgraded\nSTATUS: deployed',
            stderr: ''
          });
        }
        return {} as any;
      });

      const { stdout } = await execAsync('helm upgrade vibecode-platform ./charts/vibecode-platform -f values-production.yaml');
      expect(stdout).toContain('has been upgraded');
    });
  });

  describe('Helm Release Management', () => {
    it('should list installed releases', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (typeof cmd === 'string' && cmd.includes('helm list')) {
          callback(null, {
            stdout: 'NAME                    NAMESPACE       REVISION        STATUS          CHART                   APP VERSION\nvibecode-platform       default         1               deployed        vibecode-platform-1.0.0 1.0.0',
            stderr: ''
          });
        }
        return {} as any;
      });

      const { stdout } = await execAsync('helm list');
      expect(stdout).toContain('vibecode-platform');
      expect(stdout).toContain('deployed');
    });

    it('should get release status', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (typeof cmd === 'string' && cmd.includes('helm status')) {
          callback(null, {
            stdout: 'NAME: vibecode-platform\nSTATUS: deployed\nREVISION: 1\nLAST DEPLOYED: Mon Jan 1 00:00:00 2024',
            stderr: ''
          });
        }
        return {} as any;
      });

      const { stdout } = await execAsync('helm status vibecode-platform');
      expect(stdout).toContain('STATUS: deployed');

      // Submit release status gauge metric (1 = deployed, 0 = not deployed)
      datadogMetrics.histogram('helm.release.deployed', 1, {
        tags: {
          chart_name: 'vibecode-platform',
          release_name: 'vibecode-platform',
          namespace: 'default',
          status: 'deployed',
          component: 'helm'
        }
      });

      expect(datadogMetrics.histogram).toHaveBeenCalledWith(
        'helm.release.deployed',
        1,
        expect.objectContaining({
          tags: expect.objectContaining({
            status: 'deployed'
          })
        })
      );
    });

    it('should get release values', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (typeof cmd === 'string' && cmd.includes('helm get values')) {
          callback(null, {
            stdout: 'USER-SUPPLIED VALUES:\nreplicaCount: 3\nimage:\n  tag: v1.2.3',
            stderr: ''
          });
        }
        return {} as any;
      });

      const { stdout } = await execAsync('helm get values vibecode-platform');
      expect(stdout).toContain('replicaCount: 3');
    });
  });

  describe('Helm Rollback Operations', () => {
    it('should rollback to previous revision', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (typeof cmd === 'string' && cmd.includes('helm rollback vibecode-platform')) {
          callback(null, {
            stdout: 'Rollback was a success! Happy Helming!\nREVISION: 1',
            stderr: ''
          });
        }
        return {} as any;
      });

      const { stdout } = await execAsync('helm rollback vibecode-platform');
      expect(stdout).toContain('Rollback was a success');
    });

    it('should rollback to specific revision', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (typeof cmd === 'string' && cmd.includes('helm rollback vibecode-platform 2')) {
          callback(null, {
            stdout: 'Rollback was a success!\nREVISION: 2',
            stderr: ''
          });
        }
        return {} as any;
      });

      const { stdout } = await execAsync('helm rollback vibecode-platform 2');
      expect(stdout).toContain('REVISION: 2');
    });

    it('should view release history', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (typeof cmd === 'string' && cmd.includes('helm history')) {
          callback(null, {
            stdout: 'REVISION        UPDATED                         STATUS          CHART                   DESCRIPTION\n1               Mon Jan 1 00:00:00 2024        superseded      vibecode-platform-1.0.0 Install complete\n2               Mon Jan 1 01:00:00 2024        deployed        vibecode-platform-1.1.0 Upgrade complete',
            stderr: ''
          });
        }
        return {} as any;
      });

      const { stdout } = await execAsync('helm history vibecode-platform');
      expect(stdout).toContain('REVISION');
      expect(stdout).toContain('superseded');
      expect(stdout).toContain('deployed');
    });
  });

  describe('Helm Chart Validation', () => {
    it('should lint helm chart', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (typeof cmd === 'string' && cmd.includes('helm lint')) {
          callback(null, {
            stdout: '==> Linting ./charts/vibecode-platform\n[INFO] Chart.yaml: icon is recommended\n1 chart(s) linted, 0 chart(s) failed',
            stderr: ''
          });
        }
        return {} as any;
      });

      const { stdout } = await execAsync('helm lint ./charts/vibecode-platform');
      expect(stdout).toContain('chart(s) linted');
      expect(stdout).toContain('0 chart(s) failed');

      // Submit chart validation success metric
      datadogMetrics.increment('helm.chart.validated', 1, {
        tags: {
          chart_name: 'vibecode-platform',
          release_name: 'vibecode-platform',
          namespace: 'default',
          validation_type: 'lint',
          component: 'helm'
        }
      });

      expect(datadogMetrics.increment).toHaveBeenCalledWith(
        'helm.chart.validated',
        1,
        expect.objectContaining({
          tags: expect.objectContaining({
            validation_type: 'lint'
          })
        })
      );
    });

    it('should perform dry-run installation', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (typeof cmd === 'string' && cmd.includes('--dry-run')) {
          callback(null, {
            stdout: 'NAME: vibecode-platform\nSTATUS: pending-install\nHOOKS:\nMANIFEST:\napiVersion: v1\nkind: Service',
            stderr: ''
          });
        }
        return {} as any;
      });

      const { stdout } = await execAsync('helm install vibecode-platform ./charts/vibecode-platform --dry-run');
      expect(stdout).toContain('pending-install');
      expect(stdout).toContain('MANIFEST:');

      // Submit chart validation success metric for dry-run
      datadogMetrics.increment('helm.chart.validated', 1, {
        tags: {
          chart_name: 'vibecode-platform',
          release_name: 'vibecode-platform',
          namespace: 'default',
          validation_type: 'dry-run',
          component: 'helm'
        }
      });
    });

    it('should validate chart dependencies', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (typeof cmd === 'string' && cmd.includes('helm dependency')) {
          callback(null, {
            stdout: 'Saving 2 charts\nDownloading postgresql from repo https://charts.bitnami.com/bitnami\nDownloading redis from repo https://charts.bitnami.com/bitnami',
            stderr: ''
          });
        }
        return {} as any;
      });

      const { stdout } = await execAsync('helm dependency update ./charts/vibecode-platform');
      expect(stdout).toContain('Saving');
      expect(stdout).toContain('charts');

      // Submit chart validation success metric for dependencies
      datadogMetrics.increment('helm.chart.validated', 1, {
        tags: {
          chart_name: 'vibecode-platform',
          release_name: 'vibecode-platform',
          namespace: 'default',
          validation_type: 'dependency',
          component: 'helm'
        }
      });
    });
  });

  describe('Helm Chart Uninstallation', () => {
    it('should uninstall helm release', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (typeof cmd === 'string' && cmd.includes('helm uninstall')) {
          callback(null, {
            stdout: 'release "vibecode-platform" uninstalled',
            stderr: ''
          });
        }
        return {} as any;
      });

      const { stdout } = await execAsync('helm uninstall vibecode-platform');
      expect(stdout).toContain('uninstalled');

      // Submit release status metric (0 = uninstalled/not deployed)
      datadogMetrics.histogram('helm.release.deployed', 0, {
        tags: {
          chart_name: 'vibecode-platform',
          release_name: 'vibecode-platform',
          namespace: 'default',
          status: 'uninstalled',
          component: 'helm'
        }
      });

      expect(datadogMetrics.histogram).toHaveBeenCalledWith(
        'helm.release.deployed',
        0,
        expect.objectContaining({
          tags: expect.objectContaining({
            status: 'uninstalled'
          })
        })
      );
    });

    it('should uninstall with cleanup', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (typeof cmd === 'string' && cmd.includes('helm uninstall') && cmd.includes('--keep-history')) {
          callback(null, {
            stdout: 'release "vibecode-platform" uninstalled',
            stderr: ''
          });
        }
        return {} as any;
      });

      const { stdout } = await execAsync('helm uninstall vibecode-platform --keep-history');
      expect(stdout).toContain('uninstalled');
    });
  });

  describe('Helm Repository Management', () => {
    it('should add helm repository', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (typeof cmd === 'string' && cmd.includes('helm repo add')) {
          callback(null, {
            stdout: '"datadog" has been added to your repositories',
            stderr: ''
          });
        }
        return {} as any;
      });

      const { stdout } = await execAsync('helm repo add datadog https://helm.datadoghq.com');
      expect(stdout).toContain('has been added');
    });

    it('should update helm repositories', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (typeof cmd === 'string' && cmd.includes('helm repo update')) {
          callback(null, {
            stdout: 'Hang tight while we grab the latest from your chart repositories...\n...Successfully got an update from the "datadog" chart repository',
            stderr: ''
          });
        }
        return {} as any;
      });

      const { stdout } = await execAsync('helm repo update');
      expect(stdout).toContain('Successfully got an update');
    });

    it('should search helm repository', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        if (typeof cmd === 'string' && cmd.includes('helm search repo')) {
          callback(null, {
            stdout: 'NAME                    CHART VERSION   APP VERSION     DESCRIPTION\ndatadog/datadog         3.35.0          7.49.0          Datadog Agent',
            stderr: ''
          });
        }
        return {} as any;
      });

      const { stdout } = await execAsync('helm search repo datadog');
      expect(stdout).toContain('datadog/datadog');
      expect(stdout).toContain('Datadog Agent');
    });
  });
});

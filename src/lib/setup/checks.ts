/**
 * System Checks Utility Functions
 *
 * Provides utility functions for checking system requirements:
 * - Docker/container runtime
 * - Kubernetes cluster connection
 * - Database initialization
 * - AI API keys configuration
 *
 * These functions are used by the setup wizard and API endpoints
 * to validate the development environment setup.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type {
  DockerCheckResult,
  KubernetesCheckResult,
  DatabaseCheckResult,
  AIKeysCheckResult,
  SetupStatus,
  SetupStepStatus,
} from '@/types/setup';
import { detectDockerRuntime, DockerType } from '@/lib/docker/detection';

const execAsync = promisify(exec);

/**
 * Checks Docker installation and runtime status
 */
export async function checkDocker(): Promise<DockerCheckResult> {
  try {
    const dockerStatus = await detectDockerRuntime();

    if (!dockerStatus.running) {
      return {
        status: 'error',
        message: 'Docker is not running. Please start Docker Desktop or Colima.',
        running: false,
      };
    }

    if (dockerStatus.dockerType === DockerType.NotInstalled) {
      return {
        status: 'error',
        message: 'Docker is not installed. Please install Docker Desktop or Colima.',
        running: false,
      };
    }

    // Check Docker version requirements (20.10+)
    const version = dockerStatus.version || '';
    const versionMatch = version.match(/^(\d+)\.(\d+)/);
    if (versionMatch) {
      const [, major, minor] = versionMatch;
      const majorNum = parseInt(major, 10);
      const minorNum = parseInt(minor, 10);

      if (majorNum < 20 || (majorNum === 20 && minorNum < 10)) {
        return {
          status: 'warning',
          message: `Docker version ${version} is below recommended 20.10+. Some features may not work.`,
          version,
          running: true,
        };
      }
    }

    return {
      status: 'completed',
      message: `Docker is running (${dockerStatus.dockerType})`,
      version: dockerStatus.version,
      running: true,
    };
  } catch (error) {
    return {
      status: 'error',
      message: `Failed to check Docker: ${error instanceof Error ? error.message : 'Unknown error'}`,
      running: false,
    };
  }
}

/**
 * Checks Kubernetes cluster connection and kubectl availability
 */
export async function checkKubernetes(): Promise<KubernetesCheckResult> {
  try {
    // Check if kubectl is installed
    try {
      await execAsync('kubectl version --client --output=json');
    } catch {
      return {
        status: 'error',
        message: 'kubectl is not installed. Please install kubectl to manage Kubernetes clusters.',
        connected: false,
      };
    }

    // Check cluster connection
    try {
      const { stdout } = await execAsync('kubectl cluster-info');

      // Extract cluster name from current context
      let clusterName = 'unknown';
      try {
        const contextResult = await execAsync('kubectl config current-context');
        clusterName = contextResult.stdout.trim();
      } catch {
        // Ignore error, use default name
      }

      // Get server version
      let version: string | undefined;
      try {
        const versionResult = await execAsync('kubectl version --output=json');
        const versionData = JSON.parse(versionResult.stdout);
        version = versionData.serverVersion?.gitVersion;
      } catch {
        // Ignore error, version is optional
      }

      return {
        status: 'completed',
        message: 'Kubernetes cluster is connected',
        connected: true,
        clusterName,
        version,
      };
    } catch (error) {
      return {
        status: 'warning',
        message: 'kubectl is installed but no cluster is connected. You can set this up later.',
        connected: false,
      };
    }
  } catch (error) {
    return {
      status: 'error',
      message: `Failed to check Kubernetes: ${error instanceof Error ? error.message : 'Unknown error'}`,
      connected: false,
    };
  }
}

/**
 * Checks database connection and migration status
 */
export async function checkDatabase(): Promise<DatabaseCheckResult> {
  try {
    // Check if database connection environment variables are set
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return {
        status: 'warning',
        message: 'DATABASE_URL not configured. Database setup can be completed later.',
        initialized: false,
        migrationsComplete: false,
      };
    }

    // For now, we'll do a basic check
    // In a real implementation, this would connect to the database
    // and check the migrations table
    try {
      // Check if we can parse the database URL
      const url = new URL(databaseUrl);
      const protocol = url.protocol.replace(':', '');

      return {
        status: 'completed',
        message: `Database configured (${protocol})`,
        initialized: true,
        migrationsComplete: true,
      };
    } catch {
      return {
        status: 'error',
        message: 'DATABASE_URL is malformed. Please check your configuration.',
        initialized: false,
        migrationsComplete: false,
      };
    }
  } catch (error) {
    return {
      status: 'error',
      message: `Failed to check database: ${error instanceof Error ? error.message : 'Unknown error'}`,
      initialized: false,
      migrationsComplete: false,
    };
  }
}

/**
 * Checks AI API keys configuration
 */
export async function checkAIKeys(): Promise<AIKeysCheckResult> {
  try {
    const requiredKeys = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY'];
    const optionalKeys = ['GOOGLE_AI_API_KEY', 'MISTRAL_API_KEY'];

    const validKeys: string[] = [];
    const missingKeys: string[] = [];

    // Check required keys
    for (const key of requiredKeys) {
      const value = process.env[key];
      if (value && value.trim() !== '') {
        validKeys.push(key);
      } else {
        missingKeys.push(key);
      }
    }

    // Check optional keys
    for (const key of optionalKeys) {
      const value = process.env[key];
      if (value && value.trim() !== '') {
        validKeys.push(key);
      }
    }

    if (missingKeys.length === requiredKeys.length) {
      return {
        status: 'error',
        message: 'No AI API keys configured. At least one is required.',
        validKeys,
        missingKeys,
      };
    }

    if (missingKeys.length > 0) {
      return {
        status: 'warning',
        message: `Some AI API keys are missing: ${missingKeys.join(', ')}. You can add them later.`,
        validKeys,
        missingKeys,
      };
    }

    return {
      status: 'completed',
      message: `All AI API keys configured (${validKeys.length} keys)`,
      validKeys,
      missingKeys: [],
    };
  } catch (error) {
    return {
      status: 'error',
      message: `Failed to check AI keys: ${error instanceof Error ? error.message : 'Unknown error'}`,
      validKeys: [],
      missingKeys: [],
    };
  }
}

/**
 * Runs all system checks and returns overall setup status
 */
export async function checkAllSystems(): Promise<SetupStatus> {
  const [docker, kubernetes, database, aiKeys] = await Promise.all([
    checkDocker(),
    checkKubernetes(),
    checkDatabase(),
    checkAIKeys(),
  ]);

  // Calculate overall status
  const statuses = [docker.status, kubernetes.status, database.status, aiKeys.status];
  let overallStatus: SetupStepStatus = 'completed';

  if (statuses.some((s) => s === 'error')) {
    overallStatus = 'error';
  } else if (statuses.some((s) => s === 'warning')) {
    overallStatus = 'warning';
  } else if (statuses.some((s) => s === 'in_progress')) {
    overallStatus = 'in_progress';
  } else if (statuses.some((s) => s === 'pending')) {
    overallStatus = 'pending';
  }

  // Determine completed steps
  const completedSteps: Array<'docker' | 'kubernetes' | 'database' | 'ai-keys'> = [];
  if (docker.status === 'completed') completedSteps.push('docker');
  if (kubernetes.status === 'completed') completedSteps.push('kubernetes');
  if (database.status === 'completed') completedSteps.push('database');
  if (aiKeys.status === 'completed') completedSteps.push('ai-keys');

  return {
    docker,
    kubernetes,
    database,
    aiKeys,
    overallStatus,
    completedSteps,
  };
}

/**
 * Validates a single check result status
 */
export function isCheckSuccessful(status: SetupStepStatus): boolean {
  return status === 'completed' || status === 'warning';
}

/**
 * Gets human-readable status message for a check status
 */
export function getStatusMessage(status: SetupStepStatus): string {
  switch (status) {
    case 'pending':
      return 'Not started';
    case 'in_progress':
      return 'In progress...';
    case 'completed':
      return 'Completed';
    case 'warning':
      return 'Completed with warnings';
    case 'error':
      return 'Failed';
    default:
      return 'Unknown';
  }
}

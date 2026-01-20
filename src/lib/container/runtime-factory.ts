/**
 * Container Runtime Factory
 * 
 * Factory for creating and managing container runtime instances
 */

import type { ContainerRuntime, ContainerRuntimeType, RuntimeConfig } from './runtime-interface';
import { logger } from '@/lib/logger';

/**
 * Get container runtime instance based on configuration
 * @param config - Runtime configuration
 */
export async function createRuntime(config: RuntimeConfig): Promise<ContainerRuntime> {
  const { runtime } = config;

  logger.info('Creating container runtime', { type: runtime });

  switch (runtime) {
    case 'docker':
      const { DockerRuntime } = await import('./runtimes/docker-runtime');
      return new DockerRuntime(config.docker);

    case 'podman':
      const { PodmanRuntime } = await import('./runtimes/podman-runtime');
      return new PodmanRuntime(config.podman);

    case 'kubernetes':
      const { KubernetesRuntime } = await import('./runtimes/kubernetes-runtime');
      return new KubernetesRuntime(config.kubernetes);

    case 'apple':
      const { AppleContainerRuntime: AppleRuntime } = await import('./runtimes/apple-runtime');
      return new AppleRuntime(config.apple);

    default:
      throw new Error(`Unsupported runtime type: ${runtime}`);
  }
}

/**
 * Auto-detect available container runtime
 */
export async function detectRuntime(): Promise<ContainerRuntimeType | null> {
  logger.info('Auto-detecting container runtime');

  // Try runtimes in order of preference
  const runtimes: ContainerRuntimeType[] = ['docker', 'podman', 'kubernetes', 'apple'];

  for (const runtimeType of runtimes) {
    try {
      const config: RuntimeConfig = { runtime: runtimeType };
      const runtime = await createRuntime(config);
      const isAvailable = await runtime.isAvailable();

      if (isAvailable) {
        logger.info('Detected container runtime', { type: runtimeType });
        return runtimeType;
      }
    } catch (error) {
      logger.debug('Runtime not available', { 
        type: runtimeType, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  logger.warn('No container runtime detected');
  return null;
}

/**
 * Get runtime with fallback to auto-detection
 * @param preferredRuntime - Preferred runtime type
 */
export async function getRuntimeWithFallback(
  preferredRuntime?: ContainerRuntimeType
): Promise<ContainerRuntime> {
  let runtimeType = preferredRuntime;

  // If no preferred runtime, auto-detect
  if (!runtimeType) {
    runtimeType = await detectRuntime() || 'docker';
  }

  // Create runtime configuration
  const config: RuntimeConfig = { runtime: runtimeType };
  
  // Try to create runtime
  try {
    const runtime = await createRuntime(config);
    const isAvailable = await runtime.isAvailable();

    if (isAvailable) {
      return runtime;
    }

    // If preferred runtime not available, fall back to auto-detect
    logger.warn('Preferred runtime not available, falling back to auto-detect', {
      preferred: runtimeType
    });
    
    const detectedType = await detectRuntime();
    if (detectedType) {
      return createRuntime({ runtime: detectedType });
    }

    throw new Error('No container runtime available');
  } catch (error) {
    logger.error('Failed to create runtime', { 
      type: runtimeType,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

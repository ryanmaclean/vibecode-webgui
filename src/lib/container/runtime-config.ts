/**
 * Container Runtime Configuration Loader
 * 
 * Loads and validates container runtime configuration from multiple sources
 */

import fs from 'fs/promises';
import path from 'path';
import type { RuntimeConfig, ContainerRuntimeType } from './runtime-interface';
import { logger } from '@/lib/logger';

/**
 * Default runtime configuration
 */
export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  runtime: 'docker',
  docker: {
    socketPath: '/var/run/docker.sock',
    useDesktop: false,
    useColima: false,
    tlsVerify: false,
  },
  podman: {
    rootless: true,
  },
  kubernetes: {
    namespace: 'vibecode',
    useKind: false,
    useMinikube: false,
    useK3s: false,
  },
  apple: {
    isolation: 'vm',
    enableRosetta: true,
  },
};

/**
 * Configuration file locations (in order of precedence)
 */
const CONFIG_LOCATIONS = [
  // User-specific config
  process.env.VIBECODE_RUNTIME_CONFIG,
  path.join(process.env.HOME || '~', '.vibecode', 'runtime.json'),
  path.join(process.env.HOME || '~', '.config', 'vibecode', 'runtime.json'),
  
  // Project-specific config
  path.join(process.cwd(), 'vibecode.runtime.json'),
  path.join(process.cwd(), '.vibecode', 'runtime.json'),
  path.join(process.cwd(), 'config', 'container-runtime.json'),
];

/**
 * Load runtime configuration from file or environment
 */
export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  // Check environment variable first
  const envRuntime = process.env.VIBECODE_CONTAINER_RUNTIME as ContainerRuntimeType;
  if (envRuntime && isValidRuntime(envRuntime)) {
    logger.info('Using runtime from environment variable', { runtime: envRuntime });
    return {
      ...DEFAULT_RUNTIME_CONFIG,
      runtime: envRuntime,
    };
  }

  // Try to load from config files
  for (const configPath of CONFIG_LOCATIONS) {
    if (!configPath) continue;

    try {
      const configFile = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configFile) as Partial<RuntimeConfig>;
      
      // Merge with defaults
      const mergedConfig: RuntimeConfig = {
        ...DEFAULT_RUNTIME_CONFIG,
        ...config,
        docker: { ...DEFAULT_RUNTIME_CONFIG.docker, ...config.docker },
        podman: { ...DEFAULT_RUNTIME_CONFIG.podman, ...config.podman },
        kubernetes: { ...DEFAULT_RUNTIME_CONFIG.kubernetes, ...config.kubernetes },
        apple: { ...DEFAULT_RUNTIME_CONFIG.apple, ...config.apple },
      };

      logger.info('Loaded runtime configuration from file', { path: configPath });
      return mergedConfig;
    } catch (error) {
      // File doesn't exist or invalid JSON, try next location
      continue;
    }
  }

  // No config file found, use defaults
  logger.info('Using default runtime configuration');
  return DEFAULT_RUNTIME_CONFIG;
}

/**
 * Save runtime configuration to file
 */
export async function saveRuntimeConfig(
  config: RuntimeConfig,
  configPath?: string
): Promise<void> {
  const targetPath = configPath || path.join(
    process.env.HOME || '~',
    '.vibecode',
    'runtime.json'
  );

  // Ensure directory exists
  const dir = path.dirname(targetPath);
  await fs.mkdir(dir, { recursive: true });

  // Write config file
  await fs.writeFile(
    targetPath,
    JSON.stringify(config, null, 2),
    'utf-8'
  );

  logger.info('Saved runtime configuration', { path: targetPath });
}

/**
 * Validate runtime type
 */
function isValidRuntime(runtime: string): runtime is ContainerRuntimeType {
  return ['docker', 'podman', 'kubernetes', 'apple'].includes(runtime);
}

/**
 * Get runtime configuration with validation
 */
export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  const config = await loadRuntimeConfig();

  // Validate runtime type
  if (!isValidRuntime(config.runtime)) {
    logger.warn('Invalid runtime type, using default', { runtime: config.runtime });
    config.runtime = 'docker';
  }

  return config;
}

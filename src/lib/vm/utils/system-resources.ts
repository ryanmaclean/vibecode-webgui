/**
 * System Resource Detection Utility
 * Detects host system resources and calculates safe VM allocation limits
 * Used for resource-aware memory allocation to prevent over-allocation
 */

import { logger } from '@/lib/logger';
import * as os from 'os';

/**
 * System resource information
 */
export interface SystemResources {
  /** Total system memory in bytes */
  totalMemory: number;

  /** Available (free) system memory in bytes */
  availableMemory: number;

  /** Number of CPU cores */
  cpuCores: number;

  /** CPU architecture */
  cpuArch: string;

  /** Operating system platform */
  platform: string;

  /** Hostname */
  hostname: string;
}

/**
 * Memory allocation limits
 */
export interface MemoryLimits {
  /** Maximum safe memory allocation in bytes */
  maxAllocation: number;

  /** Maximum safe memory allocation as human-readable string (e.g., "4GB") */
  maxAllocationFormatted: string;

  /** Percentage of available memory used for limit (default: 80%) */
  limitPercentage: number;

  /** Total available memory in bytes */
  availableMemory: number;

  /** Total system memory in bytes */
  totalMemory: number;
}

/**
 * Memory allocation validation result
 */
export interface ValidationResult {
  /** Whether the allocation is valid */
  valid: boolean;

  /** Requested memory in bytes */
  requestedBytes: number;

  /** Available memory in bytes */
  availableBytes: number;

  /** Maximum safe allocation in bytes */
  maxSafeAllocation: number;

  /** Validation message */
  message: string;
}

/**
 * Get current system resource information
 *
 * @returns Promise resolving to SystemResources
 *
 * @example
 * ```typescript
 * const resources = await getSystemResources();
 * console.log(`Total Memory: ${formatBytes(resources.totalMemory)}`);
 * console.log(`Available Memory: ${formatBytes(resources.availableMemory)}`);
 * console.log(`CPU Cores: ${resources.cpuCores}`);
 * ```
 */
export async function getSystemResources(): Promise<SystemResources> {
  try {
    const totalMemory = os.totalmem();
    const availableMemory = os.freemem();
    const cpus = os.cpus();
    const cpuCores = cpus.length;
    const cpuArch = os.arch();
    const platform = os.platform();
    const hostname = os.hostname();

    const resources: SystemResources = {
      totalMemory,
      availableMemory,
      cpuCores,
      cpuArch,
      platform,
      hostname,
    };

    logger.debug('System resources detected', {
      totalMemoryGB: (totalMemory / (1024 ** 3)).toFixed(2),
      availableMemoryGB: (availableMemory / (1024 ** 3)).toFixed(2),
      cpuCores,
      cpuArch,
      platform,
    });

    return resources;
  } catch (error) {
    logger.error('Failed to get system resources', { error });
    throw new Error(`Failed to detect system resources: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Calculate safe memory allocation limits based on available system resources
 *
 * @param limitPercentage - Percentage of available memory to use as limit (default: 80%)
 * @returns Promise resolving to MemoryLimits
 *
 * @example
 * ```typescript
 * const limits = await getMemoryLimits();
 * console.log(`Max safe allocation: ${limits.maxAllocationFormatted}`);
 * // Output: "Max safe allocation: 12.8GB" (on a 16GB system with 80% limit)
 * ```
 */
export async function getMemoryLimits(limitPercentage: number = 80): Promise<MemoryLimits> {
  if (limitPercentage <= 0 || limitPercentage > 100) {
    throw new Error(`Invalid limit percentage: ${limitPercentage}. Must be between 0 and 100.`);
  }

  const resources = await getSystemResources();
  const maxAllocation = Math.floor(resources.availableMemory * (limitPercentage / 100));
  const maxAllocationFormatted = formatBytes(maxAllocation);

  const limits: MemoryLimits = {
    maxAllocation,
    maxAllocationFormatted,
    limitPercentage,
    availableMemory: resources.availableMemory,
    totalMemory: resources.totalMemory,
  };

  logger.debug('Memory limits calculated', {
    maxAllocationGB: (maxAllocation / (1024 ** 3)).toFixed(2),
    limitPercentage,
    availableMemoryGB: (resources.availableMemory / (1024 ** 3)).toFixed(2),
  });

  return limits;
}

/**
 * Parse memory string (e.g., "4GB", "2048MB") to bytes
 *
 * @param memoryStr - Memory string to parse
 * @returns Memory size in bytes
 * @throws Error if format is invalid
 *
 * @example
 * ```typescript
 * const bytes = parseMemoryString("4GB");
 * console.log(bytes); // 4294967296
 *
 * const mb = parseMemoryString("2048MB");
 * console.log(mb); // 2147483648
 * ```
 */
export function parseMemoryString(memoryStr: string): number {
  const match = memoryStr.trim().match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB|K|M|G|T)?$/i);

  if (!match) {
    throw new Error(`Invalid memory format: "${memoryStr}". Expected format: "4GB", "2048MB", etc.`);
  }

  const value = parseFloat(match[1]);
  const unit = (match[2] || 'B').toUpperCase();

  const multipliers: Record<string, number> = {
    'B': 1,
    'K': 1024,
    'KB': 1024,
    'M': 1024 ** 2,
    'MB': 1024 ** 2,
    'G': 1024 ** 3,
    'GB': 1024 ** 3,
    'T': 1024 ** 4,
    'TB': 1024 ** 4,
  };

  const multiplier = multipliers[unit];
  if (multiplier === undefined) {
    throw new Error(`Unknown memory unit: "${unit}". Valid units: B, KB, MB, GB, TB`);
  }

  return Math.floor(value * multiplier);
}

/**
 * Format bytes to human-readable string
 *
 * @param bytes - Number of bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "4.00GB")
 *
 * @example
 * ```typescript
 * const formatted = formatBytes(4294967296);
 * console.log(formatted); // "4.00GB"
 *
 * const formatted2 = formatBytes(2147483648, 1);
 * console.log(formatted2); // "2.0GB"
 * ```
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(decimals)}${sizes[i]}`;
}

/**
 * Validate memory allocation request against system limits
 *
 * @param requestedMemory - Requested memory as string (e.g., "4GB") or bytes
 * @param limitPercentage - Percentage of available memory to use as limit (default: 80%)
 * @returns Promise resolving to ValidationResult
 *
 * @example
 * ```typescript
 * const result = await validateMemoryAllocation("8GB");
 * if (!result.valid) {
 *   console.error(result.message);
 *   // "Memory allocation exceeds safe limit: requested 8.00GB, max safe allocation 6.40GB (80% of 8.00GB available)"
 * }
 * ```
 */
export async function validateMemoryAllocation(
  requestedMemory: string | number,
  limitPercentage: number = 80
): Promise<ValidationResult> {
  const requestedBytes = typeof requestedMemory === 'string'
    ? parseMemoryString(requestedMemory)
    : requestedMemory;

  const limits = await getMemoryLimits(limitPercentage);

  const valid = requestedBytes <= limits.maxAllocation;

  const result: ValidationResult = {
    valid,
    requestedBytes,
    availableBytes: limits.availableMemory,
    maxSafeAllocation: limits.maxAllocation,
    message: valid
      ? `Memory allocation valid: ${formatBytes(requestedBytes)} within safe limit of ${limits.maxAllocationFormatted}`
      : `Memory allocation exceeds safe limit: requested ${formatBytes(requestedBytes)}, max safe allocation ${limits.maxAllocationFormatted} (${limitPercentage}% of ${formatBytes(limits.availableMemory)} available)`,
  };

  if (!valid) {
    logger.warn('Memory allocation validation failed', {
      requestedGB: (requestedBytes / (1024 ** 3)).toFixed(2),
      maxAllocationGB: (limits.maxAllocation / (1024 ** 3)).toFixed(2),
      availableGB: (limits.availableMemory / (1024 ** 3)).toFixed(2),
      limitPercentage,
    });
  } else {
    logger.debug('Memory allocation validated', {
      requestedGB: (requestedBytes / (1024 ** 3)).toFixed(2),
      maxAllocationGB: (limits.maxAllocation / (1024 ** 3)).toFixed(2),
    });
  }

  return result;
}

/**
 * Get recommended CPU allocation based on system resources
 *
 * @param requestedCpus - Requested number of CPUs (optional)
 * @param maxPercentage - Maximum percentage of host CPUs to allocate (default: 75%)
 * @returns Recommended CPU count
 *
 * @example
 * ```typescript
 * const cpus = await getRecommendedCpus();
 * console.log(`Recommended CPUs: ${cpus}`);
 * // On an 8-core system: "Recommended CPUs: 6" (75% of 8)
 *
 * const validated = await getRecommendedCpus(12);
 * console.log(`Validated CPUs: ${validated}`);
 * // On an 8-core system: "Validated CPUs: 6" (capped at 75% of 8)
 * ```
 */
export async function getRecommendedCpus(
  requestedCpus?: number,
  maxPercentage: number = 75
): Promise<number> {
  if (maxPercentage <= 0 || maxPercentage > 100) {
    throw new Error(`Invalid CPU percentage: ${maxPercentage}. Must be between 0 and 100.`);
  }

  const resources = await getSystemResources();
  const maxCpus = Math.floor(resources.cpuCores * (maxPercentage / 100));
  const minCpus = 1;

  // Ensure at least 1 CPU
  const safeCpus = Math.max(minCpus, maxCpus);

  if (requestedCpus === undefined) {
    logger.debug('Recommended CPU allocation', {
      cpuCores: resources.cpuCores,
      recommended: safeCpus,
      maxPercentage,
    });
    return safeCpus;
  }

  const allocatedCpus = Math.min(requestedCpus, safeCpus);

  if (allocatedCpus < requestedCpus) {
    logger.warn('Requested CPU count exceeds safe limit, capping allocation', {
      requested: requestedCpus,
      allocated: allocatedCpus,
      maxSafe: safeCpus,
      totalCores: resources.cpuCores,
      maxPercentage,
    });
  }

  return allocatedCpus;
}

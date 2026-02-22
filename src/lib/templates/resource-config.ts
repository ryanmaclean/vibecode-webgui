/**
 * Resource Configuration Templates
 * Provides pre-configured resource allocation presets and validation for project templates
 */

import type { VMResource } from '@/types/multi-vm';

/**
 * Resource preset sizes
 */
export type ResourcePreset = 'minimal' | 'small' | 'medium' | 'large' | 'xlarge' | 'custom';

/**
 * Resource tier for different workload types
 */
export type ResourceTier = 'development' | 'testing' | 'production' | 'ml-training' | 'ml-inference';

/**
 * Base resource requirements interface
 */
export interface ResourceRequirements {
  /** Minimum CPU cores required */
  minCpuCores: number;
  /** Recommended CPU cores */
  recommendedCpuCores: number;
  /** Minimum memory in MB */
  minMemoryMB: number;
  /** Recommended memory in MB */
  recommendedMemoryMB: number;
  /** Minimum disk space in MB */
  minDiskMB: number;
  /** Recommended disk space in MB */
  recommendedDiskMB: number;
  /** GPU requirements (if applicable) */
  gpu?: {
    required: boolean;
    minMemoryMB?: number;
    recommendedMemoryMB?: number;
    type?: string;
  };
}

/**
 * Template resource configuration
 */
export interface TemplateResourceConfig {
  /** Resource preset name */
  preset: ResourcePreset;
  /** Default tier */
  defaultTier: ResourceTier;
  /** Resource requirements by tier */
  tiers: {
    development?: VMResource;
    testing?: VMResource;
    production?: VMResource;
    'ml-training'?: VMResource;
    'ml-inference'?: VMResource;
  };
  /** Minimum requirements */
  minimumRequirements: ResourceRequirements;
  /** Whether this template supports GPU */
  supportsGpu?: boolean;
  /** Scaling recommendations */
  scaling?: {
    vertical?: {
      enabled: boolean;
      maxCpuCores?: number;
      maxMemoryMB?: number;
    };
    horizontal?: {
      enabled: boolean;
      minInstances?: number;
      maxInstances?: number;
    };
  };
}

/**
 * Minimal resource preset - for lightweight applications
 */
export const MINIMAL_PRESET: VMResource = {
  cpuCores: 1,
  memoryMB: 512,
  diskMB: 5120,
};

/**
 * Small resource preset - for simple development environments
 */
export const SMALL_PRESET: VMResource = {
  cpuCores: 1,
  memoryMB: 1024,
  diskMB: 10240,
};

/**
 * Medium resource preset - for standard development and testing
 */
export const MEDIUM_PRESET: VMResource = {
  cpuCores: 2,
  memoryMB: 2048,
  diskMB: 20480,
};

/**
 * Large resource preset - for production and resource-intensive workloads
 */
export const LARGE_PRESET: VMResource = {
  cpuCores: 4,
  memoryMB: 4096,
  diskMB: 51200,
};

/**
 * XLarge resource preset - for heavy production workloads
 */
export const XLARGE_PRESET: VMResource = {
  cpuCores: 8,
  memoryMB: 8192,
  diskMB: 102400,
};

/**
 * ML Training preset - for machine learning model training
 */
export const ML_TRAINING_PRESET: VMResource = {
  cpuCores: 8,
  memoryMB: 16384,
  diskMB: 102400,
  gpu: {
    enabled: true,
    type: 'nvidia-tesla',
    memory: 8192,
  },
};

/**
 * ML Inference preset - for machine learning model serving
 */
export const ML_INFERENCE_PRESET: VMResource = {
  cpuCores: 4,
  memoryMB: 8192,
  diskMB: 51200,
  gpu: {
    enabled: true,
    type: 'nvidia-tesla',
    memory: 4096,
  },
};

/**
 * Resource presets map
 */
export const RESOURCE_PRESETS: Record<ResourcePreset, VMResource | null> = {
  minimal: MINIMAL_PRESET,
  small: SMALL_PRESET,
  medium: MEDIUM_PRESET,
  large: LARGE_PRESET,
  xlarge: XLARGE_PRESET,
  custom: null,
};

/**
 * Default resource requirements for frontend templates
 */
export const FRONTEND_REQUIREMENTS: ResourceRequirements = {
  minCpuCores: 1,
  recommendedCpuCores: 2,
  minMemoryMB: 512,
  recommendedMemoryMB: 2048,
  minDiskMB: 5120,
  recommendedDiskMB: 10240,
};

/**
 * Default resource requirements for backend templates
 */
export const BACKEND_REQUIREMENTS: ResourceRequirements = {
  minCpuCores: 1,
  recommendedCpuCores: 2,
  minMemoryMB: 1024,
  recommendedMemoryMB: 2048,
  minDiskMB: 10240,
  recommendedDiskMB: 20480,
};

/**
 * Default resource requirements for fullstack templates
 */
export const FULLSTACK_REQUIREMENTS: ResourceRequirements = {
  minCpuCores: 2,
  recommendedCpuCores: 4,
  minMemoryMB: 2048,
  recommendedMemoryMB: 4096,
  minDiskMB: 20480,
  recommendedDiskMB: 51200,
};

/**
 * Default resource requirements for data/ML templates
 */
export const DATA_ML_REQUIREMENTS: ResourceRequirements = {
  minCpuCores: 4,
  recommendedCpuCores: 8,
  minMemoryMB: 8192,
  recommendedMemoryMB: 16384,
  minDiskMB: 51200,
  recommendedDiskMB: 102400,
  gpu: {
    required: false,
    minMemoryMB: 4096,
    recommendedMemoryMB: 8192,
    type: 'nvidia-tesla',
  },
};

/**
 * Default resource requirements for mobile templates
 */
export const MOBILE_REQUIREMENTS: ResourceRequirements = {
  minCpuCores: 2,
  recommendedCpuCores: 4,
  minMemoryMB: 2048,
  recommendedMemoryMB: 4096,
  minDiskMB: 20480,
  recommendedDiskMB: 51200,
};

/**
 * Default resource requirements for infrastructure templates
 */
export const INFRASTRUCTURE_REQUIREMENTS: ResourceRequirements = {
  minCpuCores: 2,
  recommendedCpuCores: 4,
  minMemoryMB: 2048,
  recommendedMemoryMB: 4096,
  minDiskMB: 20480,
  recommendedDiskMB: 51200,
};

/**
 * Get resource preset by name
 */
export function getResourcePreset(preset: ResourcePreset): VMResource | null {
  return RESOURCE_PRESETS[preset];
}

/**
 * Get resource requirements for a template category
 */
export function getRequirementsForCategory(
  category: 'frontend' | 'backend' | 'fullstack' | 'mobile' | 'data' | 'infrastructure'
): ResourceRequirements {
  switch (category) {
    case 'frontend':
      return FRONTEND_REQUIREMENTS;
    case 'backend':
      return BACKEND_REQUIREMENTS;
    case 'fullstack':
      return FULLSTACK_REQUIREMENTS;
    case 'data':
      return DATA_ML_REQUIREMENTS;
    case 'mobile':
      return MOBILE_REQUIREMENTS;
    case 'infrastructure':
      return INFRASTRUCTURE_REQUIREMENTS;
    default:
      return BACKEND_REQUIREMENTS;
  }
}

/**
 * Get resource configuration for a specific tier
 */
export function getResourcesForTier(
  tier: ResourceTier,
  category: 'frontend' | 'backend' | 'fullstack' | 'mobile' | 'data' | 'infrastructure'
): VMResource {
  const requirements = getRequirementsForCategory(category);

  switch (tier) {
    case 'development':
      return {
        cpuCores: requirements.minCpuCores,
        memoryMB: requirements.minMemoryMB,
        diskMB: requirements.minDiskMB,
      };
    case 'testing':
      return {
        cpuCores: Math.ceil((requirements.minCpuCores + requirements.recommendedCpuCores) / 2),
        memoryMB: Math.ceil((requirements.minMemoryMB + requirements.recommendedMemoryMB) / 2),
        diskMB: Math.ceil((requirements.minDiskMB + requirements.recommendedDiskMB) / 2),
      };
    case 'production':
      return {
        cpuCores: requirements.recommendedCpuCores,
        memoryMB: requirements.recommendedMemoryMB,
        diskMB: requirements.recommendedDiskMB,
      };
    case 'ml-training':
      return {
        ...ML_TRAINING_PRESET,
      };
    case 'ml-inference':
      return {
        ...ML_INFERENCE_PRESET,
      };
    default:
      return {
        cpuCores: requirements.recommendedCpuCores,
        memoryMB: requirements.recommendedMemoryMB,
        diskMB: requirements.recommendedDiskMB,
      };
  }
}

/**
 * Create a complete template resource configuration
 */
export function createTemplateResourceConfig(
  preset: ResourcePreset,
  category: 'frontend' | 'backend' | 'fullstack' | 'mobile' | 'data' | 'infrastructure',
  options?: Partial<TemplateResourceConfig>
): TemplateResourceConfig {
  const requirements = getRequirementsForCategory(category);
  const supportsGpu = category === 'data' || requirements.gpu !== undefined;

  const defaultTier: ResourceTier = category === 'data' ? 'ml-training' : 'development';

  return {
    preset,
    defaultTier,
    tiers: {
      development: getResourcesForTier('development', category),
      testing: getResourcesForTier('testing', category),
      production: getResourcesForTier('production', category),
      ...(supportsGpu && {
        'ml-training': getResourcesForTier('ml-training', category),
        'ml-inference': getResourcesForTier('ml-inference', category),
      }),
    },
    minimumRequirements: requirements,
    supportsGpu,
    scaling: {
      vertical: {
        enabled: true,
        maxCpuCores: requirements.recommendedCpuCores * 2,
        maxMemoryMB: requirements.recommendedMemoryMB * 2,
      },
      horizontal: {
        enabled: category !== 'data',
        minInstances: 1,
        maxInstances: category === 'infrastructure' ? 10 : 5,
      },
    },
    ...options,
  };
}

/**
 * Validate resource configuration
 */
export function validateResourceConfig(
  resources: VMResource,
  requirements: ResourceRequirements
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (resources.cpuCores < requirements.minCpuCores) {
    errors.push(
      `CPU cores (${resources.cpuCores}) below minimum requirement (${requirements.minCpuCores})`
    );
  } else if (resources.cpuCores < requirements.recommendedCpuCores) {
    warnings.push(
      `CPU cores (${resources.cpuCores}) below recommended (${requirements.recommendedCpuCores})`
    );
  }

  if (resources.memoryMB < requirements.minMemoryMB) {
    errors.push(
      `Memory (${resources.memoryMB}MB) below minimum requirement (${requirements.minMemoryMB}MB)`
    );
  } else if (resources.memoryMB < requirements.recommendedMemoryMB) {
    warnings.push(
      `Memory (${resources.memoryMB}MB) below recommended (${requirements.recommendedMemoryMB}MB)`
    );
  }

  if (resources.diskMB < requirements.minDiskMB) {
    errors.push(
      `Disk space (${resources.diskMB}MB) below minimum requirement (${requirements.minDiskMB}MB)`
    );
  } else if (resources.diskMB < requirements.recommendedDiskMB) {
    warnings.push(
      `Disk space (${resources.diskMB}MB) below recommended (${requirements.recommendedDiskMB}MB)`
    );
  }

  if (requirements.gpu?.required && !resources.gpu?.enabled) {
    errors.push('GPU is required but not enabled');
  }

  if (resources.gpu?.enabled && requirements.gpu?.minMemoryMB) {
    const gpuMemory = resources.gpu.memory || 0;
    if (gpuMemory < requirements.gpu.minMemoryMB) {
      errors.push(
        `GPU memory (${gpuMemory}MB) below minimum requirement (${requirements.gpu.minMemoryMB}MB)`
      );
    } else if (requirements.gpu.recommendedMemoryMB && gpuMemory < requirements.gpu.recommendedMemoryMB) {
      warnings.push(
        `GPU memory (${gpuMemory}MB) below recommended (${requirements.gpu.recommendedMemoryMB}MB)`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Calculate estimated cost per hour (in arbitrary units)
 * This is a simplified cost estimation based on resource allocation
 */
export function estimateResourceCost(resources: VMResource): {
  hourly: number;
  daily: number;
  monthly: number;
} {
  const cpuCost = resources.cpuCores * 0.05;
  const memoryCost = (resources.memoryMB / 1024) * 0.01;
  const diskCost = (resources.diskMB / 1024) * 0.0001;
  const gpuCost = resources.gpu?.enabled ? (resources.gpu.memory || 0) / 1024 * 0.50 : 0;

  const hourly = cpuCost + memoryCost + diskCost + gpuCost;
  const daily = hourly * 24;
  const monthly = daily * 30;

  return {
    hourly: parseFloat(hourly.toFixed(4)),
    daily: parseFloat(daily.toFixed(2)),
    monthly: parseFloat(monthly.toFixed(2)),
  };
}

/**
 * Compare two resource configurations
 */
export function compareResources(
  a: VMResource,
  b: VMResource
): {
  cpuDiff: number;
  memoryDiff: number;
  diskDiff: number;
  costDiff: number;
} {
  const costA = estimateResourceCost(a);
  const costB = estimateResourceCost(b);

  return {
    cpuDiff: a.cpuCores - b.cpuCores,
    memoryDiff: a.memoryMB - b.memoryMB,
    diskDiff: a.diskMB - b.diskMB,
    costDiff: parseFloat((costA.monthly - costB.monthly).toFixed(2)),
  };
}

/**
 * Generate environment variables for resource configuration
 */
export function generateResourceEnvVars(resources: VMResource): Array<{
  name: string;
  description: string;
  required: boolean;
  defaultValue?: string;
  example?: string;
}> {
  const envVars = [
    {
      name: 'RESOURCE_CPU_CORES',
      description: 'Number of CPU cores allocated',
      required: false,
      defaultValue: resources.cpuCores.toString(),
      example: '2',
    },
    {
      name: 'RESOURCE_MEMORY_MB',
      description: 'Memory allocation in MB',
      required: false,
      defaultValue: resources.memoryMB.toString(),
      example: '2048',
    },
    {
      name: 'RESOURCE_DISK_MB',
      description: 'Disk space allocation in MB',
      required: false,
      defaultValue: resources.diskMB.toString(),
      example: '20480',
    },
  ];

  if (resources.gpu?.enabled) {
    envVars.push(
      {
        name: 'GPU_ENABLED',
        description: 'Enable GPU support',
        required: false,
        defaultValue: 'true',
        example: 'true',
      },
      {
        name: 'GPU_MEMORY_MB',
        description: 'GPU memory allocation in MB',
        required: false,
        defaultValue: (resources.gpu.memory || 0).toString(),
        example: '8192',
      }
    );

    if (resources.gpu.type) {
      envVars.push({
        name: 'GPU_TYPE',
        description: 'GPU type/model',
        required: false,
        defaultValue: resources.gpu.type,
        example: resources.gpu.type,
      });
    }
  }

  return envVars;
}

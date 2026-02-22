/**
 * Plugin Permission Validator
 * Validates and manages plugin permissions for security enforcement
 */

import { PluginPermission, PluginSandboxConfig } from '@/types/plugin';

/**
 * All valid plugin permissions
 */
export const VALID_PERMISSIONS: readonly PluginPermission[] = [
  'filesystem:read',
  'filesystem:write',
  'network:outbound',
  'database:read',
  'database:write',
  'ai-models:access',
  'ui:inject',
  'commands:register',
  'settings:read',
  'settings:write'
] as const;

/**
 * Permission categories for grouping related permissions
 */
export const PERMISSION_CATEGORIES = {
  filesystem: ['filesystem:read', 'filesystem:write'],
  network: ['network:outbound'],
  database: ['database:read', 'database:write'],
  aiModels: ['ai-models:access'],
  ui: ['ui:inject'],
  commands: ['commands:register'],
  settings: ['settings:read', 'settings:write']
} as const;

/**
 * Permission risk levels
 */
export type PermissionRiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Permission metadata including risk level and description
 */
export interface PermissionMetadata {
  permission: PluginPermission;
  riskLevel: PermissionRiskLevel;
  description: string;
  requires?: PluginPermission[];  // Prerequisite permissions
  conflicts?: PluginPermission[];  // Mutually exclusive permissions
}

/**
 * Permission metadata registry
 */
export const PERMISSION_METADATA: Record<PluginPermission, Omit<PermissionMetadata, 'permission'>> = {
  'filesystem:read': {
    riskLevel: 'medium',
    description: 'Read files from the filesystem within allowed paths'
  },
  'filesystem:write': {
    riskLevel: 'high',
    description: 'Write, modify, or delete files within allowed paths',
    requires: ['filesystem:read']
  },
  'network:outbound': {
    riskLevel: 'medium',
    description: 'Make outbound network requests to allowed hosts'
  },
  'database:read': {
    riskLevel: 'medium',
    description: 'Read data from the database'
  },
  'database:write': {
    riskLevel: 'high',
    description: 'Write, modify, or delete data in the database',
    requires: ['database:read']
  },
  'ai-models:access': {
    riskLevel: 'medium',
    description: 'Access AI model APIs and make inference requests'
  },
  'ui:inject': {
    riskLevel: 'high',
    description: 'Inject custom UI components into the application'
  },
  'commands:register': {
    riskLevel: 'low',
    description: 'Register custom commands in the command palette'
  },
  'settings:read': {
    riskLevel: 'low',
    description: 'Read user and workspace settings'
  },
  'settings:write': {
    riskLevel: 'medium',
    description: 'Modify user and workspace settings',
    requires: ['settings:read']
  }
};

/**
 * Permission validation result
 */
export interface PermissionValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missingPrerequisites?: Array<{
    requested: PluginPermission;
    requires: PluginPermission[];
  }>;
  conflicts?: Array<{
    permission1: PluginPermission;
    permission2: PluginPermission;
  }>;
}

/**
 * Sandbox configuration validation result
 */
export interface SandboxConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Check if a string is a valid plugin permission
 */
export function isValidPermission(permission: string): permission is PluginPermission {
  return VALID_PERMISSIONS.includes(permission as PluginPermission);
}

/**
 * Get permission metadata
 */
export function getPermissionMetadata(permission: PluginPermission): PermissionMetadata {
  return {
    permission,
    ...PERMISSION_METADATA[permission]
  };
}

/**
 * Get all permissions in a category
 */
export function getPermissionsByCategory(category: keyof typeof PERMISSION_CATEGORIES): readonly PluginPermission[] {
  return PERMISSION_CATEGORIES[category];
}

/**
 * Check if a permission requires other permissions
 */
export function getPermissionPrerequisites(permission: PluginPermission): PluginPermission[] {
  return PERMISSION_METADATA[permission].requires || [];
}

/**
 * Check if permissions have any conflicts
 */
export function getPermissionConflicts(permission: PluginPermission): PluginPermission[] {
  return PERMISSION_METADATA[permission].conflicts || [];
}

/**
 * Validate a list of requested permissions
 */
export function validatePermissions(permissions: string[]): PermissionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingPrerequisites: Array<{ requested: PluginPermission; requires: PluginPermission[] }> = [];
  const conflicts: Array<{ permission1: PluginPermission; permission2: PluginPermission }> = [];

  // Check for empty permissions array
  if (permissions.length === 0) {
    warnings.push('Plugin has no permissions - it will have very limited capabilities');
  }

  // Check for duplicate permissions
  const uniquePermissions = new Set(permissions);
  if (uniquePermissions.size !== permissions.length) {
    warnings.push('Duplicate permissions detected - they will be deduplicated');
  }

  // Validate each permission
  const validPermissions: PluginPermission[] = [];
  for (const permission of uniquePermissions) {
    if (!isValidPermission(permission)) {
      errors.push(`Invalid permission: '${permission}'. Valid permissions are: ${VALID_PERMISSIONS.join(', ')}`);
    } else {
      validPermissions.push(permission);
    }
  }

  // Check for missing prerequisites
  for (const permission of validPermissions) {
    const prerequisites = getPermissionPrerequisites(permission);
    const missingPrereqs = prerequisites.filter(prereq => !validPermissions.includes(prereq));

    if (missingPrereqs.length > 0) {
      missingPrerequisites.push({
        requested: permission,
        requires: missingPrereqs
      });
      errors.push(
        `Permission '${permission}' requires ${missingPrereqs.map(p => `'${p}'`).join(', ')} but ${missingPrereqs.length === 1 ? 'it is' : 'they are'} not included`
      );
    }
  }

  // Check for conflicts
  for (let i = 0; i < validPermissions.length; i++) {
    const permission1 = validPermissions[i];
    const conflictsWith = getPermissionConflicts(permission1);

    for (let j = i + 1; j < validPermissions.length; j++) {
      const permission2 = validPermissions[j];
      if (conflictsWith.includes(permission2)) {
        conflicts.push({ permission1, permission2 });
        errors.push(`Permissions '${permission1}' and '${permission2}' are mutually exclusive`);
      }
    }
  }

  // Security warnings for high-risk permissions
  const highRiskPermissions = validPermissions.filter(
    p => PERMISSION_METADATA[p].riskLevel === 'high' || PERMISSION_METADATA[p].riskLevel === 'critical'
  );

  if (highRiskPermissions.length > 0) {
    warnings.push(
      `Plugin requests high-risk permissions: ${highRiskPermissions.join(', ')}. Review carefully before installation.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    missingPrerequisites: missingPrerequisites.length > 0 ? missingPrerequisites : undefined,
    conflicts: conflicts.length > 0 ? conflicts : undefined
  };
}

/**
 * Validate sandbox configuration for requested permissions
 */
export function validateSandboxConfig(
  permissions: PluginPermission[],
  config?: Partial<PluginSandboxConfig>
): SandboxConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config) {
    return { valid: true, errors, warnings };
  }

  // Validate filesystem permissions
  const hasFilesystemRead = permissions.includes('filesystem:read');
  const hasFilesystemWrite = permissions.includes('filesystem:write');

  if ((hasFilesystemRead || hasFilesystemWrite) && config.allowedPaths) {
    if (!Array.isArray(config.allowedPaths)) {
      errors.push('allowedPaths must be an array of strings');
    } else if (config.allowedPaths.length === 0) {
      warnings.push('allowedPaths is empty - filesystem access will be limited to plugin data directory');
    } else {
      // Validate each path
      for (const path of config.allowedPaths) {
        if (typeof path !== 'string') {
          errors.push(`Invalid path in allowedPaths: ${path} (must be a string)`);
        } else if (path.includes('..')) {
          errors.push(`Path contains directory traversal: ${path}`);
        } else if (path.trim() === '') {
          errors.push('Empty path in allowedPaths');
        }
      }
    }
  }

  // Validate network permissions
  const hasNetworkAccess = permissions.includes('network:outbound');

  if (hasNetworkAccess && config.allowedHosts) {
    if (!Array.isArray(config.allowedHosts)) {
      errors.push('allowedHosts must be an array of strings');
    } else if (config.allowedHosts.length === 0) {
      warnings.push('allowedHosts is empty - all network access will be blocked');
    } else {
      // Validate each host
      for (const host of config.allowedHosts) {
        if (typeof host !== 'string') {
          errors.push(`Invalid host in allowedHosts: ${host} (must be a string)`);
        } else if (host.trim() === '') {
          errors.push('Empty host in allowedHosts');
        } else if (host === '*') {
          warnings.push('Wildcard host (*) allows access to all domains - this is a security risk');
        }
      }
    }
  }

  // Validate timeout
  if (config.timeout !== undefined) {
    if (typeof config.timeout !== 'number' || config.timeout <= 0) {
      errors.push('timeout must be a positive number');
    } else if (config.timeout > 300000) {  // 5 minutes
      warnings.push('timeout is very high (>5 minutes) - consider reducing for better resource management');
    }
  }

  // Validate memory limit
  if (config.memoryLimit !== undefined) {
    if (typeof config.memoryLimit !== 'number' || config.memoryLimit <= 0) {
      errors.push('memoryLimit must be a positive number');
    } else if (config.memoryLimit > 1024) {  // 1 GB
      warnings.push('memoryLimit is very high (>1GB) - consider reducing to prevent resource exhaustion');
    } else if (config.memoryLimit < 64) {  // 64 MB
      warnings.push('memoryLimit is very low (<64MB) - plugin may fail due to insufficient memory');
    }
  }

  // Validate CPU limit
  if (config.cpuLimit !== undefined) {
    if (typeof config.cpuLimit !== 'number' || config.cpuLimit <= 0) {
      errors.push('cpuLimit must be a positive number');
    } else if (config.cpuLimit > 60000) {  // 60 seconds
      warnings.push('cpuLimit is very high (>60s) - consider reducing for better resource management');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Check if a specific permission is granted
 */
export function hasPermission(
  grantedPermissions: PluginPermission[],
  requiredPermission: PluginPermission
): boolean {
  return grantedPermissions.includes(requiredPermission);
}

/**
 * Check if all required permissions are granted
 */
export function hasAllPermissions(
  grantedPermissions: PluginPermission[],
  requiredPermissions: PluginPermission[]
): boolean {
  return requiredPermissions.every(permission =>
    grantedPermissions.includes(permission)
  );
}

/**
 * Check if any of the required permissions are granted
 */
export function hasAnyPermission(
  grantedPermissions: PluginPermission[],
  requiredPermissions: PluginPermission[]
): boolean {
  return requiredPermissions.some(permission =>
    grantedPermissions.includes(permission)
  );
}

/**
 * Filter granted permissions to only valid ones
 */
export function filterValidPermissions(permissions: string[]): PluginPermission[] {
  return permissions.filter(isValidPermission);
}

/**
 * Get permissions by risk level
 */
export function getPermissionsByRiskLevel(riskLevel: PermissionRiskLevel): PluginPermission[] {
  return VALID_PERMISSIONS.filter(
    permission => PERMISSION_METADATA[permission].riskLevel === riskLevel
  );
}

/**
 * Calculate overall risk score for a set of permissions
 */
export function calculatePermissionRiskScore(permissions: PluginPermission[]): number {
  const riskScores: Record<PermissionRiskLevel, number> = {
    low: 1,
    medium: 3,
    high: 7,
    critical: 10
  };

  return permissions.reduce((score, permission) => {
    const metadata = PERMISSION_METADATA[permission];
    return score + riskScores[metadata.riskLevel];
  }, 0);
}

/**
 * Get human-readable permission summary
 */
export function getPermissionSummary(permissions: PluginPermission[]): string {
  if (permissions.length === 0) {
    return 'No permissions requested';
  }

  const categories = Object.entries(PERMISSION_CATEGORIES).filter(([_, categoryPermissions]) =>
    categoryPermissions.some(p => permissions.includes(p))
  );

  const summary = categories.map(([category]) => {
    const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
    return categoryName;
  });

  return `Can access: ${summary.join(', ')}`;
}

/**
 * Validate and sanitize permissions list
 */
export function sanitizePermissions(permissions: string[]): {
  valid: PluginPermission[];
  invalid: string[];
} {
  const valid: PluginPermission[] = [];
  const invalid: string[] = [];

  const uniquePermissions = Array.from(new Set(permissions));

  for (const permission of uniquePermissions) {
    if (isValidPermission(permission)) {
      valid.push(permission);
    } else {
      invalid.push(permission);
    }
  }

  return { valid, invalid };
}

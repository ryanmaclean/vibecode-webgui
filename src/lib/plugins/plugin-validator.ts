/**
 * Plugin Manifest Validator
 * Validates plugin.json manifest schema using Zod and checks required fields
 */

import { z } from 'zod';
import {
  PluginManifest,
  PluginType,
  PluginPermission,
  PluginValidationResult
} from '@/types/plugin';
import {
  validatePermissions,
  isValidPermission,
  VALID_PERMISSIONS
} from './plugin-permissions';

/**
 * Valid plugin types
 */
const VALID_PLUGIN_TYPES: readonly PluginType[] = [
  'ai-model',
  'integration',
  'workflow',
  'ui-extension',
  'code-generator',
  'linter',
  'formatter',
  'other'
] as const;

/**
 * Zod schema for plugin author
 */
const pluginAuthorSchema = z.object({
  name: z.string().min(1, 'Author name is required').max(100),
  email: z.string().email().optional(),
  url: z.string().url().optional()
});

/**
 * Zod schema for plugin repository
 */
const pluginRepositorySchema = z.object({
  type: z.string().min(1).max(50),
  url: z.string().url()
});

/**
 * Zod schema for plugin engines
 */
const pluginEnginesSchema = z.object({
  node: z.string().optional(),
  vibecode: z.string().optional()
});

/**
 * Zod schema for plugin permission
 */
const pluginPermissionSchema = z.string().refine(
  (val): val is PluginPermission => isValidPermission(val),
  (val) => ({
    message: `Invalid permission: '${val}'. Valid permissions are: ${VALID_PERMISSIONS.join(', ')}`
  })
);

/**
 * Zod schema for plugin type
 */
const pluginTypeSchema = z.enum([
  'ai-model',
  'integration',
  'workflow',
  'ui-extension',
  'code-generator',
  'linter',
  'formatter',
  'other'
] as const);

/**
 * Zod schema for plugin manifest
 */
const pluginManifestSchema = z.object({
  id: z.string()
    .min(1, 'Plugin ID is required')
    .max(100)
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Plugin ID must contain only alphanumeric characters, hyphens, and underscores'
    ),
  name: z.string()
    .min(1, 'Plugin name is required')
    .max(100),
  version: z.string()
    .min(1, 'Plugin version is required')
    .regex(
      /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/,
      'Version must follow semantic versioning (e.g., 1.0.0, 1.0.0-beta.1)'
    ),
  description: z.string()
    .min(1, 'Plugin description is required')
    .max(500),
  author: pluginAuthorSchema,
  type: pluginTypeSchema,
  main: z.string()
    .min(1, 'Main entry point is required')
    .refine(
      (path) => !path.includes('..'),
      'Main path must not contain directory traversal sequences'
    )
    .refine(
      (path) => path.endsWith('.js') || path.endsWith('.ts') || path.endsWith('.mjs'),
      'Main entry point must be a JavaScript or TypeScript file'
    ),
  permissions: z.array(pluginPermissionSchema),
  dependencies: z.record(z.string(), z.string()).optional(),
  peerDependencies: z.record(z.string(), z.string()).optional(),
  engines: pluginEnginesSchema.optional(),
  repository: pluginRepositorySchema.optional(),
  license: z.string().max(50).optional(),
  keywords: z.array(z.string().max(50)).max(20).optional(),
  homepage: z.string().url().optional(),
  icon: z.string().max(500).optional()
});

/**
 * Validate plugin manifest against schema
 */
export function validatePluginManifest(manifest: unknown): PluginValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if manifest is an object
  if (typeof manifest !== 'object' || manifest === null) {
    return {
      valid: false,
      errors: ['Plugin manifest must be a valid JSON object'],
      warnings: []
    };
  }

  // Validate against Zod schema
  const result = pluginManifestSchema.safeParse(manifest);

  if (!result.success) {
    // Extract validation errors from Zod
    const zodErrors = result.error.errors.map(err => {
      const path = err.path.join('.');
      return path ? `${path}: ${err.message}` : err.message;
    });
    errors.push(...zodErrors);
  }

  // If basic schema validation fails, return early
  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  // At this point, we know the manifest matches the schema
  const validManifest = result.data as PluginManifest;

  // Validate permissions using permission validator
  const permissionResult = validatePermissions(validManifest.permissions);
  errors.push(...permissionResult.errors);
  warnings.push(...permissionResult.warnings);

  // Additional custom validations

  // Warn if no description keywords for discoverability
  if (!validManifest.keywords || validManifest.keywords.length === 0) {
    warnings.push('No keywords provided - consider adding keywords for better discoverability');
  }

  // Warn if no license specified
  if (!validManifest.license) {
    warnings.push('No license specified - consider adding a license field');
  }

  // Warn if no repository URL
  if (!validManifest.repository) {
    warnings.push('No repository URL provided - users may have difficulty finding source code');
  }

  // Check for version constraints
  if (validManifest.engines?.vibecode) {
    try {
      // Basic semver validation
      const versionPattern = /^[><=^~]?\d+\.\d+\.\d+/;
      if (!versionPattern.test(validManifest.engines.vibecode)) {
        warnings.push(
          `VibeCode version constraint '${validManifest.engines.vibecode}' may not be valid semver`
        );
      }
    } catch (e) {
      warnings.push('Unable to validate VibeCode version constraint');
    }
  }

  // Check for Node.js version constraints
  if (validManifest.engines?.node) {
    try {
      const versionPattern = /^[><=^~]?\d+/;
      if (!versionPattern.test(validManifest.engines.node)) {
        warnings.push(
          `Node.js version constraint '${validManifest.engines.node}' may not be valid semver`
        );
      }
    } catch (e) {
      warnings.push('Unable to validate Node.js version constraint');
    }
  }

  // Validate dependencies
  if (validManifest.dependencies) {
    const depCount = Object.keys(validManifest.dependencies).length;
    if (depCount > 50) {
      warnings.push(`Plugin has ${depCount} dependencies - consider reducing for better performance`);
    }
  }

  // Check for potentially dangerous dependency names
  if (validManifest.dependencies) {
    const dangerousPatterns = ['eval', 'vm2', 'child_process'];
    const dangerousDeps = Object.keys(validManifest.dependencies).filter(dep =>
      dangerousPatterns.some(pattern => dep.includes(pattern))
    );
    if (dangerousDeps.length > 0) {
      warnings.push(
        `Plugin dependencies include potentially dangerous packages: ${dangerousDeps.join(', ')}. Review carefully.`
      );
    }
  }

  // Validate icon path/URL
  if (validManifest.icon) {
    const isUrl = validManifest.icon.startsWith('http://') || validManifest.icon.startsWith('https://');
    const isRelativePath = !validManifest.icon.startsWith('/') && !validManifest.icon.includes('..');

    if (!isUrl && !isRelativePath) {
      errors.push('Icon must be a valid URL or relative path (no absolute paths or directory traversal)');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate plugin manifest from JSON string
 */
export function validatePluginManifestJSON(jsonString: string): PluginValidationResult {
  try {
    const manifest = JSON.parse(jsonString);
    return validatePluginManifest(manifest);
  } catch (error) {
    return {
      valid: false,
      errors: [`Failed to parse plugin manifest JSON: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings: []
    };
  }
}

/**
 * Check if manifest has required fields for a specific plugin type
 */
export function validatePluginTypeRequirements(manifest: PluginManifest): PluginValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  switch (manifest.type) {
    case 'ai-model':
      if (!manifest.permissions.includes('ai-models:access')) {
        warnings.push("AI model plugins typically require 'ai-models:access' permission");
      }
      break;

    case 'ui-extension':
      if (!manifest.permissions.includes('ui:inject')) {
        warnings.push("UI extension plugins typically require 'ui:inject' permission");
      }
      break;

    case 'integration':
      if (!manifest.permissions.includes('network:outbound')) {
        warnings.push("Integration plugins typically require 'network:outbound' permission");
      }
      break;

    case 'code-generator':
    case 'formatter':
    case 'linter':
      if (!manifest.permissions.includes('filesystem:write')) {
        warnings.push(`${manifest.type} plugins typically require 'filesystem:write' permission`);
      }
      break;

    case 'workflow':
      if (manifest.permissions.length === 0) {
        warnings.push('Workflow plugins typically require at least one permission');
      }
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Perform comprehensive manifest validation
 */
export function validateManifestComprehensive(manifest: unknown): PluginValidationResult {
  // First validate basic structure and schema
  const basicValidation = validatePluginManifest(manifest);

  if (!basicValidation.valid) {
    return basicValidation;
  }

  // If basic validation passes, perform type-specific validation
  const typeValidation = validatePluginTypeRequirements(manifest as PluginManifest);

  // Combine results
  return {
    valid: basicValidation.valid && typeValidation.valid,
    errors: [...basicValidation.errors, ...typeValidation.errors],
    warnings: [...basicValidation.warnings, ...typeValidation.warnings]
  };
}

/**
 * Sanitize and normalize manifest data
 */
export function sanitizeManifest(manifest: unknown): PluginManifest | null {
  const validation = validatePluginManifest(manifest);

  if (!validation.valid) {
    return null;
  }

  // At this point, manifest is valid and matches PluginManifest type
  const validManifest = manifest as PluginManifest;

  // Normalize data
  return {
    ...validManifest,
    id: validManifest.id.toLowerCase().trim(),
    name: validManifest.name.trim(),
    version: validManifest.version.trim(),
    description: validManifest.description.trim(),
    // Remove duplicate permissions
    permissions: Array.from(new Set(validManifest.permissions)),
    // Normalize keywords
    keywords: validManifest.keywords?.map(k => k.toLowerCase().trim()),
    // Ensure main path uses forward slashes
    main: validManifest.main.replace(/\\/g, '/')
  };
}

/**
 * Get validation summary for display
 */
export function getValidationSummary(result: PluginValidationResult): string {
  if (result.valid) {
    const warningText = result.warnings.length > 0
      ? ` (${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'})`
      : '';
    return `✓ Plugin manifest is valid${warningText}`;
  }

  return `✗ Plugin manifest is invalid (${result.errors.length} error${result.errors.length === 1 ? '' : 's'})`;
}

/**
 * Check if a plugin type is valid
 */
export function isValidPluginType(type: string): type is PluginType {
  return VALID_PLUGIN_TYPES.includes(type as PluginType);
}

/**
 * Tests for Plugin Permissions
 * @jest-environment node
 */

import {
  validatePermissions,
  validateSandboxConfig,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  filterValidPermissions,
  getPermissionsByRiskLevel,
  calculatePermissionRiskScore,
  getPermissionSummary,
  sanitizePermissions,
  isValidPermission,
  getPermissionMetadata,
  getPermissionsByCategory,
  getPermissionPrerequisites,
  getPermissionConflicts,
} from '@/lib/plugins/plugin-permissions';
import { PluginPermission } from '@/types/plugin';

describe('Plugin Permissions', () => {
  describe('isValidPermission', () => {
    it('should validate correct permissions', () => {
      expect(isValidPermission('filesystem:read')).toBe(true);
      expect(isValidPermission('network:outbound')).toBe(true);
      expect(isValidPermission('commands:register')).toBe(true);
    });

    it('should reject invalid permissions', () => {
      expect(isValidPermission('invalid:permission')).toBe(false);
      expect(isValidPermission('filesystem:execute')).toBe(false);
      expect(isValidPermission('')).toBe(false);
    });
  });

  describe('validate Permissions', () => {
    it('should validate valid permissions array', () => {
      const result = validatePermissions(['filesystem:read', 'network:outbound']);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject manifest with missing fields', () => {
      const result = validatePermissions(['invalid:permission', 'filesystem:read']);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Invalid permission');
    });

    it('should check permission prerequisites', () => {
      // filesystem:write requires filesystem:read
      const result = validatePermissions(['filesystem:write']);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('requires'))).toBe(true);
      expect(result.missingPrerequisites).toBeDefined();
    });

    it('should pass when prerequisites are met', () => {
      const result = validatePermissions(['filesystem:read', 'filesystem:write']);
      expect(result.valid).toBe(true);
    });

    it('should warn about high-risk permissions', () => {
      const result = validatePermissions(['filesystem:write']);
      // Will fail due to missing prereq, but should also have warning about high-risk
      expect(result.warnings.some(w => w.includes('high-risk'))).toBe(true);
    });

    it('should warn about duplicate permissions', () => {
      const result = validatePermissions(['filesystem:read', 'filesystem:read']);
      expect(result.warnings.some(w => w.includes('Duplicate'))).toBe(true);
    });

    it('should warn about empty permissions', () => {
      const result = validatePermissions([]);
      expect(result.warnings.some(w => w.includes('no permissions'))).toBe(true);
    });
  });

  describe('validateSandboxConfig', () => {
    it('should validate sandbox config with filesystem permissions', () => {
      const result = validateSandboxConfig(
        ['filesystem:read'],
        { allowedPaths: ['/allowed/path'] }
      );
      expect(result.valid).toBe(true);
    });

    it('should reject invalid allowedPaths', () => {
      const result = validateSandboxConfig(
        ['filesystem:read'],
        { allowedPaths: ['../malicious/path'] }
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('directory traversal'))).toBe(true);
    });

    it('should reject empty paths', () => {
      const result = validateSandboxConfig(
        ['filesystem:read'],
        { allowedPaths: [''] }
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Empty path'))).toBe(true);
    });

    it('should validate network permissions', () => {
      const result = validateSandboxConfig(
        ['network:outbound'],
        { allowedHosts: ['api.example.com'] }
      );
      expect(result.valid).toBe(true);
    });

    it('should warn about wildcard hosts', () => {
      const result = validateSandboxConfig(
        ['network:outbound'],
        { allowedHosts: ['*'] }
      );
      expect(result.warnings.some(w => w.includes('Wildcard'))).toBe(true);
    });

    it('should validate timeout', () => {
      const result = validateSandboxConfig(
        [],
        { timeout: -100 }
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('timeout'))).toBe(true);
    });

    it('should validate memory limit', () => {
      const result = validateSandboxConfig(
        [],
        { memoryLimit: -100 }
      );
      expect(result.valid).toBe(false);
    });

    it('should warn about very high memory limit', () => {
      const result = validateSandboxConfig(
        [],
        { memoryLimit: 2000 }
      );
      expect(result.warnings.some(w => w.includes('very high'))).toBe(true);
    });
  });

  describe('hasPermission', () => {
    it('should check if permission is granted', () => {
      const granted: PluginPermission[] = ['filesystem:read', 'network:outbound'];
      expect(hasPermission(granted, 'filesystem:read')).toBe(true);
      expect(hasPermission(granted, 'database:write')).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true when all permissions are granted', () => {
      const granted: PluginPermission[] = ['filesystem:read', 'network:outbound'];
      expect(hasAllPermissions(granted, ['filesystem:read', 'network:outbound'])).toBe(true);
    });

    it('should return false when some permissions are missing', () => {
      const granted: PluginPermission[] = ['filesystem:read'];
      expect(hasAllPermissions(granted, ['filesystem:read', 'network:outbound'])).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true when at least one permission is granted', () => {
      const granted: PluginPermission[] = ['filesystem:read'];
      expect(hasAnyPermission(granted, ['filesystem:read', 'network:outbound'])).toBe(true);
    });

    it('should return false when no permissions are granted', () => {
      const granted: PluginPermission[] = ['filesystem:read'];
      expect(hasAnyPermission(granted, ['network:outbound', 'database:write'])).toBe(false);
    });
  });

  describe('filterValidPermissions', () => {
    it('should filter to only valid permissions', () => {
      const permissions = ['filesystem:read', 'invalid:perm', 'network:outbound'];
      const result = filterValidPermissions(permissions);
      expect(result).toEqual(['filesystem:read', 'network:outbound']);
    });
  });

  describe('getPermissionsByRiskLevel', () => {
    it('should get permissions by risk level', () => {
      const lowRisk = getPermissionsByRiskLevel('low');
      expect(lowRisk.length).toBeGreaterThan(0);
      expect(lowRisk).toContain('commands:register');

      const highRisk = getPermissionsByRiskLevel('high');
      expect(highRisk).toContain('filesystem:write');
    });
  });

  describe('calculatePermissionRiskScore', () => {
    it('should calculate risk score correctly', () => {
      const lowRiskPerms: PluginPermission[] = ['commands:register'];
      const lowScore = calculatePermissionRiskScore(lowRiskPerms);

      const highRiskPerms: PluginPermission[] = ['filesystem:write', 'database:write'];
      const highScore = calculatePermissionRiskScore(highRiskPerms);

      expect(highScore).toBeGreaterThan(lowScore);
    });

    it('should return 0 for no permissions', () => {
      expect(calculatePermissionRiskScore([])).toBe(0);
    });
  });

  describe('getPermissionSummary', () => {
    it('should generate human-readable summary', () => {
      const permissions: PluginPermission[] = ['filesystem:read', 'network:outbound'];
      const summary = getPermissionSummary(permissions);
      expect(summary).toContain('Can access:');
      expect(summary).toContain('Filesystem');
      expect(summary).toContain('Network');
    });

    it('should handle empty permissions', () => {
      const summary = getPermissionSummary([]);
      expect(summary).toContain('No permissions');
    });
  });

  describe('sanitizePermissions', () => {
    it('should separate valid and invalid permissions', () => {
      const permissions = ['filesystem:read', 'invalid:perm', 'network:outbound', 'bad:permission'];
      const result = sanitizePermissions(permissions);

      expect(result.valid).toEqual(['filesystem:read', 'network:outbound']);
      expect(result.invalid).toEqual(['invalid:perm', 'bad:permission']);
    });

    it('should deduplicate permissions', () => {
      const permissions = ['filesystem:read', 'filesystem:read', 'network:outbound'];
      const result = sanitizePermissions(permissions);
      expect(result.valid).toHaveLength(2);
    });
  });

  describe('getPermissionMetadata', () => {
    it('should return metadata for permission', () => {
      const metadata = getPermissionMetadata('filesystem:write');
      expect(metadata.permission).toBe('filesystem:write');
      expect(metadata.riskLevel).toBe('high');
      expect(metadata.description).toBeDefined();
      expect(metadata.requires).toContain('filesystem:read');
    });
  });

  describe('getPermissionsByCategory', () => {
    it('should return permissions for a category', () => {
      const filesystemPerms = getPermissionsByCategory('filesystem');
      expect(filesystemPerms).toContain('filesystem:read');
      expect(filesystemPerms).toContain('filesystem:write');
    });
  });

  describe('getPermissionPrerequisites', () => {
    it('should return prerequisites for permission', () => {
      const prereqs = getPermissionPrerequisites('filesystem:write');
      expect(prereqs).toContain('filesystem:read');
    });

    it('should return empty array for permissions without prereqs', () => {
      const prereqs = getPermissionPrerequisites('filesystem:read');
      expect(prereqs).toEqual([]);
    });
  });

  describe('getPermissionConflicts', () => {
    it('should return conflicts for permission', () => {
      // Currently no conflicts defined, but test the function
      const conflicts = getPermissionConflicts('filesystem:read');
      expect(Array.isArray(conflicts)).toBe(true);
    });
  });
});

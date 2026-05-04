/**
 * Tests for Plugin Validator
 * @jest-environment node
 */

import {
  validatePluginManifest,
  validatePluginManifestJSON,
  isValidPluginType,
} from '@/lib/plugins/plugin-validator';
import { PluginManifest } from '@/types/plugin';

describe('Plugin Validator', () => {
  const createValidManifest = (overrides: Partial<PluginManifest> = {}): PluginManifest => ({
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin for unit testing',
    author: {
      name: 'Test Author',
      email: 'test@example.com',
    },
    type: 'other',
    main: 'index.js',
    permissions: ['commands:register'],
    ...overrides,
  });

  describe('validatePluginManifest', () => {
    it('should validate correct manifest', () => {
      const manifest = createValidManifest();
      const result = validatePluginManifest(manifest);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject manifest with missing required fields', () => {
      const invalidManifest = { name: 'Test' } as any;
      const result = validatePluginManifest(invalidManifest);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate semantic versioning', () => {
      const validVersions = ['1.0.0', '2.1.3', '0.0.1', '1.0.0-beta.1', '1.0.0+build.123'];
      validVersions.forEach(version => {
        const manifest = createValidManifest({ version });
        const result = validatePluginManifest(manifest);
        expect(result.valid).toBe(true);
      });
    });

    it('should reject invalid semantic versioning', () => {
      const invalidVersions = ['1.0', 'v1.0.0', '1.0.0.0', 'latest'];
      invalidVersions.forEach(version => {
        const manifest = createValidManifest({ version });
        const result = validatePluginManifest(manifest);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.toLowerCase().includes('version'))).toBe(true);
      });
    });

    it('should validate permission array', () => {
      const manifest = createValidManifest({
        permissions: ['filesystem:read', 'network:outbound'],
      });
      const result = validatePluginManifest(manifest);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid permissions', () => {
      const manifest = createValidManifest({
        permissions: ['invalid:permission'] as any,
      });
      const result = validatePluginManifest(manifest);
      expect(result.valid).toBe(false);
    });

    it('should validate plugin ID format', () => {
      const validIds = ['my-plugin', 'plugin_123', 'test-plugin-v2'];
      validIds.forEach(id => {
        const manifest = createValidManifest({ id });
        const result = validatePluginManifest(manifest);
        expect(result.valid).toBe(true);
      });
    });

    it('should reject invalid plugin ID format', () => {
      const invalidIds = ['my plugin', 'plugin@123', 'test/plugin', 'plugin$'];
      invalidIds.forEach(id => {
        const manifest = createValidManifest({ id });
        const result = validatePluginManifest(manifest);
        expect(result.valid).toBe(false);
      });
    });

    it('should validate plugin types', () => {
      const validTypes = ['ai-model', 'integration', 'workflow', 'ui-extension', 'other'];
      validTypes.forEach(type => {
        const manifest = createValidManifest({ type: type as any });
        const result = validatePluginManifest(manifest);
        expect(result.valid).toBe(true);
      });
    });

    it('should warn about dangerous dependencies', () => {
      const manifest = createValidManifest({
        dependencies: {
          'child_process': '*',
        },
      });
      const result = validatePluginManifest(manifest);
      expect(result.warnings.some(w => w.toLowerCase().includes('dangerous'))).toBe(true);
    });

    it('should validate author object', () => {
      const manifest = createValidManifest({
        author: {
          name: 'John Doe',
          email: 'john@example.com',
          url: 'https://example.com',
        },
      });
      const result = validatePluginManifest(manifest);
      expect(result.valid).toBe(true);
    });

    it('should accept author as string', () => {
      const manifest = createValidManifest({
        author: 'John Doe',
      });
      const result = validatePluginManifest(manifest);
      expect(result.valid).toBe(true);
    });
  });

  describe('validatePluginManifestJSON', () => {
    it('should parse and validate JSON string', () => {
      const manifest = createValidManifest();
      const jsonString = JSON.stringify(manifest);
      const result = validatePluginManifestJSON(jsonString);

      expect(result.valid).toBe(true);
      expect(result.manifest).toEqual(manifest);
    });

    it('should reject invalid JSON', () => {
      const result = validatePluginManifestJSON('{ invalid json }');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('JSON'))).toBe(true);
    });

    it('should validate parsed manifest', () => {
      const invalidManifest = { name: 'Test' };
      const jsonString = JSON.stringify(invalidManifest);
      const result = validatePluginManifestJSON(jsonString);

      expect(result.valid).toBe(false);
    });
  });

  describe('isValidPluginType', () => {
    it('should validate plugin types', () => {
      expect(isValidPluginType('ai-model')).toBe(true);
      expect(isValidPluginType('workflow')).toBe(true);
      expect(isValidPluginType('other')).toBe(true);
    });

    it('should reject invalid types', () => {
      expect(isValidPluginType('invalid')).toBe(false);
      expect(isValidPluginType('')).toBe(false);
    });
  });

  describe('sanitizeManifest', () => {
    it.todo('should normalize manifest fields - requires sanitizeManifest to be exported');
  });

  describe('getValidationSummary', () => {
    it.todo('should provide validation summary - requires getValidationSummary to be exported');
  });
});

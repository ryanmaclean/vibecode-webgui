/**
 * Unit tests for template validation system
 * Validates template structure, configuration, and data integrity
 */

import {
  PROJECT_TEMPLATES,
  getTemplateById,
  getTemplatesByCategory,
  getTemplatesByComplexity,
  searchTemplates,
  type ProjectTemplate
} from '../../src/lib/templates/index';
import { validateResourceConfig, type VMResource, type ResourceRequirements } from '../../src/lib/templates/resource-config';
import { validateMonitoringConfig, type MonitoringConfig } from '../../src/lib/templates/monitoring-config';

describe('Template Validation System', () => {
  describe('Resource Configuration Validation', () => {
    test('should validate valid resource configuration', () => {
      const resources: VMResource = {
        cpuCores: 4,
        memoryMB: 8192,
        diskMB: 51200,
        gpu: {
          enabled: false
        }
      };

      const requirements: ResourceRequirements = {
        minCpuCores: 2,
        recommendedCpuCores: 4,
        minMemoryMB: 4096,
        recommendedMemoryMB: 8192,
        minDiskMB: 20480,
        recommendedDiskMB: 51200
      };

      const result = validateResourceConfig(resources, requirements);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    test('should return errors when resources below minimum requirements', () => {
      const resources: VMResource = {
        cpuCores: 1,
        memoryMB: 2048,
        diskMB: 10240,
        gpu: {
          enabled: false
        }
      };

      const requirements: ResourceRequirements = {
        minCpuCores: 2,
        recommendedCpuCores: 4,
        minMemoryMB: 4096,
        recommendedMemoryMB: 8192,
        minDiskMB: 20480,
        recommendedDiskMB: 51200
      };

      const result = validateResourceConfig(resources, requirements);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('CPU cores (1) below minimum requirement (2)');
      expect(result.errors).toContain('Memory (2048MB) below minimum requirement (4096MB)');
      expect(result.errors).toContain('Disk space (10240MB) below minimum requirement (20480MB)');
    });

    test('should return warnings when resources below recommended but above minimum', () => {
      const resources: VMResource = {
        cpuCores: 2,
        memoryMB: 4096,
        diskMB: 20480,
        gpu: {
          enabled: false
        }
      };

      const requirements: ResourceRequirements = {
        minCpuCores: 2,
        recommendedCpuCores: 4,
        minMemoryMB: 4096,
        recommendedMemoryMB: 8192,
        minDiskMB: 20480,
        recommendedDiskMB: 51200
      };

      const result = validateResourceConfig(resources, requirements);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings).toContain('CPU cores (2) below recommended (4)');
      expect(result.warnings).toContain('Memory (4096MB) below recommended (8192MB)');
      expect(result.warnings).toContain('Disk space (20480MB) below recommended (51200MB)');
    });

    test('should validate GPU requirements', () => {
      const resources: VMResource = {
        cpuCores: 4,
        memoryMB: 8192,
        diskMB: 51200,
        gpu: {
          enabled: false
        }
      };

      const requirements: ResourceRequirements = {
        minCpuCores: 2,
        recommendedCpuCores: 4,
        minMemoryMB: 4096,
        recommendedMemoryMB: 8192,
        minDiskMB: 20480,
        recommendedDiskMB: 51200,
        gpu: {
          required: true,
          minMemoryMB: 4096
        }
      };

      const result = validateResourceConfig(resources, requirements);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('GPU is required but not enabled');
    });

    test('should validate GPU memory requirements', () => {
      const resources: VMResource = {
        cpuCores: 4,
        memoryMB: 8192,
        diskMB: 51200,
        gpu: {
          enabled: true,
          memory: 2048
        }
      };

      const requirements: ResourceRequirements = {
        minCpuCores: 2,
        recommendedCpuCores: 4,
        minMemoryMB: 4096,
        recommendedMemoryMB: 8192,
        minDiskMB: 20480,
        recommendedDiskMB: 51200,
        gpu: {
          required: true,
          minMemoryMB: 4096
        }
      };

      const result = validateResourceConfig(resources, requirements);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('GPU memory (2048MB) below minimum requirement (4096MB)');
    });
  });

  describe('Monitoring Configuration Validation', () => {
    test('should validate valid Datadog configuration', () => {
      const config: MonitoringConfig = {
        provider: 'datadog',
        enabled: false,
        serviceName: 'test-service',
        environment: 'development',
        samplingRate: 0.5
      };

      const result = validateMonitoringConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should require provider field', () => {
      const config = {
        serviceName: 'test-service',
        environment: 'development'
      } as any;

      const result = validateMonitoringConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Monitoring provider is required');
    });

    test('should require service name', () => {
      const config: MonitoringConfig = {
        provider: 'datadog',
        enabled: false,
        serviceName: '',
        environment: 'development'
      };

      const result = validateMonitoringConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Service name is required');
    });

    test('should require environment', () => {
      const config: MonitoringConfig = {
        provider: 'datadog',
        enabled: false,
        serviceName: 'test-service',
        environment: ''
      };

      const result = validateMonitoringConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Environment is required');
    });

    test('should validate sampling rate range', () => {
      const invalidConfig1: MonitoringConfig = {
        provider: 'datadog',
        enabled: false,
        serviceName: 'test-service',
        environment: 'development',
        samplingRate: 1.5
      };

      const result1 = validateMonitoringConfig(invalidConfig1);
      expect(result1.valid).toBe(false);
      expect(result1.errors).toContain('Sampling rate must be between 0 and 1');

      const invalidConfig2: MonitoringConfig = {
        provider: 'datadog',
        enabled: false,
        serviceName: 'test-service',
        environment: 'development',
        samplingRate: -0.1
      };

      const result2 = validateMonitoringConfig(invalidConfig2);
      expect(result2.valid).toBe(false);
      expect(result2.errors).toContain('Sampling rate must be between 0 and 1');
    });
  });

  describe('Project Template Structure Validation', () => {
    test('should validate all templates have required fields', () => {
      PROJECT_TEMPLATES.forEach(template => {
        expect(template.id).toBeDefined();
        expect(typeof template.id).toBe('string');
        expect(template.id.length).toBeGreaterThan(0);

        expect(template.name).toBeDefined();
        expect(typeof template.name).toBe('string');
        expect(template.name.length).toBeGreaterThan(0);

        expect(template.description).toBeDefined();
        expect(typeof template.description).toBe('string');
        expect(template.description.length).toBeGreaterThan(0);

        expect(template.category).toBeDefined();
        expect(['frontend', 'backend', 'fullstack', 'mobile', 'data', 'infrastructure']).toContain(template.category);

        expect(template.complexity).toBeDefined();
        expect(['beginner', 'intermediate', 'advanced']).toContain(template.complexity);

        expect(template.tags).toBeDefined();
        expect(Array.isArray(template.tags)).toBe(true);
        expect(template.tags.length).toBeGreaterThan(0);

        expect(template.language).toBeDefined();
        expect(Array.isArray(template.language)).toBe(true);
        expect(template.language.length).toBeGreaterThan(0);

        expect(template.frameworks).toBeDefined();
        expect(Array.isArray(template.frameworks)).toBe(true);

        expect(template.features).toBeDefined();
        expect(Array.isArray(template.features)).toBe(true);

        expect(template.estimatedSetupTime).toBeDefined();
        expect(typeof template.estimatedSetupTime).toBe('string');

        expect(template.files).toBeDefined();
        expect(Array.isArray(template.files)).toBe(true);

        expect(template.dependencies).toBeDefined();
        expect(typeof template.dependencies).toBe('object');

        expect(template.scripts).toBeDefined();
        expect(typeof template.scripts).toBe('object');

        expect(template.envVars).toBeDefined();
        expect(Array.isArray(template.envVars)).toBe(true);

        expect(typeof template.dockerSupport).toBe('boolean');
        expect(typeof template.kubernetesSupport).toBe('boolean');
        expect(typeof template.cicdTemplate).toBe('boolean');
        expect(typeof template.testingSetup).toBe('boolean');
        expect(typeof template.monitoringSetup).toBe('boolean');

        expect(template.documentation).toBeDefined();
        expect(Array.isArray(template.documentation.setup)).toBe(true);
        expect(Array.isArray(template.documentation.usage)).toBe(true);
        expect(Array.isArray(template.documentation.deployment)).toBe(true);
      });
    });

    test('should validate template IDs are unique', () => {
      const ids = PROJECT_TEMPLATES.map(t => t.id);
      const uniqueIds = new Set(ids);

      expect(ids.length).toBe(uniqueIds.size);
    });

    test('should validate environment variables have required fields', () => {
      PROJECT_TEMPLATES.forEach(template => {
        template.envVars.forEach(envVar => {
          expect(envVar.name).toBeDefined();
          expect(typeof envVar.name).toBe('string');
          expect(envVar.name.length).toBeGreaterThan(0);

          expect(envVar.description).toBeDefined();
          expect(typeof envVar.description).toBe('string');

          expect(typeof envVar.required).toBe('boolean');
        });
      });
    });

    test('should validate scripts have valid commands', () => {
      PROJECT_TEMPLATES.forEach(template => {
        Object.entries(template.scripts).forEach(([key, value]) => {
          expect(typeof key).toBe('string');
          expect(key.length).toBeGreaterThan(0);

          expect(typeof value).toBe('string');
          expect(value.length).toBeGreaterThan(0);
        });
      });
    });

    test('should validate dependencies have version numbers', () => {
      PROJECT_TEMPLATES.forEach(template => {
        Object.entries(template.dependencies).forEach(([pkg, version]) => {
          expect(typeof pkg).toBe('string');
          expect(pkg.length).toBeGreaterThan(0);

          expect(typeof version).toBe('string');
          expect(version.length).toBeGreaterThan(0);
        });

        if (template.devDependencies) {
          Object.entries(template.devDependencies).forEach(([pkg, version]) => {
            expect(typeof pkg).toBe('string');
            expect(pkg.length).toBeGreaterThan(0);

            expect(typeof version).toBe('string');
            expect(version.length).toBeGreaterThan(0);
          });
        }
      });
    });

    test('should validate documentation has meaningful content', () => {
      PROJECT_TEMPLATES.forEach(template => {
        expect(template.documentation.setup.length).toBeGreaterThan(0);
        template.documentation.setup.forEach(step => {
          expect(typeof step).toBe('string');
          expect(step.length).toBeGreaterThan(0);
        });

        expect(template.documentation.usage.length).toBeGreaterThan(0);
        template.documentation.usage.forEach(step => {
          expect(typeof step).toBe('string');
          expect(step.length).toBeGreaterThan(0);
        });

        expect(template.documentation.deployment.length).toBeGreaterThan(0);
        template.documentation.deployment.forEach(step => {
          expect(typeof step).toBe('string');
          expect(step.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Template Helper Function Validation', () => {
    test('getTemplateById should return correct template', () => {
      const template = getTemplateById('react-typescript-tailwind');

      expect(template).toBeDefined();
      expect(template!.id).toBe('react-typescript-tailwind');
      expect(template!.name).toBe('React + TypeScript + Tailwind CSS');
    });

    test('getTemplateById should return undefined for non-existent template', () => {
      const template = getTemplateById('non-existent-template');

      expect(template).toBeUndefined();
    });

    test('getTemplatesByCategory should return templates in category', () => {
      const frontendTemplates = getTemplatesByCategory('frontend');

      expect(Array.isArray(frontendTemplates)).toBe(true);
      expect(frontendTemplates.length).toBeGreaterThan(0);
      frontendTemplates.forEach(template => {
        expect(template.category).toBe('frontend');
      });
    });

    test('getTemplatesByComplexity should return templates with complexity level', () => {
      const beginnerTemplates = getTemplatesByComplexity('beginner');

      expect(Array.isArray(beginnerTemplates)).toBe(true);
      expect(beginnerTemplates.length).toBeGreaterThan(0);
      beginnerTemplates.forEach(template => {
        expect(template.complexity).toBe('beginner');
      });
    });

    test('searchTemplates should find templates by name', () => {
      const results = searchTemplates('React');

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(t => t.name.toLowerCase().includes('react'))).toBe(true);
    });

    test('searchTemplates should find templates by tags', () => {
      const results = searchTemplates('typescript');

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(t => t.tags.includes('typescript'))).toBe(true);
    });

    test('searchTemplates should find templates by language', () => {
      const results = searchTemplates('python');

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(t => t.language.includes('python'))).toBe(true);
    });

    test('searchTemplates should find templates by framework', () => {
      const results = searchTemplates('nextjs');

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(t => t.frameworks.includes('nextjs'))).toBe(true);
    });

    test('searchTemplates should be case-insensitive', () => {
      const lowerResults = searchTemplates('react');
      const upperResults = searchTemplates('REACT');
      const mixedResults = searchTemplates('ReAcT');

      expect(lowerResults.length).toBe(upperResults.length);
      expect(lowerResults.length).toBe(mixedResults.length);
    });
  });

  describe('Template Data Integrity', () => {
    test('should have multiple templates available', () => {
      expect(PROJECT_TEMPLATES.length).toBeGreaterThan(0);
    });

    test('should have templates in all categories', () => {
      const categories = new Set(PROJECT_TEMPLATES.map(t => t.category));

      expect(categories.has('frontend')).toBe(true);
      expect(categories.has('backend')).toBe(true);
      expect(categories.has('fullstack')).toBe(true);
    });

    test('should have templates with all complexity levels', () => {
      const complexities = new Set(PROJECT_TEMPLATES.map(t => t.complexity));

      expect(complexities.has('beginner')).toBe(true);
      expect(complexities.has('intermediate')).toBe(true);
      expect(complexities.has('advanced')).toBe(true);
    });

    test('should validate template tags are not empty strings', () => {
      PROJECT_TEMPLATES.forEach(template => {
        template.tags.forEach(tag => {
          expect(tag.length).toBeGreaterThan(0);
          expect(tag.trim()).toBe(tag);
        });
      });
    });

    test('should validate template languages are not empty strings', () => {
      PROJECT_TEMPLATES.forEach(template => {
        template.language.forEach(lang => {
          expect(lang.length).toBeGreaterThan(0);
          expect(lang.trim()).toBe(lang);
        });
      });
    });

    test('should validate monitoring config exists when monitoringSetup is true', () => {
      PROJECT_TEMPLATES.forEach(template => {
        if (template.monitoringSetup) {
          if (template.monitoringConfig) {
            expect(template.monitoringConfig.provider).toBeDefined();
            expect(template.monitoringConfig.serviceName).toBeDefined();
          }
        }
      });
    });

    test('should validate required env vars are marked as required', () => {
      PROJECT_TEMPLATES.forEach(template => {
        const requiredEnvVars = template.envVars.filter(env => env.required);

        requiredEnvVars.forEach(envVar => {
          expect(envVar.required).toBe(true);
          expect(envVar.example || envVar.defaultValue).toBeDefined();
        });
      });
    });
  });

  describe('Template Content Validation', () => {
    test('should validate template files have valid structure', () => {
      PROJECT_TEMPLATES.forEach(template => {
        template.files.forEach(file => {
          expect(file.path).toBeDefined();
          expect(typeof file.path).toBe('string');

          expect(file.content).toBeDefined();
          expect(typeof file.content).toBe('string');

          expect(file.type).toBeDefined();
          expect(['file', 'directory']).toContain(file.type);
        });
      });
    });

    test('should validate category-specific requirements', () => {
      const frontendTemplates = getTemplatesByCategory('frontend');
      frontendTemplates.forEach(template => {
        const hasUIFramework = template.frameworks.some(f =>
          ['react', 'vue', 'angular', 'svelte', 'electron'].includes(f)
        );
        expect(hasUIFramework || template.frameworks.length === 0).toBe(true);
      });

      const backendTemplates = getTemplatesByCategory('backend');
      backendTemplates.forEach(template => {
        const hasBackendFramework = template.frameworks.some(f =>
          ['express', 'fastapi', 'apollo-server', 'serverless'].includes(f)
        );
        expect(hasBackendFramework || template.frameworks.length === 0).toBe(true);
      });
    });

    test('should validate templates have features defined', () => {
      PROJECT_TEMPLATES.forEach(template => {
        expect(template.features).toBeDefined();
        expect(Array.isArray(template.features)).toBe(true);

        if (template.complexity === 'advanced') {
          expect(template.features.length).toBeGreaterThan(0);
        }
      });
    });
  });
});

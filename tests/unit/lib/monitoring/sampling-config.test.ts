/**
 * Unit Tests for Sampling Configuration Module
 * Tests sampling configuration, validation, and environment variable handling
 */

import { jest } from '@jest/globals';

describe('Sampling Configuration', () => {
  let getSamplingConfig: any;
  let getSamplingRule: any;
  let validateSamplingConfig: any;
  let getSamplingConfigSummary: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Clear all sampling-related environment variables
    delete process.env.NODE_ENV;
    delete process.env.SKIP_MONITORING;
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.OTEL_ENABLED;
    delete process.env.DD_ENABLED;
    delete process.env.OTEL_SAMPLING_ENABLED;
    delete process.env.OTEL_SAMPLING_ERROR_RATE;
    delete process.env.OTEL_SAMPLING_DEFAULT_RATE;
    delete process.env.OTEL_SAMPLING_BUFFER_TIMEOUT;
    delete process.env.OTEL_SAMPLING_MAX_BUFFER_SIZE;

    // Import fresh module
    const module = require('@/lib/monitoring/sampling-config');
    getSamplingConfig = module.getSamplingConfig;
    getSamplingRule = module.getSamplingRule;
    validateSamplingConfig = module.validateSamplingConfig;
    getSamplingConfigSummary = module.getSamplingConfigSummary;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getSamplingConfig', () => {
    it('should return default configuration', () => {
      const config = getSamplingConfig();

      expect(config).toMatchObject({
        errorSampleRate: 1.0,
        defaultSampleRate: 0.1,
        bufferTimeout: 30000,
        maxBufferSize: 10000,
        enabled: true
      });
      expect(config.rules).toHaveLength(2);
    });

    it('should include default rules', () => {
      const config = getSamplingConfig();

      expect(config.rules).toEqual([
        {
          name: 'error-traces',
          condition: 'error',
          sampleRate: 1.0
        },
        {
          name: 'success-traces',
          condition: 'success',
          sampleRate: 0.1
        }
      ]);
    });

    it('should parse error sample rate from environment', () => {
      process.env.OTEL_SAMPLING_ERROR_RATE = '0.5';
      jest.resetModules();
      const module = require('@/lib/monitoring/sampling-config');

      const config = module.getSamplingConfig();

      expect(config.errorSampleRate).toBe(0.5);
      expect(config.rules[0].sampleRate).toBe(0.5);
    });

    it('should parse default sample rate from environment', () => {
      process.env.OTEL_SAMPLING_DEFAULT_RATE = '0.25';
      jest.resetModules();
      const module = require('@/lib/monitoring/sampling-config');

      const config = module.getSamplingConfig();

      expect(config.defaultSampleRate).toBe(0.25);
      expect(config.rules[1].sampleRate).toBe(0.25);
    });

    it('should parse buffer timeout from environment', () => {
      process.env.OTEL_SAMPLING_BUFFER_TIMEOUT = '60000';
      jest.resetModules();
      const module = require('@/lib/monitoring/sampling-config');

      const config = module.getSamplingConfig();

      expect(config.bufferTimeout).toBe(60000);
    });

    it('should parse max buffer size from environment', () => {
      process.env.OTEL_SAMPLING_MAX_BUFFER_SIZE = '20000';
      jest.resetModules();
      const module = require('@/lib/monitoring/sampling-config');

      const config = module.getSamplingConfig();

      expect(config.maxBufferSize).toBe(20000);
    });

    it('should validate error rate within range', () => {
      process.env.OTEL_SAMPLING_ERROR_RATE = '1.5';
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      jest.resetModules();
      const module = require('@/lib/monitoring/sampling-config');

      const config = module.getSamplingConfig();

      expect(config.errorSampleRate).toBe(1.0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('out of range')
      );
    });

    it('should validate error rate minimum', () => {
      process.env.OTEL_SAMPLING_ERROR_RATE = '-0.1';
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      jest.resetModules();
      const module = require('@/lib/monitoring/sampling-config');

      const config = module.getSamplingConfig();

      expect(config.errorSampleRate).toBe(1.0);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should handle invalid error rate value', () => {
      process.env.OTEL_SAMPLING_ERROR_RATE = 'invalid';
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      jest.resetModules();
      const module = require('@/lib/monitoring/sampling-config');

      const config = module.getSamplingConfig();

      expect(config.errorSampleRate).toBe(1.0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid sampling rate')
      );
    });

    it('should validate default rate within range', () => {
      process.env.OTEL_SAMPLING_DEFAULT_RATE = '2.0';
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      jest.resetModules();
      const module = require('@/lib/monitoring/sampling-config');

      const config = module.getSamplingConfig();

      expect(config.defaultSampleRate).toBe(0.1);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should handle invalid buffer timeout', () => {
      process.env.OTEL_SAMPLING_BUFFER_TIMEOUT = 'invalid';
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      jest.resetModules();
      const module = require('@/lib/monitoring/sampling-config');

      const config = module.getSamplingConfig();

      expect(config.bufferTimeout).toBe(30000);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid integer value')
      );
    });

    it('should validate buffer timeout minimum', () => {
      process.env.OTEL_SAMPLING_BUFFER_TIMEOUT = '500';
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      jest.resetModules();
      const module = require('@/lib/monitoring/sampling-config');

      const config = module.getSamplingConfig();

      expect(config.bufferTimeout).toBe(30000);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('below minimum')
      );
    });

    it('should handle invalid max buffer size', () => {
      process.env.OTEL_SAMPLING_MAX_BUFFER_SIZE = 'invalid';
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      jest.resetModules();
      const module = require('@/lib/monitoring/sampling-config');

      const config = module.getSamplingConfig();

      expect(config.maxBufferSize).toBe(10000);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should validate max buffer size minimum', () => {
      process.env.OTEL_SAMPLING_MAX_BUFFER_SIZE = '50';
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      jest.resetModules();
      const module = require('@/lib/monitoring/sampling-config');

      const config = module.getSamplingConfig();

      expect(config.maxBufferSize).toBe(10000);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should handle float values for integer fields', () => {
      process.env.OTEL_SAMPLING_BUFFER_TIMEOUT = '30000.5';
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      jest.resetModules();
      const module = require('@/lib/monitoring/sampling-config');

      const config = module.getSamplingConfig();

      expect(config.bufferTimeout).toBe(30000);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('Sampling enabled checks', () => {
    it('should be disabled in test environment', () => {
      process.env.NODE_ENV = 'test';
      jest.resetModules();
      const module = require('@/lib/monitoring/sampling-config');

      const config = module.getSamplingConfig();

      expect(config.enabled).toBe(false);
    });

    it('should be disabled when SKIP_MONITORING is true', () => {
      process.env.SKIP_MONITORING = 'true';
      jest.resetModules();
      const module = require('@/lib/monitoring/sampling-config');

      const config = module.getSamplingConfig();

      expect(config.enabled).toBe(false);
    });

    it('should be disabled in CI environment', () => {
      process.env.CI = 'true';
      jest.resetModules();
      const module = require('@/lib/monitoring/sampling-config');

      const config = module.getSamplingConfig();

      expect(config.enabled).toBe(false);
    });

    it('should be disabled in GitHub Actions', () => {
      process.env.GITHUB_ACTIONS = 'true';
      jest.resetModules();
      const module = require('@/lib/monitoring/sampling-config');

      const config = module.getSamplingConfig();

      expect(config.enabled).toBe(false);
    });

    it('should be disabled when OTEL is disabled', () => {
      process.env.OTEL_ENABLED = 'false';
      jest.resetModules();
      const module = require('@/lib/monitoring/sampling-config');

      const config = module.getSamplingConfig();

      expect(config.enabled).toBe(false);
    });

    it('should be disabled when Datadog is disabled', () => {
      process.env.DD_ENABLED = 'false';
      jest.resetModules();
      const module = require('@/lib/monitoring/sampling-config');

      const config = module.getSamplingConfig();

      expect(config.enabled).toBe(false);
    });

    it('should be disabled when explicitly set to false', () => {
      process.env.OTEL_SAMPLING_ENABLED = 'false';
      jest.resetModules();
      const module = require('@/lib/monitoring/sampling-config');

      const config = module.getSamplingConfig();

      expect(config.enabled).toBe(false);
    });

    it('should be enabled by default in production', () => {
      process.env.NODE_ENV = 'production';
      jest.resetModules();
      const module = require('@/lib/monitoring/sampling-config');

      const config = module.getSamplingConfig();

      expect(config.enabled).toBe(true);
    });
  });

  describe('getSamplingRule', () => {
    it('should return error rule', () => {
      const rule = getSamplingRule('error');

      expect(rule).toEqual({
        name: 'error-traces',
        condition: 'error',
        sampleRate: 1.0
      });
    });

    it('should return success rule', () => {
      const rule = getSamplingRule('success');

      expect(rule).toEqual({
        name: 'success-traces',
        condition: 'success',
        sampleRate: 0.1
      });
    });

    it('should return null for all condition', () => {
      const rule = getSamplingRule('all');

      expect(rule).toBeNull();
    });

    it('should return rule with custom rate from environment', () => {
      process.env.OTEL_SAMPLING_ERROR_RATE = '0.8';
      jest.resetModules();
      const module = require('@/lib/monitoring/sampling-config');

      const rule = module.getSamplingRule('error');

      expect(rule.sampleRate).toBe(0.8);
    });
  });

  describe('validateSamplingConfig', () => {
    it('should validate correct configuration', () => {
      const config = {
        errorSampleRate: 0.5,
        defaultSampleRate: 0.1,
        bufferTimeout: 30000,
        maxBufferSize: 10000,
        rules: [
          { name: 'test-rule', condition: 'error' as const, sampleRate: 0.5 }
        ]
      };

      const result = validateSamplingConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject error rate below 0', () => {
      const config = { errorSampleRate: -0.1 };

      const result = validateSamplingConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'errorSampleRate must be between 0 and 1, got: -0.1'
      );
    });

    it('should reject error rate above 1', () => {
      const config = { errorSampleRate: 1.5 };

      const result = validateSamplingConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'errorSampleRate must be between 0 and 1, got: 1.5'
      );
    });

    it('should reject default rate below 0', () => {
      const config = { defaultSampleRate: -0.5 };

      const result = validateSamplingConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'defaultSampleRate must be between 0 and 1, got: -0.5'
      );
    });

    it('should reject default rate above 1', () => {
      const config = { defaultSampleRate: 2.0 };

      const result = validateSamplingConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'defaultSampleRate must be between 0 and 1, got: 2'
      );
    });

    it('should reject buffer timeout below minimum', () => {
      const config = { bufferTimeout: 500 };

      const result = validateSamplingConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'bufferTimeout must be at least 1000ms, got: 500'
      );
    });

    it('should accept buffer timeout at minimum', () => {
      const config = { bufferTimeout: 1000 };

      const result = validateSamplingConfig(config);

      expect(result.valid).toBe(true);
    });

    it('should reject max buffer size below minimum', () => {
      const config = { maxBufferSize: 50 };

      const result = validateSamplingConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'maxBufferSize must be at least 100, got: 50'
      );
    });

    it('should accept max buffer size at minimum', () => {
      const config = { maxBufferSize: 100 };

      const result = validateSamplingConfig(config);

      expect(result.valid).toBe(true);
    });

    it('should reject non-array rules', () => {
      const config = { rules: 'invalid' as any };

      const result = validateSamplingConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('rules must be an array');
    });

    it('should reject rule without name', () => {
      const config = {
        rules: [
          { condition: 'error' as const, sampleRate: 1.0 } as any
        ]
      };

      const result = validateSamplingConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Rule at index 0 missing name');
    });

    it('should reject rule without condition', () => {
      const config = {
        rules: [
          { name: 'test-rule', sampleRate: 1.0 } as any
        ]
      };

      const result = validateSamplingConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Rule at index 0 missing condition');
    });

    it('should reject rule with invalid sample rate', () => {
      const config = {
        rules: [
          { name: 'test-rule', condition: 'error' as const, sampleRate: 1.5 }
        ]
      };

      const result = validateSamplingConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Rule at index 0 has invalid sampleRate: 1.5'
      );
    });

    it('should reject rule with negative sample rate', () => {
      const config = {
        rules: [
          { name: 'test-rule', condition: 'error' as const, sampleRate: -0.1 }
        ]
      };

      const result = validateSamplingConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Rule at index 0 has invalid sampleRate: -0.1'
      );
    });

    it('should reject rule without sample rate', () => {
      const config = {
        rules: [
          { name: 'test-rule', condition: 'error' as const } as any
        ]
      };

      const result = validateSamplingConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Rule at index 0 has invalid sampleRate: undefined'
      );
    });

    it('should validate empty configuration', () => {
      const result = validateSamplingConfig({});

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should collect multiple errors', () => {
      const config = {
        errorSampleRate: 1.5,
        defaultSampleRate: -0.1,
        bufferTimeout: 500,
        maxBufferSize: 50
      };

      const result = validateSamplingConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(4);
    });

    it('should accept zero sample rates', () => {
      const config = {
        errorSampleRate: 0,
        defaultSampleRate: 0
      };

      const result = validateSamplingConfig(config);

      expect(result.valid).toBe(true);
    });

    it('should accept maximum sample rates', () => {
      const config = {
        errorSampleRate: 1,
        defaultSampleRate: 1
      };

      const result = validateSamplingConfig(config);

      expect(result.valid).toBe(true);
    });
  });

  describe('getSamplingConfigSummary', () => {
    it('should return disabled summary when sampling is disabled', () => {
      process.env.NODE_ENV = 'test';
      jest.resetModules();
      const module = require('@/lib/monitoring/sampling-config');

      const summary = module.getSamplingConfigSummary();

      expect(summary).toBe('Sampling: disabled');
    });

    it('should return enabled summary with default rates', () => {
      const summary = getSamplingConfigSummary();

      expect(summary).toContain('Sampling: enabled');
      expect(summary).toContain('Error rate: 100.0%');
      expect(summary).toContain('Success rate: 10.0%');
      expect(summary).toContain('Buffer timeout: 30000ms');
      expect(summary).toContain('Max buffer size: 10000 spans');
    });

    it('should format custom error rate', () => {
      process.env.OTEL_SAMPLING_ERROR_RATE = '0.75';
      jest.resetModules();
      const module = require('@/lib/monitoring/sampling-config');

      const summary = module.getSamplingConfigSummary();

      expect(summary).toContain('Error rate: 75.0%');
    });

    it('should format custom default rate', () => {
      process.env.OTEL_SAMPLING_DEFAULT_RATE = '0.25';
      jest.resetModules();
      const module = require('@/lib/monitoring/sampling-config');

      const summary = module.getSamplingConfigSummary();

      expect(summary).toContain('Success rate: 25.0%');
    });

    it('should include custom buffer timeout', () => {
      process.env.OTEL_SAMPLING_BUFFER_TIMEOUT = '60000';
      jest.resetModules();
      const module = require('@/lib/monitoring/sampling-config');

      const summary = module.getSamplingConfigSummary();

      expect(summary).toContain('Buffer timeout: 60000ms');
    });

    it('should include custom max buffer size', () => {
      process.env.OTEL_SAMPLING_MAX_BUFFER_SIZE = '20000';
      jest.resetModules();
      const module = require('@/lib/monitoring/sampling-config');

      const summary = module.getSamplingConfigSummary();

      expect(summary).toContain('Max buffer size: 20000 spans');
    });

    it('should format zero rates correctly', () => {
      process.env.OTEL_SAMPLING_ERROR_RATE = '0';
      process.env.OTEL_SAMPLING_DEFAULT_RATE = '0';
      jest.resetModules();
      const module = require('@/lib/monitoring/sampling-config');

      const summary = module.getSamplingConfigSummary();

      expect(summary).toContain('Error rate: 0.0%');
      expect(summary).toContain('Success rate: 0.0%');
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined environment variables', () => {
      delete process.env.OTEL_SAMPLING_ERROR_RATE;
      delete process.env.OTEL_SAMPLING_DEFAULT_RATE;

      const config = getSamplingConfig();

      expect(config.errorSampleRate).toBe(1.0);
      expect(config.defaultSampleRate).toBe(0.1);
    });

    it('should handle empty string environment variables', () => {
      process.env.OTEL_SAMPLING_ERROR_RATE = '';
      process.env.OTEL_SAMPLING_DEFAULT_RATE = '';
      jest.resetModules();
      const module = require('@/lib/monitoring/sampling-config');

      const config = module.getSamplingConfig();

      expect(config.errorSampleRate).toBe(1.0);
      expect(config.defaultSampleRate).toBe(0.1);
    });

    it('should handle whitespace in environment variables', () => {
      process.env.OTEL_SAMPLING_ERROR_RATE = '  0.5  ';
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      jest.resetModules();
      const module = require('@/lib/monitoring/sampling-config');

      const config = module.getSamplingConfig();

      // Number() handles whitespace, so this should work
      expect(config.errorSampleRate).toBe(0.5);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle all configuration options together', () => {
      process.env.OTEL_SAMPLING_ERROR_RATE = '0.8';
      process.env.OTEL_SAMPLING_DEFAULT_RATE = '0.2';
      process.env.OTEL_SAMPLING_BUFFER_TIMEOUT = '60000';
      process.env.OTEL_SAMPLING_MAX_BUFFER_SIZE = '20000';
      jest.resetModules();
      const module = require('@/lib/monitoring/sampling-config');

      const config = module.getSamplingConfig();

      expect(config).toMatchObject({
        errorSampleRate: 0.8,
        defaultSampleRate: 0.2,
        bufferTimeout: 60000,
        maxBufferSize: 20000,
        enabled: true
      });
    });

    it('should handle boundary value 0 for sample rates', () => {
      process.env.OTEL_SAMPLING_ERROR_RATE = '0';
      process.env.OTEL_SAMPLING_DEFAULT_RATE = '0';
      jest.resetModules();
      const module = require('@/lib/monitoring/sampling-config');

      const config = module.getSamplingConfig();

      expect(config.errorSampleRate).toBe(0);
      expect(config.defaultSampleRate).toBe(0);
    });

    it('should handle boundary value 1 for sample rates', () => {
      process.env.OTEL_SAMPLING_ERROR_RATE = '1';
      process.env.OTEL_SAMPLING_DEFAULT_RATE = '1';
      jest.resetModules();
      const module = require('@/lib/monitoring/sampling-config');

      const config = module.getSamplingConfig();

      expect(config.errorSampleRate).toBe(1);
      expect(config.defaultSampleRate).toBe(1);
    });
  });

  describe('Backward compatibility', () => {
    it('should expose samplingConfig.get', () => {
      const module = require('@/lib/monitoring/sampling-config');

      expect(module.samplingConfig.get).toBe(getSamplingConfig);
    });

    it('should expose samplingConfig.getRule', () => {
      const module = require('@/lib/monitoring/sampling-config');

      expect(module.samplingConfig.getRule).toBe(getSamplingRule);
    });

    it('should expose samplingConfig.validate', () => {
      const module = require('@/lib/monitoring/sampling-config');

      expect(module.samplingConfig.validate).toBe(validateSamplingConfig);
    });

    it('should expose samplingConfig.getSummary', () => {
      const module = require('@/lib/monitoring/sampling-config');

      expect(module.samplingConfig.getSummary).toBe(getSamplingConfigSummary);
    });
  });
});

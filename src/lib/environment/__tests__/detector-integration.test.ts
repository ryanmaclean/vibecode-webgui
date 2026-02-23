/**
 * Integration tests for environment detection across all signals
 * Tests NODE_ENV, DD_ENV, and other environment variables
 */

import { EnvironmentDetector, getEnvironmentDetector, detectEnvironment } from '../detector';
import { EnvironmentType, DetectionConfidence } from '../types';

/**
 * Helper function to set environment variables
 * Uses Object.defineProperty to avoid read-only property errors
 */
function setEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    Object.defineProperty(process.env, key, {
      value,
      configurable: true,
      writable: true,
    });
  }
}

describe('Environment Detection Integration Tests', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Clear all environment variables that affect detection
    setEnv('NODE_ENV', undefined);
    setEnv('DD_ENV', undefined);
    setEnv('ENVIRONMENT', undefined);
    setEnv('APP_ENV', undefined);
    setEnv('DEPLOYMENT_ENV', undefined);
    setEnv('VERCEL_ENV', undefined);
    setEnv('RAILWAY_ENVIRONMENT', undefined);
    setEnv('RENDER_ENV', undefined);
    setEnv('HOSTNAME', undefined);
    setEnv('VERCEL_GIT_COMMIT_REF', undefined);
    setEnv('RAILWAY_GIT_BRANCH', undefined);
    setEnv('RENDER_GIT_BRANCH', undefined);
    setEnv('GIT_BRANCH', undefined);
    setEnv('BRANCH_NAME', undefined);
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  // ==========================================================================
  // NODE_ENV Detection
  // ==========================================================================

  describe('NODE_ENV detection', () => {
    it('detects development from NODE_ENV=development', () => {
      setEnv('NODE_ENV', 'development');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.environment).toBe('development');
      expect(result.confidence).toBe('medium'); // Single high-confidence signal = medium
      expect(result.signals).toHaveLength(1);
      expect(result.signals[0].type).toBe('env_variable');
      expect(result.signals[0].source).toBe('NODE_ENV');
      expect(result.signals[0].confidence).toBe('high');
    });

    it('detects development from NODE_ENV=dev', () => {
      setEnv('NODE_ENV', 'dev');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.environment).toBe('development');
      expect(result.confidence).toBe('medium');
    });

    it('detects production from NODE_ENV=production', () => {
      setEnv('NODE_ENV', 'production');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.environment).toBe('production');
      expect(result.confidence).toBe('medium');
      expect(result.signals[0].source).toBe('NODE_ENV');
      expect(result.signals[0].indicates).toBe('production');
    });

    it('detects production from NODE_ENV=prod', () => {
      setEnv('NODE_ENV', 'prod');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.environment).toBe('production');
      expect(result.confidence).toBe('medium');
    });

    it('detects staging from NODE_ENV=staging', () => {
      setEnv('NODE_ENV', 'staging');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.environment).toBe('staging');
      expect(result.confidence).toBe('medium');
    });

    it('detects staging from NODE_ENV=stg', () => {
      setEnv('NODE_ENV', 'stg');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.environment).toBe('staging');
      expect(result.confidence).toBe('medium');
    });

    it('detects test from NODE_ENV=test', () => {
      setEnv('NODE_ENV', 'test');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.environment).toBe('test');
      expect(result.confidence).toBe('medium');
    });

    it('handles case-insensitive NODE_ENV values', () => {
      setEnv('NODE_ENV', 'PRODUCTION');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.environment).toBe('production');
    });
  });

  // ==========================================================================
  // DD_ENV Detection (Datadog)
  // ==========================================================================

  describe('DD_ENV detection', () => {
    it('detects development from DD_ENV=development', () => {
      setEnv('DD_ENV', 'development');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.environment).toBe('development');
      expect(result.signals[0].source).toBe('DD_ENV');
    });

    it('detects production from DD_ENV=production', () => {
      setEnv('DD_ENV', 'production');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.environment).toBe('production');
      expect(result.signals[0].source).toBe('DD_ENV');
    });

    it('detects staging from DD_ENV=staging', () => {
      setEnv('DD_ENV', 'staging');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.environment).toBe('staging');
    });

    it('detects test from DD_ENV=test', () => {
      setEnv('DD_ENV', 'test');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.environment).toBe('test');
    });
  });

  // ==========================================================================
  // Multiple Signal Priority
  // ==========================================================================

  describe('multi-signal priority', () => {
    it('NODE_ENV takes priority over DD_ENV (appears first in list)', () => {
      setEnv('NODE_ENV', 'production');
      setEnv('DD_ENV', 'development');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.environment).toBe('production');
      expect(result.primarySignal?.source).toBe('NODE_ENV');
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.[0]).toContain('Conflicting signals');
    });

    it('DD_ENV is used when NODE_ENV is absent', () => {
      setEnv('DD_ENV', 'staging');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.environment).toBe('staging');
      expect(result.primarySignal?.source).toBe('DD_ENV');
    });

    it('detects conflicts between NODE_ENV and DD_ENV', () => {
      setEnv('NODE_ENV', 'development');
      setEnv('DD_ENV', 'production');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.warnings).toBeDefined();
      expect(result.warnings?.[0]).toContain('Conflicting signals');
      expect(result.warnings?.[0]).toContain('development');
      expect(result.warnings?.[0]).toContain('production');
    });

    it('higher priority signal wins when multiple agree', () => {
      setEnv('NODE_ENV', 'production');
      setEnv('DD_ENV', 'production');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.environment).toBe('production');
      expect(result.confidence).toBe('high'); // Multiple high-confidence signals agree
      expect(result.signals).toHaveLength(2);
      expect(result.warnings).toBeUndefined();
    });
  });

  // ==========================================================================
  // Other Environment Variables
  // ==========================================================================

  describe('other environment variable detection', () => {
    it('detects from ENVIRONMENT variable', () => {
      setEnv('ENVIRONMENT', 'production');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.environment).toBe('production');
      expect(result.signals[0].source).toBe('ENVIRONMENT');
    });

    it('detects from APP_ENV variable', () => {
      setEnv('APP_ENV', 'staging');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.environment).toBe('staging');
      expect(result.signals[0].source).toBe('APP_ENV');
    });

    it('detects from VERCEL_ENV variable', () => {
      setEnv('VERCEL_ENV', 'production');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.environment).toBe('production');
      expect(result.signals[0].source).toBe('VERCEL_ENV');
    });

    it('detects from RAILWAY_ENVIRONMENT variable', () => {
      setEnv('RAILWAY_ENVIRONMENT', 'development');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.environment).toBe('development');
      expect(result.signals[0].source).toBe('RAILWAY_ENVIRONMENT');
    });
  });

  // ==========================================================================
  // Hostname Detection
  // ==========================================================================

  describe('hostname detection', () => {
    it('detects development from localhost', () => {
      setEnv('HOSTNAME', 'localhost');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.environment).toBe('development');
      expect(result.signals[0].type).toBe('hostname');
      expect(result.signals[0].confidence).toBe('medium');
    });

    it('detects development from dev- prefix', () => {
      setEnv('HOSTNAME', 'dev-server-01');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.environment).toBe('development');
    });

    it('detects staging from staging- prefix', () => {
      setEnv('HOSTNAME', 'staging-web-01');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.environment).toBe('staging');
    });

    it('detects production from prod- prefix', () => {
      setEnv('HOSTNAME', 'prod-api-01');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.environment).toBe('production');
    });

    it('detects test from test- prefix', () => {
      setEnv('HOSTNAME', 'test-runner-01');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.environment).toBe('test');
    });
  });

  // ==========================================================================
  // Confidence Levels
  // ==========================================================================

  describe('confidence level determination', () => {
    it('returns high confidence when multiple high-confidence signals agree', () => {
      setEnv('NODE_ENV', 'production');
      setEnv('DD_ENV', 'production');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.confidence).toBe('high');
      expect(result.environment).toBe('production');
    });

    it('returns medium confidence for single high-confidence signal', () => {
      setEnv('NODE_ENV', 'production');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.confidence).toBe('medium');
    });

    it('returns medium confidence for hostname-only detection', () => {
      setEnv('HOSTNAME', 'staging-server');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.confidence).toBe('medium');
    });

    it('returns unknown confidence when no signals detected', () => {
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.confidence).toBe('unknown');
      expect(result.environment).toBe('unknown');
      expect(result.warnings).toContain('No environment signals detected, using fallback');
    });
  });

  // ==========================================================================
  // Fallback Behavior
  // ==========================================================================

  describe('fallback behavior', () => {
    it('uses unknown as default fallback when no signals', () => {
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.environment).toBe('unknown');
      expect(result.warnings).toBeDefined();
    });

    it('uses custom fallback environment when configured', () => {
      const detector = new EnvironmentDetector({ fallbackEnvironment: 'development' });
      const result = detector.detect();

      expect(result.environment).toBe('development');
    });

    it('ignores unrecognized environment values', () => {
      setEnv('NODE_ENV', 'foobar');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.environment).toBe('unknown');
      expect(result.signals).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Caching Behavior
  // ==========================================================================

  describe('caching behavior', () => {
    it('caches detection results', () => {
      setEnv('NODE_ENV', 'production');
      const detector = new EnvironmentDetector();

      const result1 = detector.detect();
      const result2 = detector.detect();

      expect(result1).toBe(result2); // Same object reference
    });

    it('refresh bypasses cache', () => {
      setEnv('NODE_ENV', 'production');
      const detector = new EnvironmentDetector();

      const result1 = detector.detect();
      setEnv('NODE_ENV', 'development');
      const result2 = detector.refresh();

      expect(result1).not.toBe(result2);
      expect(result1.environment).toBe('production');
      expect(result2.environment).toBe('development');
    });
  });

  // ==========================================================================
  // Context Function
  // ==========================================================================

  describe('getContext integration', () => {
    it('returns complete environment context for production', () => {
      setEnv('NODE_ENV', 'production');
      const detector = new EnvironmentDetector();
      const context = detector.getContext();

      expect(context.current.environment).toBe('production');
      expect(context.isProduction).toBe(true);
      expect(context.isDevelopment).toBe(false);
      expect(context.isStaging).toBe(false);
      expect(context.safetyEnabled).toBe(true);
      expect(context.updatedAt).toBeInstanceOf(Date);
    });

    it('returns complete environment context for development', () => {
      setEnv('NODE_ENV', 'development');
      const detector = new EnvironmentDetector();
      const context = detector.getContext();

      expect(context.current.environment).toBe('development');
      expect(context.isProduction).toBe(false);
      expect(context.isDevelopment).toBe(true);
      expect(context.isStaging).toBe(false);
    });

    it('returns complete environment context for staging', () => {
      setEnv('NODE_ENV', 'staging');
      const detector = new EnvironmentDetector();
      const context = detector.getContext();

      expect(context.current.environment).toBe('staging');
      expect(context.isProduction).toBe(false);
      expect(context.isDevelopment).toBe(false);
      expect(context.isStaging).toBe(true);
    });

    it('treats test environment as development', () => {
      setEnv('NODE_ENV', 'test');
      const detector = new EnvironmentDetector();
      const context = detector.getContext();

      expect(context.current.environment).toBe('test');
      expect(context.isDevelopment).toBe(true);
    });
  });

  // ==========================================================================
  // Convenience Functions
  // ==========================================================================

  describe('convenience function integration', () => {
    it('detectEnvironment works without manual instantiation', () => {
      setEnv('NODE_ENV', 'production');
      const result = detectEnvironment();

      expect(result.environment).toBe('production');
    });

    it('getEnvironmentDetector returns singleton', () => {
      const detector1 = getEnvironmentDetector();
      const detector2 = getEnvironmentDetector();

      expect(detector1).toBe(detector2);
    });

    it('getEnvironmentDetector with config creates new instance', () => {
      const detector1 = getEnvironmentDetector();
      const detector2 = getEnvironmentDetector({ fallbackEnvironment: 'development' });

      expect(detector1).not.toBe(detector2);
    });
  });

  // ==========================================================================
  // Complex Multi-Signal Scenarios
  // ==========================================================================

  describe('complex multi-signal scenarios', () => {
    it('correctly handles 3+ agreeing signals with high confidence', () => {
      setEnv('NODE_ENV', 'production');
      setEnv('DD_ENV', 'production');
      setEnv('ENVIRONMENT', 'production');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.environment).toBe('production');
      expect(result.confidence).toBe('high');
      expect(result.signals.length).toBeGreaterThanOrEqual(3);
      expect(result.warnings).toBeUndefined();
    });

    it('detects conflicts with multiple conflicting signals', () => {
      setEnv('NODE_ENV', 'production');
      setEnv('DD_ENV', 'development');
      setEnv('HOSTNAME', 'staging-server');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.warnings).toBeDefined();
      expect(result.warnings?.[0]).toContain('Conflicting signals');
      expect(result.environment).toBe('production'); // NODE_ENV has highest priority
    });

    it('handles mixed confidence levels correctly', () => {
      setEnv('NODE_ENV', 'production'); // high confidence
      setEnv('HOSTNAME', 'dev-machine'); // medium confidence, different environment
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.environment).toBe('production'); // High-confidence signal wins
      expect(result.warnings).toBeDefined();
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('handles empty string environment variables', () => {
      setEnv('NODE_ENV', '');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.environment).toBe('unknown');
    });

    it('handles whitespace-only environment variables', () => {
      setEnv('NODE_ENV', '  ');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.environment).toBe('unknown');
    });

    it('trims whitespace from environment variables', () => {
      setEnv('NODE_ENV', '  production  ');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.environment).toBe('production');
    });

    it('includes timestamp in detection result', () => {
      setEnv('NODE_ENV', 'production');
      const detector = new EnvironmentDetector();
      const result = detector.detect();

      expect(result.detectedAt).toBeInstanceOf(Date);
    });
  });
});

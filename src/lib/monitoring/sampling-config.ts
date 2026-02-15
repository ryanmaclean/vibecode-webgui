/**
 * Sampling Configuration Module
 * Provides configuration for tail-based sampling with environment variable support
 * Follows defensive patterns for graceful degradation
 */

/**
 * Sampling rule definition
 */
export interface SamplingRule {
  /** Rule name for identification */
  name: string;
  /** Condition that triggers this rule */
  condition: 'error' | 'success' | 'all';
  /** Sample rate (0.0 to 1.0) */
  sampleRate: number;
}

/**
 * Complete sampling configuration
 */
export interface SamplingConfig {
  /** Sampling rules in priority order */
  rules: SamplingRule[];
  /** Error trace sample rate (default: 1.0 = 100%) */
  errorSampleRate: number;
  /** Default/success trace sample rate (default: 0.1 = 10%) */
  defaultSampleRate: number;
  /** Buffer timeout in milliseconds (default: 30000 = 30s) */
  bufferTimeout: number;
  /** Maximum number of spans to buffer (default: 10000) */
  maxBufferSize: number;
  /** Whether sampling is enabled */
  enabled: boolean;
}

/**
 * Default sampling rules
 */
const DEFAULT_RULES: SamplingRule[] = [
  {
    name: 'error-traces',
    condition: 'error',
    sampleRate: 1.0, // 100% of error traces
  },
  {
    name: 'success-traces',
    condition: 'success',
    sampleRate: 0.1, // 10% of successful traces
  },
];

/**
 * Parse and validate environment variable as float
 */
function parseEnvFloat(value: string | undefined, defaultValue: number, min: number = 0, max: number = 1): number {
  if (!value) {
    return defaultValue;
  }

  const parsed = Number(value);
  if (isNaN(parsed)) {
    console.warn(`⚠️ Invalid sampling rate '${value}', using default: ${defaultValue}`);
    return defaultValue;
  }

  if (parsed < min || parsed > max) {
    console.warn(`⚠️ Sampling rate ${parsed} out of range [${min}, ${max}], using default: ${defaultValue}`);
    return defaultValue;
  }

  return parsed;
}

/**
 * Parse and validate environment variable as integer
 */
function parseEnvInt(value: string | undefined, defaultValue: number, min: number = 0): number {
  if (!value) {
    return defaultValue;
  }

  const parsed = Number(value);
  if (isNaN(parsed) || !Number.isInteger(parsed)) {
    console.warn(`⚠️ Invalid integer value '${value}', using default: ${defaultValue}`);
    return defaultValue;
  }

  if (parsed < min) {
    console.warn(`⚠️ Value ${parsed} below minimum ${min}, using default: ${defaultValue}`);
    return defaultValue;
  }

  return parsed;
}

/**
 * Check if sampling is enabled based on environment
 */
function isSamplingEnabled(): boolean {
  // Disabled in test environments
  if (
    process.env.NODE_ENV === 'test' ||
    process.env.SKIP_MONITORING === 'true' ||
    process.env.CI === 'true' ||
    process.env.GITHUB_ACTIONS === 'true'
  ) {
    return false;
  }

  // Disabled if OpenTelemetry is disabled
  if (
    process.env.OTEL_ENABLED === 'false' ||
    process.env.DD_ENABLED === 'false'
  ) {
    return false;
  }

  // Explicitly disabled sampling
  if (process.env.OTEL_SAMPLING_ENABLED === 'false') {
    return false;
  }

  return true;
}

/**
 * Build sampling rules from environment and defaults
 */
function buildSamplingRules(errorRate: number, defaultRate: number): SamplingRule[] {
  return [
    {
      name: 'error-traces',
      condition: 'error',
      sampleRate: errorRate,
    },
    {
      name: 'success-traces',
      condition: 'success',
      sampleRate: defaultRate,
    },
  ];
}

/**
 * Get current sampling configuration from environment variables
 *
 * Environment variables:
 * - OTEL_SAMPLING_ENABLED: Enable/disable sampling (default: true if OTEL enabled)
 * - OTEL_SAMPLING_ERROR_RATE: Sample rate for error traces (default: 1.0)
 * - OTEL_SAMPLING_DEFAULT_RATE: Sample rate for successful traces (default: 0.1)
 * - OTEL_SAMPLING_BUFFER_TIMEOUT: Timeout in ms for trace buffering (default: 30000)
 * - OTEL_SAMPLING_MAX_BUFFER_SIZE: Maximum spans to buffer (default: 10000)
 */
export function getSamplingConfig(): SamplingConfig {
  const enabled = isSamplingEnabled();

  // Parse environment variables with validation
  const errorSampleRate = parseEnvFloat(
    process.env.OTEL_SAMPLING_ERROR_RATE,
    1.0, // 100% default
    0,
    1
  );

  const defaultSampleRate = parseEnvFloat(
    process.env.OTEL_SAMPLING_DEFAULT_RATE,
    0.1, // 10% default
    0,
    1
  );

  const bufferTimeout = parseEnvInt(
    process.env.OTEL_SAMPLING_BUFFER_TIMEOUT,
    30000, // 30 seconds default
    1000 // minimum 1 second
  );

  const maxBufferSize = parseEnvInt(
    process.env.OTEL_SAMPLING_MAX_BUFFER_SIZE,
    10000, // 10k spans default
    100 // minimum 100 spans
  );

  // Build rules from environment configuration
  const rules = buildSamplingRules(errorSampleRate, defaultSampleRate);

  return {
    rules,
    errorSampleRate,
    defaultSampleRate,
    bufferTimeout,
    maxBufferSize,
    enabled,
  };
}

/**
 * Get a specific sampling rule by condition
 */
export function getSamplingRule(condition: 'error' | 'success' | 'all'): SamplingRule | null {
  const config = getSamplingConfig();
  const rule = config.rules.find(r => r.condition === condition);
  return rule || null;
}

/**
 * Validate sampling configuration
 */
export function validateSamplingConfig(config: Partial<SamplingConfig>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (config.errorSampleRate !== undefined) {
    if (config.errorSampleRate < 0 || config.errorSampleRate > 1) {
      errors.push(`errorSampleRate must be between 0 and 1, got: ${config.errorSampleRate}`);
    }
  }

  if (config.defaultSampleRate !== undefined) {
    if (config.defaultSampleRate < 0 || config.defaultSampleRate > 1) {
      errors.push(`defaultSampleRate must be between 0 and 1, got: ${config.defaultSampleRate}`);
    }
  }

  if (config.bufferTimeout !== undefined) {
    if (config.bufferTimeout < 1000) {
      errors.push(`bufferTimeout must be at least 1000ms, got: ${config.bufferTimeout}`);
    }
  }

  if (config.maxBufferSize !== undefined) {
    if (config.maxBufferSize < 100) {
      errors.push(`maxBufferSize must be at least 100, got: ${config.maxBufferSize}`);
    }
  }

  if (config.rules !== undefined) {
    if (!Array.isArray(config.rules)) {
      errors.push('rules must be an array');
    } else {
      config.rules.forEach((rule, index) => {
        if (!rule.name) {
          errors.push(`Rule at index ${index} missing name`);
        }
        if (!rule.condition) {
          errors.push(`Rule at index ${index} missing condition`);
        }
        if (rule.sampleRate === undefined || rule.sampleRate < 0 || rule.sampleRate > 1) {
          errors.push(`Rule at index ${index} has invalid sampleRate: ${rule.sampleRate}`);
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get sampling configuration summary for logging/debugging
 */
export function getSamplingConfigSummary(): string {
  const config = getSamplingConfig();

  if (!config.enabled) {
    return 'Sampling: disabled';
  }

  const summary = [
    `Sampling: enabled`,
    `Error rate: ${(config.errorSampleRate * 100).toFixed(1)}%`,
    `Success rate: ${(config.defaultSampleRate * 100).toFixed(1)}%`,
    `Buffer timeout: ${config.bufferTimeout}ms`,
    `Max buffer size: ${config.maxBufferSize} spans`,
  ];

  return summary.join(', ');
}

/**
 * Export for backward compatibility with existing code
 */
export const samplingConfig = {
  get: getSamplingConfig,
  getRule: getSamplingRule,
  validate: validateSamplingConfig,
  getSummary: getSamplingConfigSummary,
};

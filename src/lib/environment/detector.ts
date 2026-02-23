/**
 * Environment Detection Library
 * Multi-signal detection for identifying dev/staging/prod environments
 */

import {
  EnvironmentType,
  DetectionConfidence,
  DetectionSignal,
  DetectionSignalType,
  EnvironmentDetectionResult,
  EnvironmentDetectorConfig,
  EnvironmentContext,
} from './types'

// Type declarations for environments where global types are not available
declare const process: {
  env: Record<string, string | undefined>;
} | undefined;

declare const window: {
  location: {
    hostname: string;
  };
} | undefined;

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_ENV_VARIABLES = [
  'NODE_ENV',           // Most common
  'DD_ENV',             // Datadog environment
  'ENVIRONMENT',        // Generic
  'APP_ENV',            // Application environment
  'DEPLOYMENT_ENV',     // Deployment environment
  'VERCEL_ENV',         // Vercel platform
  'RAILWAY_ENVIRONMENT', // Railway platform
  'RENDER_ENV',         // Render platform
]

const DEFAULT_HOSTNAME_PATTERNS = {
  development: [
    /^localhost$/i,
    /^127\.0\.0\.1$/,
    /^::1$/,
    /^.*\.local$/i,
    /^dev-/i,
    /^development-/i,
  ],
  staging: [
    /^staging-/i,
    /^stg-/i,
    /^uat-/i,
    /^preprod-/i,
  ],
  production: [
    /^prod-/i,
    /^production-/i,
    /^prd-/i,
  ],
  test: [
    /^test-/i,
    /^ci-/i,
  ],
}

const DEFAULT_DOMAIN_PATTERNS = {
  development: [
    /^localhost$/i,
    /^127\.0\.0\.1$/,
    /\.local$/i,
    /\.dev$/i,
    /^dev\./i,
  ],
  staging: [
    /^staging\./i,
    /^stg\./i,
    /^uat\./i,
    /\.staging\./i,
  ],
  production: [
    /^(?!dev\.|staging\.|stg\.).*$/i, // Matches domains without dev/staging
  ],
}

const DEFAULT_BRANCH_PATTERNS = {
  development: [
    /^main$/i,
    /^master$/i,
    /^develop$/i,
    /^dev$/i,
    /^feature\//i,
  ],
  staging: [
    /^staging$/i,
    /^release\//i,
  ],
  production: [
    /^production$/i,
    /^prod$/i,
  ],
}

// ============================================================================
// Environment Detector Class
// ============================================================================

export class EnvironmentDetector {
  private config: EnvironmentDetectorConfig
  private cachedResult: EnvironmentDetectionResult | null = null
  private cacheExpiry = 60000 // Cache for 1 minute

  constructor(config: EnvironmentDetectorConfig = {}) {
    this.config = {
      envVariables: config.envVariables ?? DEFAULT_ENV_VARIABLES,
      hostnamePatterns: config.hostnamePatterns ?? DEFAULT_HOSTNAME_PATTERNS,
      domainPatterns: config.domainPatterns ?? DEFAULT_DOMAIN_PATTERNS,
      branchPatterns: config.branchPatterns ?? DEFAULT_BRANCH_PATTERNS,
      customRules: config.customRules ?? [],
      fallbackEnvironment: config.fallbackEnvironment ?? 'unknown',
    }
  }

  /**
   * Detect current environment with multi-signal analysis
   */
  detect(): EnvironmentDetectionResult {
    // Return cached result if still valid
    if (this.cachedResult && this.isCacheValid()) {
      return this.cachedResult
    }

    const signals: DetectionSignal[] = []
    const warnings: string[] = []

    // Collect all detection signals
    signals.push(...this.detectFromEnvVariables())
    signals.push(...this.detectFromHostname())
    signals.push(...this.detectFromDomain())
    signals.push(...this.detectFromGitBranch())
    signals.push(...this.detectFromCustomRules())

    // Determine environment from signals
    const result = this.determineEnvironment(signals, warnings)

    // Cache the result
    this.cachedResult = result

    return result
  }

  /**
   * Get complete environment context
   */
  getContext(): EnvironmentContext {
    const detection = this.detect()

    return {
      current: detection,
      safetyEnabled: true, // Always enabled by default
      isProduction: detection.environment === 'production',
      isDevelopment: detection.environment === 'development' || detection.environment === 'test',
      isStaging: detection.environment === 'staging',
      updatedAt: new Date(),
    }
  }

  /**
   * Force refresh of detection (bypass cache)
   */
  refresh(): EnvironmentDetectionResult {
    this.cachedResult = null
    return this.detect()
  }

  // ==========================================================================
  // Signal Detection Methods
  // ==========================================================================

  private detectFromEnvVariables(): DetectionSignal[] {
    const signals: DetectionSignal[] = []

    if (!this.config.envVariables) return signals

    // Check if we're in a Node.js environment
    if (typeof process === 'undefined' || !process.env) {
      return signals
    }

    for (let i = 0; i < this.config.envVariables.length; i++) {
      const envVar = this.config.envVariables[i]
      const value = process.env[envVar]

      if (!value) continue

      const normalizedValue = value.toLowerCase().trim()
      const environment = this.mapValueToEnvironment(normalizedValue)

      if (environment) {
        signals.push({
          type: 'env_variable',
          source: envVar,
          value: value,
          indicates: environment,
          confidence: 'high', // Environment variables are reliable
          priority: 100 - i, // Earlier variables have higher priority
        })
      }
    }

    return signals
  }

  private detectFromHostname(): DetectionSignal[] {
    const signals: DetectionSignal[] = []

    if (!this.config.hostnamePatterns) return signals

    let hostname: string | undefined
    try {
      if (typeof window !== 'undefined' && window.location) {
        hostname = window.location.hostname
      } else if (typeof process !== 'undefined' && process.env.HOSTNAME) {
        hostname = process.env.HOSTNAME
      }
    } catch {
      return signals
    }

    if (!hostname) return signals

    const patterns = this.config.hostnamePatterns
    for (const env in patterns) {
      if (Object.prototype.hasOwnProperty.call(patterns, env)) {
        const envPatterns = patterns[env as keyof typeof patterns]
        if (envPatterns) {
          for (const pattern of envPatterns) {
            if (pattern.test(hostname)) {
              signals.push({
                type: 'hostname',
                source: 'hostname',
                value: hostname,
                indicates: env as EnvironmentType,
                confidence: 'medium',
                priority: 70,
              })
              break // Only add one signal per environment
            }
          }
        }
      }
    }

    return signals
  }

  private detectFromDomain(): DetectionSignal[] {
    const signals: DetectionSignal[] = []

    if (!this.config.domainPatterns) return signals
    if (typeof window === 'undefined' || !window.location) return signals

    const domain = window.location.hostname

    const patterns = this.config.domainPatterns
    for (const env in patterns) {
      if (Object.prototype.hasOwnProperty.call(patterns, env)) {
        const envPatterns = patterns[env as keyof typeof patterns]
        if (envPatterns) {
          for (const pattern of envPatterns) {
            if (pattern.test(domain)) {
              signals.push({
                type: 'domain',
                source: 'domain',
                value: domain,
                indicates: env as EnvironmentType,
                confidence: 'medium',
                priority: 60,
              })
              break
            }
          }
        }
      }
    }

    return signals
  }

  private detectFromGitBranch(): DetectionSignal[] {
    const signals: DetectionSignal[] = []

    if (!this.config.branchPatterns) return signals
    if (typeof process === 'undefined' || !process.env) return signals

    // Try to detect git branch from environment variables
    const branchSources = [
      'VERCEL_GIT_COMMIT_REF',
      'RAILWAY_GIT_BRANCH',
      'RENDER_GIT_BRANCH',
      'GIT_BRANCH',
      'BRANCH_NAME',
    ]

    let branch: string | undefined
    for (const source of branchSources) {
      branch = process.env[source]
      if (branch) break
    }

    if (!branch) return signals

    const patterns = this.config.branchPatterns
    for (const env in patterns) {
      if (Object.prototype.hasOwnProperty.call(patterns, env)) {
        const envPatterns = patterns[env as keyof typeof patterns]
        if (envPatterns) {
          for (const pattern of envPatterns) {
            if (pattern.test(branch)) {
              signals.push({
                type: 'git_branch',
                source: 'git_branch',
                value: branch,
                indicates: env as EnvironmentType,
                confidence: 'low', // Branch is less reliable than env vars
                priority: 40,
              })
              break
            }
          }
        }
      }
    }

    return signals
  }

  private detectFromCustomRules(): DetectionSignal[] {
    const signals: DetectionSignal[] = []

    if (!this.config.customRules) return signals

    for (const rule of this.config.customRules) {
      try {
        const signal = rule.evaluate()
        if (signal) {
          signals.push(signal)
        }
      } catch (error) {
        console.warn(`Custom detection rule '${rule.name}' failed:`, error)
      }
    }

    return signals
  }

  // ==========================================================================
  // Decision Logic
  // ==========================================================================

  private determineEnvironment(
    signals: DetectionSignal[],
    warnings: string[]
  ): EnvironmentDetectionResult {
    if (signals.length === 0) {
      // No signals found - use fallback
      return {
        environment: this.config.fallbackEnvironment ?? 'unknown',
        confidence: 'unknown',
        signals: [],
        detectedAt: new Date(),
        warnings: ['No environment signals detected, using fallback'],
      }
    }

    // Sort signals by priority (highest first)
    const sortedSignals = [...signals].sort((a, b) => b.priority - a.priority)

    // Use highest priority signal as primary
    const primarySignal = sortedSignals[0]
    let environment = primarySignal.indicates

    // Check for conflicts (signals indicating different environments)
    const environmentsMap: { [key: string]: boolean } = {}
    signals.forEach(s => {
      environmentsMap[s.indicates] = true
    })
    const environmentsList = Object.keys(environmentsMap)

    if (environmentsList.length > 1) {
      warnings.push(
        `Conflicting signals detected: ${environmentsList.join(', ')}. ` +
        `Using highest priority signal (${primarySignal.source}: ${environment})`
      )
    }

    // Determine overall confidence
    const confidence = this.determineConfidence(signals, primarySignal)

    return {
      environment,
      confidence,
      signals: sortedSignals,
      primarySignal,
      detectedAt: new Date(),
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  }

  private determineConfidence(
    signals: DetectionSignal[],
    primarySignal: DetectionSignal
  ): DetectionConfidence {
    // If multiple high-confidence signals agree, return high
    const highConfidenceSignals = signals.filter(
      s => s.confidence === 'high' && s.indicates === primarySignal.indicates
    )
    if (highConfidenceSignals.length >= 2) {
      return 'high'
    }

    // If at least one high-confidence signal, return medium
    if (highConfidenceSignals.length === 1) {
      return 'medium'
    }

    // Otherwise use primary signal's confidence
    return primarySignal.confidence
  }

  private mapValueToEnvironment(value: string): EnvironmentType | null {
    const normalized = value.toLowerCase().trim()

    // Direct matches
    if (normalized === 'development' || normalized === 'dev') return 'development'
    if (normalized === 'production' || normalized === 'prod') return 'production'
    if (normalized === 'staging' || normalized === 'stg' || normalized === 'stage') return 'staging'
    if (normalized === 'test' || normalized === 'testing') return 'test'

    return null
  }

  private isCacheValid(): boolean {
    if (!this.cachedResult) return false

    const age = Date.now() - this.cachedResult.detectedAt.getTime()
    return age < this.cacheExpiry
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalDetector: EnvironmentDetector | null = null

/**
 * Get the global environment detector instance
 */
export function getEnvironmentDetector(
  config?: EnvironmentDetectorConfig
): EnvironmentDetector {
  if (!globalDetector || config) {
    globalDetector = new EnvironmentDetector(config)
  }
  return globalDetector
}

/**
 * Detect current environment (convenience function)
 */
export function detectEnvironment(): EnvironmentDetectionResult {
  return getEnvironmentDetector().detect()
}

/**
 * Get current environment context (convenience function)
 */
export function getEnvironmentContext(): EnvironmentContext {
  return getEnvironmentDetector().getContext()
}

/**
 * Check if currently in production
 */
export function isProduction(): boolean {
  return getEnvironmentDetector().detect().environment === 'production'
}

/**
 * Check if currently in development
 */
export function isDevelopment(): boolean {
  const env = getEnvironmentDetector().detect().environment
  return env === 'development' || env === 'test'
}

/**
 * Check if currently in staging
 */
export function isStaging(): boolean {
  return getEnvironmentDetector().detect().environment === 'staging'
}

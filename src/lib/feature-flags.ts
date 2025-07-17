/**
 * Feature Flags and Experimentation System
 * Inspired by Datadog's Eppo acquisition for A/B testing and feature management
 * Provides statistical analysis and data warehouse integration capabilities
 */

import { logger, appLogger } from './server-monitoring'

interface FeatureFlag {
  key: string
  name: string
  description: string
  enabled: boolean
  variants: FeatureFlagVariant[]
  targeting: FeatureFlagTargeting
  metrics: string[]
  createdAt: string
  updatedAt: string
  createdBy: string
}

interface FeatureFlagVariant {
  key: string
  name: string
  description: string
  weight: number
  payload?: Record<string, any>
}

interface FeatureFlagTargeting {
  rules: TargetingRule[]
  defaultVariant: string
  rolloutPercentage: number
}

interface TargetingRule {
  attribute: string
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'contains' | 'regex'
  value: any
  variant: string
}

interface ExperimentContext {
  userId: string
  workspaceId?: string
  userAgent?: string
  ipAddress?: string
  customAttributes?: Record<string, any>
}

interface ExperimentResult {
  flagKey: string
  variant: string
  payload?: Record<string, any>
  isExperiment: boolean
  allocationKey?: string
}

interface ExperimentMetric {
  name: string
  value: number
  timestamp: string
  context: ExperimentContext
  variant: string
  flagKey: string
}

/**
 * Feature Flag and Experimentation Engine
 * Provides Eppo-style experimentation capabilities with statistical analysis
 */
class FeatureFlagEngine {
  private flags: Map<string, FeatureFlag> = new Map()
  private allocations: Map<string, Map<string, string>> = new Map() // userId -> flagKey -> variant
  private metrics: ExperimentMetric[] = []

  constructor() {
    this.initializeDefaultFlags()

    appLogger.logBusiness('feature_flag_engine_initialized', {
      feature: 'experimentation',
      metadata: { totalFlags: this.flags.size }
    })
  }

  /**
   * Evaluate a feature flag for a given context
   */
  async evaluateFlag(
    flagKey: string,
    context: ExperimentContext,
    defaultValue: boolean = false
  ): Promise<ExperimentResult> {
    const startTime = Date.now()

    try {
      const flag = this.flags.get(flagKey)

      if (!flag || !flag.enabled) {
        appLogger.logBusiness('flag_evaluation_disabled', {
          feature: 'feature_flags',
          metadata: { flagKey, enabled: flag?.enabled ?? false }
        })

        return {
          flagKey,
          variant: 'control',
          isExperiment: false
        }
      }

      // Check if user already has an allocation
      const userAllocations = this.allocations.get(context.userId)
      if (userAllocations?.has(flagKey)) {
        const variant = userAllocations.get(flagKey)!
        const flagVariant = flag.variants.find(v => v.key === variant)

        return {
          flagKey,
          variant,
          payload: flagVariant?.payload,
          isExperiment: true,
          allocationKey: this.getAllocationKey(context.userId, flagKey)
        }
      }

      // Evaluate targeting rules
      const targetedVariant = this.evaluateTargeting(flag, context)
      if (targetedVariant) {
        this.setUserAllocation(context.userId, flagKey, targetedVariant)

        const flagVariant = flag.variants.find(v => v.key === targetedVariant)

        appLogger.logBusiness('flag_evaluation_targeted', {
          feature: 'feature_flags',
          userId: context.userId,
          metadata: { flagKey, variant: targetedVariant, targeted: true }
        })

        return {
          flagKey,
          variant: targetedVariant,
          payload: flagVariant?.payload,
          isExperiment: true,
          allocationKey: this.getAllocationKey(context.userId, flagKey)
        }
      }

      // Random allocation based on variant weights
      const allocatedVariant = this.allocateRandomVariant(flag, context)
      this.setUserAllocation(context.userId, flagKey, allocatedVariant)

      const flagVariant = flag.variants.find(v => v.key === allocatedVariant)

      appLogger.logBusiness('flag_evaluation_allocated', {
        feature: 'feature_flags',
        userId: context.userId,
        metadata: { flagKey, variant: allocatedVariant, randomAllocation: true }
      })

      return {
        flagKey,
        variant: allocatedVariant,
        payload: flagVariant?.payload,
        isExperiment: true,
        allocationKey: this.getAllocationKey(context.userId, flagKey)
      }

    } catch (error) {
      logger.error('Feature flag evaluation failed', {
        flagKey,
        userId: context.userId,
        error: (error as Error).message
      })

      return {
        flagKey,
        variant: 'control',
        isExperiment: false
      }
    } finally {
      const duration = Date.now() - startTime
      appLogger.logPerformance({
        endpoint: 'feature_flag_evaluation',
        responseTime: duration,
        method: 'evaluate'
      })
    }
  }

  /**
   * Track an experiment metric (conversion, revenue, etc.)
   */
  async trackMetric(
    flagKey: string,
    metricName: string,
    value: number,
    context: ExperimentContext
  ): Promise<void> {
    try {
      const userAllocations = this.allocations.get(context.userId)
      const variant = userAllocations?.get(flagKey) || 'control'

      const metric: ExperimentMetric = {
        name: metricName,
        value,
        timestamp: new Date().toISOString(),
        context,
        variant,
        flagKey
      }

      this.metrics.push(metric)

      // Log to Datadog for analysis
      appLogger.logBusiness('experiment_metric_tracked', {
        feature: 'experimentation',
        userId: context.userId,
        value,
        metadata: {
          flagKey,
          metricName,
          variant,
          allocationKey: this.getAllocationKey(context.userId, flagKey)
        }
      })

      // Send to Datadog as custom metric
      logger.info('Experiment metric tracked', {
        category: 'experimentation',
        flagKey,
        metricName,
        value,
        variant,
        userId: context.userId
      })

    } catch (error) {
      logger.error('Failed to track experiment metric', {
        flagKey,
        metricName,
        value,
        userId: context.userId,
        error: (error as Error).message
      })
    }
  }

  /**
   * Create or update a feature flag
   */
  async createFlag(flag: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>): Promise<void> {
    const now = new Date().toISOString()
    const fullFlag: FeatureFlag = {
      ...flag,
      createdAt: now,
      updatedAt: now
    }

    this.flags.set(flag.key, fullFlag)

    appLogger.logBusiness('feature_flag_created', {
      feature: 'feature_flags',
      metadata: {
        flagKey: flag.key,
        variantCount: flag.variants.length,
        targetingRules: flag.targeting.rules.length
      }
    })

    logger.info('Feature flag created', {
      category: 'feature_flags',
      flagKey: flag.key,
      enabled: flag.enabled,
      variants: flag.variants.length
    })
  }

  /**
   * Get experiment results and statistical analysis
   */
  async getExperimentResults(flagKey: string): Promise<{
    flag: FeatureFlag | null
    metrics: Record<string, VariantMetrics>
    statisticalSignificance: Record<string, StatisticalResult>
  }> {
    const flag = this.flags.get(flagKey)
    if (!flag) {
      return {
        flag: null,
        metrics: {},
        statisticalSignificance: {}
      }
    }

    const flagMetrics = this.metrics.filter(m => m.flagKey === flagKey)
    const variantMetrics: Record<string, VariantMetrics> = {}

    // Aggregate metrics by variant
    for (const variant of flag.variants) {
      const variantData = flagMetrics.filter(m => m.variant === variant.key)

      variantMetrics[variant.key] = {
        totalSamples: variantData.length,
        conversionRate: this.calculateConversionRate(variantData),
        averageValue: this.calculateAverageValue(variantData),
        standardDeviation: this.calculateStandardDeviation(variantData),
        confidenceInterval: this.calculateConfidenceInterval(variantData)
      }
    }

    // Calculate statistical significance between variants
    const statisticalSignificance: Record<string, StatisticalResult> = {}
    const controlVariant = flag.variants[0]?.key

    if (controlVariant) {
      for (const variant of flag.variants.slice(1)) {
        statisticalSignificance[variant.key] = this.calculateStatisticalSignificance(
          variantMetrics[controlVariant],
          variantMetrics[variant.key]
        )
      }
    }

    return {
      flag,
      metrics: variantMetrics,
      statisticalSignificance
    }
  }

  private evaluateTargeting(flag: FeatureFlag, context: ExperimentContext): string | null {
    for (const rule of flag.targeting.rules) {
      if (this.evaluateRule(rule, context)) {
        return rule.variant
      }
    }
    return null
  }

  private evaluateRule(rule: TargetingRule, context: ExperimentContext): boolean {
    const attributeValue = this.getAttributeValue(rule.attribute, context)

    switch (rule.operator) {
      case 'equals':
        return attributeValue === rule.value
      case 'not_equals':
        return attributeValue !== rule.value
      case 'in':
        return Array.isArray(rule.value) && rule.value.includes(attributeValue)
      case 'not_in':
        return Array.isArray(rule.value) && !rule.value.includes(attributeValue)
      case 'contains':
        return typeof attributeValue === 'string' && attributeValue.includes(rule.value)
      case 'regex':
        return typeof attributeValue === 'string' && new RegExp(rule.value).test(attributeValue)
      default:
        return false
    }
  }

  private getAttributeValue(attribute: string, context: ExperimentContext): any {
    switch (attribute) {
      case 'userId':
        return context.userId
      case 'workspaceId':
        return context.workspaceId
      case 'userAgent':
        return context.userAgent
      case 'ipAddress':
        return context.ipAddress
      default:
        return context.customAttributes?.[attribute]
    }
  }

  private allocateRandomVariant(flag: FeatureFlag, context: ExperimentContext): string {
    const totalWeight = flag.variants.reduce((sum, v) => sum + v.weight, 0)
    const hash = this.hashString(context.userId + flag.key)
    const normalizedHash = hash / 2147483647 // Normalize to 0-1
    const threshold = normalizedHash * totalWeight

    let cumulativeWeight = 0
    for (const variant of flag.variants) {
      cumulativeWeight += variant.weight
      if (threshold <= cumulativeWeight) {
        return variant.key
      }
    }

    return flag.variants[0]?.key || 'control'
  }

  private hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }

  private setUserAllocation(userId: string, flagKey: string, variant: string): void {
    if (!this.allocations.has(userId)) {
      this.allocations.set(userId, new Map())
    }
    this.allocations.get(userId)!.set(flagKey, variant)
  }

  private getAllocationKey(userId: string, flagKey: string): string {
    return `${userId}:${flagKey}`
  }

  private calculateConversionRate(metrics: ExperimentMetric[]): number {
    if (metrics.length === 0) return 0
    const conversions = metrics.filter(m => m.value > 0).length
    return conversions / metrics.length
  }

  private calculateAverageValue(metrics: ExperimentMetric[]): number {
    if (metrics.length === 0) return 0
    const sum = metrics.reduce((acc, m) => acc + m.value, 0)
    return sum / metrics.length
  }

  private calculateStandardDeviation(metrics: ExperimentMetric[]): number {
    if (metrics.length === 0) return 0
    const mean = this.calculateAverageValue(metrics)
    const variance = metrics.reduce((acc, m) => acc + Math.pow(m.value - mean, 2), 0) / metrics.length
    return Math.sqrt(variance)
  }

  private calculateConfidenceInterval(metrics: ExperimentMetric[]): [number, number] {
    if (metrics.length < 2) return [0, 0]
    const mean = this.calculateAverageValue(metrics)
    const stdDev = this.calculateStandardDeviation(metrics)
    const marginOfError = 1.96 * (stdDev / Math.sqrt(metrics.length)) // 95% confidence
    return [mean - marginOfError, mean + marginOfError]
  }

  private calculateStatisticalSignificance(
    control: VariantMetrics,
    treatment: VariantMetrics
  ): StatisticalResult {
    // Simplified z-test for proportions
    const p1 = control.conversionRate
    const p2 = treatment.conversionRate
    const n1 = control.totalSamples
    const n2 = treatment.totalSamples

    if (n1 === 0 || n2 === 0) {
      return {
        pValue: 1,
        isSignificant: false,
        confidenceLevel: 0,
        liftPercentage: 0
      }
    }

    const pooledRate = (p1 * n1 + p2 * n2) / (n1 + n2)
    const standardError = Math.sqrt(pooledRate * (1 - pooledRate) * (1/n1 + 1/n2))
    const zScore = Math.abs((p2 - p1) / standardError)

    // Approximate p-value calculation
    const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)))
    const isSignificant = pValue < 0.05
    const liftPercentage = p1 > 0 ? ((p2 - p1) / p1) * 100 : 0

    return {
      pValue,
      isSignificant,
      confidenceLevel: (1 - pValue) * 100,
      liftPercentage
    }
  }

  private normalCDF(x: number): number {
    // Approximation of standard normal CDF
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)))
  }

  private erf(x: number): number {
    // Approximation of error function
    const a1 =  0.254829592
    const a2 = -0.284496736
    const a3 =  1.421413741
    const a4 = -1.453152027
    const a5 =  1.061405429
    const p  =  0.3275911

    const sign = x >= 0 ? 1 : -1
    x = Math.abs(x)

    const t = 1.0 / (1.0 + p * x)
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)

    return sign * y
  }

  private initializeDefaultFlags(): void {
    // AI Assistant Feature Flag
    this.createFlag({
      key: 'ai_assistant_v2',
      name: 'AI Assistant V2',
      description: 'Enable enhanced AI assistant with advanced code analysis',
      enabled: true,
      variants: [
        { key: 'control', name: 'Control', description: 'Current AI assistant', weight: 50 },
        { key: 'enhanced', name: 'Enhanced', description: 'V2 with code analysis', weight: 50 }
      ],
      targeting: {
        rules: [],
        defaultVariant: 'control',
        rolloutPercentage: 100
      },
      metrics: ['code_completions', 'user_satisfaction', 'session_duration'],
      createdBy: 'system'
    })

    // Code Editor Theme Flag
    this.createFlag({
      key: 'editor_theme_dark_plus',
      name: 'Dark+ Editor Theme',
      description: 'Enable enhanced dark theme for code editor',
      enabled: true,
      variants: [
        { key: 'default', name: 'Default Theme', description: 'Standard VS Code theme', weight: 70 },
        { key: 'dark_plus', name: 'Dark+', description: 'Enhanced dark theme', weight: 30 }
      ],
      targeting: {
        rules: [],
        defaultVariant: 'default',
        rolloutPercentage: 100
      },
      metrics: ['theme_changes', 'user_retention', 'session_duration'],
      createdBy: 'system'
    })
  }
}

interface VariantMetrics {
  totalSamples: number
  conversionRate: number
  averageValue: number
  standardDeviation: number
  confidenceInterval: [number, number]
}

interface StatisticalResult {
  pValue: number
  isSignificant: boolean
  confidenceLevel: number
  liftPercentage: number
}

// Singleton instance
export const featureFlagEngine = new FeatureFlagEngine()

export {
  FeatureFlagEngine,
  type FeatureFlag,
  type FeatureFlagVariant,
  type ExperimentContext,
  type ExperimentResult,
  type ExperimentMetric,
  type VariantMetrics,
  type StatisticalResult
}

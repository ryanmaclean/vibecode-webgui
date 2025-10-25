/**
 * Experiment Templates
 *
 * Pre-configured templates for common experiment types.
 * Provides best-practice defaults for sample sizes, metrics, and guardrails.
 */

import { experimentWarehouse } from './warehouse';
import { GUARDRAIL_TEMPLATES, type Guardrail } from './rollout';
import { logger } from '@/lib/server-monitoring';

/**
 * Metric configuration
 */
export interface MetricConfig {
  name: string;
  type: 'binary' | 'continuous';
  target: 'maximize' | 'minimize';
  description?: string;
}

/**
 * Variant configuration
 */
export interface VariantConfig {
  key: string;
  weight: number;
  name?: string;
  description?: string;
}

/**
 * Experiment template definition
 */
export interface ExperimentTemplate {
  name: string;
  description: string;
  category: 'ui' | 'backend' | 'ai' | 'pricing' | 'feature';
  defaultConfig: {
    variants: VariantConfig[];
    metrics: MetricConfig[];
    guardrails: Guardrail[];
    sampleSize: number;
    duration: number; // milliseconds
    primaryMetric?: string;
  };
  useCases: string[];
  bestPractices: string[];
}

/**
 * Pre-configured experiment templates
 */
export const EXPERIMENT_TEMPLATES: Record<string, ExperimentTemplate> = {
  /**
   * Simple A/B test for UI elements
   */
  button_test: {
    name: 'Button A/B Test',
    description: 'Test button color, text, or placement',
    category: 'ui',
    defaultConfig: {
      variants: [
        { key: 'control', weight: 50, name: 'Current Button', description: 'Original button design' },
        { key: 'treatment', weight: 50, name: 'New Button', description: 'Updated button design' }
      ],
      metrics: [
        {
          name: 'click_rate',
          type: 'binary',
          target: 'maximize',
          description: 'Percentage of users who clicked'
        },
        {
          name: 'conversion_rate',
          type: 'binary',
          target: 'maximize',
          description: 'Percentage who completed desired action'
        }
      ],
      guardrails: [
        GUARDRAIL_TEMPLATES.minConversionRate(0.1),
        GUARDRAIL_TEMPLATES.maxErrorRate(0.01)
      ],
      sampleSize: 2000,
      duration: 604800000, // 7 days
      primaryMetric: 'conversion_rate'
    },
    useCases: [
      'CTA button optimization',
      'Form submit button testing',
      'Navigation element changes',
      'Color/size/text variations'
    ],
    bestPractices: [
      'Test one element at a time',
      'Ensure sufficient contrast for accessibility',
      'Run for full business cycle',
      'Consider mobile vs desktop separately'
    ]
  },

  /**
   * AI model comparison experiment
   */
  ai_model_comparison: {
    name: 'AI Model Comparison',
    description: 'Compare two AI models for quality, latency, and cost',
    category: 'ai',
    defaultConfig: {
      variants: [
        { key: 'model_a', weight: 50, name: 'Current Model', description: 'Production model' },
        { key: 'model_b', weight: 50, name: 'New Model', description: 'Candidate model' }
      ],
      metrics: [
        {
          name: 'latency_ms',
          type: 'continuous',
          target: 'minimize',
          description: 'Response time in milliseconds'
        },
        {
          name: 'cost_per_request',
          type: 'continuous',
          target: 'minimize',
          description: 'Cost per API request'
        },
        {
          name: 'quality_score',
          type: 'continuous',
          target: 'maximize',
          description: 'Model output quality (0-1)'
        },
        {
          name: 'user_satisfaction',
          type: 'binary',
          target: 'maximize',
          description: 'User satisfaction with response'
        }
      ],
      guardrails: [
        GUARDRAIL_TEMPLATES.maxP95Latency(5000),
        GUARDRAIL_TEMPLATES.maxCostPerRequest(0.05),
        GUARDRAIL_TEMPLATES.maxErrorRate(0.02)
      ],
      sampleSize: 1000,
      duration: 1209600000, // 14 days
      primaryMetric: 'quality_score'
    },
    useCases: [
      'LLM model upgrades',
      'Prompt engineering validation',
      'Model parameter tuning',
      'Cost vs quality tradeoff analysis'
    ],
    bestPractices: [
      'Define quality metrics upfront',
      'Monitor cost closely',
      'Test with representative prompts',
      'Consider edge cases',
      'Track error rates by error type'
    ]
  },

  /**
   * Multi-armed bandit experiment
   */
  multi_arm_bandit: {
    name: 'Multi-Armed Bandit',
    description: 'Dynamic optimization across 4+ variants',
    category: 'feature',
    defaultConfig: {
      variants: [
        { key: 'variant_a', weight: 25, name: 'Option A' },
        { key: 'variant_b', weight: 25, name: 'Option B' },
        { key: 'variant_c', weight: 25, name: 'Option C' },
        { key: 'variant_d', weight: 25, name: 'Option D' }
      ],
      metrics: [
        {
          name: 'reward',
          type: 'continuous',
          target: 'maximize',
          description: 'Reward value per interaction'
        },
        {
          name: 'engagement_rate',
          type: 'binary',
          target: 'maximize',
          description: 'User engagement'
        }
      ],
      guardrails: [
        GUARDRAIL_TEMPLATES.maxErrorRate(0.02)
      ],
      sampleSize: 5000,
      duration: 2592000000, // 30 days
      primaryMetric: 'reward'
    },
    useCases: [
      'Content personalization',
      'Recommendation algorithm testing',
      'Ad creative optimization',
      'Feature variant exploration'
    ],
    bestPractices: [
      'Start with equal weights',
      'Use Thompson sampling or UCB',
      'Monitor exploration vs exploitation',
      'Consider time-varying rewards',
      'Plan for long-term learning'
    ]
  },

  /**
   * Pricing experiment
   */
  pricing_test: {
    name: 'Pricing Experiment',
    description: 'Test different price points or structures',
    category: 'pricing',
    defaultConfig: {
      variants: [
        { key: 'current_price', weight: 40, name: 'Current Pricing', description: 'Existing price point' },
        { key: 'lower_price', weight: 30, name: 'Lower Price', description: '10-20% reduction' },
        { key: 'higher_price', weight: 30, name: 'Higher Price', description: '10-20% increase' }
      ],
      metrics: [
        {
          name: 'conversion_rate',
          type: 'binary',
          target: 'maximize',
          description: 'Purchase rate'
        },
        {
          name: 'revenue_per_user',
          type: 'continuous',
          target: 'maximize',
          description: 'Average revenue per user'
        },
        {
          name: 'total_revenue',
          type: 'continuous',
          target: 'maximize',
          description: 'Total revenue generated'
        },
        {
          name: 'churn_rate',
          type: 'binary',
          target: 'minimize',
          description: 'Customer churn rate'
        }
      ],
      guardrails: [
        GUARDRAIL_TEMPLATES.minConversionRate(0.02),
        {
          name: 'Min Revenue Per User',
          metricName: 'revenue_per_user',
          threshold: 10,
          operator: 'gte',
          type: 'custom'
        }
      ],
      sampleSize: 3000,
      duration: 1209600000, // 14 days
      primaryMetric: 'total_revenue'
    },
    useCases: [
      'Price optimization',
      'Tiered pricing structure',
      'Promotional pricing',
      'Value-based pricing validation'
    ],
    bestPractices: [
      'Segment by user cohort',
      'Track lifetime value',
      'Monitor churn carefully',
      'Consider competitor pricing',
      'Test during representative period',
      'Account for seasonality'
    ]
  },

  /**
   * Feature flag / rollout experiment
   */
  feature_rollout: {
    name: 'Feature Rollout',
    description: 'Gradual rollout of new feature with monitoring',
    category: 'feature',
    defaultConfig: {
      variants: [
        { key: 'control', weight: 90, name: 'Current Version', description: 'Without new feature' },
        { key: 'feature_enabled', weight: 10, name: 'New Feature', description: 'With new feature' }
      ],
      metrics: [
        {
          name: 'feature_usage',
          type: 'binary',
          target: 'maximize',
          description: 'Feature adoption rate'
        },
        {
          name: 'error_rate',
          type: 'continuous',
          target: 'minimize',
          description: 'Error rate'
        },
        {
          name: 'session_duration',
          type: 'continuous',
          target: 'maximize',
          description: 'User session duration'
        }
      ],
      guardrails: [
        GUARDRAIL_TEMPLATES.maxErrorRate(0.01),
        GUARDRAIL_TEMPLATES.maxP95Latency(3000)
      ],
      sampleSize: 1000,
      duration: 604800000, // 7 days
      primaryMetric: 'feature_usage'
    },
    useCases: [
      'New feature validation',
      'Breaking change rollout',
      'UI redesign',
      'Backend optimization'
    ],
    bestPractices: [
      'Start with small percentage',
      'Monitor performance closely',
      'Have rollback plan ready',
      'Test across user segments',
      'Collect qualitative feedback'
    ]
  },

  /**
   * Backend performance experiment
   */
  backend_optimization: {
    name: 'Backend Optimization',
    description: 'Test backend changes for performance improvements',
    category: 'backend',
    defaultConfig: {
      variants: [
        { key: 'current', weight: 50, name: 'Current Implementation' },
        { key: 'optimized', weight: 50, name: 'Optimized Version' }
      ],
      metrics: [
        {
          name: 'latency_p50',
          type: 'continuous',
          target: 'minimize',
          description: 'Median latency'
        },
        {
          name: 'latency_p95',
          type: 'continuous',
          target: 'minimize',
          description: '95th percentile latency'
        },
        {
          name: 'latency_p99',
          type: 'continuous',
          target: 'minimize',
          description: '99th percentile latency'
        },
        {
          name: 'error_rate',
          type: 'continuous',
          target: 'minimize',
          description: 'Error rate'
        },
        {
          name: 'throughput',
          type: 'continuous',
          target: 'maximize',
          description: 'Requests per second'
        }
      ],
      guardrails: [
        GUARDRAIL_TEMPLATES.maxErrorRate(0.005),
        GUARDRAIL_TEMPLATES.maxP95Latency(1000)
      ],
      sampleSize: 10000,
      duration: 259200000, // 3 days
      primaryMetric: 'latency_p95'
    },
    useCases: [
      'Database query optimization',
      'Caching strategy changes',
      'API endpoint improvements',
      'Algorithm optimization'
    ],
    bestPractices: [
      'Test under production load',
      'Monitor resource usage',
      'Track error types',
      'Consider time of day variations',
      'Test edge cases'
    ]
  }
};

/**
 * Create an experiment from a template
 *
 * @param templateKey - Template identifier
 * @param experimentKey - Unique key for new experiment
 * @param experimentName - Human-readable name
 * @param overrides - Optional config overrides
 * @returns Created experiment
 *
 * @example
 * // Create button test from template
 * const experiment = await createFromTemplate(
 *   'button_test',
 *   'checkout-button-color',
 *   'Checkout Button Color Test',
 *   {
 *     variants: [
 *       { key: 'blue', weight: 50 },
 *       { key: 'green', weight: 50 }
 *     ]
 *   }
 * );
 */
export async function createFromTemplate(
  templateKey: string,
  experimentKey: string,
  experimentName: string,
  overrides?: Partial<ExperimentTemplate['defaultConfig']>
): Promise<any> {
  try {
    const template = EXPERIMENT_TEMPLATES[templateKey];

    if (!template) {
      throw new Error(`Template not found: ${templateKey}`);
    }

    // Merge template config with overrides
    const config = {
      ...template.defaultConfig,
      ...overrides,
      template: templateKey,
      createdFrom: 'template'
    };

    // Create experiment
    const experiment = await experimentWarehouse.upsertExperiment(
      experimentKey,
      experimentName,
      config,
      `Created from template: ${template.name}`,
      'draft'
    );

    logger.info('Experiment created from template', {
      experimentKey,
      templateKey,
      template: template.name
    });

    return experiment;

  } catch (error) {
    logger.error('Failed to create experiment from template', {
      templateKey,
      experimentKey,
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * Get template by key
 *
 * @param templateKey - Template identifier
 * @returns Template definition or undefined
 */
export function getTemplate(templateKey: string): ExperimentTemplate | undefined {
  return EXPERIMENT_TEMPLATES[templateKey];
}

/**
 * List all available templates
 *
 * @param category - Optional category filter
 * @returns Array of template definitions
 */
export function listTemplates(category?: ExperimentTemplate['category']): ExperimentTemplate[] {
  const templates = Object.values(EXPERIMENT_TEMPLATES);

  if (category) {
    return templates.filter(t => t.category === category);
  }

  return templates;
}

/**
 * Get template categories
 *
 * @returns Array of unique categories
 */
export function getTemplateCategories(): string[] {
  const categories = Object.values(EXPERIMENT_TEMPLATES).map(t => t.category);
  return [...new Set(categories)];
}

/**
 * Validate experiment config against template
 *
 * @param config - Experiment configuration
 * @param templateKey - Template to validate against
 * @returns Validation result
 */
export function validateAgainstTemplate(
  config: any,
  templateKey: string
): { valid: boolean; errors: string[] } {
  const template = EXPERIMENT_TEMPLATES[templateKey];
  const errors: string[] = [];

  if (!template) {
    errors.push(`Template not found: ${templateKey}`);
    return { valid: false, errors };
  }

  // Check required variants
  if (!config.variants || config.variants.length < 2) {
    errors.push('At least 2 variants required');
  }

  // Check variant weights sum to 100
  if (config.variants) {
    const totalWeight = config.variants.reduce((sum: number, v: any) => sum + (v.weight || 0), 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      errors.push(`Variant weights must sum to 100, got ${totalWeight}`);
    }
  }

  // Check required metrics
  if (!config.metrics || config.metrics.length === 0) {
    errors.push('At least 1 metric required');
  }

  // Check sample size
  if (config.sampleSize < template.defaultConfig.sampleSize / 2) {
    errors.push(
      `Sample size ${config.sampleSize} is too small. Recommended: ${template.defaultConfig.sampleSize}`
    );
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get recommended sample size for a template
 *
 * @param templateKey - Template identifier
 * @param minimumDetectableEffect - Minimum effect to detect (e.g., 0.05 for 5%)
 * @param power - Statistical power (default: 0.8)
 * @param alpha - Significance level (default: 0.05)
 * @returns Recommended sample size per variant
 */
export function getRecommendedSampleSize(
  templateKey: string,
  minimumDetectableEffect: number = 0.05,
  power: number = 0.8,
  alpha: number = 0.05
): number {
  const template = EXPERIMENT_TEMPLATES[templateKey];

  if (!template) {
    throw new Error(`Template not found: ${templateKey}`);
  }

  // Simple approximation for binary metrics
  // More sophisticated calculation would use actual statistical formulas
  const baseSize = template.defaultConfig.sampleSize;
  const effectAdjustment = Math.pow(0.05 / minimumDetectableEffect, 2);

  return Math.ceil(baseSize * effectAdjustment);
}

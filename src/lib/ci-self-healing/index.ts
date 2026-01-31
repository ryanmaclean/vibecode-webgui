/**
 * Self-Healing CI Module
 *
 * Analyzes CI failures and generates automatic fixes using Claude.
 *
 * Usage:
 * ```typescript
 * import { SelfHealingCI } from '@/lib/ci-self-healing'
 *
 * const healer = new SelfHealingCI({
 *   owner: 'your-org',
 *   repo: 'your-repo',
 *   githubToken: process.env.GITHUB_TOKEN!,
 *   anthropicApiKey: process.env.ANTHROPIC_API_KEY,
 * })
 *
 * // Analyze and fix the latest failure
 * const result = await healer.healLatestFailure()
 * ```
 */

export * from './types'
export { FailureAnalyzer } from './failure-analyzer'
export { FixGenerator } from './fix-generator'

import { FailureAnalyzer } from './failure-analyzer'
import { FixGenerator } from './fix-generator'
import type {
  SelfHealingConfig,
  FailureAnalysisResult,
  FixGenerationResult,
  PRCreationResult,
} from './types'

export interface HealingResult {
  analysis: FailureAnalysisResult
  fixes: FixGenerationResult
  pr?: PRCreationResult | null
}

/**
 * Main entry point for Self-Healing CI functionality
 */
export class SelfHealingCI {
  private analyzer: FailureAnalyzer
  private generator: FixGenerator
  private config: SelfHealingConfig

  constructor(config: SelfHealingConfig) {
    this.config = config
    this.analyzer = new FailureAnalyzer(config)
    this.generator = new FixGenerator(config)
  }

  /**
   * Analyze and fix the most recent failed workflow run
   */
  async healLatestFailure(): Promise<HealingResult | null> {
    // Analyze the latest failure
    const analysis = await this.analyzer.analyzeLatestFailure()

    if (!analysis) {
      console.log('No recent failures found')
      return null
    }

    return this.healFailure(analysis)
  }

  /**
   * Analyze and fix a specific workflow run
   */
  async healWorkflowRun(runId: number): Promise<HealingResult> {
    const analysis = await this.analyzer.analyzeWorkflowRun(runId)
    return this.healFailure(analysis)
  }

  /**
   * Process an analyzed failure and generate fixes
   */
  private async healFailure(analysis: FailureAnalysisResult): Promise<HealingResult> {
    // Generate fixes
    const fixes = await this.generator.generateFixes(analysis)

    // Optionally create PR
    let pr: PRCreationResult | null = null
    if (this.config.createPR && fixes.suggestions.length > 0) {
      pr = await this.generator.applyFixesAndCreatePR(analysis, fixes)
    }

    return {
      analysis,
      fixes,
      pr,
    }
  }

  /**
   * Analyze a workflow run without generating fixes
   */
  async analyzeOnly(runId: number): Promise<FailureAnalysisResult> {
    return this.analyzer.analyzeWorkflowRun(runId)
  }

  /**
   * Generate fixes for a pre-analyzed failure
   */
  async generateFixesOnly(analysis: FailureAnalysisResult): Promise<FixGenerationResult> {
    return this.generator.generateFixes(analysis)
  }
}

/**
 * Create a Self-Healing CI instance with default configuration
 */
export function createSelfHealingCI(
  owner: string,
  repo: string,
  options: Partial<SelfHealingConfig> = {}
): SelfHealingCI {
  const config: SelfHealingConfig = {
    owner,
    repo,
    githubToken: options.githubToken || process.env.GITHUB_TOKEN || '',
    anthropicApiKey: options.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
    maxLogsSize: options.maxLogsSize || 500000,
    analysisModel: options.analysisModel || 'claude-sonnet-4-20250514',
    fixModel: options.fixModel || 'claude-sonnet-4-20250514',
    confidenceThreshold: options.confidenceThreshold || 0.3,
    autoFix: options.autoFix || false,
    createPR: options.createPR || false,
    dryRun: options.dryRun || false,
  }

  return new SelfHealingCI(config)
}

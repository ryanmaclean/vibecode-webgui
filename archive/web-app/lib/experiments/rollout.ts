/**
 * Gradual Rollout Manager
 *
 * Implements progressive traffic ramping for winning variants.
 * Monitors guardrails at each stage and can auto-pause if violations detected.
 */

import { PrismaClient } from '@prisma/client';
import { logger, appLogger } from '@/lib/server-monitoring';
import { scheduleTrafficRamp } from './scheduler';

const prisma = new PrismaClient();

/**
 * Guardrail definition for rollout monitoring
 */
export interface Guardrail {
  name: string;
  metricName: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'gte' | 'lte'; // greater than, less than, etc.
  type: 'error_rate' | 'latency' | 'conversion' | 'custom';
}

/**
 * Single stage in a rollout schedule
 */
export interface RolloutStage {
  percentage: number; // Target traffic percentage
  duration: number; // Duration in milliseconds
  guardrails: Guardrail[];
  completedAt?: Date;
  status?: 'pending' | 'active' | 'completed' | 'failed';
}

/**
 * Complete rollout schedule for a winning variant
 */
export interface RolloutSchedule {
  id?: string;
  experimentKey: string;
  winningVariant: string;
  stages: RolloutStage[];
  currentStage: number;
  startedAt: Date;
  completedAt?: Date;
  status: 'pending' | 'active' | 'completed' | 'paused' | 'failed';
  pausedReason?: string;
}

/**
 * Default conservative rollout stages
 * 1% → 10% → 50% → 100% with monitoring periods
 */
export const DEFAULT_ROLLOUT_STAGES: RolloutStage[] = [
  {
    percentage: 1,
    duration: 86400000, // 1 day
    guardrails: [],
    status: 'pending'
  },
  {
    percentage: 10,
    duration: 172800000, // 2 days
    guardrails: [],
    status: 'pending'
  },
  {
    percentage: 50,
    duration: 172800000, // 2 days
    guardrails: [],
    status: 'pending'
  },
  {
    percentage: 100,
    duration: 0, // Final stage
    guardrails: [],
    status: 'pending'
  }
];

/**
 * Create a rollout schedule for a winning variant
 *
 * @param experimentKey - Unique experiment identifier
 * @param winningVariant - Variant to roll out
 * @param stages - Custom stages or use default
 * @returns Created rollout schedule
 *
 * @example
 * // Use default conservative rollout
 * const rollout = await createRolloutSchedule('feature-test', 'treatment');
 *
 * // Custom rollout stages
 * const customStages = [
 *   { percentage: 5, duration: 3600000, guardrails: [] },
 *   { percentage: 25, duration: 3600000, guardrails: [] },
 *   { percentage: 100, duration: 0, guardrails: [] }
 * ];
 * const rollout = await createRolloutSchedule('feature-test', 'treatment', customStages);
 */
export async function createRolloutSchedule(
  experimentKey: string,
  winningVariant: string,
  stages?: RolloutStage[]
): Promise<RolloutSchedule> {
  try {
    const rolloutStages = stages || DEFAULT_ROLLOUT_STAGES;

    const rollout: RolloutSchedule = {
      experimentKey,
      winningVariant,
      stages: rolloutStages.map(s => ({ ...s, status: 'pending' })),
      currentStage: 0,
      startedAt: new Date(),
      status: 'pending'
    };

    // Store in database
    await prisma.$executeRaw`
      INSERT INTO experiment_rollouts
        (experiment_key, winning_variant, stages, current_stage, started_at, status)
      VALUES
        (${experimentKey}, ${winningVariant}, ${JSON.stringify(rollout.stages)}::jsonb,
         ${rollout.currentStage}, ${rollout.startedAt}, ${rollout.status})
    `;

    logger.info('Rollout schedule created', {
      experimentKey,
      winningVariant,
      stageCount: rollout.stages.length
    });

    appLogger.logBusiness('rollout_created', {
      feature: 'experimentation',
      metadata: {
        experimentKey,
        winningVariant,
        stageCount: rollout.stages.length
      }
    });

    return rollout;

  } catch (error) {
    logger.error('Failed to create rollout schedule', {
      experimentKey,
      winningVariant,
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * Get rollout schedule for an experiment
 *
 * @param experimentKey - Unique experiment identifier
 * @returns Rollout schedule or null if not found
 */
export async function getRolloutSchedule(
  experimentKey: string
): Promise<RolloutSchedule | null> {
  try {
    const results = await prisma.$queryRaw<any[]>`
      SELECT * FROM experiment_rollouts
      WHERE experiment_key = ${experimentKey}
        AND status != 'completed'
      ORDER BY started_at DESC
      LIMIT 1
    `;

    if (results.length === 0) {
      return null;
    }

    return mapRolloutSchedule(results[0]);

  } catch (error) {
    logger.error('Failed to get rollout schedule', {
      experimentKey,
      error: (error as Error).message
    });
    return null;
  }
}

/**
 * Execute the next rollout stage
 *
 * Advances to next stage and updates variant traffic allocation.
 *
 * @param rollout - Rollout schedule
 * @returns Updated rollout schedule
 *
 * @example
 * const rollout = await getRolloutSchedule('feature-test');
 * if (rollout) {
 *   await executeRolloutStage(rollout);
 * }
 */
export async function executeRolloutStage(
  rollout: RolloutSchedule
): Promise<RolloutSchedule> {
  try {
    const currentStageIndex = rollout.currentStage;

    if (currentStageIndex >= rollout.stages.length) {
      throw new Error('No more stages to execute');
    }

    const stage = rollout.stages[currentStageIndex];

    logger.info('Executing rollout stage', {
      experimentKey: rollout.experimentKey,
      stage: currentStageIndex,
      percentage: stage.percentage
    });

    // Update experiment variant weights
    const experiment = await prisma.experiment.findUnique({
      where: { key: rollout.experimentKey }
    });

    if (!experiment) {
      throw new Error(`Experiment not found: ${rollout.experimentKey}`);
    }

    const config = experiment.config as any;
    const variants = config.variants || [];

    // Set winning variant to target percentage
    const winningVariantConfig = variants.find(
      (v: any) => v.key === rollout.winningVariant
    );

    if (winningVariantConfig) {
      winningVariantConfig.weight = stage.percentage;

      // Distribute remaining traffic to other variants
      const otherVariants = variants.filter(
        (v: any) => v.key !== rollout.winningVariant
      );

      const remainingWeight = 100 - stage.percentage;
      const totalOtherWeight = otherVariants.reduce(
        (sum: number, v: any) => sum + (v.weight || 0),
        0
      );

      if (totalOtherWeight > 0 && remainingWeight > 0) {
        otherVariants.forEach((v: any) => {
          v.weight = (v.weight / totalOtherWeight) * remainingWeight;
        });
      } else if (remainingWeight === 0) {
        // 100% to winner, zero others
        otherVariants.forEach((v: any) => {
          v.weight = 0;
        });
      }

      await prisma.experiment.update({
        where: { key: rollout.experimentKey },
        data: { config }
      });
    }

    // Mark stage as completed
    stage.completedAt = new Date();
    stage.status = 'completed';

    // Check if this is the last stage
    const isLastStage = currentStageIndex === rollout.stages.length - 1;

    if (isLastStage) {
      rollout.status = 'completed';
      rollout.completedAt = new Date();
    } else {
      // Advance to next stage
      rollout.currentStage += 1;
      rollout.stages[rollout.currentStage].status = 'active';

      // Schedule next stage
      const nextStage = rollout.stages[rollout.currentStage];
      if (nextStage.duration > 0) {
        const nextStageDate = new Date(Date.now() + nextStage.duration);
        await scheduleTrafficRamp(
          rollout.experimentKey,
          nextStageDate,
          nextStage.percentage,
          rollout.winningVariant
        );
      }
    }

    // Update database
    await prisma.$executeRaw`
      UPDATE experiment_rollouts
      SET stages = ${JSON.stringify(rollout.stages)}::jsonb,
          current_stage = ${rollout.currentStage},
          status = ${rollout.status},
          completed_at = ${rollout.completedAt || null},
          updated_at = ${new Date()}
      WHERE experiment_key = ${rollout.experimentKey}
        AND started_at = ${rollout.startedAt}
    `;

    appLogger.logBusiness('rollout_stage_executed', {
      feature: 'experimentation',
      metadata: {
        experimentKey: rollout.experimentKey,
        stage: currentStageIndex,
        percentage: stage.percentage,
        isLastStage
      }
    });

    logger.info('Rollout stage executed', {
      experimentKey: rollout.experimentKey,
      stage: currentStageIndex,
      percentage: stage.percentage,
      nextStage: rollout.currentStage
    });

    return rollout;

  } catch (error) {
    logger.error('Failed to execute rollout stage', {
      experimentKey: rollout.experimentKey,
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * Evaluate guardrails for current rollout stage
 *
 * @param rollout - Rollout schedule
 * @returns true if all guardrails pass, false otherwise
 */
export async function evaluateRolloutGuardrails(
  rollout: RolloutSchedule
): Promise<{ passed: boolean; violations: string[] }> {
  try {
    const currentStage = rollout.stages[rollout.currentStage];
    const violations: string[] = [];

    if (!currentStage.guardrails || currentStage.guardrails.length === 0) {
      return { passed: true, violations: [] };
    }

    // Get recent metrics for the variant
    const metricsData = await prisma.$queryRaw<any[]>`
      SELECT metric_name, AVG(value) as avg_value, COUNT(*) as count
      FROM experiment_metrics
      WHERE experiment_id = (
        SELECT id FROM experiments WHERE key = ${rollout.experimentKey}
      )
      AND variant_key = ${rollout.winningVariant}
      AND timestamp >= ${new Date(Date.now() - currentStage.duration)}
      GROUP BY metric_name
    `;

    // Check each guardrail
    for (const guardrail of currentStage.guardrails) {
      const metric = metricsData.find(m => m.metric_name === guardrail.metricName);

      if (!metric) {
        logger.warn('Guardrail metric not found', {
          experimentKey: rollout.experimentKey,
          metricName: guardrail.metricName
        });
        continue;
      }

      const value = parseFloat(metric.avg_value);
      const threshold = guardrail.threshold;
      let violated = false;

      switch (guardrail.operator) {
        case 'gt':
          violated = value <= threshold;
          break;
        case 'lt':
          violated = value >= threshold;
          break;
        case 'gte':
          violated = value < threshold;
          break;
        case 'lte':
          violated = value > threshold;
          break;
      }

      if (violated) {
        const violation = `${guardrail.name}: ${guardrail.metricName} = ${value.toFixed(4)} (threshold: ${guardrail.operator} ${threshold})`;
        violations.push(violation);
        logger.warn('Guardrail violation detected', {
          experimentKey: rollout.experimentKey,
          guardrail: guardrail.name,
          value,
          threshold,
          operator: guardrail.operator
        });
      }
    }

    return {
      passed: violations.length === 0,
      violations
    };

  } catch (error) {
    logger.error('Failed to evaluate guardrails', {
      experimentKey: rollout.experimentKey,
      error: (error as Error).message
    });
    return { passed: false, violations: [`Error evaluating guardrails: ${(error as Error).message}`] };
  }
}

/**
 * Pause a rollout due to guardrail violations
 *
 * @param rollout - Rollout schedule
 * @param reason - Reason for pausing
 */
export async function pauseRollout(
  rollout: RolloutSchedule,
  reason: string
): Promise<void> {
  try {
    rollout.status = 'paused';
    rollout.pausedReason = reason;

    await prisma.$executeRaw`
      UPDATE experiment_rollouts
      SET status = 'paused',
          paused_reason = ${reason},
          updated_at = ${new Date()}
      WHERE experiment_key = ${rollout.experimentKey}
        AND started_at = ${rollout.startedAt}
    `;

    appLogger.logBusiness('rollout_paused', {
      feature: 'experimentation',
      metadata: {
        experimentKey: rollout.experimentKey,
        reason,
        stage: rollout.currentStage
      }
    });

    logger.warn('Rollout paused', {
      experimentKey: rollout.experimentKey,
      reason
    });

  } catch (error) {
    logger.error('Failed to pause rollout', {
      experimentKey: rollout.experimentKey,
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * Resume a paused rollout
 *
 * @param rollout - Rollout schedule
 */
export async function resumeRollout(
  rollout: RolloutSchedule
): Promise<void> {
  try {
    rollout.status = 'active';
    rollout.pausedReason = undefined;

    await prisma.$executeRaw`
      UPDATE experiment_rollouts
      SET status = 'active',
          paused_reason = NULL,
          updated_at = ${new Date()}
      WHERE experiment_key = ${rollout.experimentKey}
        AND started_at = ${rollout.startedAt}
    `;

    logger.info('Rollout resumed', {
      experimentKey: rollout.experimentKey
    });

  } catch (error) {
    logger.error('Failed to resume rollout', {
      experimentKey: rollout.experimentKey,
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * Start monitoring a rollout
 *
 * Periodically checks guardrails and auto-advances stages.
 *
 * @param rollout - Rollout schedule
 * @param checkIntervalMs - Check interval in milliseconds (default: 300000 = 5 minutes)
 * @returns Stop function to halt monitoring
 */
export function startRolloutMonitoring(
  rollout: RolloutSchedule,
  checkIntervalMs: number = 300000 // 5 minutes
): () => void {
  logger.info('Starting rollout monitoring', {
    experimentKey: rollout.experimentKey,
    checkIntervalMs
  });

  const timer = setInterval(async () => {
    try {
      // Get latest rollout state
      const currentRollout = await getRolloutSchedule(rollout.experimentKey);

      if (!currentRollout || currentRollout.status === 'completed') {
        logger.info('Rollout completed, stopping monitoring', {
          experimentKey: rollout.experimentKey
        });
        clearInterval(timer);
        return;
      }

      if (currentRollout.status === 'paused') {
        logger.info('Rollout paused, skipping check', {
          experimentKey: rollout.experimentKey
        });
        return;
      }

      // Check guardrails
      const guardrailResult = await evaluateRolloutGuardrails(currentRollout);

      if (!guardrailResult.passed) {
        await pauseRollout(
          currentRollout,
          `Guardrail violations: ${guardrailResult.violations.join(', ')}`
        );
        return;
      }

      // Check if current stage duration elapsed
      const currentStage = currentRollout.stages[currentRollout.currentStage];
      const stageStartTime = currentStage.completedAt
        ? new Date(currentStage.completedAt)
        : currentRollout.startedAt;

      const elapsedMs = Date.now() - stageStartTime.getTime();

      if (currentStage.duration > 0 && elapsedMs >= currentStage.duration) {
        logger.info('Stage duration elapsed, advancing', {
          experimentKey: rollout.experimentKey,
          stage: currentRollout.currentStage
        });
        await executeRolloutStage(currentRollout);
      }

    } catch (error) {
      logger.error('Rollout monitoring iteration failed', {
        experimentKey: rollout.experimentKey,
        error: (error as Error).message
      });
    }
  }, checkIntervalMs);

  // Ensure timer doesn't prevent process exit
  if (timer.unref) {
    timer.unref();
  }

  // Return stop function
  return () => {
    logger.info('Stopping rollout monitoring', {
      experimentKey: rollout.experimentKey
    });
    clearInterval(timer);
  };
}

/**
 * Map database record to RolloutSchedule
 */
function mapRolloutSchedule(record: any): RolloutSchedule {
  return {
    id: record.id,
    experimentKey: record.experiment_key,
    winningVariant: record.winning_variant,
    stages: record.stages,
    currentStage: record.current_stage,
    startedAt: record.started_at,
    completedAt: record.completed_at,
    status: record.status,
    pausedReason: record.paused_reason
  };
}

/**
 * Common guardrail templates
 */
export const GUARDRAIL_TEMPLATES = {
  maxErrorRate: (threshold: number): Guardrail => ({
    name: 'Max Error Rate',
    metricName: 'error_rate',
    threshold,
    operator: 'lte',
    type: 'error_rate'
  }),

  minConversionRate: (threshold: number): Guardrail => ({
    name: 'Min Conversion Rate',
    metricName: 'conversion_rate',
    threshold,
    operator: 'gte',
    type: 'conversion'
  }),

  maxP95Latency: (threshold: number): Guardrail => ({
    name: 'Max P95 Latency',
    metricName: 'latency_p95',
    threshold,
    operator: 'lte',
    type: 'latency'
  }),

  maxCostPerRequest: (threshold: number): Guardrail => ({
    name: 'Max Cost Per Request',
    metricName: 'cost_per_request',
    threshold,
    operator: 'lte',
    type: 'custom'
  })
};

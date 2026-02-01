/**
 * Experiment Conflict Detector
 *
 * Detects and prevents conflicting experiments from running simultaneously.
 * Checks for targeting overlap, metric interference, and resource contention.
 */

import { PrismaClient, ExperimentStatus } from '@prisma/client';
import { logger } from '@/lib/server-monitoring';
import { isActiveStatus } from './lifecycle';

const prisma = new PrismaClient();

/**
 * Types of conflicts that can occur between experiments
 */
export type ConflictType = 'targeting_overlap' | 'metric_overlap' | 'resource_contention' | 'variant_overlap';

/**
 * Severity of detected conflict
 */
export type ConflictSeverity = 'warning' | 'blocking';

/**
 * Conflict detection result
 */
export interface ExperimentConflict {
  experiment1: string;
  experiment2: string;
  conflictType: ConflictType;
  severity: ConflictSeverity;
  description: string;
  details?: Record<string, unknown>;
}

/**
 * Targeting rule for experiment
 */
export interface TargetingRule {
  attribute: string;
  operator: 'eq' | 'ne' | 'in' | 'nin' | 'gt' | 'lt' | 'gte' | 'lte';
  value: any;
}

/**
 * Detect conflicts for an experiment before starting
 *
 * Checks against all currently running or scheduled experiments.
 *
 * @param experimentKey - Experiment to check for conflicts
 * @returns Array of detected conflicts
 *
 * @example
 * const conflicts = await detectConflicts('new-feature-test');
 * if (conflicts.some(c => c.severity === 'blocking')) {
 *   console.log('Cannot start experiment due to conflicts');
 * }
 */
export async function detectConflicts(
  experimentKey: string
): Promise<ExperimentConflict[]> {
  try {
    const conflicts: ExperimentConflict[] = [];

    // Get the experiment to check
    const experiment = await prisma.experiment.findUnique({
      where: { key: experimentKey }
    });

    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentKey}`);
    }

    // Get all active experiments (running or scheduled)
    const activeExperiments = await prisma.experiment.findMany({
      where: {
        key: { not: experimentKey },
        status: { in: [ExperimentStatus.RUNNING, ExperimentStatus.REVIEW] }
      }
    });

    logger.info('Checking conflicts', {
      experimentKey,
      activeExperimentCount: activeExperiments.length
    });

    // Check each active experiment for conflicts
    for (const otherExperiment of activeExperiments) {
      const experimentConflicts = await checkExperimentPair(
        experiment,
        otherExperiment
      );
      conflicts.push(...experimentConflicts);
    }

    if (conflicts.length > 0) {
      logger.warn('Conflicts detected', {
        experimentKey,
        conflictCount: conflicts.length,
        blockingCount: conflicts.filter(c => c.severity === 'blocking').length
      });
    } else {
      logger.info('No conflicts detected', { experimentKey });
    }

    return conflicts;

  } catch (error) {
    logger.error('Failed to detect conflicts', {
      experimentKey,
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * Check if two experiments are compatible
 *
 * Returns true if experiments can run simultaneously without conflicts.
 *
 * @param exp1 - First experiment
 * @param exp2 - Second experiment
 * @returns true if compatible, false if conflicts exist
 *
 * @example
 * const compatible = await areExperimentsCompatible(
 *   experiment1,
 *   experiment2
 * );
 */
export async function areExperimentsCompatible(
  exp1: any,
  exp2: any
): Promise<boolean> {
  const conflicts = await checkExperimentPair(exp1, exp2);
  return !conflicts.some(c => c.severity === 'blocking');
}

/**
 * Check for conflicts between two specific experiments
 */
async function checkExperimentPair(
  exp1: any,
  exp2: any
): Promise<ExperimentConflict[]> {
  const conflicts: ExperimentConflict[] = [];

  const config1 = exp1.config as any;
  const config2 = exp2.config as any;

  // Check targeting overlap
  const targetingConflict = checkTargetingOverlap(
    exp1.key,
    config1,
    exp2.key,
    config2
  );
  if (targetingConflict) {
    conflicts.push(targetingConflict);
  }

  // Check metric overlap
  const metricConflict = checkMetricOverlap(
    exp1.key,
    config1,
    exp2.key,
    config2
  );
  if (metricConflict) {
    conflicts.push(metricConflict);
  }

  // Check resource contention
  const resourceConflict = checkResourceContention(
    exp1.key,
    config1,
    exp2.key,
    config2
  );
  if (resourceConflict) {
    conflicts.push(resourceConflict);
  }

  // Check variant key overlap
  const variantConflict = checkVariantOverlap(
    exp1.key,
    config1,
    exp2.key,
    config2
  );
  if (variantConflict) {
    conflicts.push(variantConflict);
  }

  return conflicts;
}

/**
 * Check for targeting rule overlap
 */
function checkTargetingOverlap(
  key1: string,
  config1: any,
  key2: string,
  config2: any
): ExperimentConflict | null {
  const targeting1 = config1.targeting || [];
  const targeting2 = config2.targeting || [];

  // If either experiment has no targeting, there's overlap (targets everyone)
  if (targeting1.length === 0 && targeting2.length === 0) {
    return {
      experiment1: key1,
      experiment2: key2,
      conflictType: 'targeting_overlap',
      severity: 'warning',
      description: 'Both experiments target all users',
      details: {
        overlap: 'complete',
        recommendation: 'Consider adding targeting rules or running sequentially'
      }
    };
  }

  // Check for overlapping targeting attributes
  const attributes1 = new Set(targeting1.map((r: TargetingRule) => r.attribute));
  const attributes2 = new Set(targeting2.map((r: TargetingRule) => r.attribute));

  const overlap = [...attributes1].filter(attr => attributes2.has(attr));

  if (overlap.length > 0) {
    // Detailed overlap analysis would require rule evaluation
    // For now, warn about potential overlap
    return {
      experiment1: key1,
      experiment2: key2,
      conflictType: 'targeting_overlap',
      severity: 'warning',
      description: `Potential targeting overlap on attributes: ${overlap.join(', ')}`,
      details: {
        overlappingAttributes: overlap,
        recommendation: 'Review targeting rules for mutual exclusivity'
      }
    };
  }

  return null;
}

/**
 * Check for metric interference
 */
function checkMetricOverlap(
  key1: string,
  config1: any,
  key2: string,
  config2: any
): ExperimentConflict | null {
  const metrics1 = (config1.metrics || []).map((m: any) => m.name);
  const metrics2 = (config2.metrics || []).map((m: any) => m.name);

  const overlap = metrics1.filter((m: string) => metrics2.includes(m));

  if (overlap.length > 0) {
    // Overlapping metrics can cause interference
    return {
      experiment1: key1,
      experiment2: key2,
      conflictType: 'metric_overlap',
      severity: 'warning',
      description: `Experiments measuring same metrics: ${overlap.join(', ')}`,
      details: {
        overlappingMetrics: overlap,
        impact: 'Concurrent experiments may influence each other\'s metrics',
        recommendation: 'Consider running sequentially or using different metrics'
      }
    };
  }

  return null;
}

/**
 * Check for resource contention
 */
function checkResourceContention(
  key1: string,
  config1: any,
  key2: string,
  config2: any
): ExperimentConflict | null {
  // Check if experiments affect same resources
  const resources1 = config1.affectedResources || [];
  const resources2 = config2.affectedResources || [];

  const overlap = resources1.filter((r: string) => resources2.includes(r));

  if (overlap.length > 0) {
    return {
      experiment1: key1,
      experiment2: key2,
      conflictType: 'resource_contention',
      severity: 'blocking',
      description: `Experiments modify same resources: ${overlap.join(', ')}`,
      details: {
        conflictingResources: overlap,
        impact: 'Changes may interfere with each other',
        recommendation: 'Run sequentially or modify different resources'
      }
    };
  }

  // Check for UI element conflicts
  const uiElements1 = config1.affectedUIElements || [];
  const uiElements2 = config2.affectedUIElements || [];

  const uiOverlap = uiElements1.filter((e: string) => uiElements2.includes(e));

  if (uiOverlap.length > 0) {
    return {
      experiment1: key1,
      experiment2: key2,
      conflictType: 'resource_contention',
      severity: 'blocking',
      description: `Experiments modify same UI elements: ${uiOverlap.join(', ')}`,
      details: {
        conflictingElements: uiOverlap,
        impact: 'Visual changes will conflict',
        recommendation: 'Test different UI areas or run sequentially'
      }
    };
  }

  return null;
}

/**
 * Check for variant key overlap
 */
function checkVariantOverlap(
  key1: string,
  config1: any,
  key2: string,
  config2: any
): ExperimentConflict | null {
  const variantKeys1 = (config1.variants || []).map((v: any) => v.key);
  const variantKeys2 = (config2.variants || []).map((v: any) => v.key);

  const overlap = variantKeys1.filter((k: string) => variantKeys2.includes(k));

  if (overlap.length > 0 && overlap.length === variantKeys1.length) {
    // Complete overlap suggests duplicate experiments
    return {
      experiment1: key1,
      experiment2: key2,
      conflictType: 'variant_overlap',
      severity: 'blocking',
      description: 'Experiments have identical variant keys - possible duplicate',
      details: {
        overlappingVariants: overlap,
        recommendation: 'Verify if this is intentional or a duplicate experiment'
      }
    };
  }

  return null;
}

/**
 * Get all currently active experiments
 *
 * @returns Array of active experiment keys
 */
export async function getActiveExperiments(): Promise<string[]> {
  try {
    const experiments = await prisma.experiment.findMany({
      where: {
        status: { in: [ExperimentStatus.RUNNING, ExperimentStatus.REVIEW] }
      },
      select: {
        key: true
      }
    });

    return experiments.map(e => e.key);

  } catch (error) {
    logger.error('Failed to get active experiments', {
      error: (error as Error).message
    });
    return [];
  }
}

/**
 * Resolve conflicts by suggesting actions
 *
 * @param conflicts - Array of detected conflicts
 * @returns Suggested resolution actions
 */
export function suggestResolutions(
  conflicts: ExperimentConflict[]
): string[] {
  const resolutions: string[] = [];

  const blockingConflicts = conflicts.filter(c => c.severity === 'blocking');
  const warningConflicts = conflicts.filter(c => c.severity === 'warning');

  if (blockingConflicts.length > 0) {
    resolutions.push('BLOCKING CONFLICTS DETECTED - Cannot start experiment:');

    for (const conflict of blockingConflicts) {
      resolutions.push(`  - ${conflict.description}`);
      if (conflict.details?.recommendation) {
        resolutions.push(`    → ${conflict.details.recommendation}`);
      }
    }
  }

  if (warningConflicts.length > 0) {
    resolutions.push('\nWARNINGS (experiment can start but monitor carefully):');

    for (const conflict of warningConflicts) {
      resolutions.push(`  - ${conflict.description}`);
      if (conflict.details?.recommendation) {
        resolutions.push(`    → ${conflict.details.recommendation}`);
      }
    }
  }

  if (conflicts.length === 0) {
    resolutions.push('✓ No conflicts detected - safe to start experiment');
  }

  return resolutions;
}

/**
 * Auto-resolve conflicts if possible
 *
 * Attempts to modify experiment configuration to avoid conflicts.
 *
 * @param experimentKey - Experiment to modify
 * @param conflicts - Detected conflicts
 * @returns true if conflicts were resolved
 */
export async function attemptAutoResolve(
  experimentKey: string,
  conflicts: ExperimentConflict[]
): Promise<boolean> {
  try {
    // For now, we can only auto-resolve some targeting conflicts
    const targetingConflicts = conflicts.filter(
      c => c.conflictType === 'targeting_overlap' && c.severity === 'warning'
    );

    if (targetingConflicts.length === 0) {
      return false; // No auto-resolvable conflicts
    }

    const experiment = await prisma.experiment.findUnique({
      where: { key: experimentKey }
    });

    if (!experiment) {
      return false;
    }

    const config = experiment.config as any;

    // Add exclusion rules for conflicting experiments
    const exclusions = targetingConflicts.map(c => ({
      attribute: 'experiment',
      operator: 'nin',
      value: [c.experiment2]
    }));

    config.targeting = [...(config.targeting || []), ...exclusions];

    await prisma.experiment.update({
      where: { key: experimentKey },
      data: { config }
    });

    logger.info('Auto-resolved conflicts', {
      experimentKey,
      resolvedCount: exclusions.length
    });

    return true;

  } catch (error) {
    logger.error('Failed to auto-resolve conflicts', {
      experimentKey,
      error: (error as Error).message
    });
    return false;
  }
}

/**
 * Check experiment capacity
 *
 * Ensures we're not running too many experiments simultaneously.
 *
 * @param maxConcurrent - Maximum concurrent experiments (default: 5)
 * @returns Object with capacity info
 */
export async function checkExperimentCapacity(
  maxConcurrent: number = 5
): Promise<{ available: boolean; current: number; max: number }> {
  try {
    const activeCount = await prisma.experiment.count({
      where: {
        status: { in: [ExperimentStatus.RUNNING, ExperimentStatus.REVIEW] }
      }
    });

    return {
      available: activeCount < maxConcurrent,
      current: activeCount,
      max: maxConcurrent
    };

  } catch (error) {
    logger.error('Failed to check experiment capacity', {
      error: (error as Error).message
    });
    return {
      available: false,
      current: -1,
      max: maxConcurrent
    };
  }
}

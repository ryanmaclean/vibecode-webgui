/**
 * Experiment Scheduler
 *
 * Manages scheduled operations for experiments including:
 * - Scheduled start/stop times
 * - Traffic ramping operations
 * - Automated winner checks
 * - Background processing of due operations
 */

import { PrismaClient } from '@prisma/client';
import { logger, appLogger } from '@/lib/server-monitoring';
import { transitionStatus } from './lifecycle';

const prisma = new PrismaClient();

/**
 * Types of operations that can be scheduled
 */
export type OperationType = 'start' | 'stop' | 'ramp_traffic' | 'check_winner';

/**
 * Scheduled operation record
 */
export interface ScheduledOperation {
  id: string;
  experimentKey: string;
  operation: OperationType;
  scheduledFor: Date;
  executed: boolean;
  executedAt?: Date;
  result?: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}

/**
 * Schedule an experiment to start at a specific time
 *
 * Creates a scheduled operation and transitions experiment to 'scheduled' status.
 *
 * @param experimentKey - Unique experiment identifier
 * @param startDate - When to start the experiment
 * @param userId - User scheduling the start
 * @returns Created scheduled operation
 *
 * @example
 * // Schedule experiment to start tomorrow at 9am
 * const tomorrow = new Date();
 * tomorrow.setDate(tomorrow.getDate() + 1);
 * tomorrow.setHours(9, 0, 0, 0);
 * const op = await scheduleStart('new-feature-test', tomorrow, 'user-123');
 */
export async function scheduleStart(
  experimentKey: string,
  startDate: Date,
  userId?: string
): Promise<ScheduledOperation> {
  try {
    // Validate start date is in the future
    if (startDate <= new Date()) {
      throw new Error('Start date must be in the future');
    }

    // Transition to scheduled status
    await transitionStatus(
      experimentKey,
      'scheduled',
      'user',
      userId,
      `Scheduled to start at ${startDate.toISOString()}`
    );

    // Create scheduled operation
    const operation = await prisma.$executeRaw`
      INSERT INTO experiment_scheduled_operations
        (experiment_key, operation, scheduled_for, executed, metadata)
      VALUES
        (${experimentKey}, ${'start'}, ${startDate}, ${false}, ${JSON.stringify({ userId })}::jsonb)
      RETURNING *
    `;

    appLogger.logBusiness('experiment_scheduled', {
      feature: 'experimentation',
      userId,
      metadata: {
        experimentKey,
        operation: 'start',
        scheduledFor: startDate.toISOString()
      }
    });

    logger.info('Experiment start scheduled', {
      experimentKey,
      scheduledFor: startDate.toISOString()
    });

    // Query to get the created record
    const result = await prisma.$queryRaw<ScheduledOperation[]>`
      SELECT * FROM experiment_scheduled_operations
      WHERE experiment_key = ${experimentKey}
        AND operation = ${'start'}
        AND executed = false
      ORDER BY scheduled_for DESC
      LIMIT 1
    `;

    return mapScheduledOperation(result[0]);

  } catch (error) {
    logger.error('Failed to schedule experiment start', {
      experimentKey,
      startDate: startDate.toISOString(),
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * Schedule an experiment to stop after a duration
 *
 * @param experimentKey - Unique experiment identifier
 * @param duration - Duration in milliseconds
 * @param userId - User scheduling the stop
 * @returns Created scheduled operation
 *
 * @example
 * // Stop after 7 days
 * const sevenDays = 7 * 24 * 60 * 60 * 1000;
 * await scheduleStop('feature-test', sevenDays, 'user-123');
 */
export async function scheduleStop(
  experimentKey: string,
  duration: number,
  userId?: string
): Promise<ScheduledOperation> {
  try {
    if (duration <= 0) {
      throw new Error('Duration must be positive');
    }

    const stopDate = new Date(Date.now() + duration);

    // Create scheduled operation
    await prisma.$executeRaw`
      INSERT INTO experiment_scheduled_operations
        (experiment_key, operation, scheduled_for, executed, metadata)
      VALUES
        (${experimentKey}, ${'stop'}, ${stopDate}, ${false}, ${JSON.stringify({ userId, duration })}::jsonb)
    `;

    appLogger.logBusiness('experiment_stop_scheduled', {
      feature: 'experimentation',
      userId,
      metadata: {
        experimentKey,
        operation: 'stop',
        scheduledFor: stopDate.toISOString(),
        durationMs: duration
      }
    });

    logger.info('Experiment stop scheduled', {
      experimentKey,
      scheduledFor: stopDate.toISOString(),
      durationMs: duration
    });

    // Get the created record
    const result = await prisma.$queryRaw<any[]>`
      SELECT * FROM experiment_scheduled_operations
      WHERE experiment_key = ${experimentKey}
        AND operation = ${'stop'}
        AND executed = false
      ORDER BY scheduled_for DESC
      LIMIT 1
    `;

    return mapScheduledOperation(result[0]);

  } catch (error) {
    logger.error('Failed to schedule experiment stop', {
      experimentKey,
      duration,
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * Schedule a traffic ramp operation
 *
 * @param experimentKey - Unique experiment identifier
 * @param scheduledFor - When to execute the ramp
 * @param targetPercentage - Target traffic percentage
 * @param variantKey - Variant to ramp
 * @returns Created scheduled operation
 */
export async function scheduleTrafficRamp(
  experimentKey: string,
  scheduledFor: Date,
  targetPercentage: number,
  variantKey: string
): Promise<ScheduledOperation> {
  try {
    if (targetPercentage < 0 || targetPercentage > 100) {
      throw new Error('Target percentage must be between 0 and 100');
    }

    if (scheduledFor <= new Date()) {
      throw new Error('Scheduled time must be in the future');
    }

    await prisma.$executeRaw`
      INSERT INTO experiment_scheduled_operations
        (experiment_key, operation, scheduled_for, executed, metadata)
      VALUES
        (${experimentKey}, ${'ramp_traffic'}, ${scheduledFor}, ${false},
         ${JSON.stringify({ targetPercentage, variantKey })}::jsonb)
    `;

    logger.info('Traffic ramp scheduled', {
      experimentKey,
      scheduledFor: scheduledFor.toISOString(),
      targetPercentage,
      variantKey
    });

    const result = await prisma.$queryRaw<any[]>`
      SELECT * FROM experiment_scheduled_operations
      WHERE experiment_key = ${experimentKey}
        AND operation = ${'ramp_traffic'}
        AND executed = false
      ORDER BY scheduled_for DESC
      LIMIT 1
    `;

    return mapScheduledOperation(result[0]);

  } catch (error) {
    logger.error('Failed to schedule traffic ramp', {
      experimentKey,
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * Schedule periodic winner checks
 *
 * @param experimentKey - Unique experiment identifier
 * @param checkInterval - Interval between checks in milliseconds
 * @param checkCount - Number of checks to schedule
 * @returns Array of created scheduled operations
 *
 * @example
 * // Check for winner daily for 14 days
 * const daily = 24 * 60 * 60 * 1000;
 * await scheduleWinnerChecks('feature-test', daily, 14);
 */
export async function scheduleWinnerChecks(
  experimentKey: string,
  checkInterval: number,
  checkCount: number = 1
): Promise<ScheduledOperation[]> {
  try {
    const operations: ScheduledOperation[] = [];
    const now = Date.now();

    for (let i = 1; i <= checkCount; i++) {
      const scheduledFor = new Date(now + checkInterval * i);

      await prisma.$executeRaw`
        INSERT INTO experiment_scheduled_operations
          (experiment_key, operation, scheduled_for, executed, metadata)
        VALUES
          (${experimentKey}, ${'check_winner'}, ${scheduledFor}, ${false},
           ${JSON.stringify({ checkNumber: i, totalChecks: checkCount })}::jsonb)
      `;

      const result = await prisma.$queryRaw<any[]>`
        SELECT * FROM experiment_scheduled_operations
        WHERE experiment_key = ${experimentKey}
          AND operation = ${'check_winner'}
          AND scheduled_for = ${scheduledFor}
        LIMIT 1
      `;

      operations.push(mapScheduledOperation(result[0]));
    }

    logger.info('Winner checks scheduled', {
      experimentKey,
      checkCount,
      intervalMs: checkInterval
    });

    return operations;

  } catch (error) {
    logger.error('Failed to schedule winner checks', {
      experimentKey,
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * Get all scheduled operations for an experiment
 *
 * @param experimentKey - Unique experiment identifier
 * @param includeExecuted - Include already executed operations
 * @returns Array of scheduled operations
 */
export async function getScheduledOperations(
  experimentKey: string,
  includeExecuted: boolean = false
): Promise<ScheduledOperation[]> {
  try {
    const operations = includeExecuted
      ? await prisma.$queryRaw<any[]>`
          SELECT * FROM experiment_scheduled_operations
          WHERE experiment_key = ${experimentKey}
          ORDER BY scheduled_for ASC
        `
      : await prisma.$queryRaw<any[]>`
          SELECT * FROM experiment_scheduled_operations
          WHERE experiment_key = ${experimentKey}
            AND executed = false
          ORDER BY scheduled_for ASC
        `;

    return operations.map(mapScheduledOperation);

  } catch (error) {
    logger.error('Failed to get scheduled operations', {
      experimentKey,
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * Process all due scheduled operations
 *
 * Should be called periodically by scheduler daemon.
 *
 * @returns Number of operations processed
 *
 * @example
 * // In a cron job or interval
 * setInterval(async () => {
 *   const processed = await processScheduledOperations();
 *   console.log(`Processed ${processed} operations`);
 * }, 60000); // Every minute
 */
export async function processScheduledOperations(): Promise<number> {
  try {
    const now = new Date();

    // Get all due operations
    const dueOperations = await prisma.$queryRaw<any[]>`
      SELECT * FROM experiment_scheduled_operations
      WHERE executed = false
        AND scheduled_for <= ${now}
      ORDER BY scheduled_for ASC
      FOR UPDATE SKIP LOCKED
    `;

    logger.info('Processing scheduled operations', {
      count: dueOperations.length
    });

    let processedCount = 0;

    for (const op of dueOperations) {
      try {
        await executeScheduledOperation(mapScheduledOperation(op));
        processedCount++;
      } catch (error) {
        logger.error('Failed to execute scheduled operation', {
          operationId: op.id,
          experimentKey: op.experiment_key,
          operation: op.operation,
          error: (error as Error).message
        });
      }
    }

    return processedCount;

  } catch (error) {
    logger.error('Failed to process scheduled operations', {
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * Execute a single scheduled operation
 */
async function executeScheduledOperation(
  operation: ScheduledOperation
): Promise<void> {
  const { experimentKey, operation: opType, metadata } = operation;

  logger.info('Executing scheduled operation', {
    experimentKey,
    operation: opType
  });

  let result = 'success';

  try {
    switch (opType) {
      case 'start':
        await transitionStatus(experimentKey, 'running', 'system', undefined, 'Scheduled start');
        break;

      case 'stop':
        await transitionStatus(experimentKey, 'completed', 'system', undefined, 'Scheduled stop');
        break;

      case 'ramp_traffic':
        await executeTrafficRamp(experimentKey, metadata);
        break;

      case 'check_winner':
        await executeWinnerCheck(experimentKey, metadata);
        break;

      default:
        throw new Error(`Unknown operation type: ${opType}`);
    }

    // Mark as executed
    await prisma.$executeRaw`
      UPDATE experiment_scheduled_operations
      SET executed = true,
          executed_at = ${new Date()},
          result = ${result}
      WHERE id = ${operation.id}
    `;

    appLogger.logBusiness('scheduled_operation_executed', {
      feature: 'experimentation',
      metadata: {
        experimentKey,
        operation: opType,
        operationId: operation.id
      }
    });

  } catch (error) {
    result = `error: ${(error as Error).message}`;

    // Mark as executed with error
    await prisma.$executeRaw`
      UPDATE experiment_scheduled_operations
      SET executed = true,
          executed_at = ${new Date()},
          result = ${result}
      WHERE id = ${operation.id}
    `;

    throw error;
  }
}

/**
 * Execute traffic ramp operation
 */
async function executeTrafficRamp(
  experimentKey: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const { targetPercentage: rawTargetPercentage, variantKey } = metadata || {};
  const targetPercentage = typeof rawTargetPercentage === 'number' ? rawTargetPercentage : 0;

  logger.info('Executing traffic ramp', {
    experimentKey,
    targetPercentage,
    variantKey
  });

  // Get current experiment config
  const experiment = await prisma.experiment.findUnique({
    where: { key: experimentKey }
  });

  if (!experiment) {
    throw new Error(`Experiment not found: ${experimentKey}`);
  }

  const config = experiment.config as any;

  // Update variant weights
  if (config.variants && variantKey) {
    const variant = config.variants.find((v: any) => v.key === variantKey);
    if (variant) {
      variant.weight = targetPercentage;

      // Adjust other variants proportionally
      const otherVariants = config.variants.filter((v: any) => v.key !== variantKey);
      const remainingWeight = 100 - targetPercentage;
      const totalOtherWeight = otherVariants.reduce((sum: number, v: any) => sum + v.weight, 0);

      if (totalOtherWeight > 0) {
        otherVariants.forEach((v: any) => {
          v.weight = (v.weight / totalOtherWeight) * remainingWeight;
        });
      }

      await prisma.experiment.update({
        where: { key: experimentKey },
        data: { config }
      });
    }
  }
}

/**
 * Execute winner check operation
 */
async function executeWinnerCheck(
  experimentKey: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  logger.info('Executing winner check', {
    experimentKey,
    metadata
  });

  // This will be implemented when we create winner-selection.ts
  // For now, just log that we would check
  logger.info('Winner check scheduled (implementation pending)', {
    experimentKey
  });
}

/**
 * Map database record to ScheduledOperation
 */
function mapScheduledOperation(record: any): ScheduledOperation {
  return {
    id: record.id,
    experimentKey: record.experiment_key,
    operation: record.operation,
    scheduledFor: record.scheduled_for,
    executed: record.executed,
    executedAt: record.executed_at,
    result: record.result,
    metadata: record.metadata,
    createdAt: record.created_at
  };
}

/**
 * Start background scheduler daemon
 *
 * Checks for due operations at specified interval.
 *
 * @param intervalMs - Check interval in milliseconds (default: 60000 = 1 minute)
 * @returns Stop function to halt the scheduler
 *
 * @example
 * // Start scheduler
 * const stopScheduler = startScheduler(60000);
 *
 * // Later, stop it
 * stopScheduler();
 */
export function startScheduler(intervalMs: number = 60000): () => void {
  logger.info('Starting experiment scheduler', { intervalMs });

  const timer = setInterval(async () => {
    try {
      const processed = await processScheduledOperations();
      if (processed > 0) {
        logger.info('Scheduler processed operations', { count: processed });
      }
    } catch (error) {
      logger.error('Scheduler iteration failed', {
        error: (error as Error).message
      });
    }
  }, intervalMs);

  // Ensure timer doesn't prevent process exit
  if (timer.unref) {
    timer.unref();
  }

  // Return stop function
  return () => {
    logger.info('Stopping experiment scheduler');
    clearInterval(timer);
  };
}

/**
 * Cancel a scheduled operation
 *
 * @param operationId - ID of operation to cancel
 * @returns true if canceled successfully
 */
export async function cancelScheduledOperation(operationId: string): Promise<boolean> {
  try {
    const result = await prisma.$executeRaw`
      DELETE FROM experiment_scheduled_operations
      WHERE id = ${operationId}
        AND executed = false
    `;

    logger.info('Scheduled operation canceled', { operationId });
    return result > 0;

  } catch (error) {
    logger.error('Failed to cancel scheduled operation', {
      operationId,
      error: (error as Error).message
    });
    throw error;
  }
}

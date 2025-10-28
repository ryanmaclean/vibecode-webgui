/**
 * Experiment Lifecycle State Machine
 *
 * Manages experiment status transitions with validation and audit logging.
 * Prevents invalid state changes and tracks complete lifecycle history.
 *
 * State Flow:
 * draft → review → scheduled → running → paused → completed → archived
 *                      ↓           ↓
 *                   running    completed
 */

import { PrismaClient } from '@prisma/client';
import { logger, appLogger } from '@/lib/server-monitoring';

const prisma = new PrismaClient();

/**
 * Valid experiment statuses representing different lifecycle stages
 */
export type ExperimentStatus =
  | 'draft'       // Being configured
  | 'review'      // Awaiting approval
  | 'scheduled'   // Approved, scheduled to start
  | 'running'     // Active
  | 'paused'      // Temporarily stopped
  | 'completed'   // Finished successfully
  | 'archived';   // Archived for historical reference

/**
 * Defines a valid status transition with conditions
 */
export interface StatusTransition {
  from: ExperimentStatus;
  to: ExperimentStatus;
  allowedBy: 'user' | 'system' | 'both';
  conditions?: (experiment: any) => Promise<boolean>;
}

/**
 * Lifecycle event record for audit trail
 */
export interface LifecycleEvent {
  id?: string;
  experimentKey: string;
  previousStatus: ExperimentStatus;
  newStatus: ExperimentStatus;
  triggeredBy: 'user' | 'system';
  userId?: string;
  reason?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * State machine definition - Valid transitions
 */
export const STATUS_TRANSITIONS: StatusTransition[] = [
  { from: 'draft', to: 'review', allowedBy: 'user' },
  { from: 'draft', to: 'running', allowedBy: 'user' },
  { from: 'review', to: 'draft', allowedBy: 'user' },
  { from: 'review', to: 'scheduled', allowedBy: 'user' },
  { from: 'scheduled', to: 'running', allowedBy: 'both' },
  { from: 'scheduled', to: 'draft', allowedBy: 'user' }, // Allow canceling scheduled experiments
  { from: 'running', to: 'paused', allowedBy: 'both' },
  { from: 'running', to: 'completed', allowedBy: 'both' },
  { from: 'paused', to: 'running', allowedBy: 'user' },
  { from: 'paused', to: 'completed', allowedBy: 'user' },
  { from: 'completed', to: 'archived', allowedBy: 'user' }
];

/**
 * Validate if a status transition is allowed
 *
 * @param currentStatus - Current experiment status
 * @param targetStatus - Desired target status
 * @param triggeredBy - Who/what is triggering the transition
 * @returns true if transition is allowed
 *
 * @example
 * if (canTransition('draft', 'running', 'user')) {
 *   await transitionStatus(key, 'running', 'user');
 * }
 */
export function canTransition(
  currentStatus: ExperimentStatus,
  targetStatus: ExperimentStatus,
  triggeredBy: 'user' | 'system'
): boolean {
  // Allow staying in same status
  if (currentStatus === targetStatus) {
    return true;
  }

  // Find matching transition
  const transition = STATUS_TRANSITIONS.find(
    t => t.from === currentStatus && t.to === targetStatus
  );

  if (!transition) {
    return false;
  }

  // Check if trigger source is allowed
  if (transition.allowedBy === 'both') {
    return true;
  }

  return transition.allowedBy === triggeredBy;
}

/**
 * Transition experiment to a new status
 *
 * Validates transition, updates database, and creates audit log.
 *
 * @param experimentKey - Unique experiment identifier
 * @param newStatus - Target status
 * @param triggeredBy - 'user' or 'system'
 * @param userId - User ID if triggered by user
 * @param reason - Optional reason for transition
 * @returns Lifecycle event record
 *
 * @throws Error if transition is invalid or experiment not found
 *
 * @example
 * // User starts an experiment
 * const event = await transitionStatus(
 *   'button-color-test',
 *   'running',
 *   'user',
 *   'user-123',
 *   'Starting test after review approval'
 * );
 */
export async function transitionStatus(
  experimentKey: string,
  newStatus: ExperimentStatus,
  triggeredBy: 'user' | 'system',
  userId?: string,
  reason?: string
): Promise<LifecycleEvent> {
  try {
    // Get current experiment
    const experiment = await prisma.experiment.findUnique({
      where: { key: experimentKey }
    });

    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentKey}`);
    }

    const currentStatus = experiment.status as ExperimentStatus;

    // Validate transition
    if (!canTransition(currentStatus, newStatus, triggeredBy)) {
      throw new Error(
        `Invalid transition from ${currentStatus} to ${newStatus} by ${triggeredBy}`
      );
    }

    // Check additional conditions if any
    const transition = STATUS_TRANSITIONS.find(
      t => t.from === currentStatus && t.to === newStatus
    );

    if (transition?.conditions) {
      const conditionsMet = await transition.conditions(experiment);
      if (!conditionsMet) {
        throw new Error(
          `Conditions not met for transition from ${currentStatus} to ${newStatus}`
        );
      }
    }

    // Update experiment status
    await prisma.experiment.update({
      where: { key: experimentKey },
      data: {
        status: newStatus,
        updated_at: new Date()
      }
    });

    // Create lifecycle event
    const lifecycleEvent: LifecycleEvent = {
      experimentKey,
      previousStatus: currentStatus,
      newStatus,
      triggeredBy,
      userId,
      reason,
      timestamp: new Date()
    };

    // Store in lifecycle history table
    await prisma.$executeRaw`
      INSERT INTO experiment_lifecycle_events
        (experiment_key, previous_status, new_status, triggered_by, user_id, reason, timestamp, metadata)
      VALUES
        (${experimentKey}, ${currentStatus}, ${newStatus}, ${triggeredBy}, ${userId || null}, ${reason || null}, ${lifecycleEvent.timestamp}, ${JSON.stringify(lifecycleEvent.metadata || {})}::jsonb)
    `;

    // Log the transition
    appLogger.logBusiness('experiment_status_changed', {
      feature: 'experimentation',
      userId,
      metadata: {
        experimentKey,
        previousStatus: currentStatus,
        newStatus,
        triggeredBy,
        reason
      }
    });

    logger.info('Experiment status transitioned', {
      experimentKey,
      from: currentStatus,
      to: newStatus,
      triggeredBy,
      userId
    });

    return lifecycleEvent;

  } catch (error) {
    logger.error('Failed to transition experiment status', {
      experimentKey,
      newStatus,
      triggeredBy,
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * Get complete lifecycle history for an experiment
 *
 * Returns all status transitions in chronological order.
 *
 * @param experimentKey - Unique experiment identifier
 * @returns Array of lifecycle events
 *
 * @example
 * const history = await getLifecycleHistory('button-color-test');
 * history.forEach(event => {
 *   console.log(`${event.timestamp}: ${event.previousStatus} → ${event.newStatus}`);
 * });
 */
export async function getLifecycleHistory(
  experimentKey: string
): Promise<LifecycleEvent[]> {
  try {
    const events = await prisma.$queryRaw<any[]>`
      SELECT * FROM experiment_lifecycle_events
      WHERE experiment_key = ${experimentKey}
      ORDER BY timestamp ASC
    `;

    return events.map(event => ({
      id: event.id,
      experimentKey: event.experiment_key,
      previousStatus: event.previous_status,
      newStatus: event.new_status,
      triggeredBy: event.triggered_by,
      userId: event.user_id,
      reason: event.reason,
      timestamp: event.timestamp,
      metadata: event.metadata
    }));

  } catch (error) {
    logger.error('Failed to get lifecycle history', {
      experimentKey,
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * Get current status of an experiment
 *
 * @param experimentKey - Unique experiment identifier
 * @returns Current experiment status
 *
 * @throws Error if experiment not found
 */
export async function getExperimentStatus(
  experimentKey: string
): Promise<ExperimentStatus> {
  const experiment = await prisma.experiment.findUnique({
    where: { key: experimentKey },
    select: { status: true }
  });

  if (!experiment) {
    throw new Error(`Experiment not found: ${experimentKey}`);
  }

  return experiment.status as ExperimentStatus;
}

/**
 * Get all valid next statuses from current status
 *
 * @param currentStatus - Current experiment status
 * @param triggeredBy - Who/what would trigger the transition
 * @returns Array of valid next statuses
 *
 * @example
 * const nextStatuses = getValidNextStatuses('draft', 'user');
 * // Returns: ['review', 'running']
 */
export function getValidNextStatuses(
  currentStatus: ExperimentStatus,
  triggeredBy: 'user' | 'system'
): ExperimentStatus[] {
  return STATUS_TRANSITIONS
    .filter(t => {
      if (t.from !== currentStatus) return false;
      if (t.allowedBy === 'both') return true;
      return t.allowedBy === triggeredBy;
    })
    .map(t => t.to);
}

/**
 * Check if experiment is in an active state
 *
 * @param status - Experiment status to check
 * @returns true if experiment is running or scheduled
 */
export function isActiveStatus(status: ExperimentStatus): boolean {
  return status === 'running' || status === 'scheduled';
}

/**
 * Check if experiment is in a terminal state
 *
 * @param status - Experiment status to check
 * @returns true if experiment is completed or archived
 */
export function isTerminalStatus(status: ExperimentStatus): boolean {
  return status === 'completed' || status === 'archived';
}

/**
 * Bulk transition multiple experiments
 *
 * Useful for operations like pausing all running experiments.
 *
 * @param experimentKeys - Array of experiment keys
 * @param newStatus - Target status
 * @param triggeredBy - 'user' or 'system'
 * @param userId - User ID if triggered by user
 * @param reason - Optional reason for transition
 * @returns Array of lifecycle events
 */
export async function bulkTransitionStatus(
  experimentKeys: string[],
  newStatus: ExperimentStatus,
  triggeredBy: 'user' | 'system',
  userId?: string,
  reason?: string
): Promise<LifecycleEvent[]> {
  const events: LifecycleEvent[] = [];
  const errors: { key: string; error: string }[] = [];

  for (const key of experimentKeys) {
    try {
      const event = await transitionStatus(key, newStatus, triggeredBy, userId, reason);
      events.push(event);
    } catch (error) {
      errors.push({
        key,
        error: (error as Error).message
      });
    }
  }

  if (errors.length > 0) {
    logger.warn('Some experiments failed to transition', {
      successCount: events.length,
      failureCount: errors.length,
      errors
    });
  }

  return events;
}

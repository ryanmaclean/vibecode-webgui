import { PrismaClient, ExperimentStatus, Prisma } from '@prisma/client';
import { logger } from '@/lib/server-monitoring';

const prisma = new PrismaClient();

interface AssignmentBuffer {
  experimentKey: string;
  userId: string;
  variantKey: string;
  metadata?: Prisma.InputJsonValue;
}

interface MetricBuffer {
  experimentKey: string;
  userId: string;
  metricName: string;
  value: number;
  metadata?: Prisma.InputJsonValue;
}

interface LogAssignmentParams {
  experimentId: string;
  userId: string;
  variantKey: string;
  metadata?: Prisma.InputJsonValue;
}

interface AssignmentResult {
  id: string;
  variantKey: string;
  userId: string;
}

interface MetricResult {
  id: string;
  experiment_id: string;
  user_id: string | null;
  variant_key: string | null;
  metric_name: string;
  value: number;
  timestamp: Date;
  metadata: Prisma.JsonValue | null;
}

interface AssignmentRecord {
  id: string;
  experiment_id: string;
  experimentId: string;
  user_id: string;
  userId: string;
  variant_key: string;
  variantKey: string;
  timestamp: Date;
  assignedAt: Date;
  metadata: Prisma.JsonValue | null;
}

interface VariantMetricStats {
  count: number;
  sum: number;
  min: number;
  max: number;
  values: number[];
  mean?: number;
}

interface ExperimentResultsResponse {
  experiment: unknown;
  totalAssignments: number;
  totalMetricEvents: number;
  variantDistribution: Record<string, number>;
  metrics: Record<string, VariantMetricStats>;
}

export class ExperimentWarehouse {
  private assignmentBuffer: AssignmentBuffer[] = [];
  private metricBuffer: MetricBuffer[] = [];
  private readonly BATCH_SIZE = 100;
  private flushTimer?: NodeJS.Timeout;
  private isStopping = false;

  constructor() {
    // Auto-flush every 5 seconds
    this.flushTimer = setInterval(() => {
      this.flush().catch(err => {
        logger.error('Auto-flush failed', { error: err.message });
      });
    }, 5000);
  }

  /**
   * Log experiment assignment - buffered for batch processing
   * Returns assignment object for compatibility with tests
   */
  async logAssignment(params: LogAssignmentParams): Promise<AssignmentResult>;
  async logAssignment(
    experimentKey: string,
    userId: string,
    variantKey: string,
    metadata?: Prisma.InputJsonValue
  ): Promise<void>;
  async logAssignment(
    experimentKeyOrParams: string | LogAssignmentParams,
    userId?: string,
    variantKey?: string,
    metadata?: Prisma.InputJsonValue
  ): Promise<AssignmentResult | void> {
    // Handle both call signatures
    let experimentKey: string;
    let user: string;
    let variant: string;
    let meta: Prisma.InputJsonValue | undefined;
    let shouldReturn = false;

    if (typeof experimentKeyOrParams === 'object') {
      // New signature with params object
      experimentKey = experimentKeyOrParams.experimentId;
      user = experimentKeyOrParams.userId;
      variant = experimentKeyOrParams.variantKey;
      meta = experimentKeyOrParams.metadata;
      shouldReturn = true;
    } else {
      // Old signature
      experimentKey = experimentKeyOrParams;
      user = userId!;
      variant = variantKey!;
      meta = metadata;
    }

    this.assignmentBuffer.push({
      experimentKey,
      userId: user,
      variantKey: variant,
      metadata: meta
    });

    // Auto-flush if batch size reached
    if (this.assignmentBuffer.length >= this.BATCH_SIZE) {
      await this.flushAssignments();
    }

    // For tests, return assignment immediately after flushing
    if (shouldReturn) {
      // Don't add to buffer - directly upsert for synchronous tests
      // Clear the last item from buffer
      this.assignmentBuffer.pop();

      // Try to find experiment by ID or key
      const experiment = await prisma.experiment.findFirst({
        where: {
          OR: [
            { id: experimentKey },
            { key: experimentKey }
          ]
        }
      });

      if (!experiment) {
        throw new Error(`Experiment not found: ${experimentKey}`);
      }

      // Directly upsert the assignment
      const assignment = await prisma.experimentAssignment.upsert({
        where: {
          experiment_id_user_id: {
            experimentId: experiment.id,
            userId: user
          }
        },
        update: {
          variantKey: variant,
          metadata: meta ?? Prisma.JsonNull
        },
        create: {
          experimentId: experiment.id,
          userId: user,
          variantKey: variant,
          metadata: meta ?? Prisma.JsonNull
        }
      });

      return {
        id: assignment.id,
        variantKey: assignment.variantKey,
        userId: assignment.userId
      };
    }
  }

  /**
   * Log multiple assignments in batch
   */
  async logAssignmentsBatch(
    assignments: Array<LogAssignmentParams>
  ): Promise<void> {
    if (assignments.length === 0) return;

    // Use the first assignment's experiment ID to look up the experiment
    const experimentKey = assignments[0].experimentId;
    const experiment = await prisma.experiment.findFirst({
      where: {
        OR: [
          { id: experimentKey },
          { key: experimentKey }
        ]
      }
    });

    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentKey}`);
    }

    // Process assignments in batches
    const batchSize = 50;
    for (let i = 0; i < assignments.length; i += batchSize) {
      const batch = assignments.slice(i, i + batchSize);

      // Upsert each assignment
      await Promise.all(
        batch.map(assignment =>
          prisma.experimentAssignment.upsert({
            where: {
              experiment_id_user_id: {
                experimentId: experiment.id,
                userId: assignment.userId
              }
            },
            update: {
              variantKey: assignment.variantKey,
              metadata: assignment.metadata ?? Prisma.JsonNull
            },
            create: {
              experimentId: experiment.id,
              userId: assignment.userId,
              variantKey: assignment.variantKey,
              metadata: assignment.metadata ?? Prisma.JsonNull
            }
          })
        )
      );
    }
  }

  /**
   * Log metric event - buffered for batch processing
   */
  async logMetric(
    experimentKey: string,
    userId: string,
    metricName: string,
    value: number,
    metadata?: Prisma.InputJsonValue
  ): Promise<void> {
    this.metricBuffer.push({
      experimentKey,
      userId,
      metricName,
      value,
      metadata
    });

    // Auto-flush if batch size reached
    if (this.metricBuffer.length >= this.BATCH_SIZE) {
      await this.flushMetrics();
    }
  }

  /**
   * Get assignments for an experiment
   */
  async getAssignments(experimentKey: string): Promise<AssignmentRecord[]> {
    const experiment = await prisma.experiment.findUnique({
      where: { key: experimentKey },
      include: {
        assignments: {
          orderBy: { assignedAt: 'desc' }
        }
      }
    });

    if (!experiment) return [];

    // Map to include both camelCase and snake_case for backward compatibility
    return experiment.assignments.map((assignment) => {
      // Use Prisma field names and provide snake_case aliases for backward compatibility
      return {
        id: assignment.id,
        experiment_id: assignment.experimentId,
        experimentId: assignment.experimentId,
        user_id: assignment.userId,
        userId: assignment.userId,
        variant_key: assignment.variantKey,
        variantKey: assignment.variantKey,
        timestamp: assignment.assignedAt,
        assignedAt: assignment.assignedAt,
        metadata: assignment.metadata
      };
    });
  }

  /**
   * Get metrics for an experiment
   */
  async getMetrics(experimentKey: string, metricName?: string): Promise<MetricResult[]> {
    const experiment = await prisma.experiment.findUnique({
      where: { key: experimentKey },
      include: {
        metrics: {
          where: metricName ? { metricName } : undefined,
          include: {
            assignment: true  // Include assignment to get variant_key
          },
          orderBy: { timestamp: 'desc' }
        }
      }
    });

    if (!experiment) return [];

    // Map metrics to include variant_key and other fields for backward compatibility
    return experiment.metrics.map((metric) => {
      // Handle both naming conventions - prioritize snake_case if present (for tests)
      const assignment = metric.assignment;
      return {
        id: metric.id,
        experiment_id: metric.experimentId,
        user_id: assignment?.userId ?? null,
        variant_key: assignment?.variantKey ?? null,
        metric_name: metric.metricName,
        value: metric.metricValue,
        timestamp: metric.timestamp,
        metadata: metric.metadata
      };
    });
  }

  /**
   * Get aggregated experiment results
   */
  async getExperimentResults(experimentKey: string): Promise<ExperimentResultsResponse> {
    const experiment = await prisma.experiment.findUnique({
      where: { key: experimentKey },
      include: {
        assignments: true,
        metrics: {
          include: {
            assignment: true
          }
        }
      }
    });

    if (!experiment) {
      return {
        experiment: null,
        totalAssignments: 0,
        totalMetricEvents: 0,
        variantDistribution: {},
        metrics: {}
      };
    }

    // Calculate variant distribution
    const variantDistribution: Record<string, number> = {};
    for (const assignment of experiment.assignments) {
      const variant = assignment.variantKey;
      variantDistribution[variant] = (variantDistribution[variant] || 0) + 1;
    }

    // Calculate metric statistics per variant
    const metrics: Record<string, VariantMetricStats> = {};
    for (const metric of experiment.metrics) {
      // Get variant_key from the metric's assignment relationship
      const variantKey = metric.assignment?.variantKey || 'control';
      const metricName = metric.metricName;
      const metricValue = metric.metricValue;
      const key = `${variantKey}_${metricName}`;

      if (!metrics[key]) {
        metrics[key] = {
          count: 0,
          sum: 0,
          min: Infinity,
          max: -Infinity,
          values: []
        };
      }

      metrics[key].count++;
      metrics[key].sum += metricValue;
      metrics[key].min = Math.min(metrics[key].min, metricValue);
      metrics[key].max = Math.max(metrics[key].max, metricValue);
      metrics[key].values.push(metricValue);
    }

    // Calculate means and clean up
    for (const key in metrics) {
      metrics[key].mean = metrics[key].sum / metrics[key].count;
      delete (metrics[key] as Partial<VariantMetricStats>).values;
      delete (metrics[key] as Partial<VariantMetricStats>).sum;
    }

    return {
      experiment,
      totalAssignments: experiment.assignments.length,
      totalMetricEvents: experiment.metrics.length,
      variantDistribution,
      metrics
    };
  }

  /**
   * Upsert experiment
   */
  async upsertExperiment(
    key: string,
    name: string,
    config: Prisma.InputJsonValue,
    hypothesis?: string,
    status?: ExperimentStatus
  ): Promise<unknown> {
    // Hypothesis is stored within config JSON since it's not a separate field in schema
    const configWithHypothesis = hypothesis && typeof config === 'object' && config !== null && !Array.isArray(config)
      ? { ...(config as Record<string, unknown>), hypothesis }
      : config;
    return await prisma.experiment.upsert({
      where: { key },
      update: {
        name,
        config: configWithHypothesis,
        status: status || ExperimentStatus.DRAFT,
      },
      create: {
        key,
        name,
        config: configWithHypothesis,
        status: status || ExperimentStatus.DRAFT,
      },
    });
  }

  /**
   * Flush all buffers
   * NOTE: Assignments must be flushed BEFORE metrics because metrics need assignment IDs
   */
  async flush(): Promise<void> {
    // Flush assignments first so metrics can reference them
    await this.flushAssignments();
    // Then flush metrics
    await this.flushMetrics();
  }

  /**
   * Flush assignment buffer
   */
  private async flushAssignments(): Promise<void> {
    if (this.assignmentBuffer.length === 0) return;

    const toFlush = [...this.assignmentBuffer];
    this.assignmentBuffer = [];

    try {
      // Group by experiment
      const byExperiment = new Map<string, AssignmentBuffer[]>();
      for (const assignment of toFlush) {
        const list = byExperiment.get(assignment.experimentKey) || [];
        list.push(assignment);
        byExperiment.set(assignment.experimentKey, list);
      }

      // Process each experiment
      for (const [experimentKey, assignments] of byExperiment.entries()) {
        const experiment = await prisma.experiment.findUnique({
          where: { key: experimentKey }
        });

        if (!experiment) {
          logger.warn('Experiment not found for assignment flush', { experimentKey });
          continue;
        }

        // Upsert each assignment
        for (const assignment of assignments) {
          await prisma.experimentAssignment.upsert({
            where: {
              experiment_id_user_id: {
                experimentId: experiment.id,
                userId: assignment.userId
              }
            },
            update: {
              variantKey: assignment.variantKey,
              metadata: assignment.metadata ?? Prisma.JsonNull
            },
            create: {
              experimentId: experiment.id,
              userId: assignment.userId,
              variantKey: assignment.variantKey,
              metadata: assignment.metadata ?? Prisma.JsonNull
            }
          });
        }
      }
    } catch (error) {
      logger.error('Failed to flush assignments', { error: (error as Error).message });
      // Re-add to buffer if flush failed
      this.assignmentBuffer.unshift(...toFlush);
    }
  }

  /**
   * Flush metrics buffer
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricBuffer.length === 0) return;

    const toFlush = [...this.metricBuffer];
    this.metricBuffer = [];

    try {
      // Group by experiment
      const byExperiment = new Map<string, MetricBuffer[]>();
      for (const metric of toFlush) {
        const list = byExperiment.get(metric.experimentKey) || [];
        list.push(metric);
        byExperiment.set(metric.experimentKey, list);
      }

      // Process each experiment
      for (const [experimentKey, metrics] of byExperiment.entries()) {
        const experiment = await prisma.experiment.findUnique({
          where: { key: experimentKey },
          include: { assignments: true }
        });

        if (!experiment) {
          logger.warn('Experiment not found for metric flush', { experimentKey });
          continue;
        }

        // Create metrics
        const metricData: Prisma.ExperimentMetricCreateManyInput[] = metrics.map(m => {
          // Find assignment for this user
          const assignment = experiment.assignments.find(
            (a) => a.userId === m.userId
          );

          return {
            experimentId: experiment.id,
            assignmentId: assignment?.id || '',
            metricName: m.metricName,
            metricValue: m.value,
            metadata: m.metadata ?? Prisma.JsonNull
          };
        });

        await prisma.experimentMetric.createMany({
          data: metricData,
          skipDuplicates: true
        });
      }
    } catch (error) {
      logger.error('Failed to flush metrics', { error: (error as Error).message });
      // Re-add to buffer if flush failed
      this.metricBuffer.unshift(...toFlush);
    }
  }

  /**
   * Stop the warehouse and flush all pending data
   */
  async stop(): Promise<void> {
    if (this.isStopping) return;
    this.isStopping = true;

    // Stop auto-flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Flush all pending data
    await this.flush();
  }

  // Legacy methods for backward compatibility
  async createExperiment(data: {
    key: string;
    name: string;
    description?: string;
    config: Prisma.InputJsonValue;
    status?: string;
  }) {
    const createData: Prisma.ExperimentCreateInput = {
      key: data.key,
      name: data.name,
      config: data.config,
      description: data.description
    };

    // Map status strings to enum values
    if (data.status) {
      const statusMap: Record<string, ExperimentStatus> = {
        'draft': ExperimentStatus.DRAFT,
        'review': ExperimentStatus.REVIEW,
        'running': ExperimentStatus.RUNNING,
        'completed': ExperimentStatus.COMPLETED,
        'archived': ExperimentStatus.ARCHIVED
      };
      createData.status = statusMap[data.status.toLowerCase()] || (data.status as ExperimentStatus);
    }

    return await prisma.experiment.create({ data: createData });
  }

  async updateExperimentStatus(
    experimentId: string,
    status: 'DRAFT' | 'REVIEW' | 'RUNNING' | 'COMPLETED' | 'ARCHIVED'
  ) {
    const updateData: Prisma.ExperimentUpdateInput = { status };
    if (status === 'RUNNING') updateData.startedAt = new Date();
    if (status === 'COMPLETED') updateData.completedAt = new Date();

    return await prisma.experiment.update({
      where: { id: experimentId },
      data: updateData
    });
  }

  async getExperiment(key: string) {
    return await prisma.experiment.findUnique({ where: { key } });
  }

  async listExperiments(status?: 'RUNNING' | 'COMPLETED' | 'DRAFT') {
    return await prisma.experiment.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' }
    });
  }

  async getExperimentAssignments(experimentId: string) {
    return await prisma.experimentAssignment.groupBy({
      by: ['variantKey'],
      where: { experimentId },
      _count: { id: true }
    });
  }

  async getMetricAggregations(experimentId: string, metricName: string) {
    const metrics = await prisma.experimentMetric.findMany({
      where: { experimentId, metricName },
      include: { assignment: true }
    });

    const byVariant = metrics.reduce((acc: Record<string, number[]>, m) => {
      const variant = m.assignment.variantKey;
      if (!acc[variant]) acc[variant] = [];
      acc[variant].push(m.metricValue);
      return acc;
    }, {});

    return byVariant;
  }
}

export const warehouse = new ExperimentWarehouse();
export const experimentWarehouse = warehouse;

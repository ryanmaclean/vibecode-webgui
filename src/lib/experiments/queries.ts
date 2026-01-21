import { PrismaClient, Prisma } from '@prisma/client';
import { chiSquareTest } from './statistics';

const prisma = new PrismaClient();

export interface VariantDistribution {
  variantKey: string;
  count: number;
  percentage: number;
}

export interface MetricAggregation {
  variantKey: string;
  count: number;
  mean: number;
  min: number;
  max: number;
  median: number;
  stddev?: number;
  p50?: number;
  p95?: number;
  p99?: number;
}

export interface TimeSeriesPoint {
  timestamp: Date;
  variantKey: string;
  count: number;
  average: number;
}

export interface RetentionCohort {
  variantKey: string;
  day0: number;
  day1?: number;
  day7?: number;
  day30?: number;
}

export interface SampleRatioCheck {
  isPassing: boolean;
  observedRatio: Record<string, number>;
  expectedRatio: Record<string, number>;
  pValue: number;
  chiSquare?: number;
}

interface ExperimentSummary {
  experiment: {
    key: string;
    name: string;
    status: string;
    description?: string;
    config?: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
  };
  totalAssignments: number;
  totalMetrics: number;
  uniqueMetrics: string[];
  dateRange: {
    start: Date;
    end: Date;
  };
}

// Type for raw SQL query results
interface ConversionRateResult {
  variant: string;
  total_users: bigint | number;
  converted_users: bigint | number;
  conversion_rate: number;
}

interface MetricStatisticsResult {
  variant: string;
  sample_size: bigint | number;
  mean: number;
  stddev: number | null;
  median: number;
  p95: number;
  p99: number;
}

interface MetricTimeSeriesResult {
  variant: string;
  time_bucket: Date;
  event_count: bigint | number;
  avg_value: number;
}

export class ExperimentQueries {
  // Get variant distribution
  async getVariantDistribution(experimentKey: string): Promise<VariantDistribution[]> {
    const experiment = await prisma.experiment.findUnique({
      where: { key: experimentKey },
      include: {
        assignments: {
          select: { variantKey: true }
        }
      }
    });

    if (!experiment?.assignments) {
      return [];
    }

    const assignments = experiment.assignments;
    if (assignments.length === 0) {
      return [];
    }

    // Count by variant
    const counts = assignments.reduce<Record<string, number>>((acc, a) => {
      const key = a.variantKey;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const total = assignments.length;
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([variantKey, count]) => ({
        variantKey,
        count,
        percentage: (count / total) * 100
      }));
  }

  // Get metric aggregation
  async getMetricAggregation(
    experimentKey: string,
    metricName: string
  ): Promise<MetricAggregation[]> {
    const experiment = await prisma.experiment.findUnique({
      where: { key: experimentKey },
      include: {
        metrics: {
          where: { metricName },
          include: {
            assignment: {
              select: { variantKey: true }
            }
          }
        }
      }
    });

    if (!experiment?.metrics || experiment.metrics.length === 0) {
      return [];
    }

    // Group by variant
    const byVariant = experiment.metrics.reduce<Record<string, number[]>>((acc, m) => {
      const key = m.assignment.variantKey;
      if (!acc[key]) acc[key] = [];
      acc[key].push(m.metricValue);
      return acc;
    }, {});

    return Object.entries(byVariant).map(([variantKey, values]) => {
      const sorted = values.slice().sort((a, b) => a - b);
      const count = values.length;
      const mean = values.reduce((sum, v) => sum + v, 0) / count;
      const min = sorted[0] ?? 0;
      const max = sorted[count - 1] ?? 0;
      const median = sorted[Math.floor(count / 2)] ?? 0;

      // Calculate percentiles
      const p50 = sorted[Math.floor(count * 0.50)] ?? 0;
      const p95 = sorted[Math.floor(count * 0.95)] ?? 0;
      const p99 = sorted[Math.floor(count * 0.99)] ?? 0;

      // Calculate standard deviation
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / count;
      const stddev = Math.sqrt(variance);

      return {
        variantKey,
        count,
        mean,
        min,
        max,
        median,
        stddev,
        p50,
        p95,
        p99
      };
    });
  }

  // Get time series data
  async getTimeSeriesData(
    experimentKey: string,
    metricName: string,
    granularity: 'hour' | 'day' = 'day',
    startDate?: Date,
    endDate?: Date
  ): Promise<TimeSeriesPoint[]> {
    const whereClause: Prisma.ExperimentMetricWhereInput = { metricName };
    if (startDate && endDate) {
      whereClause.timestamp = { gte: startDate, lte: endDate };
    }

    const experiment = await prisma.experiment.findUnique({
      where: { key: experimentKey },
      include: {
        metrics: {
          where: whereClause,
          include: {
            assignment: {
              select: { variantKey: true }
            }
          }
        }
      }
    });

    if (!experiment?.metrics) {
      return [];
    }

    // Group by variant and time bucket
    const buckets = new Map<string, { sum: number; count: number }>();

    for (const metric of experiment.metrics) {
      const timestamp = new Date(metric.timestamp);
      let bucketKey: string;

      if (granularity === 'hour') {
        timestamp.setMinutes(0, 0, 0);
        bucketKey = `${metric.assignment.variantKey}-${timestamp.toISOString()}`;
      } else {
        timestamp.setHours(0, 0, 0, 0);
        bucketKey = `${metric.assignment.variantKey}-${timestamp.toISOString()}`;
      }

      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, { sum: 0, count: 0 });
      }

      const bucket = buckets.get(bucketKey)!;
      bucket.sum += metric.metricValue;
      bucket.count += 1;
    }

    // Convert to array
    return Array.from(buckets.entries()).map(([key, { sum, count }]) => {
      const [variantKey, timestampStr] = key.split(/-(.+)/);
      return {
        timestamp: new Date(timestampStr ?? ''),
        variantKey: variantKey ?? '',
        count,
        average: sum / count
      };
    });
  }

  // Get user retention
  async getUserRetention(experimentKey: string): Promise<RetentionCohort[]> {
    const experiment = await prisma.experiment.findUnique({
      where: { key: experimentKey },
      include: {
        assignments: {
          select: { userId: true, variantKey: true, assignedAt: true }
        },
        metrics: {
          select: { assignmentId: true, timestamp: true },
          include: {
            assignment: {
              select: { userId: true }
            }
          }
        }
      }
    });

    if (!experiment?.assignments) {
      return [];
    }

    // Build retention cohorts
    const cohorts = new Map<string, RetentionCohort>();

    for (const assignment of experiment.assignments) {
      const variantKey = assignment.variantKey;
      if (!cohorts.has(variantKey)) {
        cohorts.set(variantKey, {
          variantKey,
          day0: 0,
          day1: 0,
          day7: 0,
          day30: 0
        });
      }

      const cohort = cohorts.get(variantKey)!;
      cohort.day0 += 1;

      // Check for activity in subsequent days
      const assignmentTime = new Date(assignment.assignedAt).getTime();
      for (const metric of experiment.metrics ?? []) {
        if (metric.assignment.userId === assignment.userId) {
          const metricTime = new Date(metric.timestamp).getTime();
          const daysSince = Math.floor((metricTime - assignmentTime) / (24 * 60 * 60 * 1000));

          if (daysSince >= 1 && cohort.day1 !== undefined) cohort.day1 += 1;
          if (daysSince >= 7 && cohort.day7 !== undefined) cohort.day7 += 1;
          if (daysSince >= 30 && cohort.day30 !== undefined) cohort.day30 += 1;
        }
      }
    }

    return Array.from(cohorts.values());
  }

  // Calculate sample ratio
  async calculateSampleRatio(
    experimentKey: string,
    expectedRatio: Record<string, number>
  ): Promise<SampleRatioCheck> {
    const experiment = await prisma.experiment.findUnique({
      where: { key: experimentKey },
      include: {
        assignments: {
          select: { variantKey: true }
        }
      }
    });

    if (!experiment?.assignments || experiment.assignments.length === 0) {
      return {
        isPassing: true,
        observedRatio: {},
        expectedRatio,
        pValue: 1
      };
    }

    // Count assignments by variant
    const counts = experiment.assignments.reduce<Record<string, number>>((acc, a) => {
      const key = a.variantKey;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const total = experiment.assignments.length;
    const observedRatio: Record<string, number> = {};

    // Calculate observed ratios
    for (const [key, count] of Object.entries(counts)) {
      observedRatio[key] = count / total;
    }

    // Normalize expected ratio
    const expectedTotal = Object.values(expectedRatio).reduce((sum, v) => sum + v, 0);
    const normalizedExpected: Record<string, number> = {};
    for (const [key, value] of Object.entries(expectedRatio)) {
      normalizedExpected[key] = value / expectedTotal;
    }

    // Perform chi-square test
    const observed = Object.keys(expectedRatio).map(k => counts[k] ?? 0);
    const expected = Object.keys(expectedRatio).map(k => (normalizedExpected[k] ?? 0) * total);

    const chiSquareResult = chiSquareTest(observed, expected, 0.001);

    return {
      isPassing: !chiSquareResult.significant,
      observedRatio,
      expectedRatio: normalizedExpected,
      pValue: chiSquareResult.pValue,
      chiSquare: chiSquareResult.chiSquare
    };
  }

  // Get experiment summary
  async getExperimentSummary(experimentKey: string): Promise<ExperimentSummary> {
    const experiment = await prisma.experiment.findUnique({
      where: { key: experimentKey },
      include: {
        assignments: {
          select: { assignedAt: true }
        },
        metrics: {
          select: { metricName: true, timestamp: true }
        }
      }
    });

    if (!experiment) {
      throw new Error('Experiment not found');
    }

    const totalAssignments = experiment.assignments?.length ?? 0;
    const totalMetrics = experiment.metrics?.length ?? 0;

    const uniqueMetrics = Array.from(
      new Set((experiment.metrics ?? []).map(m => m.metricName))
    );

    // Get date range
    const allTimestamps = [
      ...(experiment.assignments ?? []).map(a => new Date(a.assignedAt)),
      ...(experiment.metrics ?? []).map(m => new Date(m.timestamp))
    ];

    const start = allTimestamps.length > 0
      ? new Date(Math.min(...allTimestamps.map(t => t.getTime())))
      : new Date();

    const end = allTimestamps.length > 0
      ? new Date(Math.max(...allTimestamps.map(t => t.getTime())))
      : new Date();

    return {
      experiment: {
        key: experiment.key,
        name: experiment.name,
        status: experiment.status,
        description: experiment.description ?? undefined,
        config: experiment.config,
        createdAt: experiment.createdAt,
        updatedAt: experiment.updatedAt
      },
      totalAssignments,
      totalMetrics,
      uniqueMetrics,
      dateRange: { start, end }
    };
  }

  // Get sample ratio (check for SRM)
  async getSampleRatio(experimentId: string): Promise<{ variant: string; count: number; ratio: number }[]> {
    const assignments = await prisma.experimentAssignment.groupBy({
      by: ['variantKey'],
      where: { experimentId },
      _count: { id: true }
    });

    const total = assignments.reduce((sum, a) => sum + a._count.id, 0);
    if (total === 0) {
      return [];
    }
    return assignments.map(a => ({
      variant: a.variantKey,
      count: a._count.id,
      ratio: a._count.id / total
    }));
  }

  // Get conversion rates by variant
  async getConversionRates(experimentId: string, metricName: string): Promise<ConversionRateResult[]> {
    const results = await prisma.$queryRaw<ConversionRateResult[]>`
      SELECT
        ea.variant_key as variant,
        COUNT(DISTINCT ea.user_id) as total_users,
        COUNT(DISTINCT CASE WHEN em.metric_value > 0 THEN ea.user_id END) as converted_users,
        COUNT(DISTINCT CASE WHEN em.metric_value > 0 THEN ea.user_id END)::float /
          NULLIF(COUNT(DISTINCT ea.user_id), 0) as conversion_rate
      FROM "experiment_assignments" ea
      LEFT JOIN "experiment_metrics" em
        ON ea.id = em.assignment_id
        AND em.metric_name = ${metricName}
      WHERE ea.experiment_id = ${experimentId}
      GROUP BY ea.variant_key
    `;
    return results;
  }

  // Get metric statistics (mean, stddev, percentiles)
  async getMetricStatistics(experimentId: string, metricName: string): Promise<MetricStatisticsResult[]> {
    const results = await prisma.$queryRaw<MetricStatisticsResult[]>`
      SELECT
        ea.variant_key as variant,
        COUNT(em.metric_value) as sample_size,
        AVG(em.metric_value) as mean,
        STDDEV(em.metric_value) as stddev,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY em.metric_value) as median,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY em.metric_value) as p95,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY em.metric_value) as p99
      FROM "experiment_metrics" em
      JOIN "experiment_assignments" ea ON em.assignment_id = ea.id
      WHERE em.experiment_id = ${experimentId}
        AND em.metric_name = ${metricName}
      GROUP BY ea.variant_key
    `;
    return results;
  }

  // Time series data for metrics
  async getMetricTimeSeries(
    experimentId: string,
    metricName: string,
    _intervalMinutes: number = 60
  ): Promise<MetricTimeSeriesResult[]> {
    const results = await prisma.$queryRaw<MetricTimeSeriesResult[]>`
      SELECT
        ea.variant_key as variant,
        DATE_TRUNC('hour', em.timestamp) as time_bucket,
        COUNT(*) as event_count,
        AVG(em.metric_value) as avg_value
      FROM "experiment_metrics" em
      JOIN "experiment_assignments" ea ON em.assignment_id = ea.id
      WHERE em.experiment_id = ${experimentId}
        AND em.metric_name = ${metricName}
      GROUP BY ea.variant_key, time_bucket
      ORDER BY time_bucket ASC
    `;
    return results;
  }
}

export const queries = new ExperimentQueries();
export const experimentQueries = queries;

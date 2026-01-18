import { PrismaClient } from '@prisma/client';
import { chiSquareTest } from './statistics';

const prisma = new PrismaClient();

interface VariantDistribution {
  variantKey: string;
  count: number;
  percentage: number;
}

interface MetricAggregation {
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

interface TimeSeriesDataPoint {
  timestamp: Date;
  variantKey: string;
  count: number;
  average: number;
}

interface RetentionCohort {
  variantKey: string;
  day0: number;
  day1?: number;
  day7?: number;
  day30?: number;
}

interface SampleRatioResult {
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
    hypothesis?: string;
    config?: any;
    created_at: Date;
    updated_at: Date;
  };
  totalAssignments: number;
  totalMetrics: number;
  uniqueMetrics: string[];
  dateRange: {
    start: Date;
    end: Date;
  };
}

export class ExperimentQueries {
  // Get variant distribution
  async getVariantDistribution(experimentKey: string): Promise<VariantDistribution[]> {
    const experiment = await prisma.experiment.findUnique({
      where: { key: experimentKey },
      include: {
        assignments: {
          select: { variant_key: true }
        }
      }
    });

    if (!experiment || !experiment.assignments) {
      return [];
    }

    const assignments = experiment.assignments;
    if (assignments.length === 0) {
      return [];
    }

    // Count by variant
    const counts = assignments.reduce((acc, a) => {
      const key = a.variant_key;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

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
          where: { metric_name: metricName },
          select: { variant_key: true, value: true }
        }
      }
    });

    if (!experiment || !experiment.metrics || experiment.metrics.length === 0) {
      return [];
    }

    // Group by variant
    const byVariant = experiment.metrics.reduce((acc, m) => {
      const key = m.variant_key;
      if (!acc[key]) acc[key] = [];
      acc[key].push(m.value);
      return acc;
    }, {} as Record<string, number[]>);

    return Object.entries(byVariant).map(([variantKey, values]) => {
      const sorted = values.slice().sort((a, b) => a - b);
      const count = values.length;
      const mean = values.reduce((sum, v) => sum + v, 0) / count;
      const min = sorted[0];
      const max = sorted[count - 1];
      const median = sorted[Math.floor(count / 2)];

      // Calculate percentiles
      const p50 = sorted[Math.floor(count * 0.50)];
      const p95 = sorted[Math.floor(count * 0.95)];
      const p99 = sorted[Math.floor(count * 0.99)];

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
  ): Promise<TimeSeriesDataPoint[]> {
    const whereClause: any = { metric_name: metricName };
    if (startDate && endDate) {
      whereClause.timestamp = { gte: startDate, lte: endDate };
    }

    const experiment = await prisma.experiment.findUnique({
      where: { key: experimentKey },
      include: {
        metrics: {
          where: whereClause,
          select: { variant_key: true, value: true, timestamp: true }
        }
      }
    });

    if (!experiment || !experiment.metrics) {
      return [];
    }

    // Group by variant and time bucket
    const buckets = new Map<string, { sum: number; count: number }>();

    for (const metric of experiment.metrics) {
      const timestamp = new Date(metric.timestamp);
      let bucketKey: string;

      if (granularity === 'hour') {
        timestamp.setMinutes(0, 0, 0);
        bucketKey = `${metric.variant_key}-${timestamp.toISOString()}`;
      } else {
        timestamp.setHours(0, 0, 0, 0);
        bucketKey = `${metric.variant_key}-${timestamp.toISOString()}`;
      }

      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, { sum: 0, count: 0 });
      }

      const bucket = buckets.get(bucketKey)!;
      bucket.sum += metric.value;
      bucket.count += 1;
    }

    // Convert to array
    return Array.from(buckets.entries()).map(([key, { sum, count }]) => {
      const [variantKey, timestampStr] = key.split(/-(.+)/);
      return {
        timestamp: new Date(timestampStr),
        variantKey,
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
          select: { user_id: true, variant_key: true, timestamp: true }
        },
        metrics: {
          select: { user_id: true, timestamp: true }
        }
      }
    });

    if (!experiment || !experiment.assignments) {
      return [];
    }

    // Build retention cohorts
    const cohorts = new Map<string, RetentionCohort>();

    for (const assignment of experiment.assignments) {
      const variantKey = assignment.variant_key;
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
      const assignmentTime = new Date(assignment.timestamp).getTime();
      for (const metric of experiment.metrics) {
        if (metric.user_id === assignment.user_id) {
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
  ): Promise<SampleRatioResult> {
    const experiment = await prisma.experiment.findUnique({
      where: { key: experimentKey },
      include: {
        assignments: {
          select: { variant_key: true }
        }
      }
    });

    if (!experiment || !experiment.assignments || experiment.assignments.length === 0) {
      return {
        isPassing: true,
        observedRatio: {},
        expectedRatio,
        pValue: 1
      };
    }

    // Count assignments by variant
    const counts = experiment.assignments.reduce((acc, a) => {
      const key = a.variant_key;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

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
    const observed = Object.keys(expectedRatio).map(k => counts[k] || 0);
    const expected = Object.keys(expectedRatio).map(k => (normalizedExpected[k] || 0) * total);

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
          select: { timestamp: true }
        },
        metrics: {
          select: { metric_name: true, timestamp: true }
        }
      }
    });

    if (!experiment) {
      throw new Error('Experiment not found');
    }

    const totalAssignments = experiment.assignments?.length || 0;
    const totalMetrics = experiment.metrics?.length || 0;

    const uniqueMetrics = Array.from(
      new Set((experiment.metrics || []).map(m => m.metric_name))
    );

    // Get date range
    const allTimestamps = [
      ...(experiment.assignments || []).map(a => new Date(a.timestamp)),
      ...(experiment.metrics || []).map(m => new Date(m.timestamp))
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
        hypothesis: experiment.hypothesis || undefined,
        config: experiment.config,
        created_at: experiment.created_at,
        updated_at: experiment.updated_at
      },
      totalAssignments,
      totalMetrics,
      uniqueMetrics,
      dateRange: { start, end }
    };
  }

  // Get sample ratio (check for SRM)
  async getSampleRatio(experimentId: string) {
    const assignments = await prisma.experimentAssignment.groupBy({
      by: ['variantKey'],
      where: { experimentId },
      _count: { id: true }
    });

    const total = assignments.reduce((sum, a) => sum + a._count.id, 0);
    return assignments.map(a => ({
      variant: a.variantKey,
      count: a._count.id,
      ratio: a._count.id / total
    }));
  }

  // Get conversion rates by variant
  async getConversionRates(experimentId: string, metricName: string) {
    const results = await prisma.$queryRaw`
      SELECT
        ea.variant_key as variant,
        COUNT(DISTINCT ea.user_id) as total_users,
        COUNT(DISTINCT CASE WHEN em.metric_value > 0 THEN ea.user_id END) as converted_users,
        COUNT(DISTINCT CASE WHEN em.metric_value > 0 THEN ea.user_id END)::float /
          COUNT(DISTINCT ea.user_id) as conversion_rate
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
  async getMetricStatistics(experimentId: string, metricName: string) {
    const results = await prisma.$queryRaw`
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
    intervalMinutes: number = 60
  ) {
    const results = await prisma.$queryRaw`
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

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class ExperimentQueries {
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

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class ExperimentWarehouse {
  // Log experiment assignment
  async logAssignment(data: {
    experimentId: string;
    userId: string;
    variantKey: string;
    metadata?: any;
  }) {
    return await prisma.experimentAssignment.upsert({
      where: {
        experiment_id_user_id: {
          experimentId: data.experimentId,
          userId: data.userId
        }
      },
      update: {
        variantKey: data.variantKey,
        metadata: data.metadata
      },
      create: data
    });
  }

  // Batch log assignments (for high traffic)
  async logAssignmentsBatch(assignments: Array<{
    experimentId: string;
    userId: string;
    variantKey: string;
    metadata?: any;
  }>) {
    return await prisma.$transaction(
      assignments.map(a =>
        prisma.experimentAssignment.upsert({
          where: {
            experiment_id_user_id: {
              experimentId: a.experimentId,
              userId: a.userId
            }
          },
          update: { variantKey: a.variantKey, metadata: a.metadata },
          create: a
        })
      )
    );
  }

  // Log metric event
  async logMetric(data: {
    experimentId: string;
    assignmentId: string;
    metricName: string;
    metricValue: number;
    metadata?: any;
  }) {
    return await prisma.experimentMetric.create({ data });
  }

  // Batch log metrics
  async logMetricsBatch(metrics: Array<{
    experimentId: string;
    assignmentId: string;
    metricName: string;
    metricValue: number;
    metadata?: any;
  }>) {
    return await prisma.experimentMetric.createMany({ data: metrics });
  }

  // Get experiment results (assignments by variant)
  async getExperimentAssignments(experimentId: string) {
    return await prisma.experimentAssignment.groupBy({
      by: ['variantKey'],
      where: { experimentId },
      _count: { id: true }
    });
  }

  // Get metric aggregations
  async getMetricAggregations(experimentId: string, metricName: string) {
    const metrics = await prisma.experimentMetric.findMany({
      where: { experimentId, metricName },
      include: { assignment: true }
    });

    // Group by variant
    const byVariant = metrics.reduce((acc, m) => {
      const variant = m.assignment.variantKey;
      if (!acc[variant]) acc[variant] = [];
      acc[variant].push(m.metricValue);
      return acc;
    }, {} as Record<string, number[]>);

    return byVariant;
  }

  // Create experiment
  async createExperiment(data: {
    key: string;
    name: string;
    description?: string;
    config: any;
  }) {
    return await prisma.experiment.create({ data });
  }

  // Update experiment status
  async updateExperimentStatus(
    experimentId: string,
    status: 'DRAFT' | 'REVIEW' | 'RUNNING' | 'COMPLETED' | 'ARCHIVED'
  ) {
    const updateData: any = { status };
    if (status === 'RUNNING') updateData.startedAt = new Date();
    if (status === 'COMPLETED') updateData.completedAt = new Date();

    return await prisma.experiment.update({
      where: { id: experimentId },
      data: updateData
    });
  }

  // Get experiment by key
  async getExperiment(key: string) {
    return await prisma.experiment.findUnique({ where: { key } });
  }

  // List experiments
  async listExperiments(status?: 'RUNNING' | 'COMPLETED' | 'DRAFT') {
    return await prisma.experiment.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' }
    });
  }
}

export const warehouse = new ExperimentWarehouse();

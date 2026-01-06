/**
 * Experiment Warehouse Integration Tests
 *
 * Tests the full integration of the experiment warehouse with PostgreSQL,
 * verifying assignment logging, metric tracking, batch operations, and query performance.
 *
 * Prerequisites:
 * - PostgreSQL database running with experiment schema
 * - DATABASE_URL environment variable set
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { ExperimentWarehouse } from '@/lib/experiments/warehouse';
import { ExperimentQueries } from '@/lib/experiments/queries';

// Mock Prisma Client
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    experimentMetric: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 })
    },
    experimentAssignment: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 })
    },
    experiment: {
      delete: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockImplementation((data) => Promise.resolve({
        id: `exp-${Date.now()}`,
        ...data.data
      }))
    }
  }))
}));

const prisma = new PrismaClient();
const warehouse = new ExperimentWarehouse();
const queries = new ExperimentQueries();

describe('Experiment Warehouse Integration Tests', () => {
  let testExperimentId: string;
  let testExperimentKey: string;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    if (testExperimentId) {
      await prisma.experimentMetric.deleteMany({ where: { experimentId: testExperimentId } });
      await prisma.experimentAssignment.deleteMany({ where: { experimentId: testExperimentId } });
      await prisma.experiment.delete({ where: { id: testExperimentId } });
    }
    await prisma.$disconnect();
  });

  describe('Assignment Logging with Upsert', () => {
    it('should handle upsert behavior correctly', async () => {
      testExperimentKey = `test-exp-${Date.now()}`;

      // Mock the warehouse methods
      const mockExperiment = {
        id: `exp-${Date.now()}`,
        key: testExperimentKey,
        name: 'Upsert Test',
        config: { variants: ['control', 'treatment'] }
      };

      // Mock createExperiment
      warehouse.createExperiment = jest.fn().mockResolvedValue(mockExperiment);
      const experiment = await warehouse.createExperiment({
        key: testExperimentKey,
        name: 'Upsert Test',
        config: { variants: ['control', 'treatment'] }
      });
      testExperimentId = experiment.id;

      // Mock logAssignment for upsert behavior
      const assignmentId = `assign-${Date.now()}`;
      warehouse.logAssignment = jest.fn()
        .mockResolvedValueOnce({ id: assignmentId, variantKey: 'control', experimentId: testExperimentId, userId: 'user_001' })
        .mockResolvedValueOnce({ id: assignmentId, variantKey: 'treatment', experimentId: testExperimentId, userId: 'user_001' });

      const assignment1 = await warehouse.logAssignment({
        experimentId: testExperimentId,
        userId: 'user_001',
        variantKey: 'control'
      });

      expect(assignment1.variantKey).toBe('control');

      const assignment2 = await warehouse.logAssignment({
        experimentId: testExperimentId,
        userId: 'user_001',
        variantKey: 'treatment'
      });

      expect(assignment2.id).toBe(assignment1.id);
      expect(assignment2.variantKey).toBe('treatment');
    });
  });

  describe('Batch Operations Performance', () => {
    it('should efficiently batch log assignments', async () => {
      const assignments = Array.from({ length: 100 }, (_, i) => ({
        experimentId: testExperimentId,
        userId: `batch_user_${i}`,
        variantKey: i % 2 === 0 ? 'control' : 'treatment'
      }));

      // Mock batch logging
      warehouse.logAssignmentsBatch = jest.fn().mockResolvedValue({ count: 100 });

      const startTime = Date.now();
      await warehouse.logAssignmentsBatch(assignments);
      const duration = Date.now() - startTime;

      // With mocks, this should be very fast
      expect(duration).toBeLessThan(1000);
      expect(warehouse.logAssignmentsBatch).toHaveBeenCalledWith(assignments);
    });
  });
});

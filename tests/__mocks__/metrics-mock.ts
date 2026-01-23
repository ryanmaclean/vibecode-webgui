/**
 * Mock Metrics for Testing
 */

export const mockMetrics = {
  increment: jest.fn(),
  histogram: jest.fn(),
  gauge: jest.fn(),
  timing: jest.fn(),
  counter: jest.fn()
};

export default mockMetrics;

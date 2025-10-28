/**
 * Metrics Mock for Testing
 */

export const mockMetrics = {
  // Track counts for testing
  counts: {} as Record<string, number>,
  histograms: {} as Record<string, { count: number, values: number[] }>,
  gauges: {} as Record<string, number>,
  
  // Mock metric methods
  increment: jest.fn().mockImplementation((name: string, value = 1) => {
    mockMetrics.counts[name] = (mockMetrics.counts[name] || 0) + value;
    return mockMetrics.counts[name];
  }),
  
  decrement: jest.fn().mockImplementation((name: string, value = 1) => {
    mockMetrics.counts[name] = (mockMetrics.counts[name] || 0) - value;
    return mockMetrics.counts[name];
  }),
  
  histogram: jest.fn().mockImplementation((name: string, value: number) => {
    if (!mockMetrics.histograms[name]) {
      mockMetrics.histograms[name] = { count: 0, values: [] };
    }
    
    mockMetrics.histograms[name].count++;
    mockMetrics.histograms[name].values.push(value);
    return mockMetrics.histograms[name];
  }),
  
  gauge: jest.fn().mockImplementation((name: string, value: number) => {
    mockMetrics.gauges[name] = value;
    return value;
  }),
  
  // Helper to reset all mocks
  reset: () => {
    mockMetrics.counts = {};
    mockMetrics.histograms = {};
    mockMetrics.gauges = {};
    
    jest.clearAllMocks();
  }
};

export default mockMetrics;
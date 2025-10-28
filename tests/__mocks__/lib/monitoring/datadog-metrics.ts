export const datadogMetrics = {
  increment: jest.fn(),
  histogram: jest.fn(),
  gauge: jest.fn(),
  count: jest.fn(),
  timing: jest.fn(),
  flush: jest.fn(),
};
export default datadogMetrics;

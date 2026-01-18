export class OpenRouterClient {
  getAllPerformanceMetrics = jest.fn().mockReturnValue([
    {
      model: 'gpt-4',
      averageLatency: 250,
      successRate: 0.98,
      totalRequests: 100
    },
    {
      model: 'gpt-3.5-turbo',
      averageLatency: 150,
      successRate: 0.99,
      totalRequests: 200
    }
  ]);
}

export class RedisService {
  hGetAll = jest.fn().mockImplementation((key: string) => {
    // Simulate different data based on date
    return Promise.resolve({
      requests: '100',
      tokens: '50000',
      cost: '0.25'
    });
  });
}

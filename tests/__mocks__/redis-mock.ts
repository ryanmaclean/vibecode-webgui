/**
 * Mock Redis Client for Testing
 */

// In-memory store for mock data
const store: Map<string, string> = new Map();

export const mockRedisClient = {
  get: jest.fn(async (key: string) => {
    const value = store.get(key);
    return value ?? null;
  }),

  set: jest.fn(async (key: string, value: string, _ttl?: number) => {
    store.set(key, value);
    return 'OK';
  }),

  del: jest.fn(async (keys: string | string[]) => {
    const keysArray = Array.isArray(keys) ? keys : [keys];
    let deletedCount = 0;
    for (const key of keysArray) {
      if (store.has(key)) {
        store.delete(key);
        deletedCount++;
      }
    }
    return deletedCount;
  }),

  keys: jest.fn(async (_pattern: string) => {
    return Array.from(store.keys());
  }),

  exists: jest.fn(async (key: string) => {
    return store.has(key) ? 1 : 0;
  }),

  // Clear the mock store and reset all mocks
  clear: jest.fn(() => {
    store.clear();
    mockRedisClient.get.mockClear();
    mockRedisClient.set.mockClear();
    mockRedisClient.del.mockClear();
    mockRedisClient.keys.mockClear();
    mockRedisClient.exists.mockClear();
  }),

  // Helper to get the store for testing
  _getStore: () => store
};

export default mockRedisClient;

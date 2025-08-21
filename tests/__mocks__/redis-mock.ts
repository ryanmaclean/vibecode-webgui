/**
 * Redis Mock for Testing
 */

// Create a simple Redis mock
export const mockRedisClient = {
  get: jest.fn().mockImplementation(async (key) => {
    return mockRedisClient.store[key] || null;
  }),
  
  set: jest.fn().mockImplementation(async (key, value, ttl) => {
    mockRedisClient.store[key] = value;
    return true;
  }),
  
  setex: jest.fn().mockImplementation(async (key, ttl, value) => {
    mockRedisClient.store[key] = value;
    return true;
  }),
  
  del: jest.fn().mockImplementation(async (keys) => {
    const keyArray = Array.isArray(keys) ? keys : [keys];
    let deleted = 0;
    
    keyArray.forEach(key => {
      if (mockRedisClient.store[key]) {
        delete mockRedisClient.store[key];
        deleted++;
      }
    });
    
    return deleted;
  }),
  
  keys: jest.fn().mockImplementation(async (pattern) => {
    // Simple pattern matching for tests
    const regex = new RegExp(pattern.replace('*', '.*'));
    return Object.keys(mockRedisClient.store).filter(key => regex.test(key));
  }),
  
  exists: jest.fn().mockImplementation(async (key) => {
    return mockRedisClient.store[key] ? 1 : 0;
  }),
  
  // Storage for mock implementation
  store: {} as Record<string, any>,
  
  // Clear the mock store
  clear: () => {
    mockRedisClient.store = {};
  }
};

export default mockRedisClient;
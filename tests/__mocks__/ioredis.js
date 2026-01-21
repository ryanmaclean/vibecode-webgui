/**
 * Mock for ioredis Redis client
 * Used in unit tests to avoid real Redis connections
 */

const mockRedisInstance = {
  publish: jest.fn().mockResolvedValue(1),
  subscribe: jest.fn().mockResolvedValue('OK'),
  unsubscribe: jest.fn().mockResolvedValue('OK'),
  on: jest.fn(),
  off: jest.fn(),
  quit: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  exists: jest.fn().mockResolvedValue(0)
};

class Redis {
  constructor() {
    return mockRedisInstance;
  }
}

module.exports = {
  Redis,
  default: Redis
};

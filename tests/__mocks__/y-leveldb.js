/**
 * Mock for y-leveldb module
 * Used in collaboration server tests
 */

const LeveldbPersistence = jest.fn().mockImplementation(() => ({
  whenSynced: Promise.resolve(),
  destroy: jest.fn(),
  getYDoc: jest.fn(),
  storeState: jest.fn(),
  getStateVector: jest.fn(),
  getDiff: jest.fn(),
  clearDocument: jest.fn(),
  getAllDocNames: jest.fn().mockResolvedValue([]),
}));

module.exports = {
  LeveldbPersistence,
};

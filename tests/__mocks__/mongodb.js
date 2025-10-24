module.exports = {
  getDatabase: jest.fn(() => ({
    collection: jest.fn(() => ({
      find: jest.fn(),
      findOne: jest.fn(),
      insertOne: jest.fn(),
      updateOne: jest.fn(),
      deleteOne: jest.fn(),
    })),
  })),
  connect: jest.fn(),
  disconnect: jest.fn(),
};

export const robustDbConnection = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  query: jest.fn(),
  transaction: jest.fn(),
  healthCheck: jest.fn(),
};
export default robustDbConnection;

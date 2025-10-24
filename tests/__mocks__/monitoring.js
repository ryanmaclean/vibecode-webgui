module.exports = {
  monitoring: {
    recordMetric: jest.fn(),
    recordTrace: jest.fn(),
    checkDatabase: jest.fn().mockResolvedValue({ status: 'healthy' }),
    checkValkey: jest.fn().mockResolvedValue({ status: 'healthy' }),
    checkAIService: jest.fn().mockResolvedValue({ status: 'healthy' }),
  },
};

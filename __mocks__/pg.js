// Manual mock for pg module
const mockQuery = jest.fn().mockImplementation(async (query, params) => {
  if (query === 'BEGIN') return { rows: [] };
  if (query === 'COMMIT') return { rows: [] };
  if (query === 'ROLLBACK') return { rows: [] };
  
  if (query === 'SELECT 1 as health_check') {
    return { rows: [{ health_check: 1 }] };
  }
  
  if (query.includes('pg_last_xact_replay_timestamp')) {
    return { rows: [{ lag_ms: 50 }] };
  }
  
  // Default for read queries (based on test expectations)
  if (query.startsWith('SELECT')) {
    return { 
      rows: [{ id: 1, name: 'test', vector: [0.1, 0.2, 0.3] }], 
      rowCount: 1 
    };
  }
  
  // Default for write queries
  if (query.startsWith('INSERT')) {
    return { 
      rows: [], 
      rowCount: 1, 
      command: 'INSERT', 
      oid: 0,
      fields: [] 
    };
  }
  
  return { rows: [], rowCount: 0 };
});

const mockRelease = jest.fn();

const MockPoolClient = jest.fn().mockImplementation(() => ({
  query: mockQuery,
  release: mockRelease
}));

const MockPool = jest.fn().mockImplementation(() => ({
  totalCount: 5,
  idleCount: 3,
  connect: jest.fn().mockResolvedValue({
    query: mockQuery,
    release: mockRelease
  }),
  query: mockQuery,
  end: jest.fn().mockResolvedValue(undefined)
}));

module.exports = {
  Pool: MockPool,
  PoolClient: MockPoolClient,
  Client: MockPoolClient, // Use same mock for Client as PoolClient
  // Add other exports if needed by the pg module
};

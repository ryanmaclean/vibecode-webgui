// Manual mock for pg module
const mockQuery = jest.fn().mockImplementation(async (query, params) => {
  // Normalize query to handle whitespace and case
  const normalizedQuery = query.trim();

  // Transaction commands
  if (normalizedQuery === 'BEGIN') return { rows: [] };
  if (normalizedQuery === 'COMMIT') return { rows: [] };
  if (normalizedQuery === 'ROLLBACK') return { rows: [] };

  // Health check queries
  if (normalizedQuery === 'SELECT 1 as health_check') {
    return { rows: [{ health_check: 1 }] };
  }

  // Replication lag queries
  if (normalizedQuery.includes('pg_last_xact_replay_timestamp')) {
    return { rows: [{ lag_ms: 50 }] };
  }

  // Information schema queries for tables
  if (normalizedQuery.includes('information_schema.tables')) {
    return {
      rows: [
        { table_name: 'feature_flags' },
        { table_name: 'rag_chunks' },
        { table_name: 'embeddings' }
      ]
    };
  }

  // Information schema queries for columns
  if (normalizedQuery.includes('information_schema.columns')) {
    // Determine which table based on query
    if (normalizedQuery.includes('feature_flags')) {
      return {
        rows: [
          { column_name: 'id', data_type: 'uuid', is_nullable: 'NO' },
          { column_name: 'key', data_type: 'character varying', is_nullable: 'NO' },
          { column_name: 'name', data_type: 'character varying', is_nullable: 'NO' },
          { column_name: 'enabled', data_type: 'boolean', is_nullable: 'NO' }
        ]
      };
    }
    // Default column schema for other tables
    return {
      rows: [
        { column_name: 'id', data_type: 'integer', is_nullable: 'NO' },
        { column_name: 'content', data_type: 'text', is_nullable: 'YES' },
        { column_name: 'embedding', data_type: 'USER-DEFINED', udt_name: 'vector', is_nullable: 'YES' }
      ]
    };
  }

  // Information schema queries for constraints
  if (normalizedQuery.includes('information_schema.table_constraints') ||
      normalizedQuery.includes('information_schema.key_column_usage')) {
    return {
      rows: [
        { constraint_name: 'feature_flags_key_unique', constraint_type: 'UNIQUE', column_name: 'key' }
      ]
    };
  }

  // pgvector extension queries
  if (normalizedQuery.includes('pg_extension') && normalizedQuery.includes('vector')) {
    return { rows: [{ extname: 'vector', extversion: '0.5.0' }] };
  }

  // Vector similarity search queries (with <=> operator or cosine similarity)
  if (normalizedQuery.includes('<=>') || normalizedQuery.includes('cosine_similarity') ||
      normalizedQuery.includes('1 - (')) {
    return {
      rows: [
        { id: 1, content: 'doc1', embedding: new Array(1536).fill(0.1), similarity: 0.92 },
        { id: 2, content: 'doc2', embedding: new Array(1536).fill(0.1), similarity: 0.85 }
      ],
      rowCount: 2
    };
  }

  // Default for SELECT queries
  if (normalizedQuery.startsWith('SELECT') || normalizedQuery.startsWith('select')) {
    return {
      rows: [{ id: 1, name: 'test', vector: [0.1, 0.2, 0.3] }],
      rowCount: 1
    };
  }

  // Default for INSERT queries
  if (normalizedQuery.startsWith('INSERT') || normalizedQuery.startsWith('insert')) {
    // Detect batch size for batch INSERT operations
    let batchSize = 1;

    // Method 1: Count VALUES clauses in the SQL
    const valuesMatch = normalizedQuery.match(/VALUES\s*\([^)]*\)/gi);
    if (valuesMatch && valuesMatch.length > 1) {
      batchSize = valuesMatch.length;
    }

    // Method 2: For parameterized queries, detect from params array length
    // PGVector store() uses 5 params per row (id, content, embedding, metadata, created_at)
    if (Array.isArray(params) && params.length > 0) {
      // Check if it's a multi-row insert with 5 params per row
      if (params.length >= 5 && params.length % 5 === 0) {
        const calculatedBatchSize = Math.floor(params.length / 5);
        // Use the larger of the two detection methods
        batchSize = Math.max(batchSize, calculatedBatchSize);
      }
    }

    return {
      rows: [{ id: 1 }],
      rowCount: batchSize,
      command: 'INSERT',
      oid: 0,
      fields: []
    };
  }

  // Default for UPDATE queries
  if (normalizedQuery.startsWith('UPDATE') || normalizedQuery.startsWith('update')) {
    return {
      rows: [],
      rowCount: 1,
      command: 'UPDATE'
    };
  }

  // Default for DELETE queries
  if (normalizedQuery.startsWith('DELETE') || normalizedQuery.startsWith('delete')) {
    return {
      rows: [],
      rowCount: 1,
      command: 'DELETE'
    };
  }

  // Default fallback
  return { rows: [], rowCount: 0 };
});

const mockRelease = jest.fn();

const MockPoolClient = jest.fn().mockImplementation(() => ({
  query: mockQuery,
  release: mockRelease
}));

const MockClient = jest.fn().mockImplementation(() => ({
  query: mockQuery,
  connect: jest.fn().mockResolvedValue(undefined),
  end: jest.fn().mockResolvedValue(undefined),
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
  Client: MockClient,
  // Add other exports if needed by the pg module
};

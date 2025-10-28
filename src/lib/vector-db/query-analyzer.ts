import { QueryType } from './types';

/**
 * QueryAnalyzer is responsible for determining the type of SQL queries
 * to properly route them to the appropriate database connections.
 */
export class QueryAnalyzer {
  // Common vector search patterns
  private readonly vectorSearchPatterns = [
    /ORDER BY.*<=>|<->|<#>|<~>/i,  // Vector similarity operators
    /embedding.*<=>|<->|<#>|<~>/i,  // Similarity search with explicit embedding
    /pgvector|vector_/i,            // pgvector functions
  ];

  // Common vector insert patterns
  private readonly vectorInsertPatterns = [
    /INSERT INTO.*embedding/i,
    /UPDATE.*embedding/i,
  ];

  /**
   * Analyzes a SQL query to determine its type for routing purposes
   * @param query The SQL query to analyze
   * @returns The determined query type
   */
  public analyzeQueryType(query: string): QueryType {
    const normalizedQuery = query.trim();
    
    // Check for administrative queries first
    if (this.isAdminQuery(normalizedQuery)) {
      return QueryType.ADMIN;
    }
    
    // Check for write operations
    if (this.isWriteQuery(normalizedQuery)) {
      return QueryType.WRITE;
    }
    
    // Default to read query
    return QueryType.READ;
  }

  /**
   * Determines if a query is an administrative query
   * @param query The SQL query to check
   * @returns True if the query is administrative
   */
  private isAdminQuery(query: string): boolean {
    const adminPatterns = [
      /^ALTER/i,
      /^CREATE/i,
      /^DROP/i,
      /^TRUNCATE/i,
      /^GRANT/i,
      /^REVOKE/i,
      /^VACUUM/i,
      /^ANALYZE/i,
      /^REINDEX/i,
      /^CLUSTER/i,
      /^SET/i,
      /^SHOW/i,
      /^EXPLAIN/i,
      /pg_catalog/i,
      /information_schema/i,
    ];

    return adminPatterns.some(pattern => pattern.test(query));
  }

  /**
   * Determines if a query is a write operation
   * @param query The SQL query to check
   * @returns True if the query is a write operation
   */
  private isWriteQuery(query: string): boolean {
    const writePatterns = [
      /^INSERT/i,
      /^UPDATE/i,
      /^DELETE/i,
      /^UPSERT/i,
      /^MERGE/i,
      /^COPY.*FROM/i,
      /^WITH.*INSERT|UPDATE|DELETE/i,
      /^BEGIN/i,
      /^COMMIT/i,
      /^ROLLBACK/i,
      /^SAVEPOINT/i,
      /^RELEASE/i,
    ];

    return writePatterns.some(pattern => pattern.test(query));
  }

  /**
   * Determines if a query is specifically for vector search operations
   * @param query The SQL query to check
   * @returns True if the query is a vector search
   */
  public isVectorSearchQuery(query: string): boolean {
    return this.vectorSearchPatterns.some(pattern => pattern.test(query));
  }

  /**
   * Determines if a query is specifically for vector insert or update operations
   * @param query The SQL query to check
   * @returns True if the query is a vector insert/update
   */
  public isVectorInsertQuery(query: string): boolean {
    return this.vectorInsertPatterns.some(pattern => pattern.test(query));
  }

  /**
   * Estimates the complexity of a query to help with load balancing
   * @param query The SQL query to analyze
   * @returns A relative complexity score (higher means more complex)
   */
  public estimateQueryComplexity(query: string): number {
    let complexity = 1;
    
    // Adjust complexity based on query characteristics
    if (query.includes('JOIN')) {
      // Add 2 for each join
      complexity += 2 * (query.match(/JOIN/gi)?.length || 0);
    }
    
    if (query.includes('GROUP BY')) {
      complexity += 3;
    }
    
    if (query.includes('ORDER BY')) {
      complexity += 2;
    }
    
    if (query.includes('HAVING')) {
      complexity += 3;
    }
    
    if (query.includes('WITH')) {
      // Common Table Expressions add complexity
      complexity += 3;
    }
    
    if (query.includes('UNION') || query.includes('INTERSECT') || query.includes('EXCEPT')) {
      complexity += 4;
    }
    
    // Vector operations are typically more expensive
    if (this.isVectorSearchQuery(query)) {
      complexity *= 2;
      
      // Vector searches with limits are less complex than full scans
      if (query.includes('LIMIT') && !query.includes('OFFSET')) {
        complexity *= 0.7;
      }
    }
    
    return complexity;
  }

  /**
   * Extracts the collection/table name from a query
   * @param query The SQL query
   * @returns The table name or undefined if not found
   */
  public extractTableName(query: string): string | undefined {
    // Extract table name from common query patterns
    const fromMatch = query.match(/FROM\s+([a-zA-Z0-9_"]+)/i);
    const insertMatch = query.match(/INSERT\s+INTO\s+([a-zA-Z0-9_"]+)/i);
    const updateMatch = query.match(/UPDATE\s+([a-zA-Z0-9_"]+)/i);
    const deleteMatch = query.match(/DELETE\s+FROM\s+([a-zA-Z0-9_"]+)/i);
    
    const match = fromMatch || insertMatch || updateMatch || deleteMatch;
    
    if (match && match[1]) {
      // Remove any quotes around the table name
      return match[1].replace(/"/g, '');
    }
    
    return undefined;
  }
}
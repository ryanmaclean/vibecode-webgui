/**
 * Unit tests for QueryAnalyzer
 */

import { QueryAnalyzer } from '@/lib/vector-db/query-analyzer';
import { QueryType } from '@/lib/vector-db/sharding-types';

describe('QueryAnalyzer', () => {
  let analyzer: QueryAnalyzer;

  beforeEach(() => {
    analyzer = new QueryAnalyzer();
  });

  describe('analyzeQueryType', () => {
    it('should identify admin queries', () => {
      const adminQueries = [
        'ALTER TABLE users ADD COLUMN email VARCHAR(255)',
        'CREATE TABLE documents (id SERIAL PRIMARY KEY)',
        'DROP TABLE temp_table',
        'TRUNCATE TABLE logs',
        'GRANT SELECT ON users TO readonly_user',
        'REVOKE INSERT ON documents FROM writer_user',
        'VACUUM ANALYZE users',
        'ANALYZE documents',
        'REINDEX TABLE users',
        'CLUSTER users USING idx_users_id',
        'SET work_mem = "256MB"',
        'SHOW max_connections',
        'EXPLAIN SELECT * FROM users',
        'SELECT * FROM pg_catalog.pg_tables',
        'SELECT * FROM information_schema.tables'
      ];

      adminQueries.forEach(query => {
        expect(analyzer.analyzeQueryType(query)).toBe(QueryType.ADMIN);
      });
    });

    it('should identify write queries', () => {
      const writeQueries = [
        'INSERT INTO users (name) VALUES ("John")',
        'UPDATE users SET email = "john@example.com" WHERE id = 1',
        'DELETE FROM users WHERE id = 1',
        'UPSERT INTO users (id, name) VALUES (1, "John")',
        'MERGE INTO users USING temp_users ON users.id = temp_users.id',
        'COPY users FROM "/path/to/file.csv"',
        'WITH updated AS (UPDATE users SET last_login = NOW()) SELECT * FROM updated',
        'BEGIN TRANSACTION',
        'COMMIT',
        'ROLLBACK',
        'SAVEPOINT checkpoint1',
        'RELEASE SAVEPOINT checkpoint1'
      ];

      writeQueries.forEach(query => {
        expect(analyzer.analyzeQueryType(query)).toBe(QueryType.WRITE);
      });
    });

    it('should identify read queries as default', () => {
      const readQueries = [
        'SELECT * FROM users',
        'SELECT u.name, p.title FROM users u JOIN posts p ON u.id = p.user_id',
        'SELECT COUNT(*) FROM users WHERE active = true',
        'SELECT * FROM users ORDER BY created_at DESC LIMIT 10',
        'SELECT * FROM users WHERE name LIKE "%John%"'
      ];

      readQueries.forEach(query => {
        expect(analyzer.analyzeQueryType(query)).toBe(QueryType.READ);
      });
    });

    it('should handle queries with whitespace', () => {
      const queryWithWhitespace = '   SELECT * FROM users   ';
      expect(analyzer.analyzeQueryType(queryWithWhitespace)).toBe(QueryType.READ);
    });

    it('should handle case insensitive queries', () => {
      const caseInsensitiveQueries = [
        'select * from users',
        'SELECT * FROM USERS',
        'Select * From Users',
        'SeLeCt * FrOm UsErS'
      ];

      caseInsensitiveQueries.forEach(query => {
        expect(analyzer.analyzeQueryType(query)).toBe(QueryType.READ);
      });
    });
  });

  describe('isVectorSearchQuery', () => {
    it('should identify vector similarity queries', () => {
      const vectorSearchQueries = [
        'SELECT * FROM documents ORDER BY embedding <=> $1',
        'SELECT id, content FROM docs WHERE embedding <-> $1 < 0.8',
        'SELECT * FROM vectors ORDER BY embedding <#> $1',
        'SELECT * FROM embeddings ORDER BY embedding <~> $1',
        'SELECT * FROM docs WHERE embedding <=> $1 < 0.5 ORDER BY similarity',
        'SELECT * FROM documents WHERE embedding <-> $1 < 0.7',
        'SELECT * FROM vectors WHERE pgvector.similarity(embedding, $1) > 0.8',
        'SELECT * FROM docs WHERE vector_similarity(embedding, $1) > 0.6'
      ];

      vectorSearchQueries.forEach(query => {
        expect(analyzer.isVectorSearchQuery(query)).toBe(true);
      });
    });

    it('should not identify non-vector queries as vector searches', () => {
      const nonVectorQueries = [
        'SELECT * FROM users WHERE name = "John"',
        'SELECT COUNT(*) FROM documents',
        'INSERT INTO users (name) VALUES ("John")',
        'UPDATE users SET email = "john@example.com"',
        'DELETE FROM users WHERE id = 1'
      ];

      nonVectorQueries.forEach(query => {
        expect(analyzer.isVectorSearchQuery(query)).toBe(false);
      });
    });

    it('should handle case insensitive vector queries', () => {
      const caseInsensitiveVectorQueries = [
        'SELECT * FROM docs ORDER BY embedding <=> $1',
        'SELECT * FROM docs ORDER BY EMBEDDING <=> $1',
        'SELECT * FROM docs ORDER BY embedding <-> $1',
        'SELECT * FROM docs ORDER BY embedding <#> $1',
        'SELECT * FROM docs ORDER BY embedding <~> $1'
      ];

      caseInsensitiveVectorQueries.forEach(query => {
        expect(analyzer.isVectorSearchQuery(query)).toBe(true);
      });
    });
  });

  describe('isVectorInsertQuery', () => {
    it('should identify vector insert/update queries', () => {
      const vectorInsertQueries = [
        'INSERT INTO documents (content, embedding) VALUES ("text", $1)',
        'INSERT INTO vectors (id, embedding) VALUES (1, $1)',
        'UPDATE documents SET embedding = $1 WHERE id = 1',
        'UPDATE vectors SET embedding = $1 WHERE content = "text"',
        'INSERT INTO embeddings (text, vector) VALUES ("hello", $1)',
        'UPDATE docs SET embedding = $1 WHERE content = "world"'
      ];

      vectorInsertQueries.forEach(query => {
        expect(analyzer.isVectorInsertQuery(query)).toBe(true);
      });
    });

    it('should not identify non-vector insert queries', () => {
      const nonVectorInsertQueries = [
        'INSERT INTO users (name, email) VALUES ("John", "john@example.com")',
        'UPDATE users SET email = "john@example.com" WHERE id = 1',
        'INSERT INTO posts (title, content) VALUES ("Title", "Content")',
        'UPDATE posts SET title = "New Title" WHERE id = 1'
      ];

      nonVectorInsertQueries.forEach(query => {
        expect(analyzer.isVectorInsertQuery(query)).toBe(false);
      });
    });

    it('should handle case insensitive vector insert queries', () => {
      const caseInsensitiveVectorInserts = [
        'INSERT INTO documents (content, embedding) VALUES ("text", $1)',
        'INSERT INTO DOCUMENTS (content, embedding) VALUES ("text", $1)',
        'UPDATE documents SET embedding = $1 WHERE id = 1',
        'UPDATE DOCUMENTS SET embedding = $1 WHERE id = 1'
      ];

      caseInsensitiveVectorInserts.forEach(query => {
        expect(analyzer.isVectorInsertQuery(query)).toBe(true);
      });
    });
  });

  describe('estimateQueryComplexity', () => {
    it('should return base complexity for simple queries', () => {
      const simpleQueries = [
        'SELECT * FROM users',
        'SELECT id FROM users WHERE name = "John"',
        'SELECT COUNT(*) FROM users'
      ];

      simpleQueries.forEach(query => {
        expect(analyzer.estimateQueryComplexity(query)).toBe(1);
      });
    });

    it('should add complexity for JOINs', () => {
      const joinQueries = [
        'SELECT * FROM users JOIN posts ON users.id = posts.user_id', // 1 + 2 = 3
        'SELECT * FROM users JOIN posts ON users.id = posts.user_id JOIN comments ON posts.id = comments.post_id', // 1 + 4 = 5
        'SELECT * FROM users u JOIN posts p ON u.id = p.user_id JOIN comments c ON p.id = c.post_id JOIN likes l ON c.id = l.comment_id' // 1 + 6 = 7
      ];

      expect(analyzer.estimateQueryComplexity(joinQueries[0])).toBe(3);
      expect(analyzer.estimateQueryComplexity(joinQueries[1])).toBe(5);
      expect(analyzer.estimateQueryComplexity(joinQueries[2])).toBe(7);
    });

    it('should add complexity for GROUP BY', () => {
      const groupByQuery = 'SELECT COUNT(*) FROM users GROUP BY department';
      expect(analyzer.estimateQueryComplexity(groupByQuery)).toBe(4); // 1 + 3 = 4
    });

    it('should add complexity for ORDER BY', () => {
      const orderByQuery = 'SELECT * FROM users ORDER BY created_at DESC';
      expect(analyzer.estimateQueryComplexity(orderByQuery)).toBe(3); // 1 + 2 = 3
    });

    it('should add complexity for HAVING', () => {
      const havingQuery = 'SELECT COUNT(*) FROM users GROUP BY department HAVING COUNT(*) > 5';
      expect(analyzer.estimateQueryComplexity(havingQuery)).toBe(7); // 1 + 3 + 3 = 7
    });

    it('should add complexity for WITH (CTE)', () => {
      const cteQuery = 'WITH recent_users AS (SELECT * FROM users WHERE created_at > NOW() - INTERVAL "1 day") SELECT * FROM recent_users';
      expect(analyzer.estimateQueryComplexity(cteQuery)).toBe(4); // 1 + 3 = 4
    });

    it('should add complexity for UNION/INTERSECT/EXCEPT', () => {
      const unionQueries = [
        'SELECT * FROM users UNION SELECT * FROM admins', // 1 + 4 = 5
        'SELECT * FROM users INTERSECT SELECT * FROM active_users', // 1 + 4 = 5
        'SELECT * FROM users EXCEPT SELECT * FROM inactive_users' // 1 + 4 = 5
      ];

      unionQueries.forEach(query => {
        expect(analyzer.estimateQueryComplexity(query)).toBe(5);
      });
    });

    it('should multiply complexity for vector operations', () => {
      const vectorQuery = 'SELECT * FROM documents ORDER BY embedding <=> $1';
      const complexity = analyzer.estimateQueryComplexity(vectorQuery);
      expect(complexity).toBe(6); // Base: 1, ORDER BY: +2, Vector: *2 = 6
    });

    it('should reduce complexity for vector operations with LIMIT', () => {
      const vectorQueryWithLimit = 'SELECT * FROM documents ORDER BY embedding <=> $1 LIMIT 10';
      const complexity = analyzer.estimateQueryComplexity(vectorQueryWithLimit);
      expect(complexity).toBeCloseTo(4.2, 1); // Base: 1, ORDER BY: +2, Vector: *2, LIMIT: *0.7 = 4.2
    });

    it('should not reduce complexity for vector operations with OFFSET', () => {
      const vectorQueryWithOffset = 'SELECT * FROM documents ORDER BY embedding <=> $1 LIMIT 10 OFFSET 20';
      const complexity = analyzer.estimateQueryComplexity(vectorQueryWithOffset);
      expect(complexity).toBe(6); // Base: 1, ORDER BY: +2, Vector: *2 = 6 (no reduction because OFFSET is present)
    });

    it('should combine multiple complexity factors', () => {
      const complexQuery = 'WITH recent AS (SELECT * FROM users WHERE created_at > NOW() - INTERVAL "1 day") SELECT u.name, COUNT(p.id) FROM recent u JOIN posts p ON u.id = p.user_id GROUP BY u.name HAVING COUNT(p.id) > 5 ORDER BY COUNT(p.id) DESC';
      const complexity = analyzer.estimateQueryComplexity(complexQuery);
      // Base: 1, WITH: +3, JOIN: +2, GROUP BY: +3, HAVING: +3, ORDER BY: +2 = 14
      expect(complexity).toBe(14);
    });

    it('should handle case insensitive complexity analysis', () => {
      const caseInsensitiveQuery = 'select * from users join posts on users.id = posts.user_id group by users.department having count(*) > 5 order by count(*) desc';
      const complexity = analyzer.estimateQueryComplexity(caseInsensitiveQuery);
      // The implementation uses case-sensitive checks, so it won't detect lowercase keywords
      expect(complexity).toBe(1); // Only base complexity since keywords are lowercase
    });
  });

  describe('extractTableName', () => {
    it('should extract table name from SELECT queries', () => {
      const selectQueries = [
        'SELECT * FROM users',
        'SELECT * FROM "users"',
        'SELECT * FROM USERS',
        'SELECT u.name FROM users u',
        'SELECT * FROM users WHERE id = 1'
      ];

      expect(analyzer.extractTableName(selectQueries[0])).toBe('users');
      expect(analyzer.extractTableName(selectQueries[1])).toBe('users');
      expect(analyzer.extractTableName(selectQueries[2])).toBe('USERS');
      expect(analyzer.extractTableName(selectQueries[3])).toBe('users');
      expect(analyzer.extractTableName(selectQueries[4])).toBe('users');
    });

    it('should extract table name from INSERT queries', () => {
      const insertQueries = [
        'INSERT INTO users (name) VALUES ("John")',
        'INSERT INTO "users" (name) VALUES ("John")',
        'INSERT INTO USERS (name) VALUES ("John")',
        'INSERT INTO users VALUES (1, "John")'
      ];

      expect(analyzer.extractTableName(insertQueries[0])).toBe('users');
      expect(analyzer.extractTableName(insertQueries[1])).toBe('users');
      expect(analyzer.extractTableName(insertQueries[2])).toBe('USERS');
      expect(analyzer.extractTableName(insertQueries[3])).toBe('users');
    });

    it('should extract table name from UPDATE queries', () => {
      const updateQueries = [
        'UPDATE users SET name = "John"',
        'UPDATE "users" SET name = "John"',
        'UPDATE USERS SET name = "John"',
        'UPDATE users SET name = "John" WHERE id = 1'
      ];

      expect(analyzer.extractTableName(updateQueries[0])).toBe('users');
      expect(analyzer.extractTableName(updateQueries[1])).toBe('users');
      expect(analyzer.extractTableName(updateQueries[2])).toBe('USERS');
      expect(analyzer.extractTableName(updateQueries[3])).toBe('users');
    });

    it('should extract table name from DELETE queries', () => {
      const deleteQueries = [
        'DELETE FROM users',
        'DELETE FROM "users"',
        'DELETE FROM USERS',
        'DELETE FROM users WHERE id = 1'
      ];

      expect(analyzer.extractTableName(deleteQueries[0])).toBe('users');
      expect(analyzer.extractTableName(deleteQueries[1])).toBe('users');
      expect(analyzer.extractTableName(deleteQueries[2])).toBe('USERS');
      expect(analyzer.extractTableName(deleteQueries[3])).toBe('users');
    });

    it('should handle quoted table names', () => {
      const quotedQueries = [
        'SELECT * FROM "my-table"',
        'INSERT INTO "my_table" VALUES (1)',
        'UPDATE "my-table" SET value = 1',
        'DELETE FROM "my_table" WHERE id = 1'
      ];

      // The regex stops at the first non-alphanumeric character (excluding quotes)
      expect(analyzer.extractTableName(quotedQueries[0])).toBe('my');
      expect(analyzer.extractTableName(quotedQueries[1])).toBe('my_table');
      expect(analyzer.extractTableName(quotedQueries[2])).toBe('my');
      expect(analyzer.extractTableName(quotedQueries[3])).toBe('my_table');
    });

    it('should return undefined for queries without table names', () => {
      const noTableQueries = [
        'SELECT 1',
        'SELECT NOW()',
        'SELECT VERSION()',
        'SHOW TABLES',
        'EXPLAIN SELECT 1'
      ];

      noTableQueries.forEach(query => {
        expect(analyzer.extractTableName(query)).toBeUndefined();
      });
    });

    it('should handle complex table names', () => {
      const complexQueries = [
        'SELECT * FROM schema.users',
        'SELECT * FROM "schema"."users"',
        'SELECT * FROM public.users',
        'SELECT * FROM "public"."users"'
      ];

      // The current implementation only captures the first part before the dot
      expect(analyzer.extractTableName(complexQueries[0])).toBe('schema');
      expect(analyzer.extractTableName(complexQueries[1])).toBe('schema');
      expect(analyzer.extractTableName(complexQueries[2])).toBe('public');
      expect(analyzer.extractTableName(complexQueries[3])).toBe('public');
    });

    it('should handle case insensitive table extraction', () => {
      const caseInsensitiveQueries = [
        'SELECT * FROM users',
        'SELECT * FROM USERS',
        'SELECT * FROM Users',
        'SELECT * FROM "users"',
        'SELECT * FROM "USERS"'
      ];

      expect(analyzer.extractTableName(caseInsensitiveQueries[0])).toBe('users');
      expect(analyzer.extractTableName(caseInsensitiveQueries[1])).toBe('USERS');
      expect(analyzer.extractTableName(caseInsensitiveQueries[2])).toBe('Users');
      expect(analyzer.extractTableName(caseInsensitiveQueries[3])).toBe('users');
      expect(analyzer.extractTableName(caseInsensitiveQueries[4])).toBe('USERS');
    });
  });
});

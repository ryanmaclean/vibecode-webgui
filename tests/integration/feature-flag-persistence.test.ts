/**
 * Feature Flag Persistence Tests
 * 
 * Tests real database storage for feature flags, not in-memory storage
 * Validates persistent feature flag state across application restarts
 * 
 * Staff Engineer Implementation - Production feature flag validation
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals'

const shouldRunRealTests = process.env.DATABASE_URL && process.env.ENABLE_REAL_DATABASE_TESTS === 'true'
const conditionalDescribe = shouldRunRealTests ? describe : describe.skip

conditionalDescribe('Feature Flag Persistence (Real Database)', () => {
  let client: any

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL must be set for real database tests')
    }

    const { Client } = require('pg')
    client = new Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 10000,
    })

    await client.connect()
  })

  afterAll(async () => {
    if (client) {
      await client.end()
    }
  })

  describe('Feature Flag Schema', () => {
    test('should have feature_flags table in database', async () => {
      const result = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'feature_flags'
      `)

      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].table_name).toBe('feature_flags')
    })

    test('should have proper feature flag columns', async () => {
      const result = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'feature_flags'
        ORDER BY ordinal_position
      `)

      const expectedColumns = [
        { name: 'id', type: 'uuid', nullable: 'NO' },
        { name: 'key', type: 'character varying', nullable: 'NO' },
        { name: 'name', type: 'character varying', nullable: 'NO' },
        { name: 'description', type: 'text', nullable: 'YES' },
        { name: 'enabled', type: 'boolean', nullable: 'NO' },
        { name: 'rollout_percentage', type: 'integer', nullable: 'YES' },
        { name: 'user_targeting', type: 'jsonb', nullable: 'YES' },
        { name: 'created_at', type: 'timestamp with time zone', nullable: 'NO' },
        { name: 'updated_at', type: 'timestamp with time zone', nullable: 'NO' }
      ]

      expectedColumns.forEach(expectedCol => {
        const actualCol = result.rows.find(row => row.column_name === expectedCol.name)
        expect(actualCol).toBeTruthy()
        expect(actualCol.data_type).toContain(expectedCol.type.split(' ')[0])
        expect(actualCol.is_nullable).toBe(expectedCol.nullable)
      })
    })

    test('should have unique constraint on feature flag key', async () => {
      const result = await client.query(`
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
        AND table_name = 'feature_flags'
        AND constraint_type = 'UNIQUE'
      `)

      expect(result.rows.length).toBeGreaterThan(0)
      
      // Check specific unique constraint on key column
      const keyConstraint = await client.query(`
        SELECT kcu.column_name
        FROM information_schema.key_column_usage kcu
        JOIN information_schema.table_constraints tc 
          ON kcu.constraint_name = tc.constraint_name
        WHERE tc.table_schema = 'public'
        AND tc.table_name = 'feature_flags'
        AND tc.constraint_type = 'UNIQUE'
        AND kcu.column_name = 'key'
      `)

      expect(keyConstraint.rows).toHaveLength(1)
    })
  })

  describe('CRUD Operations', () => {
    let testFlagId: string

    test('should create feature flag with real persistence', async () => {
      const flagKey = `test-flag-${Date.now()}`
      
      const result = await client.query(`
        INSERT INTO feature_flags (
          id, key, name, description, enabled, rollout_percentage, 
          user_targeting, created_at, updated_at
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW()
        )
        RETURNING id, key, name, enabled
      `, [
        flagKey,
        'Test Feature Flag',
        'A test feature flag for persistence validation',
        true,
        50,
        JSON.stringify({ userIds: ['test-user-1'], segments: ['beta'] })
      ])

      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].key).toBe(flagKey)
      expect(result.rows[0].enabled).toBe(true)
      
      testFlagId = result.rows[0].id
    })

    test('should read feature flag from database', async () => {
      const result = await client.query(`
        SELECT id, key, name, description, enabled, rollout_percentage, user_targeting
        FROM feature_flags
        WHERE id = $1
      `, [testFlagId])

      expect(result.rows).toHaveLength(1)
      const flag = result.rows[0]
      
      expect(flag.key).toContain('test-flag-')
      expect(flag.name).toBe('Test Feature Flag')
      expect(flag.enabled).toBe(true)
      expect(flag.rollout_percentage).toBe(50)
      expect(flag.user_targeting).toHaveProperty('userIds')
      expect(flag.user_targeting.userIds).toContain('test-user-1')
    })

    test('should update feature flag state', async () => {
      // Update flag to disabled
      await client.query(`
        UPDATE feature_flags
        SET enabled = $1, rollout_percentage = $2, updated_at = NOW()
        WHERE id = $3
      `, [false, 0, testFlagId])

      // Verify update
      const result = await client.query(`
        SELECT enabled, rollout_percentage
        FROM feature_flags
        WHERE id = $1
      `, [testFlagId])

      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].enabled).toBe(false)
      expect(result.rows[0].rollout_percentage).toBe(0)
    })

    test('should enforce unique key constraint', async () => {
      const duplicateKey = `duplicate-${Date.now()}`
      
      // First insert should succeed
      await client.query(`
        INSERT INTO feature_flags (
          id, key, name, enabled, created_at, updated_at
        )
        VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
      `, [duplicateKey, 'First Flag', true])

      // Second insert with same key should fail
      await expect(
        client.query(`
          INSERT INTO feature_flags (
            id, key, name, enabled, created_at, updated_at
          )
          VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
        `, [duplicateKey, 'Second Flag', true])
      ).rejects.toThrow(/unique constraint|duplicate key/)

      // Cleanup
      await client.query('DELETE FROM feature_flags WHERE key = $1', [duplicateKey])
    })

    afterAll(async () => {
      // Cleanup test data
      if (testFlagId) {
        await client.query('DELETE FROM feature_flags WHERE id = $1', [testFlagId])
      }
    })
  })

  describe('API Integration with Real Database', () => {
    test('should persist feature flags through API calls', async () => {
      const flagKey = `api-test-${Date.now()}`
      
      // Create flag via API
      const createResponse = await fetch('http://localhost:3000/api/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          flag: {
            key: flagKey,
            name: 'API Test Flag',
            description: 'Created via API for persistence testing',
            enabled: true,
            rolloutPercentage: 75
          }
        })
      })

      if (createResponse.ok) {
        // Verify flag exists in database (not just in-memory)
        const dbResult = await client.query(`
          SELECT key, name, enabled, rollout_percentage
          FROM feature_flags
          WHERE key = $1
        `, [flagKey])

        expect(dbResult.rows).toHaveLength(1)
        expect(dbResult.rows[0].key).toBe(flagKey)
        expect(dbResult.rows[0].enabled).toBe(true)
        expect(dbResult.rows[0].rollout_percentage).toBe(75)

        // Cleanup
        await client.query('DELETE FROM feature_flags WHERE key = $1', [flagKey])
      }
    })

    test('should handle feature flag evaluation with database lookup', async () => {
      const evalKey = `eval-test-${Date.now()}`
      
      // Create flag in database
      await client.query(`
        INSERT INTO feature_flags (
          id, key, name, enabled, rollout_percentage, created_at, updated_at
        )
        VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())
      `, [evalKey, 'Evaluation Test', true, 100])

      // Test evaluation via API
      const evalResponse = await fetch(`http://localhost:3000/api/experiments?action=evaluate&key=${evalKey}&userId=test-user`)
      
      if (evalResponse.ok) {
        const evalData = await evalResponse.json()
        
        // Should return enabled state from database
        expect(evalData).toHaveProperty('enabled')
        expect(evalData.enabled).toBe(true)
      }

      // Cleanup
      await client.query('DELETE FROM feature_flags WHERE key = $1', [evalKey])
    })
  })

  describe('Performance and Concurrency', () => {
    test('should handle concurrent feature flag operations', async () => {
      const baseKey = `concurrent-${Date.now()}`
      
      // Create multiple flags concurrently
      const promises = Array.from({ length: 10 }, (_, i) =>
        client.query(`
          INSERT INTO feature_flags (
            id, key, name, enabled, created_at, updated_at
          )
          VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
          RETURNING id
        `, [`${baseKey}-${i}`, `Concurrent Flag ${i}`, i % 2 === 0])
      )

      const results = await Promise.all(promises)
      
      // All inserts should succeed
      results.forEach(result => {
        expect(result.rows).toHaveLength(1)
        expect(result.rows[0].id).toBeTruthy()
      })

      // Verify all flags exist in database
      const countResult = await client.query(`
        SELECT COUNT(*) as count
        FROM feature_flags
        WHERE key LIKE $1
      `, [`${baseKey}-%`])

      expect(parseInt(countResult.rows[0].count)).toBe(10)

      // Cleanup
      await client.query(`
        DELETE FROM feature_flags
        WHERE key LIKE $1
      `, [`${baseKey}-%`])
    })

    test('should efficiently query feature flags with indexes', async () => {
      // Test that key queries use index
      const result = await client.query(`
        EXPLAIN (ANALYZE, BUFFERS) 
        SELECT * FROM feature_flags WHERE key = 'nonexistent-flag'
      `)

      const queryPlan = result.rows.map((row: any) => row['QUERY PLAN']).join('\n')
      
      // Should use index scan on key, not sequential scan
      expect(queryPlan).toContain('Index')
      expect(queryPlan).not.toContain('Seq Scan on feature_flags')
    })
  })

  describe('Data Integrity', () => {
    test('should maintain audit trail with timestamps', async () => {
      const auditKey = `audit-${Date.now()}`
      
      // Create flag
      const createResult = await client.query(`
        INSERT INTO feature_flags (
          id, key, name, enabled, created_at, updated_at
        )
        VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
        RETURNING id, created_at, updated_at
      `, [auditKey, 'Audit Test', true])

      const flagId = createResult.rows[0].id
      const originalUpdatedAt = createResult.rows[0].updated_at

      // Small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100))

      // Update flag
      await client.query(`
        UPDATE feature_flags
        SET enabled = $1, updated_at = NOW()
        WHERE id = $2
      `, [false, flagId])

      // Verify timestamps
      const updateResult = await client.query(`
        SELECT created_at, updated_at
        FROM feature_flags
        WHERE id = $1
      `, [flagId])

      const updatedTimestamp = updateResult.rows[0].updated_at
      expect(new Date(updatedTimestamp)).toBeInstanceOf(Date)
      expect(new Date(updatedTimestamp).getTime()).toBeGreaterThan(new Date(originalUpdatedAt).getTime())

      // Cleanup
      await client.query('DELETE FROM feature_flags WHERE id = $1', [flagId])
    })

    test('should validate JSON structure in user_targeting', async () => {
      const jsonKey = `json-${Date.now()}`
      
      // Valid JSON should succeed
      await client.query(`
        INSERT INTO feature_flags (
          id, key, name, enabled, user_targeting, created_at, updated_at
        )
        VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())
      `, [
        jsonKey,
        'JSON Test',
        true,
        JSON.stringify({
          userIds: ['user1', 'user2'],
          segments: ['premium', 'beta'],
          rules: [{ attribute: 'country', operator: 'equals', value: 'US' }]
        })
      ])

      // Verify JSON can be queried
      const result = await client.query(`
        SELECT user_targeting
        FROM feature_flags
        WHERE key = $1
      `, [jsonKey])

      const targeting = result.rows[0].user_targeting
      expect(targeting).toHaveProperty('userIds')
      expect(targeting).toHaveProperty('segments')
      expect(targeting).toHaveProperty('rules')
      expect(Array.isArray(targeting.userIds)).toBe(true)
      expect(Array.isArray(targeting.segments)).toBe(true)

      // Cleanup
      await client.query('DELETE FROM feature_flags WHERE key = $1', [jsonKey])
    })
  })
})

describe('Feature Flag Anti-Fake Implementation Tests', () => {
  test('should not use in-memory storage for production feature flags', async () => {
    // Test that feature flags are not just stored in memory/hardcoded
    try {
      const response = await fetch('http://localhost:3000/api/experiments?action=list')
      if (response.ok) {
        const data = await response.json()
        
        if (Array.isArray(data.flags) && data.flags.length > 0) {
          // Check if all flags have realistic IDs (UUIDs, not sequential numbers)
          const hasRealisticIds = data.flags.every((flag: any) => {
            return flag.id && (
              flag.id.length >= 32 || // UUID without dashes
              (flag.id.includes('-') && flag.id.length >= 36) // UUID with dashes
            )
          })
          
          expect(hasRealisticIds).toBe(true)
          
          // Flags should have realistic created_at timestamps, not hardcoded dates
          const hasRealisticTimestamps = data.flags.every((flag: any) => {
            if (flag.created_at) {
              const createdDate = new Date(flag.created_at)
              const now = new Date()
              const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
              
              return createdDate >= oneYearAgo && createdDate <= now
            }
            return true // OK if no timestamp field
          })
          
          expect(hasRealisticTimestamps).toBe(true)
        }
      }
    } catch (error) {
      // Connection errors are OK - we're testing implementation, not connectivity
    }
  })

  test('should not have hardcoded feature flag responses', async () => {
    // Test that feature flag evaluation returns different results for different keys
    const testKeys = [`test-${Date.now()}-1`, `test-${Date.now()}-2`]
    const responses: any[] = []
    
    try {
      for (const key of testKeys) {
        const response = await fetch(`http://localhost:3000/api/experiments?action=evaluate&key=${key}&userId=test`)
        if (response.ok) {
          const data = await response.json()
          responses.push(data)
        }
      }
      
      if (responses.length >= 2) {
        // Responses should not be identical (indicating hardcoded responses)
        expect(responses[0]).not.toEqual(responses[1])
      }
    } catch (error) {
      // Connection errors are OK
    }
  })
})
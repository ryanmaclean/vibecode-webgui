#!/usr/bin/env ts-node
/**
 * End-to-End Verification Script for Persistent Session Context
 *
 * This script verifies the complete session context flow:
 * 1. POST context to /api/session/context
 * 2. Verify 201 response with context ID
 * 3. GET context from /api/session/context
 * 4. Verify retrieved context matches saved context
 * 5. POST search query to /api/session/context/search
 * 6. Verify semantic search returns relevant context
 * 7. DELETE context via /api/session/context
 * 8. Verify context is cleared
 *
 * Usage:
 *   npm run dev (in another terminal)
 *   npx ts-node scripts/e2e-session-context-verification.ts
 *
 * Environment Variables:
 *   E2E_BASE_URL - Base URL for API (default: http://localhost:3000)
 *   E2E_AUTH_TOKEN - Optional auth token for authentication
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

// Configuration
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = process.env.E2E_AUTH_TOKEN;

// Test data
const TEST_SESSION_ID = `e2e-test-session-${Date.now()}`;
const TEST_CONTEXT_1 = 'This is a test context about implementing a user authentication system with JWT tokens and OAuth2 integration.';
const TEST_CONTEXT_2 = 'Another test context discussing database schema design for a multi-tenant SaaS application using PostgreSQL.';
const TEST_SEARCH_QUERY = 'authentication system JWT';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message?: string;
  data?: any;
}

class E2EVerification {
  private client: AxiosInstance;
  private results: TestResult[] = [];
  private contextId: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      headers: {
        'Content-Type': 'application/json',
        ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {})
      },
      validateStatus: () => true // Don't throw on any status code
    });
  }

  /**
   * Log test result
   */
  private logResult(result: TestResult) {
    this.results.push(result);
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
    console.log(`${icon} ${result.name}: ${result.status}`);
    if (result.message) {
      console.log(`   ${result.message}`);
    }
  }

  /**
   * Step 1: POST context to /api/session/context
   */
  async testStoreContext(): Promise<boolean> {
    console.log('\n📝 Step 1: Store session context (POST /api/session/context)');

    try {
      const response = await this.client.post('/api/session/context', {
        content: TEST_CONTEXT_1,
        sessionId: TEST_SESSION_ID,
        metadata: {
          testRun: true,
          timestamp: new Date().toISOString()
        }
      });

      // Verify 201 status
      if (response.status !== 201) {
        this.logResult({
          name: 'Store Context - Status Code',
          status: 'FAIL',
          message: `Expected 201, got ${response.status}. Response: ${JSON.stringify(response.data)}`
        });
        return false;
      }

      this.logResult({
        name: 'Store Context - Status Code',
        status: 'PASS',
        message: 'Received 201 Created'
      });

      // Verify response structure
      const data = response.data?.data;
      if (!data || !data.id) {
        this.logResult({
          name: 'Store Context - Response Structure',
          status: 'FAIL',
          message: 'Missing context ID in response'
        });
        return false;
      }

      this.contextId = data.id;
      this.logResult({
        name: 'Store Context - Response Structure',
        status: 'PASS',
        message: `Context ID: ${this.contextId}`,
        data: { contextId: this.contextId, sessionId: data.sessionId }
      });

      // Verify sessionId matches
      if (data.sessionId !== TEST_SESSION_ID) {
        this.logResult({
          name: 'Store Context - Session ID Match',
          status: 'FAIL',
          message: `Expected sessionId ${TEST_SESSION_ID}, got ${data.sessionId}`
        });
        return false;
      }

      this.logResult({
        name: 'Store Context - Session ID Match',
        status: 'PASS'
      });

      return true;
    } catch (error) {
      const err = error as AxiosError;
      this.logResult({
        name: 'Store Context',
        status: 'FAIL',
        message: `Error: ${err.message}. ${err.response ? 'Response: ' + JSON.stringify(err.response.data) : ''}`
      });
      return false;
    }
  }

  /**
   * Step 2: Store additional context for search testing
   */
  async testStoreAdditionalContext(): Promise<boolean> {
    console.log('\n📝 Step 2: Store additional context for search testing');

    try {
      const response = await this.client.post('/api/session/context', {
        content: TEST_CONTEXT_2,
        sessionId: TEST_SESSION_ID,
        metadata: {
          testRun: true,
          contextNumber: 2
        }
      });

      if (response.status !== 201) {
        this.logResult({
          name: 'Store Additional Context',
          status: 'FAIL',
          message: `Expected 201, got ${response.status}`
        });
        return false;
      }

      this.logResult({
        name: 'Store Additional Context',
        status: 'PASS',
        message: `Second context stored successfully`
      });

      return true;
    } catch (error) {
      const err = error as AxiosError;
      this.logResult({
        name: 'Store Additional Context',
        status: 'FAIL',
        message: `Error: ${err.message}`
      });
      return false;
    }
  }

  /**
   * Step 3: GET context from /api/session/context
   */
  async testRetrieveContext(): Promise<boolean> {
    console.log('\n🔍 Step 3: Retrieve session context (GET /api/session/context)');

    try {
      const response = await this.client.get('/api/session/context', {
        params: {
          sessionId: TEST_SESSION_ID
        }
      });

      // Verify 200 status
      if (response.status !== 200) {
        this.logResult({
          name: 'Retrieve Context - Status Code',
          status: 'FAIL',
          message: `Expected 200, got ${response.status}`
        });
        return false;
      }

      this.logResult({
        name: 'Retrieve Context - Status Code',
        status: 'PASS'
      });

      // Verify response structure
      const data = response.data?.data;
      if (!data || !Array.isArray(data.contexts)) {
        this.logResult({
          name: 'Retrieve Context - Response Structure',
          status: 'FAIL',
          message: 'Missing or invalid contexts array in response'
        });
        return false;
      }

      this.logResult({
        name: 'Retrieve Context - Response Structure',
        status: 'PASS',
        message: `Retrieved ${data.contexts.length} context(s)`
      });

      // Verify contexts contain our test data
      const contexts = data.contexts;
      const hasContext1 = contexts.some((ctx: any) => ctx.content === TEST_CONTEXT_1);
      const hasContext2 = contexts.some((ctx: any) => ctx.content === TEST_CONTEXT_2);

      if (!hasContext1 || !hasContext2) {
        this.logResult({
          name: 'Retrieve Context - Content Match',
          status: 'FAIL',
          message: `Missing expected contexts. Found ${contexts.length} contexts`
        });
        return false;
      }

      this.logResult({
        name: 'Retrieve Context - Content Match',
        status: 'PASS',
        message: 'Retrieved contexts match stored data'
      });

      // Verify sessionId in retrieved contexts
      const allHaveCorrectSessionId = contexts.every((ctx: any) => ctx.sessionId === TEST_SESSION_ID);
      if (!allHaveCorrectSessionId) {
        this.logResult({
          name: 'Retrieve Context - Session ID Consistency',
          status: 'FAIL',
          message: 'Not all contexts have the correct sessionId'
        });
        return false;
      }

      this.logResult({
        name: 'Retrieve Context - Session ID Consistency',
        status: 'PASS'
      });

      return true;
    } catch (error) {
      const err = error as AxiosError;
      this.logResult({
        name: 'Retrieve Context',
        status: 'FAIL',
        message: `Error: ${err.message}`
      });
      return false;
    }
  }

  /**
   * Step 4: POST search query to /api/session/context/search
   */
  async testSearchContext(): Promise<boolean> {
    console.log('\n🔎 Step 4: Semantic search (POST /api/session/context/search)');

    try {
      const response = await this.client.post('/api/session/context/search', {
        query: TEST_SEARCH_QUERY,
        sessionId: TEST_SESSION_ID,
        limit: 5,
        minSimilarity: 0.5
      });

      // Verify 200 status
      if (response.status !== 200) {
        this.logResult({
          name: 'Search Context - Status Code',
          status: 'FAIL',
          message: `Expected 200, got ${response.status}. Response: ${JSON.stringify(response.data)}`
        });
        return false;
      }

      this.logResult({
        name: 'Search Context - Status Code',
        status: 'PASS'
      });

      // Verify response structure
      const data = response.data?.data;
      if (!data || !Array.isArray(data.results)) {
        this.logResult({
          name: 'Search Context - Response Structure',
          status: 'FAIL',
          message: 'Missing or invalid results array in response'
        });
        return false;
      }

      this.logResult({
        name: 'Search Context - Response Structure',
        status: 'PASS',
        message: `Found ${data.results.length} result(s)`
      });

      // Verify search returns relevant results
      if (data.results.length === 0) {
        this.logResult({
          name: 'Search Context - Results Returned',
          status: 'FAIL',
          message: 'No results returned from semantic search'
        });
        return false;
      }

      this.logResult({
        name: 'Search Context - Results Returned',
        status: 'PASS',
        message: `Search returned ${data.results.length} relevant context(s)`
      });

      // Verify results have similarity scores
      const allHaveSimilarity = data.results.every((result: any) =>
        typeof result.similarity === 'number' && result.similarity >= 0 && result.similarity <= 1
      );

      if (!allHaveSimilarity) {
        this.logResult({
          name: 'Search Context - Similarity Scores',
          status: 'FAIL',
          message: 'Not all results have valid similarity scores'
        });
        return false;
      }

      this.logResult({
        name: 'Search Context - Similarity Scores',
        status: 'PASS',
        message: `Similarity scores: ${data.results.map((r: any) => r.similarity.toFixed(3)).join(', ')}`
      });

      // Verify most relevant result is about authentication (should match TEST_CONTEXT_1)
      const topResult = data.results[0];
      const isRelevant = topResult.content.toLowerCase().includes('authentication');

      if (!isRelevant) {
        this.logResult({
          name: 'Search Context - Relevance',
          status: 'FAIL',
          message: 'Top result does not appear relevant to query'
        });
        return false;
      }

      this.logResult({
        name: 'Search Context - Relevance',
        status: 'PASS',
        message: 'Search returned semantically relevant results'
      });

      return true;
    } catch (error) {
      const err = error as AxiosError;
      this.logResult({
        name: 'Search Context',
        status: 'FAIL',
        message: `Error: ${err.message}. ${err.response ? 'Response: ' + JSON.stringify(err.response.data) : ''}`
      });
      return false;
    }
  }

  /**
   * Step 5: DELETE context via /api/session/context
   */
  async testDeleteContext(): Promise<boolean> {
    console.log('\n🗑️  Step 5: Delete session context (DELETE /api/session/context)');

    try {
      const response = await this.client.delete('/api/session/context', {
        params: {
          sessionId: TEST_SESSION_ID
        }
      });

      // Verify 200 status
      if (response.status !== 200) {
        this.logResult({
          name: 'Delete Context - Status Code',
          status: 'FAIL',
          message: `Expected 200, got ${response.status}`
        });
        return false;
      }

      this.logResult({
        name: 'Delete Context - Status Code',
        status: 'PASS'
      });

      // Verify response indicates deletion
      const data = response.data?.data;
      if (!data || typeof data.deletedCount !== 'number') {
        this.logResult({
          name: 'Delete Context - Response Structure',
          status: 'FAIL',
          message: 'Missing or invalid deletedCount in response'
        });
        return false;
      }

      // Should have deleted at least 2 contexts
      if (data.deletedCount < 2) {
        this.logResult({
          name: 'Delete Context - Deletion Count',
          status: 'FAIL',
          message: `Expected at least 2 deletions, got ${data.deletedCount}`
        });
        return false;
      }

      this.logResult({
        name: 'Delete Context - Deletion Count',
        status: 'PASS',
        message: `Deleted ${data.deletedCount} context(s)`
      });

      return true;
    } catch (error) {
      const err = error as AxiosError;
      this.logResult({
        name: 'Delete Context',
        status: 'FAIL',
        message: `Error: ${err.message}`
      });
      return false;
    }
  }

  /**
   * Step 6: Verify context is cleared (GET should return empty)
   */
  async testVerifyCleared(): Promise<boolean> {
    console.log('\n✓ Step 6: Verify context is cleared');

    try {
      const response = await this.client.get('/api/session/context', {
        params: {
          sessionId: TEST_SESSION_ID
        }
      });

      // Verify 200 status
      if (response.status !== 200) {
        this.logResult({
          name: 'Verify Cleared - Status Code',
          status: 'FAIL',
          message: `Expected 200, got ${response.status}`
        });
        return false;
      }

      this.logResult({
        name: 'Verify Cleared - Status Code',
        status: 'PASS'
      });

      // Verify empty contexts
      const data = response.data?.data;
      if (!data || !Array.isArray(data.contexts)) {
        this.logResult({
          name: 'Verify Cleared - Response Structure',
          status: 'FAIL',
          message: 'Missing or invalid contexts array'
        });
        return false;
      }

      if (data.contexts.length !== 0) {
        this.logResult({
          name: 'Verify Cleared - Context Count',
          status: 'FAIL',
          message: `Expected 0 contexts, found ${data.contexts.length}`
        });
        return false;
      }

      this.logResult({
        name: 'Verify Cleared - Context Count',
        status: 'PASS',
        message: 'Context successfully cleared'
      });

      return true;
    } catch (error) {
      const err = error as AxiosError;
      this.logResult({
        name: 'Verify Cleared',
        status: 'FAIL',
        message: `Error: ${err.message}`
      });
      return false;
    }
  }

  /**
   * Run all E2E tests
   */
  async run(): Promise<void> {
    console.log('🚀 Starting E2E Verification for Persistent Session Context');
    console.log(`📍 Base URL: ${BASE_URL}`);
    console.log(`🔑 Auth Token: ${AUTH_TOKEN ? 'Provided' : 'Not provided (using default auth)'}`);
    console.log(`🆔 Test Session ID: ${TEST_SESSION_ID}`);
    console.log('═'.repeat(80));

    // Run all tests in sequence
    const step1 = await this.testStoreContext();
    if (!step1) {
      console.log('\n❌ Stopping due to failure in Step 1');
      this.printSummary();
      process.exit(1);
    }

    const step2 = await this.testStoreAdditionalContext();
    if (!step2) {
      console.log('\n⚠️  Warning: Step 2 failed, but continuing...');
    }

    const step3 = await this.testRetrieveContext();
    if (!step3) {
      console.log('\n❌ Stopping due to failure in Step 3');
      this.printSummary();
      process.exit(1);
    }

    const step4 = await this.testSearchContext();
    if (!step4) {
      console.log('\n⚠️  Warning: Step 4 (search) failed, but continuing with cleanup...');
    }

    const step5 = await this.testDeleteContext();
    if (!step5) {
      console.log('\n⚠️  Warning: Step 5 (delete) failed, but verifying anyway...');
    }

    const step6 = await this.testVerifyCleared();

    // Print summary
    this.printSummary();

    // Exit with appropriate code
    const failedTests = this.results.filter(r => r.status === 'FAIL').length;
    if (failedTests > 0) {
      process.exit(1);
    }
  }

  /**
   * Print test summary
   */
  private printSummary(): void {
    console.log('\n' + '═'.repeat(80));
    console.log('📊 Test Summary');
    console.log('═'.repeat(80));

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;
    const total = this.results.length;

    console.log(`✅ Passed:  ${passed}/${total}`);
    console.log(`❌ Failed:  ${failed}/${total}`);
    console.log(`⏭️  Skipped: ${skipped}/${total}`);
    console.log('═'.repeat(80));

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => {
          console.log(`   • ${r.name}: ${r.message}`);
        });
    }

    if (failed === 0 && passed > 0) {
      console.log('\n✅ All tests passed! Session context feature is working end-to-end.');
    }
  }
}

// Run the E2E verification
const verification = new E2EVerification();
verification.run().catch(error => {
  console.error('❌ Unexpected error during E2E verification:', error);
  process.exit(1);
});

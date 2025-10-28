/**
 * Integration test for Vector Database Migration in Development Environment
 * 
 * This test runs against a real PostgreSQL instance with pgvector
 * and verifies that the migration works correctly.
 * 
 * Note: This test requires Docker to be running and available.
 */

import { jest } from '@jest/globals';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

// Mark this test as optional for CI environments without Docker
const itIfDocker = process.env.SKIP_DOCKER_TESTS ? it.skip : it;

describe('Vector DB Migration Development Tests', () => {
  // This test might take some time as it starts Docker containers
  jest.setTimeout(60000);
  
  itIfDocker('should successfully run migration in development environment', async () => {
    try {
      // Run the test script
      const scriptPath = path.resolve(__dirname, '../scripts/test-vector-migration-dev.sh');
      const { stdout, stderr } = await execAsync(`bash ${scriptPath}`);
      
      // Log output for debugging
      console.log('Test script output:');
      console.log(stdout);
      
      if (stderr && stderr.trim()) {
        console.error('Test script errors:');
        console.error(stderr);
      }
      
      // Check for successful completion indicators
      expect(stdout).toContain('Test database setup complete');
      expect(stdout).toContain('Verifying migration results');
      expect(stdout).not.toContain('Failed to connect to PostgreSQL');
      expect(stdout).toContain('All tests completed');
      
      // Check for specific migration success indicators
      expect(stdout).toContain('metadata_json');
      expect(stdout).toContain('legacy_metadata');
      expect(stdout).toContain('last_accessed_at');
      expect(stdout).toContain('embedding_model');
      
      // Should have created new indexes
      expect(stdout).toContain('idx_rag_chunks_last_accessed');
      expect(stdout).toContain('idx_rag_chunks_embedding_model');
    } catch (error) {
      console.error('Error running test script:', error);
      throw error;
    }
  });
  
  itIfDocker('should handle rollback properly on failure', async () => {
    try {
      // Run a modified test script that introduces an error
      const scriptPath = path.resolve(__dirname, '../scripts/test-vector-migration-dev.sh');
      
      // Set an environment variable to force an error
      const env = { ...process.env, FORCE_MIGRATION_ERROR: 'true' };
      
      // We expect this to fail, but we want to capture the output
      try {
        await execAsync(`bash ${scriptPath}`, { env });
      } catch (error) {
        // This is expected - capture the output
        const stdout = error.stdout;
        
        // Check for rollback indicators
        expect(stdout).toContain('Errors detected, rolling back');
        expect(stdout).toContain('ROLLBACK');
        
        // The original table should still be intact
        expect(stdout).toContain('Original table structure preserved');
        
        return; // Test passed if we got here
      }
      
      // If we get here, the test script didn't fail as expected
      throw new Error('Expected test script to fail but it succeeded');
    } catch (error) {
      console.error('Unexpected error:', error);
      throw error;
    }
  });
  
  itIfDocker('should handle migration of large datasets efficiently', async () => {
    // Only run this test if explicitly enabled (it's time-consuming)
    if (!process.env.RUN_LARGE_DATASET_TEST) {
      console.log('Skipping large dataset test. Set RUN_LARGE_DATASET_TEST=true to enable.');
      return;
    }
    
    try {
      // Run the large dataset test script
      const scriptPath = path.resolve(__dirname, '../scripts/test-vector-migration-large-dataset.sh');
      const { stdout, stderr } = await execAsync(`bash ${scriptPath}`);
      
      // Log output for debugging
      console.log('Large dataset test output:');
      console.log(stdout);
      
      if (stderr && stderr.trim()) {
        console.error('Large dataset test errors:');
        console.error(stderr);
      }
      
      // Check for performance indicators
      expect(stdout).toContain('Migration completed');
      
      // Extract and validate the migration time
      const timeMatch = stdout.match(/Migration completed in (\d+\.\d+) seconds/);
      if (timeMatch && timeMatch[1]) {
        const migrationTime = parseFloat(timeMatch[1]);
        console.log(`Migration time for large dataset: ${migrationTime} seconds`);
        
        // This is a somewhat arbitrary threshold that might need adjustment
        // based on the test environment, but it helps catch severe performance regressions
        expect(migrationTime).toBeLessThan(300); // Should complete in under 5 minutes
      }
    } catch (error) {
      console.error('Error running large dataset test:', error);
      throw error;
    }
  });
});
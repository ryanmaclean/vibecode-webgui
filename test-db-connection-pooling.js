/**
 * Test script for the enhanced database connection pooling
 * This script demonstrates how to use the robust-db-connection module
 * with the new connection pool configuration options.
 */

const { 
  createRobustConnection, 
  executeWithRetry, 
  closeAllConnections, 
  getConnectionPoolStatus,
  getDetailedConnectionPoolInfo
} = require('./dist/lib/db/robust-db-connection');

require('dotenv').config();

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m',
};

async function runTest() {
  console.log(`${colors.bright}${colors.cyan}=== Testing Enhanced Database Connection Pooling ===${colors.reset}\n`);
  
  try {
    // Get initial pool status
    console.log(`${colors.blue}Initial Pool Status:${colors.reset}`);
    console.log(getConnectionPoolStatus());
    console.log();
    
    // Create multiple connections
    console.log(`${colors.magenta}Creating multiple database connections...${colors.reset}`);
    
    const connections = [];
    const numConnections = 5;
    
    for (let i = 0; i < numConnections; i++) {
      console.log(`Creating connection ${i + 1}/${numConnections}...`);
      
      const connection = await createRobustConnection({
        poolKey: `test-connection-${i}`,
        debug: true,
        enableLogging: true,
        // Customize pool settings for this specific connection
        poolMaxSize: 8,
        connectionTimeout: 5000
      });
      
      if (connection.success) {
        console.log(`${colors.green}Connection ${i + 1} created successfully${colors.reset}`);
        connections.push(connection);
      } else {
        console.error(`Failed to create connection ${i + 1}: ${connection.error.message}`);
      }
    }
    
    // Get updated pool status
    console.log(`\n${colors.blue}Updated Pool Status:${colors.reset}`);
    console.log(getConnectionPoolStatus());
    console.log();
    
    // Execute a query on each connection
    console.log(`${colors.magenta}Testing queries on connections...${colors.reset}`);
    
    for (let i = 0; i < connections.length; i++) {
      const connection = connections[i];
      
      if (connection.prisma) {
        console.log(`Executing query on connection ${i + 1}...`);
        
        try {
          const result = await executeWithRetry(
            connection.prisma,
            () => connection.prisma.$queryRaw`SELECT current_database(), version()`,
            3,
            1000,
            true
          );
          
          console.log(`${colors.green}Query executed successfully on connection ${i + 1}:${colors.reset}`, result);
        } catch (error) {
          console.error(`Query failed on connection ${i + 1}: ${error.message}`);
        }
      }
    }
    
    // Get detailed connection info
    console.log(`\n${colors.blue}Detailed Connection Pool Info:${colors.reset}`);
    console.log(JSON.stringify(getDetailedConnectionPoolInfo(), null, 2));
    console.log();
    
    // Test releasing connections
    console.log(`${colors.magenta}Testing connection release...${colors.reset}`);
    
    for (let i = 0; i < connections.length; i++) {
      const connection = connections[i];
      
      if (connection.release) {
        const released = connection.release();
        console.log(`Connection ${i + 1} released: ${released}`);
      }
    }
    
    // Get pool status after release
    console.log(`\n${colors.blue}Pool Status After Release:${colors.reset}`);
    console.log(getConnectionPoolStatus());
    console.log();
    
    // Close all connections
    console.log(`${colors.magenta}Closing all connections...${colors.reset}`);
    const closeResult = await closeAllConnections(true);
    console.log(`Closed ${closeResult.closed} connections`);
    
    // Final pool status
    console.log(`\n${colors.blue}Final Pool Status:${colors.reset}`);
    console.log(getConnectionPoolStatus());
    console.log();
    
    console.log(`${colors.bright}${colors.green}Test completed successfully!${colors.reset}`);
  } catch (error) {
    console.error(`${colors.bright}Test failed with error: ${error.message}${colors.reset}`);
    console.error(error);
  }
}

runTest().catch(console.error);
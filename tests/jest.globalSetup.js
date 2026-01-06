// Global setup for Jest tests
// Detects Docker, kubectl, Redis, PostgreSQL, MongoDB availability

import { execSync } from 'child_process';
import { createConnection } from 'net';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local if it exists
config({ path: resolve(process.cwd(), '.env.local') });

/**
 * Check if a TCP port is accessible
 */
async function checkTcpConnection(host, port, timeout = 2000) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port, timeout });

    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/**
 * Check Redis connectivity
 */
async function checkRedis() {
  const redisHost = process.env.REDIS_HOST || '10.0.3.70';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);

  try {
    const isConnected = await checkTcpConnection(redisHost, redisPort);
    if (isConnected) {
      console.log(`✓ Redis is available at ${redisHost}:${redisPort}`);
      return true;
    } else {
      console.warn(`⚠ Redis is not available at ${redisHost}:${redisPort} - skipping Redis tests`);
      return false;
    }
  } catch (error) {
    console.warn(`⚠ Redis connection check failed - skipping Redis tests`);
    return false;
  }
}

/**
 * Check PostgreSQL connectivity
 */
async function checkPostgreSQL() {
  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.warn('⚠ DATABASE_URL not set - skipping PostgreSQL tests');
    return false;
  }

  try {
    // Parse connection string
    const url = new URL(process.env.DATABASE_URL);
    const host = url.hostname;
    const port = parseInt(url.port || '5432', 10);

    const isConnected = await checkTcpConnection(host, port);
    if (isConnected) {
      console.log(`✓ PostgreSQL is available at ${host}:${port}`);
      return true;
    } else {
      console.warn(`⚠ PostgreSQL is not available at ${host}:${port} - skipping PostgreSQL tests`);
      return false;
    }
  } catch (error) {
    console.warn('⚠ PostgreSQL connection check failed - skipping PostgreSQL tests');
    return false;
  }
}

/**
 * Check MongoDB connectivity
 */
async function checkMongoDB() {
  const mongoUrl = process.env.MONGODB_URI || process.env.MONGO_URL;

  if (!mongoUrl) {
    console.warn('⚠ MONGODB_URI not set - skipping MongoDB tests');
    return false;
  }

  try {
    // Parse MongoDB connection string
    const url = new URL(mongoUrl);
    const host = url.hostname;
    const port = parseInt(url.port || '27017', 10);

    const isConnected = await checkTcpConnection(host, port);
    if (isConnected) {
      console.log(`✓ MongoDB is available at ${host}:${port}`);
      return true;
    } else {
      console.warn(`⚠ MongoDB is not available at ${host}:${port} - skipping MongoDB tests`);
      return false;
    }
  } catch (error) {
    console.warn('⚠ MongoDB connection check failed - skipping MongoDB tests');
    return false;
  }
}

export default async function() {
  console.log('\n🔍 Checking test infrastructure availability...\n');

  // Check Docker availability
  try {
    execSync('docker ps', { stdio: 'ignore' });
    console.log('✓ Docker is available');
    process.env.SKIP_DOCKER_TESTS = '0';
  } catch {
    console.warn('⚠ Docker is not available - skipping Docker tests');
    process.env.SKIP_DOCKER_TESTS = '1';
  }

  // Check kubectl availability
  try {
    execSync('kubectl version --client', { stdio: 'ignore' });
    console.log('✓ kubectl is available');
    process.env.SKIP_K8S_TESTS = '0';
  } catch {
    console.warn('⚠ kubectl is not available - skipping K8s tests');
    process.env.SKIP_K8S_TESTS = '1';
  }

  // Check kind availability
  try {
    execSync('kind version', { stdio: 'ignore' });
    console.log('✓ kind is available');
    process.env.SKIP_KIND_TESTS = '0';
  } catch {
    console.warn('⚠ kind is not available - skipping kind tests');
    process.env.SKIP_KIND_TESTS = '1';
  }

  // Check Redis connectivity
  const redisAvailable = await checkRedis();
  process.env.SKIP_REDIS_TESTS = redisAvailable ? '0' : '1';

  // Check PostgreSQL connectivity
  const postgresAvailable = await checkPostgreSQL();
  process.env.SKIP_POSTGRES_TESTS = postgresAvailable ? '0' : '1';

  // Check MongoDB connectivity
  const mongoAvailable = await checkMongoDB();
  process.env.SKIP_MONGO_TESTS = mongoAvailable ? '0' : '1';

  console.log('\n📊 Infrastructure Summary:');
  console.log(`   Docker:     ${process.env.SKIP_DOCKER_TESTS === '0' ? '✓ Available' : '✗ Unavailable'}`);
  console.log(`   kubectl:    ${process.env.SKIP_K8S_TESTS === '0' ? '✓ Available' : '✗ Unavailable'}`);
  console.log(`   kind:       ${process.env.SKIP_KIND_TESTS === '0' ? '✓ Available' : '✗ Unavailable'}`);
  console.log(`   Redis:      ${process.env.SKIP_REDIS_TESTS === '0' ? '✓ Available' : '✗ Unavailable'}`);
  console.log(`   PostgreSQL: ${process.env.SKIP_POSTGRES_TESTS === '0' ? '✓ Available' : '✗ Unavailable'}`);
  console.log(`   MongoDB:    ${process.env.SKIP_MONGO_TESTS === '0' ? '✓ Available' : '✗ Unavailable'}`);
  console.log('');

  return Promise.resolve();
}

// Database connectivity functions
// Provides functions for robust database connections

import { PrismaClient } from '@prisma/client';
import { getDatabaseLogger } from './database-logger';
import { 
  LogCategory, 
  DatabaseConnectionOptions,
  ConnectionResult,
  LoggerOptions
} from './db-types';
import {
  poolConfig,
  connectionPool,
  findLeastRecentlyUsedConnection,
  markConnectionInUse,
  markConnectionReleased,
  isConnectionInUse
} from './db-pool';

/**
 * Creates a robust database connection with retry capability
 */
export async function createRobustConnection(options: DatabaseConnectionOptions = {}): Promise<ConnectionResult> {
  const {
    connectionUrl = process.env.DATABASE_URL,
    maxRetries = 3,
    retryDelay = 1000,
    debug = false,
    poolKey = 'default',
    enableLogging = false,
    poolMinSize = poolConfig.minSize,
    poolMaxSize = poolConfig.maxSize,
    idleTimeout = poolConfig.idleTimeout,
    connectionTimeout = poolConfig.connectionTimeout,
    acquireTimeout = poolConfig.acquireTimeout,
    enableDynamicSizing = poolConfig.enableDynamicSizing,
    enableConnectionValidation = poolConfig.enableConnectionValidation
  } = options;

  // Set up logging
  const logger = enableLogging 
    ? getDatabaseLogger({ 
        defaultCategory: LogCategory.CONNECTION
      }) 
    : null;
  
  // Fallback to console.log if debug is true but logging is disabled
  const log = logger 
    ? (message: string, metadata?: Record<string, any>) => logger.debug(message, metadata)
    : debug 
      ? console.log 
      : () => {};

  if (!connectionUrl) {
    const error = new Error('Database connection URL is required. Set DATABASE_URL or provide connectionUrl.');
    if (logger) logger.error(error.message);
    throw error;
  }
  
  // Initialize connection start time for acquire time tracking
  const acquireStartTime = Date.now();
  connectionPool.usage.totalAcquires++;

  // Check if we need to remove idle connections or validate existing connections
  if (enableConnectionValidation) {
    await validatePoolConnections(logger);
  }

  // Check if we already have an available client for this pool key
  if (connectionPool.clients.has(poolKey)) {
    const currentTime = Date.now();
    const lastUsedTime = connectionPool.lastUsed.get(poolKey) || 0;
    const idleTime = currentTime - lastUsedTime;
    
    // Check if the connection has been idle too long
    if (idleTimeout > 0 && idleTime > idleTimeout) {
      // Connection is too old, remove it and create a new one
      if (logger) logger.info(`Connection ${poolKey} exceeded idle timeout (${idleTime}ms > ${idleTimeout}ms). Creating new connection.`);
      await removeConnection(poolKey, logger);
    } else {
      // Use existing connection
      const message = `Using existing database connection from pool: ${poolKey}`;
      if (logger) logger.info(message, { poolKey, idleTime });
      else log(message);
      
      markConnectionInUse(poolKey);
      
      // Record acquire success and time
      const acquireTime = Date.now() - acquireStartTime;
      connectionPool.usage.acquireSuccesses++;
      connectionPool.usage.acquireTimeTotal += acquireTime;
      connectionPool.usage.acquireTimeAvg = connectionPool.usage.acquireTimeTotal / connectionPool.usage.acquireSuccesses;
      
      return { 
        prisma: connectionPool.clients.get(poolKey) || null,
        fromPool: true,
        success: true,
        release: () => releaseConnection(poolKey, logger)
      };
    }
  }

  // If we've reached our pool limit, try to find an unused connection to replace
  if (connectionPool.clients.size >= poolMaxSize) {
    if (enableDynamicSizing) {
      const removedKey = findLeastRecentlyUsedConnection();
      if (removedKey) {
        if (logger) logger.info(`Pool at capacity. Removing least recently used connection: ${removedKey}`);
        await removeConnection(removedKey, logger);
        connectionPool.usage.dynamicPoolAdjustments++;
      } else {
        // No connection to replace, fail the acquire
        const error = new Error(`Connection pool at capacity (${poolMaxSize}). No available connections.`);
        if (logger) logger.error(error.message);
        
        // Record acquire failure
        connectionPool.usage.acquireFailures++;
        
        return { 
          prisma: null, 
          success: false, 
          error 
        };
      }
    } else {
      // Dynamic sizing disabled, fail the acquire
      const error = new Error(`Connection pool at capacity (${poolMaxSize}). No available connections.`);
      if (logger) logger.error(error.message);
      
      // Record acquire failure
      connectionPool.usage.acquireFailures++;
      
      return { 
        prisma: null, 
        success: false, 
        error 
      };
    }
  }

  // Create new Prisma client with timeout options
  const prismaOptions = {
    datasources: {
      db: {
        url: connectionUrl,
      },
    },
    log: debug ? ['error' as const, 'warn' as const] : ['error' as const],
  };
  
  const prisma = new PrismaClient(prismaOptions);
  
  // Retry function for database operations
  async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error = new Error('Unknown error');
    const timer = logger ? logger.createTimer('database_operation_retry') : null;
    if (timer) timer.start();
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const message = `Database operation attempt ${attempt}/${maxRetries}`;
        if (logger) logger.debug(message, { attempt, maxRetries });
        else log(message);
        
        // Add timeout for the operation
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Database operation timed out after ${connectionTimeout}ms`));
          }, connectionTimeout);
        });
        
        // Race the operation against the timeout
        return await Promise.race([
          operation(),
          timeoutPromise
        ]);
      } catch (error) {
        lastError = error as Error;
        const message = `Database operation failed (attempt ${attempt}/${maxRetries}): ${lastError.message}`;
        
        if (logger) logger.warn(message, { 
          attempt, 
          maxRetries, 
          error: lastError.message,
          retryDelay: attempt < maxRetries ? retryDelay : null
        });
        else log(message);
        
        if (attempt < maxRetries) {
          const waitMessage = `Waiting ${retryDelay}ms before retry...`;
          if (logger) logger.debug(waitMessage);
          else log(waitMessage);
          
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    
    const errorMessage = `Database operation failed after ${maxRetries} attempts. Last error: ${lastError.message}`;
    if (timer) timer.end(`Database operation failed after ${maxRetries} attempts`);
    
    if (logger) logger.error(errorMessage, lastError);
    throw new Error(errorMessage);
  }
  
  try {
    // Test connection with retry and timeout
    const message = 'Testing database connection...';
    if (logger) logger.info(message);
    else log(message);
    
    const timer = logger ? logger.createTimer('connection_test') : null;
    if (timer) timer.start();
    
    // Set up an overall acquire timeout
    const acquireTimeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Failed to acquire database connection within ${acquireTimeout}ms`));
      }, acquireTimeout);
    });
    
    // Race the connection test against the acquire timeout
    await Promise.race([
      withRetry(() => prisma.$queryRaw`SELECT 1`),
      acquireTimeoutPromise
    ]);
    
    if (timer) {
      const elapsed = timer.elapsed();
      if (logger) logger.info(`Database connection successful in ${elapsed}ms`);
    } else {
      log('Database connection successful!');
    }
    
    const currentTime = Date.now();
    
    // Add to connection pool
  connectionPool.clients.set(poolKey, prisma);
  markConnectionInUse(poolKey);
  connectionPool.lastValidated.set(poolKey, currentTime);
  connectionPool.creationTimes.set(poolKey, currentTime);
  connectionPool.usage.totalConnections++;
    
    // Update peak connections
    if (connectionPool.clients.size > connectionPool.usage.peakConnections) {
      connectionPool.usage.peakConnections = connectionPool.clients.size;
    }
    
    const poolMessage = `Added connection to pool: ${poolKey}`;
    if (logger) logger.debug(poolMessage, { 
      poolSize: connectionPool.clients.size,
      poolKey,
      maxSize: poolMaxSize,
      minSize: poolMinSize
    });
    else log(poolMessage);
    
    // Record acquire success and time
    const acquireTime = Date.now() - acquireStartTime;
    connectionPool.usage.acquireSuccesses++;
    connectionPool.usage.acquireTimeTotal += acquireTime;
    connectionPool.usage.acquireTimeAvg = connectionPool.usage.acquireTimeTotal / connectionPool.usage.acquireSuccesses;
    
    return { 
      prisma, 
      success: true, 
      fromPool: false,
      release: () => releaseConnection(poolKey, logger)
    };
  } catch (error) {
    const message = `Database connection failed: ${(error as Error).message}`;
    if (logger) logger.error(message, error as Error);
    else log(message);
    
    await prisma.$disconnect();
    
    // Record acquire failure
    connectionPool.usage.acquireFailures++;
    
    // Provide helpful error diagnostics
    const err = error as Error & { code?: string };
    let errorMessage = `Database connection error: ${err.message}`;
    let actionMessage = '';
    
    if (err.code === 'ECONNREFUSED') {
      actionMessage = 'Verify the database server is running and accessible at the specified host/port.';
    } else if (err.code === 'ETIMEDOUT') {
      actionMessage = 'Check network connectivity to the database server.';
    } else if (err.code === 'P1001') {
      actionMessage = 'Verify your connection string format and that the database server is running.';
    } else if (err.code === 'P1003') {
      actionMessage = 'The specified database does not exist. Create it or check the connection string.';
    } else if (err.code === 'P1017') {
      actionMessage = 'Authentication failed. Check username and password in the connection string.';
    }
    
    if (actionMessage) {
      errorMessage += ` ${actionMessage}`;
    }
    
    return { prisma: null, success: false, error: new Error(errorMessage) };
  }
}

/**
 * Release a connection back to the pool
 */
export function releaseConnection(poolKey: string, logger?: ReturnType<typeof getDatabaseLogger> | null): boolean {
  if (connectionPool.clients.has(poolKey)) {
    markConnectionReleased(poolKey);
    
    if (logger) {
      logger.debug(`Released connection back to pool: ${poolKey}`, {
        poolSize: connectionPool.clients.size,
        inUse: connectionPool.inUse,
        poolKey
      });
    }
    return true;
  }
  return false;
}

/**
 * Validate all connections in the pool
 */
async function validatePoolConnections(logger?: ReturnType<typeof getDatabaseLogger> | null): Promise<void> {
  if (!poolConfig.enableConnectionValidation) {
    return;
  }
  
  const currentTime = Date.now();
  const validationPromises: Promise<void>[] = [];
  
  for (const [key, client] of connectionPool.clients.entries()) {
    const lastValidatedTime = connectionPool.lastValidated.get(key) || 0;
    const validationAge = currentTime - lastValidatedTime;
    
    // Only validate connections that haven't been validated recently (within the last minute)
    if (validationAge > 60000) {
      connectionPool.usage.connectionValidations++;
      
      if (logger) logger.debug(`Validating connection: ${key}`, { validationAge });
      
      const promise = validateConnection(key, client, logger).catch(async error => {
        connectionPool.usage.connectionValidationFailures++;
        if (logger) logger.error(`Connection validation failed for ${key}: ${error.message}`, error);
        await removeConnection(key, logger);
      });
      
      validationPromises.push(promise);
    }
  }
  
  if (validationPromises.length > 0) {
    await Promise.all(validationPromises);
  }
}

/**
 * Validate a single connection
 */
async function validateConnection(
  key: string, 
  client: PrismaClient, 
  logger?: ReturnType<typeof getDatabaseLogger> | null
): Promise<void> {
  try {
    // Simple validation query with timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Connection validation timed out after ${poolConfig.connectionTimeout}ms`));
      }, poolConfig.connectionTimeout);
    });
    
    await Promise.race([
      client.$queryRaw`SELECT 1`,
      timeoutPromise
    ]);
    
    // Update last validation time
    connectionPool.lastValidated.set(key, Date.now());
    
    if (logger) logger.debug(`Connection ${key} validated successfully`);
  } catch (error) {
    if (logger) logger.error(`Connection ${key} validation failed: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Remove a connection from the pool
 */
async function removeConnection(
  key: string, 
  logger?: ReturnType<typeof getDatabaseLogger> | null
): Promise<boolean> {
  const client = connectionPool.clients.get(key);
  if (!client) {
    return false;
  }
  
  try {
    await client.$disconnect();
    connectionPool.clients.delete(key);
    connectionPool.lastUsed.delete(key);
    connectionPool.lastValidated.delete(key);
    connectionPool.creationTimes.delete(key);
    if (isConnectionInUse(key)) {
      connectionPool.inUseConnections.delete(key);
      connectionPool.inUse = Math.max(0, connectionPool.inUse - 1);
    }
    
    if (logger) logger.debug(`Removed connection from pool: ${key}`);
    return true;
  } catch (error) {
    if (logger) logger.error(`Failed to remove connection ${key}: ${(error as Error).message}`);
    return false;
  }
}

/**
 * Execute a database operation with retry logic
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>, 
  maxRetries = 3, 
  retryDelay = 1000,
  enableLogging = false
): Promise<T> {
  const logger = enableLogging ? getDatabaseLogger() : null;
  const timer = logger ? logger.createTimer('db_operation') : null;
  if (timer) timer.start();
  
  let lastError: Error = new Error('Unknown error');
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (logger) logger.debug(`Database operation attempt ${attempt}/${maxRetries}`);
      const result = await operation();
      
      if (timer) {
        const elapsed = timer.elapsed();
        if (logger) logger.debug(`Database operation completed successfully in ${elapsed}ms`);
      }
      
      return result;
    } catch (error) {
      lastError = error as Error;
      
      if (logger) {
        logger.warn(`Database operation failed (attempt ${attempt}/${maxRetries})`, {
          error: lastError.message,
          attempt,
          maxRetries,
          willRetry: attempt < maxRetries
        });
      }
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  if (logger) {
    logger.error(`Database operation failed after ${maxRetries} attempts`, lastError);
  }
  
  throw new Error(`Database operation failed after ${maxRetries} attempts. Last error: ${lastError.message}`);
}

/**
 * Initialize the vector database with robust connection handling
 */
export async function initializeVectorDatabaseRobust(options: DatabaseConnectionOptions & {
  createExtensions?: boolean;
  createTables?: boolean;
} = {}): Promise<ConnectionResult> {
  const {
    createExtensions = true,
    createTables = true,
    debug = false,
    enableLogging = false,
    ...connectionOptions
  } = options;
  
  const logger = enableLogging ? getDatabaseLogger({
    defaultCategory: LogCategory.INITIALIZATION
  }) : null;
  
  const log = logger 
    ? (message: string, metadata?: Record<string, any>) => logger.info(message, metadata)
    : debug 
      ? console.log 
      : () => {};
  
  // Create robust connection
  const result = await createRobustConnection({
    ...connectionOptions,
    debug,
    enableLogging
  });
  
  if (!result.success || !result.prisma) {
    return result;
  }
  
  const prismaClient = result.prisma;
  
  try {
    if (createExtensions) {
      // Create pgvector extension
      log('Creating pgvector extension if needed...');
      try {
        await executeWithRetry(() => 
          prismaClient.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector;`
        , 3, 1000, enableLogging);
        log('pgvector extension created or already exists');
      } catch (extError) {
        const errorMessage = `Could not create pgvector extension: ${(extError as Error).message}`;
        log(errorMessage);
        if (logger) logger.warn(errorMessage, { error: extError });
        log('This may be due to insufficient database permissions or pgvector not being installed.');
      }
    }
    
    if (createTables) {
      // Create document_embeddings table
      log('Creating document_embeddings table if needed...');
      try {
        await executeWithRetry(() => 
          prismaClient.$executeRaw`
            CREATE TABLE IF NOT EXISTS document_embeddings (
              id SERIAL PRIMARY KEY,
              document_id VARCHAR(255) UNIQUE NOT NULL,
              content TEXT NOT NULL,
              embedding vector(1536),
              metadata JSONB DEFAULT '{}',
              embedding_generation_time_ms INTEGER,
              search_count INTEGER DEFAULT 0,
              last_accessed_at TIMESTAMP,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `
        , 3, 1000, enableLogging);
        
        await executeWithRetry(() => 
          prismaClient.$executeRaw`
            CREATE INDEX IF NOT EXISTS document_embeddings_document_id_idx ON document_embeddings(document_id);
          `
        , 3, 1000, enableLogging);
        
        log('document_embeddings table created or already exists');
        
        // Try to create vector indexes if possible
        try {
          await executeWithRetry(() => 
            prismaClient.$executeRaw`
              CREATE INDEX IF NOT EXISTS document_embeddings_embedding_l2_idx ON document_embeddings 
              USING ivfflat (embedding vector_l2_ops);
            `
          , 3, 1000, enableLogging);
          log('Vector L2 index created or already exists');
        } catch (idxError) {
          const errorMessage = `Could not create vector L2 index: ${(idxError as Error).message}`;
          log(errorMessage);
          if (logger) logger.warn(errorMessage, { error: idxError });
        }
        
        try {
          await executeWithRetry(() => 
            prismaClient.$executeRaw`
              CREATE INDEX IF NOT EXISTS document_embeddings_embedding_ip_idx ON document_embeddings 
              USING ivfflat (embedding vector_ip_ops);
            `
          , 3, 1000, enableLogging);
          log('Vector IP index created or already exists');
        } catch (idxError) {
          const errorMessage = `Could not create vector IP index: ${(idxError as Error).message}`;
          log(errorMessage);
          if (logger) logger.warn(errorMessage, { error: idxError });
        }
        
      } catch (tableError) {
        const errorMessage = `Could not create document_embeddings table: ${(tableError as Error).message}`;
        log(errorMessage);
        if (logger) logger.error(errorMessage, tableError as Error);
        throw tableError;
      }
    }
    
    return { ...result, success: true };
  } catch (error) {
    const errorMessage = `Database initialization failed: ${(error as Error).message}`;
    log(errorMessage);
    if (logger) logger.error(errorMessage, error as Error);
    
    if (!result.fromPool) {
      await prismaClient.$disconnect();
    }
    return { prisma: null, success: false, error: error as Error };
  }
}

/**
 * Close all connections in the pool
 */
export async function closeAllConnections(enableLogging = false): Promise<{ closed: number }> {
  const logger = enableLogging ? getDatabaseLogger() : null;
  const promises: Promise<void>[] = [];
  
  if (logger) logger.info(`Closing all database connections (${connectionPool.clients.size})...`);
  
  for (const [key, client] of connectionPool.clients.entries()) {
    promises.push(client.$disconnect().then(() => {
      connectionPool.clients.delete(key);
      connectionPool.lastUsed.delete(key);
      connectionPool.lastValidated.delete(key);
      connectionPool.creationTimes.delete(key);
      if (logger) logger.debug(`Closed connection: ${key}`);
    }));
  }
  
  await Promise.all(promises);
  connectionPool.inUse = 0;
  
  if (logger) logger.info(`Closed ${promises.length} database connections successfully`);
  
  return { closed: promises.length };
}

/**
 * Create a robust connection with logging
 */
export async function createRobustConnectionWithLogging(
  options?: DatabaseConnectionOptions,
  loggerOptions?: LoggerOptions
) {
  const logger = getDatabaseLogger(loggerOptions);
  const timer = logger.createTimer('connection');
  timer.start();
  
  logger.info('Creating robust database connection', {
    connectionUrl: options?.connectionUrl ? 'Provided' : 'Using DATABASE_URL',
    maxRetries: options?.maxRetries,
  });
  
  try {
    const connection = await createRobustConnection(options);
    
    const elapsed = timer.end(
      connection.success 
        ? 'Database connection established successfully' 
        : 'Database connection failed',
      {
        success: connection.success,
        fromPool: connection.fromPool,
        error: connection.error?.message
      }
    );
    
    if (connection.success) {
      logger.info(`Database connection established in ${elapsed}ms`, {
        fromPool: connection.fromPool
      });
    } else {
      logger.error(`Database connection failed after ${elapsed}ms`, 
        connection.error, 
        { fromPool: connection.fromPool }
      );
    }
    
    return connection;
  } catch (error) {
    const elapsed = timer.end('Database connection failed with exception');
    logger.error(`Database connection failed after ${elapsed}ms with exception`, error as Error);
    throw error;
  }
}

// Database connectivity functions
// Provides functions for robust database connections

import { PrismaClient } from '@prisma/client';
import { getDatabaseLogger, LogCategory, LoggerOptions } from './db-logger';
import {
  DatabaseConnectionOptions,
  ConnectionResult
} from './db-types';
import { 
  poolConfig, 
  connectionPool 
} from './db-pool';

async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number,
  retryDelay: number,
  logger: any | null
): Promise<T> {
  let lastError: Error | null = null;
  const timer = logger ? logger.createTimer('execute_with_retry') : null;
  if (timer) timer.start();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (logger) logger.info(`Database operation attempt ${attempt}/${maxRetries}`);
      const result = await operation();
      if (timer) {
        const elapsed = timer.elapsed();
        if (logger) logger.info(`Database operation completed successfully in ${elapsed}ms`);
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

  throw new Error(`Database operation failed after ${maxRetries} attempts. Last error: ${lastError?.message}`);
}

export async function createRobustConnection(options: DatabaseConnectionOptions = {}): Promise<ConnectionResult> {
  const {
    connectionUrl = process.env.DATABASE_URL,
    maxRetries = 3,
    retryDelay = 1000,
    debug = false,
    poolKey = 'default',
    enableLogging = false,
    poolMaxSize = poolConfig.maxSize,
    idleTimeout = poolConfig.idleTimeout,
    connectionTimeout = poolConfig.connectionTimeout,
    acquireTimeout = poolConfig.acquireTimeout,
    enableDynamicSizing = poolConfig.enableDynamicSizing,
    enableConnectionValidation = poolConfig.enableConnectionValidation
  } = options;

  const dbLogger = enableLogging ? getDatabaseLogger({ defaultCategory: LogCategory.CONNECTION }) : null;
  const log = dbLogger ? (message: string, metadata?: Record<string, any>) => dbLogger.debug(message, metadata) : debug ? (message: string) => console.log(message) : () => {};

  if (!connectionUrl) {
    const error = new Error('Database connection URL is required. Set DATABASE_URL or provide connectionUrl.');
    if (dbLogger) dbLogger.error(error.message);
    throw error;
  }

  const acquireStartTime = Date.now();
  connectionPool.usage.totalAcquires++;

  if (enableConnectionValidation) {
    await validatePoolConnections(dbLogger);
  }

  if (connectionPool.clients.has(poolKey)) {
    const currentTime = Date.now();
    const lastUsedTime = connectionPool.lastUsed.get(poolKey) || 0;
    const idleTime = currentTime - lastUsedTime;

    if (idleTimeout > 0 && idleTime > idleTimeout) {
      if (dbLogger) dbLogger.info(`Connection ${poolKey} exceeded idle timeout (${idleTime}ms > ${idleTimeout}ms). Creating new connection.`);
      await removeConnection(poolKey, dbLogger);
    } else {
      const message = `Using existing database connection from pool: ${poolKey}`;
      if (dbLogger) dbLogger.info(message, { poolKey, idleTime });
      else log(message);
      connectionPool.inUse++;
      connectionPool.lastUsed.set(poolKey, currentTime);
      const acquireTime = Date.now() - acquireStartTime;
      connectionPool.usage.acquireSuccesses++;
      connectionPool.usage.acquireTimeTotal += acquireTime;
      connectionPool.usage.acquireTimeAvg = connectionPool.usage.acquireTimeTotal / connectionPool.usage.acquireSuccesses;
      return {
        prisma: connectionPool.clients.get(poolKey) || null,
        fromPool: true,
        success: true,
        release: () => releaseConnection(poolKey, dbLogger)
      };
    }
  }

  if (connectionPool.clients.size >= poolMaxSize) {
    if (enableDynamicSizing) {
      const removedKey = findLeastRecentlyUsedConnection();
      if (removedKey) {
        if (dbLogger) dbLogger.info(`Pool at capacity. Removing least recently used connection: ${removedKey}`);
        await removeConnection(removedKey, dbLogger);
        connectionPool.usage.dynamicPoolAdjustments++;
      } else {
        const error = new Error(`Connection pool at capacity (${poolMaxSize}). No available connections.`);
        if (dbLogger) dbLogger.error(error.message);
        connectionPool.usage.acquireFailures++;
        return { prisma: null, success: false, error };
      }
    } else {
      const error = new Error(`Connection pool at capacity (${poolMaxSize}). No available connections.`);
      if (dbLogger) dbLogger.error(error.message);
      connectionPool.usage.acquireFailures++;
      return { prisma: null, success: false, error };
    }
  }

  const prismaOptions = {
    datasources: {
      db: { url: connectionUrl },
    },
    log: debug ? ['error' as const, 'warn' as const] : ['error' as const],
  };

  const prisma = new PrismaClient(prismaOptions);

  try {
    const message = 'Testing database connection...';
    if (dbLogger) dbLogger.info(message);
    else log(message);

    const timer = dbLogger ? dbLogger.createTimer('connection_test') : null;
    if (timer) timer.start();

    const acquireTimeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Failed to acquire database connection within ${acquireTimeout}ms`));
      }, acquireTimeout);
    });

    await Promise.race([
      executeWithRetry(() => prisma.$queryRaw`SELECT 1`, maxRetries, retryDelay, dbLogger),
      acquireTimeoutPromise
    ]);

    if (timer) {
      const elapsed = timer.elapsed();
      if (dbLogger) dbLogger.info(`Database connection successful in ${elapsed}ms`);
    } else {
      log('Database connection successful!');
    }

    connectionPool.clients.set(poolKey, prisma);
    connectionPool.lastUsed.set(poolKey, Date.now());
    connectionPool.creationTimes.set(poolKey, Date.now());
    connectionPool.lastValidated.set(poolKey, Date.now());

    const poolMessage = `Added connection to pool: ${poolKey}`;
    if (dbLogger) dbLogger.info(poolMessage, { poolSize: connectionPool.clients.size, poolKey, maxSize: poolMaxSize });
    else log(poolMessage);

    const acquireTime = Date.now() - acquireStartTime;
    connectionPool.usage.acquireSuccesses++;
    connectionPool.usage.acquireTimeTotal += acquireTime;
    connectionPool.usage.acquireTimeAvg = connectionPool.usage.acquireTimeTotal / connectionPool.usage.acquireSuccesses;

    return { prisma, success: true, fromPool: false, release: () => releaseConnection(poolKey, dbLogger) };
  } catch (error) {
    const message = `Database connection failed: ${(error as Error).message}`;
    if (dbLogger) dbLogger.error(message, error as Error);
    else log(message);

    await prisma.$disconnect();
    connectionPool.usage.acquireFailures++;

    let actionMessage = '';
    if ((error as Error).message.includes('timed out')) {
      actionMessage = 'Consider increasing connectionTimeout or acquireTimeout.';
    } else if ((error as Error).message.includes('Authentication failed')) {
      actionMessage = 'Please check your database credentials.';
    } else if ((error as Error).message.includes('is not running')) {
      actionMessage = 'Please ensure your database server is running.';
    }

    let errorMessage = `Failed to connect to the database.`;
    if (actionMessage) {
      errorMessage += ` ${actionMessage}`;
    }

    return { prisma: null, success: false, error: new Error(errorMessage) };
  }
}

export function releaseConnection(poolKey: string, logger?: ReturnType<typeof getDatabaseLogger> | null): boolean {
  if (connectionPool.clients.has(poolKey)) {
    connectionPool.inUse--;
    connectionPool.lastUsed.set(poolKey, Date.now());
    if (logger) {
      logger.info(`Released connection: ${poolKey}`, { inUse: connectionPool.inUse, poolSize: connectionPool.clients.size });
    }
    return true;
  } else {
    if (logger) {
      logger.warn(`Attempted to release a non-existent connection key: ${poolKey}`);
    }
    return false;
  }
}

function findLeastRecentlyUsedConnection(): string | null {
  let oldestKey: string | null = null;
  let oldestTime = Infinity;
  for (const [key, lastUsedTime] of connectionPool.lastUsed.entries()) {
    if (connectionPool.inUse > 0) {
      continue;
    }
    if (lastUsedTime < oldestTime) {
      oldestTime = lastUsedTime;
      oldestKey = key;
    }
  }
  return oldestKey;
}

export async function validatePoolConnections(logger?: ReturnType<typeof getDatabaseLogger> | null): Promise<void> {
  const validationPromises: Promise<void>[] = [];
  const now = Date.now();
  for (const [key, client] of connectionPool.clients.entries()) {
    const lastValidated = connectionPool.lastValidated.get(key) || 0;
    const validationInterval = 30000; // 30 seconds default
    if (now - lastValidated > validationInterval) {
      const promise = validateConnection(key, client, logger).catch(err => {
        if (logger) logger.error(`Connection validation failed for ${key}, removing from pool`, err);
        removeConnection(key, logger);
      });
      validationPromises.push(promise);
    }
  }
  if (validationPromises.length > 0) {
    await Promise.all(validationPromises);
  }
}

export async function validateConnection(key: string, client: PrismaClient, logger?: ReturnType<typeof getDatabaseLogger> | null): Promise<void> {
  try {
    await client.$queryRaw`SELECT 1`;
    connectionPool.lastValidated.set(key, Date.now());
    if (logger) logger.info(`Connection ${key} validated successfully`);
  } catch (error) {
    if (logger) logger.warn(`Connection ${key} failed validation: ${(error as Error).message}`);
    throw error;
  }
}

export async function removeConnection(key: string, logger?: ReturnType<typeof getDatabaseLogger> | null): Promise<boolean> {
  const client = connectionPool.clients.get(key);
  if (client) {
    try {
      await client.$disconnect();
      if (logger) logger.info(`Disconnected connection: ${key}`);
    } catch (error) {
      if (logger) logger.error(`Error disconnecting connection ${key}: ${(error as Error).message}`);
    }
    connectionPool.clients.delete(key);
    connectionPool.lastUsed.delete(key);
    connectionPool.creationTimes.delete(key);
    connectionPool.lastValidated.delete(key);
    if (logger) logger.info(`Removed connection from pool: ${key}`, { poolSize: connectionPool.clients.size });
    return true;
  } else {
    if (logger) logger.warn(`Attempted to remove non-existent connection: ${key}`);
    return false;
  }
}

export async function initializeVectorDatabaseRobust(options: DatabaseConnectionOptions & { createExtensions?: boolean; createTables?: boolean; } = {}): Promise<ConnectionResult> {
  const { createExtensions = true, createTables = true, debug = false, enableLogging = false, ...connectionOptions } = options;
  const initLogger = enableLogging ? getDatabaseLogger({ defaultCategory: LogCategory.INITIALIZATION }) : null;
  const log = initLogger ? (message: string, metadata?: Record<string, any>) => initLogger.info(message, metadata) : debug ? (message: string) => console.log(message) : () => {};
  const result = await createRobustConnection({ ...connectionOptions, debug, enableLogging });
  if (!result.success || !result.prisma) {
    return result;
  }
  const prismaClient = result.prisma;
  try {
    if (createExtensions) {
      log('Creating pgvector extension if needed...');
      try {
        await executeWithRetry(() => prismaClient.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector;`, 3, 1000, initLogger);
        log('pgvector extension created or already exists');
      } catch (extError) {
        const errorMessage = `Could not create pgvector extension: ${(extError as Error).message}`;
        log(errorMessage);
        if (initLogger) initLogger.warn(errorMessage, { error: extError });
        log('This may be due to insufficient database permissions or pgvector not being installed.');
      }
    }
    if (createTables) {
      log('Creating document_embeddings table if needed...');
      try {
        await executeWithRetry(() => prismaClient.$executeRaw`
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
        `, 3, 1000, initLogger);
        await executeWithRetry(() => prismaClient.$executeRaw`
          CREATE INDEX IF NOT EXISTS document_embeddings_document_id_idx ON document_embeddings(document_id);
        `, 3, 1000, initLogger);
        log('document_embeddings table created or already exists');
        try {
          await executeWithRetry(() => prismaClient.$executeRaw`
            CREATE INDEX IF NOT EXISTS document_embeddings_embedding_l2_idx ON document_embeddings
            USING ivfflat (embedding vector_l2_ops);
          `, 3, 1000, initLogger);
          log('Vector L2 index created or already exists');
        } catch (idxError) {
          const errorMessage = `Could not create vector L2 index: ${(idxError as Error).message}`;
          log(errorMessage);
          if (initLogger) initLogger.warn(errorMessage, { error: idxError });
        }
        try {
          await executeWithRetry(() => prismaClient.$executeRaw`
            CREATE INDEX IF NOT EXISTS document_embeddings_embedding_ip_idx ON document_embeddings
            USING ivfflat (embedding vector_ip_ops);
          `, 3, 1000, initLogger);
          log('Vector IP index created or already exists');
        } catch (idxError) {
          const errorMessage = `Could not create vector IP index: ${(idxError as Error).message}`;
          log(errorMessage);
          if (initLogger) initLogger.warn(errorMessage, { error: idxError });
        }
      } catch (tableError) {
        const errorMessage = `Could not create document_embeddings table: ${(tableError as Error).message}`;
        log(errorMessage);
        if (initLogger) initLogger.error(errorMessage, tableError as Error);
        throw tableError;
      }
    }
    return { ...result, success: true };
  } catch (error) {
    const errorMessage = `Database initialization failed: ${(error as Error).message}`;
    log(errorMessage);
    if (initLogger) initLogger.error(errorMessage, error as Error);
    if (!result.fromPool) {
      await prismaClient.$disconnect();
    }
    return { prisma: null, success: false, error: error as Error };
  }
}

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
      if (logger) logger.info(`Closed connection: ${key}`);
    }));
  }
  await Promise.all(promises);
  connectionPool.inUse = 0;
  if (logger) logger.info(`Closed ${promises.length} database connections successfully`);
  return { closed: promises.length };
}

export async function createRobustConnectionWithLogging(options?: DatabaseConnectionOptions, loggerOptions?: LoggerOptions) {
  const logger = getDatabaseLogger(loggerOptions);
  const timer = logger.createTimer('connection');
  timer.start();
  console.log('Creating robust database connection', { connectionUrl: options?.connectionUrl ? 'Provided' : 'Using DATABASE_URL', maxRetries: options?.maxRetries });
  try {
    const connection = await createRobustConnection(options);
    const elapsed = timer.end(connection.success ? 'Database connection established successfully' : 'Database connection failed', { success: connection.success, fromPool: connection.fromPool, error: connection.error?.message });
    if (connection.success) {
      console.log(`Database connection established in ${elapsed}ms`, { fromPool: connection.fromPool });
    } else {
      console.error(`Database connection failed after ${elapsed}ms`, connection.error, { fromPool: connection.fromPool });
    }
    return connection;
  } catch (error) {
    const elapsed = timer.end('Database connection failed with exception');
    console.error(`Database connection failed after ${elapsed}ms with exception`, error as Error);
    throw error;
  }
}

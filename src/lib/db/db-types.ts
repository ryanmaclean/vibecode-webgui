// Database shared types
// Contains common type definitions used across database modules

import { PrismaClient } from '@prisma/client';

// Configure logging levels
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace'
}

// Configure logging categories
export enum LogCategory {
  QUERY = 'query',
  CONNECTION = 'connection',
  TRANSACTION = 'transaction',
  MIGRATION = 'migration',
  INITIALIZATION = 'initialization',
  VECTOR = 'vector',
  EMBEDDING = 'embedding',
  HEALTH = 'health'
}

// Database logger interface
export interface DbLogger {
  log: (message: string, options?: LogOptions) => void;
  error: (message: string, error?: Error, metadata?: Record<string, any>) => void;
  warn: (message: string, metadata?: Record<string, any>) => void;
  info: (message: string, metadata?: Record<string, any>) => void;
  debug: (message: string, metadata?: Record<string, any>) => void;
  trace: (message: string, metadata?: Record<string, any>) => void;
  createTimer: (operation: string) => DbOperationTimer;
  setDefaultCategory: (category: LogCategory) => void;
  shouldLog: (level: LogLevel) => boolean;
}

export interface LogOptions {
  level?: LogLevel;
  category?: LogCategory;
  elapsed?: number;
  operation?: string;
  sql?: string;
  params?: any;
  metadata?: Record<string, any>;
  error?: Error;
  timestamp?: Date;
}

export interface DbOperationTimer {
  start: () => void;
  end: (message?: string, additionalMetadata?: Record<string, any>) => number;
  elapsed: () => number;
}

export interface LoggerOptions {
  logLevel?: LogLevel;
  defaultCategory?: LogCategory;
  logToConsole?: boolean;
  logToFile?: boolean;
  logToMetrics?: boolean;
  logFilePath?: string;
  serviceName?: string;
  environment?: string;
}

// Connection pool configuration
export interface DatabaseConnectionOptions {
  connectionUrl?: string;
  maxRetries?: number;
  retryDelay?: number;
  debug?: boolean;
  poolKey?: string;
  enableLogging?: boolean;
  poolMinSize?: number;
  poolMaxSize?: number;
  idleTimeout?: number;
  connectionTimeout?: number;
  acquireTimeout?: number;
  enableDynamicSizing?: boolean;
  enableConnectionValidation?: boolean;
}

export interface ConnectionResult {
  prisma: PrismaClient | null;
  success: boolean;
  fromPool?: boolean;
  release?: () => boolean;
  error?: Error;
}

// Pool status types
export interface ConnectionPoolStatus {
  size: number;
  inUse: number;
  maxSize: number;
  minSize: number;
  available: number;
  utilization: number;
  configuration: {
    idleTimeout: number;
    connectionTimeout: number;
    acquireTimeout: number;
    enableDynamicSizing: boolean;
    enableConnectionValidation: boolean;
  };
  metrics: {
    totalConnections: number;
    peakConnections: number;
    totalAcquires: number;
    acquireSuccesses: number;
    acquireFailures: number;
    acquireTimeAvg: number;
    connectionValidations: number;
    connectionValidationFailures: number;
    dynamicPoolAdjustments: number;
  };
}

export interface DetailedConnectionPoolInfo {
  status: ConnectionPoolStatus;
  connections: {
    key: string;
    ageMs: number;
    idleTimeMs: number;
    timeSinceValidationMs: number;
    inUse: boolean;
  }[];
}

// Health check types
export interface HealthCheckOptions {
  detailed?: boolean;
  checkPgVector?: boolean;
  checkIndices?: boolean;
  timeout?: number;
  debug?: boolean;
  includePoolDetails?: boolean;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  timestamp: string;
  databaseName?: string;
  postgresVersion?: string;
  connectionTime?: number;
  pgVectorAvailable?: boolean;
  documentTableExists?: boolean;
  pgVectorVersion?: string;
  indices?: {
    exists: boolean;
    count: number;
    details?: Array<{
      name: string;
      definition: string;
    }>;
  };
  connectionPool?: ConnectionPoolStatus & {
    connections?: {
      key: string;
      ageMs: number;
      idleTimeMs: number;
      timeSinceValidationMs: number;
      inUse: boolean;
    }[];
  };
  error?: string;
}
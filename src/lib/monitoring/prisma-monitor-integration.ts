/**
 * Prisma Monitor Integration
 * 
 * Provides seamless integration between Prisma queries and the database performance monitor.
 * Automatically tracks query performance without requiring manual instrumentation.
 */

import { PrismaClient } from '@prisma/client';
import { DatabasePerformanceMonitor } from './database-performance-monitor';
// import { logger } from '@/lib/logger';

interface PrismaQueryEvent {
  timestamp: Date;
  query: string;
  params: string;
  duration: number;
  target: string;
}

interface PrismaLogEvent {
  timestamp: Date;
  message: string;
  target: string;
}

/**
 * Enhanced Prisma client with performance monitoring
 */
export class MonitoredPrismaClient extends PrismaClient {
  private performanceMonitor: DatabasePerformanceMonitor;
  private queryCount = 0;

  constructor(options?: ConstructorParameters<typeof PrismaClient>[0]) {
    // Enable query logging for monitoring
    const enhancedOptions = {
      ...options,
      log: [
        ...(options?.log || []),
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    } as ConstructorParameters<typeof PrismaClient>[0];

    super(enhancedOptions);

    this.performanceMonitor = new DatabasePerformanceMonitor(this);
    this.setupEventListeners();
  }

  /**
   * Setup Prisma event listeners for automatic monitoring
   */
  private setupEventListeners(): void {
    // Query event listener
    this.$on('query' as any, (event: PrismaQueryEvent) => {
      this.handleQueryEvent(event);
    });

    // Error event listener
    this.$on('error' as any, (event: PrismaLogEvent) => {
      console.error('Prisma error event:', {
        message: event.message,
        target: event.target,
        timestamp: event.timestamp,
      });
    });

    // Warning event listener
    this.$on('warn' as any, (event: PrismaLogEvent) => {
      console.warn('Prisma warning event:', {
        message: event.message,
        target: event.target,
        timestamp: event.timestamp,
      });
    });
  }

  /**
   * Handle query events for performance tracking
   */
  private handleQueryEvent(event: PrismaQueryEvent): void {
    this.queryCount++;

    // Parse query to determine operation type
    const operation = this.parseQueryOperation(event.query);
    
    // Extract table/model name from target
    const tableName = this.extractTableName(event.target);

    // Create a more readable query identifier
    const queryIdentifier = this.createQueryIdentifier(operation, tableName, event.query);

    // Track the query performance
    this.performanceMonitor.trackQuery({
      query: queryIdentifier,
      duration: event.duration,
      success: true, // Queries that reach this event handler were successful
      operation,
      rowsAffected: this.estimateRowsAffected(event.query),
    });
  }

  /**
   * Parse SQL query to determine operation type
   */
  private parseQueryOperation(query: string): 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'TRANSACTION' {
    const normalizedQuery = query.trim().toUpperCase();
    
    if (normalizedQuery.startsWith('SELECT')) return 'SELECT';
    if (normalizedQuery.startsWith('INSERT')) return 'INSERT';
    if (normalizedQuery.startsWith('UPDATE')) return 'UPDATE';
    if (normalizedQuery.startsWith('DELETE')) return 'DELETE';
    if (normalizedQuery.includes('BEGIN') || normalizedQuery.includes('COMMIT')) return 'TRANSACTION';
    
    return 'SELECT'; // Default fallback
  }

  /**
   * Extract table name from Prisma target
   */
  private extractTableName(target: string): string {
    // Prisma target format is typically like "library.model.operation"
    const parts = target.split('.');
    return parts.length > 1 ? parts[1] : 'unknown';
  }

  /**
   * Create a human-readable query identifier
   */
  private createQueryIdentifier(
    operation: string, 
    tableName: string, 
    originalQuery: string
  ): string {
    const baseIdentifier = `${operation}_${tableName}`;
    
    // Add more specific information for certain operations
    if (operation === 'SELECT' && originalQuery.includes('WHERE')) {
      return `${baseIdentifier}_filtered`;
    }
    if (operation === 'SELECT' && originalQuery.includes('ORDER BY')) {
      return `${baseIdentifier}_sorted`;
    }
    if (operation === 'SELECT' && originalQuery.includes('JOIN')) {
      return `${baseIdentifier}_joined`;
    }
    if (originalQuery.includes('COUNT(')) {
      return `${baseIdentifier}_count`;
    }
    if (originalQuery.includes('GROUP BY')) {
      return `${baseIdentifier}_aggregated`;
    }

    return baseIdentifier;
  }

  /**
   * Estimate rows affected from query (rough approximation)
   */
  private estimateRowsAffected(query: string): number | undefined {
    // This is a rough estimation - in practice, you'd want more sophisticated parsing
    if (query.includes('LIMIT')) {
      const limitMatch = query.match(/LIMIT\s+(\d+)/i);
      if (limitMatch) {
        return parseInt(limitMatch[1], 10);
      }
    }
    
    // For now, return undefined as we can't reliably estimate without actual result metadata
    return undefined;
  }

  /**
   * Wrap a query with enhanced monitoring
   */
  public async monitoredQuery<T>(
    queryName: string,
    operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'TRANSACTION',
    queryFn: () => Promise<T>,
    userId?: number
  ): Promise<T> {
    return this.performanceMonitor.monitorQuery(queryName, operation, queryFn, userId);
  }

  /**
   * Get the performance monitor instance
   */
  public getPerformanceMonitor(): DatabasePerformanceMonitor {
    return this.performanceMonitor;
  }

  /**
   * Get query statistics
   */
  public getQueryStats(): {
    totalQueries: number;
    performanceSummary: ReturnType<DatabasePerformanceMonitor['getPerformanceSummary']>;
    recentSlowQueries: ReturnType<DatabasePerformanceMonitor['getSlowQueries']>;
  } {
    return {
      totalQueries: this.queryCount,
      performanceSummary: this.performanceMonitor.getPerformanceSummary(),
      recentSlowQueries: this.performanceMonitor.getSlowQueries(),
    };
  }

  /**
   * Override disconnect to properly cleanup monitoring
   */
  public async $disconnect(): Promise<void> {
    this.performanceMonitor.stop();
    await super.$disconnect();
  }
}

/**
 * Create a monitored Prisma instance
 */
export function createMonitoredPrisma(options?: ConstructorParameters<typeof PrismaClient>[0]): MonitoredPrismaClient {
  return new MonitoredPrismaClient(options);
}

/**
 * Middleware for existing Prisma client to add monitoring
 */
export function addMonitoringMiddleware(prisma: PrismaClient): DatabasePerformanceMonitor {
  const monitor = new DatabasePerformanceMonitor(prisma);

  // Add middleware to intercept all queries
  prisma.$use(async (params, next) => {
    const startTime = Date.now();
    const operation = params.action.toUpperCase() as any;
    const modelName = params.model || 'unknown';
    const queryName = `${operation}_${modelName}`;

    try {
      const result = await next(params);
      const duration = Date.now() - startTime;

      monitor.trackQuery({
        query: queryName,
        duration,
        success: true,
        operation,
        rowsAffected: Array.isArray(result) ? result.length : 1,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      monitor.trackQuery({
        query: queryName,
        duration,
        success: false,
        operation,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  });

  return monitor;
}

/**
 * Utility to create performance alerts for Slack/Discord/etc
 */
export function createPerformanceAlertHandler(
  webhookUrl?: string,
  slackChannel?: string
) {
  return (alert: Parameters<DatabasePerformanceMonitor['onAlert']>[0][0]) => {
    const alertMessage = {
      text: `🔍 Database Performance Alert`,
      attachments: [
        {
          color: alert.severity === 'critical' ? 'danger' : 'warning',
          fields: [
            {
              title: 'Alert Type',
              value: alert.type.replace(/_/g, ' ').toUpperCase(),
              short: true,
            },
            {
              title: 'Severity',
              value: alert.severity.toUpperCase(),
              short: true,
            },
            {
              title: 'Message',
              value: alert.message,
              short: false,
            },
            {
              title: 'Timestamp',
              value: alert.timestamp.toISOString(),
              short: true,
            },
          ],
        },
      ],
    };

    // In a real implementation, you'd send this to your alerting system
    console.warn('Performance alert generated:', alertMessage);
    
    // Example: Send to webhook if configured
    if (webhookUrl) {
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertMessage),
      }).catch(err => console.error('Failed to send alert webhook:', err));
    }
  };
}

export default MonitoredPrismaClient;
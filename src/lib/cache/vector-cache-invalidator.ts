/**
 * Vector Cache Invalidation Service
 * Provides cache invalidation for pgVector database changes
 */

import { PrismaClient } from '@prisma/client';
import { VectorCacheManager } from './vector-cache-strategy';
import { valkeyLogger } from './valkey-logger';
import { metrics } from '../server-monitoring';

// Initialize Prisma client for database access
const prisma = new PrismaClient();

// Type for Prisma middleware
interface PrismaMiddlewareParams {
  action: string;
  model?: string;
  args: any;
  dataPath: string[];
  runInTransaction: boolean;
}

// Type for Prisma middleware next function
type PrismaMiddlewareNext = (params: PrismaMiddlewareParams) => Promise<any>;

/**
 * Vector Cache Invalidator
 * Handles cache invalidation for vector database changes
 */
export class VectorCacheInvalidator {
  private static instance: VectorCacheInvalidator;
  private listenersInitialized = false;
  
  // Private constructor for singleton pattern
  private constructor() {}
  
  /**
   * Get singleton instance
   */
  public static getInstance(): VectorCacheInvalidator {
    if (!VectorCacheInvalidator.instance) {
      VectorCacheInvalidator.instance = new VectorCacheInvalidator();
    }
    return VectorCacheInvalidator.instance;
  }
  
  /**
   * Initialize cache invalidation listeners
   */
  public async initialize(): Promise<void> {
    if (this.listenersInitialized) {
      return;
    }
    
    try {
      // Set up Prisma middleware for capturing database changes
      this.setupPrismaMiddleware();
      
      // Create PostgreSQL triggers for invalidation events (optional)
      await this.createPostgresListeners();
      
      this.listenersInitialized = true;
      valkeyLogger.info('Vector cache invalidation service initialized', {
        command: 'init_invalidation'
      });
    } catch (error) {
      valkeyLogger.error('Failed to initialize vector cache invalidation', {
        command: 'init_invalidation',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  /**
   * Setup Prisma middleware to capture database changes
   */
  private setupPrismaMiddleware(): void {
    // Add middleware to track RAGChunk changes
    (prisma as any).$use(async (params: PrismaMiddlewareParams, next: PrismaMiddlewareNext) => {
      // Track start time for performance monitoring
      const startTime = Date.now();
      
      // Capture original action
      const action = params.action;
      const model = params.model;
      
      // Skip if not relevant to vector data
      if (!this.isVectorModel(model)) {
        return next(params);
      }
      
      // Execute the database operation
      const result = await next(params);
      
        // Process result and invalidate cache when necessary
        if (this.shouldInvalidateCache(action, model, result) && model) {
          await this.invalidateModelCache(model, result);
        }
      
      // Track duration and report metrics
      const duration = Date.now() - startTime;
      metrics.histogram('vector_cache.invalidation.middleware.duration', duration);
      
      return result;
    });
    
    valkeyLogger.debug('Prisma middleware for vector cache invalidation set up', {
      command: 'setup_middleware'
    });
  }
  
  /**
   * Create PostgreSQL listeners for database changes
   */
  private async createPostgresListeners(): Promise<void> {
    try {
      // Create notification function if it doesn't exist
      await prisma.$executeRaw`
        CREATE OR REPLACE FUNCTION notify_vector_changes() RETURNS TRIGGER AS $$
        DECLARE
          payload TEXT;
        BEGIN
          payload = json_build_object(
            'table', TG_TABLE_NAME,
            'action', TG_OP,
            'id', NEW.id,
            'content_type', CASE WHEN TG_TABLE_NAME = 'ai_embeddings' THEN NEW.content_type ELSE NULL END
          )::text;
          
          PERFORM pg_notify('vector_changes', payload);
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `;
      
      // Create triggers for RAGChunk table
      await prisma.$executeRaw`
        DROP TRIGGER IF EXISTS vector_changes_rag_chunks ON rag_chunks;
        CREATE TRIGGER vector_changes_rag_chunks
        AFTER INSERT OR UPDATE OR DELETE ON rag_chunks
        FOR EACH ROW EXECUTE FUNCTION notify_vector_changes();
      `;
      
      // Create triggers for ai_embeddings table
      await prisma.$executeRaw`
        DROP TRIGGER IF EXISTS vector_changes_ai_embeddings ON ai_embeddings;
        CREATE TRIGGER vector_changes_ai_embeddings
        AFTER INSERT OR UPDATE OR DELETE ON ai_embeddings
        FOR EACH ROW EXECUTE FUNCTION notify_vector_changes();
      `;
      
      valkeyLogger.info('PostgreSQL triggers for vector cache invalidation created', {
        command: 'create_triggers'
      });
      
      // Setup listener for invalidation events
      this.listenToPostgresEvents();
    } catch (error) {
      valkeyLogger.error('Failed to create PostgreSQL triggers for invalidation', {
        command: 'create_triggers',
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Continue without PostgreSQL listeners - will still use Prisma middleware
    }
  }
  
  /**
   * Listen to PostgreSQL notification events
   */
  private async listenToPostgresEvents(): Promise<void> {
    try {
      // Create a dedicated connection for notifications
      const { PG } = require('@prisma/adapter-pg');
      const db = new PG.Pool({
        connectionString: process.env.DATABASE_URL
      });
      
      const client = await db.connect();
      
      // Listen for vector_changes notifications
      await client.query('LISTEN vector_changes');
      
      valkeyLogger.info('Listening for PostgreSQL vector_changes events', {
        command: 'listen_events'
      });
      
      // Handle notifications
      client.on('notification', async (msg: any) => {
        try {
          if (msg.channel === 'vector_changes') {
            const payload = JSON.parse(msg.payload);
            const { table, action, id, content_type } = payload;
            
            valkeyLogger.debug('Received vector change notification', {
              command: 'pg_notification',
              metadata: { table, action, id, content_type }
            });
            
            // Invalidate cache based on notification
            await this.invalidateCacheFromNotification(table, action, id, content_type);
          }
        } catch (error) {
          valkeyLogger.error('Error processing vector change notification', {
            command: 'pg_notification',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });
      
      // Handle connection errors
      client.on('error', (err: Error) => {
        valkeyLogger.error('PostgreSQL notification listener error', {
          command: 'pg_listener',
          error: err.message
        });
        
        // Attempt to reconnect after delay
        setTimeout(() => this.listenToPostgresEvents(), 5000);
      });
    } catch (error) {
      valkeyLogger.error('Failed to set up PostgreSQL notification listener', {
        command: 'setup_listener',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  /**
   * Check if a model is related to vector data
   */
  private isVectorModel(model?: string): boolean {
    return model === 'RAGChunk' || model === 'AIEmbedding';
  }
  
  /**
   * Determine if cache should be invalidated
   */
  private shouldInvalidateCache(
    action: string,
    model?: string,
    result?: any
  ): boolean {
    // No need to invalidate for read operations
    if (action === 'findUnique' || action === 'findMany' || action === 'findFirst' || action === 'aggregate' || action === 'count') {
      return false;
    }
    
    // Invalid model or no result
    if (!this.isVectorModel(model) || !result) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Invalidate cache for model changes
   */
  private async invalidateModelCache(model: string, data: any): Promise<void> {
    try {
      const startTime = Date.now();
      
      let table: string;
      let contentType: string | undefined;
      
      // Map Prisma model to database table
      if (model === 'RAGChunk') {
        table = 'rag_chunks';
        
        // Try to determine content type from associated file
        if (data.file_id) {
          const file = await prisma.file.findUnique({
            where: { id: data.file_id },
            select: { language: true }
          });
          
          if (file?.language) {
            contentType = file.language;
          }
        }
      } else if (model === 'AIEmbedding') {
        table = 'ai_embeddings';
        contentType = data.content_type;
      } else {
        return; // Not a vector model
      }
      
      // Invalidate cache for this table/content type
      const invalidatedCount = await VectorCacheManager.invalidateForTable(table, contentType);
      
      // Report metrics
      const duration = Date.now() - startTime;
      metrics.histogram('vector_cache.invalidation.duration', duration);
      
      valkeyLogger.info('Vector cache invalidated via Prisma middleware', {
        command: 'invalidate',
        duration,
        metadata: {
          model,
          table,
          contentType,
          invalidatedCount
        }
      });
    } catch (error) {
      valkeyLogger.error('Error invalidating vector cache via middleware', {
        command: 'invalidate',
        error: error instanceof Error ? error.message : String(error),
        metadata: { model }
      });
    }
  }
  
  /**
   * Invalidate cache based on PostgreSQL notification
   */
  private async invalidateCacheFromNotification(
    table: string,
    action: string,
    id: number | string,
    contentType?: string
  ): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Invalidate cache for this table/content type
      const tableTyped = table === 'rag_chunks' || table === 'ai_embeddings' 
        ? table as 'rag_chunks' | 'ai_embeddings'
        : 'rag_chunks';  // Default fallback

      const invalidatedCount = await VectorCacheManager.invalidateForTable(tableTyped, contentType);
      
      // Report metrics
      const duration = Date.now() - startTime;
      metrics.histogram('vector_cache.invalidation.notification.duration', duration);
      
      valkeyLogger.info('Vector cache invalidated via PostgreSQL notification', {
        command: 'invalidate_notification',
        duration,
        metadata: {
          table,
          action,
          id,
          contentType,
          invalidatedCount
        }
      });
    } catch (error) {
      valkeyLogger.error('Error invalidating vector cache via notification', {
        command: 'invalidate_notification',
        error: error instanceof Error ? error.message : String(error),
        metadata: { table, action, id, contentType }
      });
    }
  }
  
  /**
   * Manually invalidate cache for specific table/content
   */
  public async manuallyInvalidateCache(
    table: 'rag_chunks' | 'ai_embeddings',
    contentType?: string
  ): Promise<number> {
    try {
      const startTime = Date.now();
      
      // Invalidate cache for this table/content type
      const invalidatedCount = await VectorCacheManager.invalidateForTable(table, contentType);
      
      // Report metrics
      const duration = Date.now() - startTime;
      metrics.histogram('vector_cache.invalidation.manual.duration', duration);
      
      valkeyLogger.info('Vector cache manually invalidated', {
        command: 'invalidate_manual',
        duration,
        metadata: {
          table,
          contentType,
          invalidatedCount
        }
      });
      
      return invalidatedCount;
    } catch (error) {
      valkeyLogger.error('Error manually invalidating vector cache', {
        command: 'invalidate_manual',
        error: error instanceof Error ? error.message : String(error),
        metadata: { table, contentType }
      });
      
      return 0;
    }
  }
}

// Create and export singleton instance
export const vectorCacheInvalidator = VectorCacheInvalidator.getInstance();

// Initialize invalidation service
// Only in server environment
if (typeof window === 'undefined') {
  vectorCacheInvalidator.initialize().catch(err => {
    console.error('Failed to initialize vector cache invalidation service:', err);
  });
}

export default vectorCacheInvalidator;
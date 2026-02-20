/**
 * Persistent Context Service
 * Manages storing and retrieving session context with vector embeddings for semantic search
 */

import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { metrics } from '../server-monitoring';

/**
 * Configuration options for PersistentContextService
 */
export interface PersistentContextServiceConfig {
  /** OpenAI API key for embeddings (defaults to env var) */
  apiKey?: string;
  /** OpenAI base URL (defaults to OpenAI or OpenRouter based on env) */
  baseURL?: string;
  /** Embedding model to use (defaults to text-embedding-3-small) */
  embeddingModel?: string;
  /** Enable logging */
  enableLogging?: boolean;
  /** Enable metrics tracking */
  enableMetrics?: boolean;
  /** Prisma client instance (optional, will create if not provided) */
  prismaClient?: PrismaClient;
}

/**
 * Input data for storing session context
 */
export interface StoreContextInput {
  /** The conversation context text to store */
  content: string;
  /** Session identifier */
  sessionId?: string;
  /** User ID who owns this context */
  userId: number;
  /** Workspace ID (optional) */
  workspaceId?: number;
  /** Additional metadata (e.g., message count, token count, conversation summary) */
  metadata?: Record<string, unknown>;
}

/**
 * Stored context data returned from the database
 */
export interface StoredContext {
  /** Unique identifier for this context entry */
  id: number;
  /** The conversation context text */
  content: string;
  /** Session identifier */
  sessionId: string | null;
  /** User ID who owns this context */
  userId: number;
  /** Workspace ID */
  workspaceId: number | null;
  /** Additional metadata */
  metadata: Record<string, unknown> | null;
  /** When this context was created */
  createdAt: Date;
  /** When this context was last updated */
  updatedAt: Date;
}

/**
 * Options for retrieving session context
 */
export interface RetrieveContextOptions {
  /** User ID to filter by */
  userId: number;
  /** Session ID to filter by (optional) */
  sessionId?: string;
  /** Workspace ID to filter by (optional) */
  workspaceId?: number;
  /** Limit the number of results (default: 10) */
  limit?: number;
  /** Order by (default: createdAt desc) */
  orderBy?: 'createdAt' | 'updatedAt';
  /** Order direction (default: desc) */
  orderDirection?: 'asc' | 'desc';
}

/**
 * Options for semantic search of session context
 */
export interface SearchContextOptions {
  /** User ID to filter by */
  userId: number;
  /** Session ID to filter by (optional) */
  sessionId?: string;
  /** Workspace ID to filter by (optional) */
  workspaceId?: number;
  /** Limit the number of results (default: 5) */
  limit?: number;
  /** Minimum similarity threshold (0-1, default: 0.7) */
  minSimilarity?: number;
}

/**
 * Search result with similarity score
 */
export interface ContextSearchResult extends StoredContext {
  /** Similarity score (0-1, higher is more similar) */
  similarity: number;
}

/**
 * PersistentContextService
 * Handles storing, retrieving, and managing persistent session context with vector embeddings
 */
export class PersistentContextService {
  private readonly config: Required<Omit<PersistentContextServiceConfig, 'prismaClient' | 'apiKey' | 'baseURL'>>;
  private readonly prisma: PrismaClient;
  private readonly openai: OpenAI | null = null;
  private readonly ownsPrismaClient: boolean;

  /**
   * Constructor for PersistentContextService
   * @param config Service configuration options
   */
  constructor(config: PersistentContextServiceConfig = {}) {
    // Set up configuration with defaults
    this.config = {
      embeddingModel: config.embeddingModel ?? 'text-embedding-3-small',
      enableLogging: config.enableLogging ?? true,
      enableMetrics: config.enableMetrics ?? true
    };

    // Use provided Prisma client or create a new one
    if (config.prismaClient) {
      this.prisma = config.prismaClient;
      this.ownsPrismaClient = false;
    } else {
      this.prisma = new PrismaClient({
        log: this.config.enableLogging ? ['error', 'warn'] : [],
        errorFormat: 'pretty'
      });
      this.ownsPrismaClient = true;
    }

    // Initialize OpenAI client for embeddings
    const apiKey = config.apiKey ?? process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({
        apiKey,
        baseURL: config.baseURL ?? (process.env.OPENROUTER_API_KEY ? 'https://openrouter.ai/api/v1' : undefined)
      });
    } else if (this.config.enableLogging) {
      console.warn('PersistentContextService: No API key provided, embeddings will be zero vectors');
    }
  }

  /**
   * Initialize the service and connect to the database
   */
  public async initialize(): Promise<void> {
    try {
      if (this.ownsPrismaClient) {
        await this.prisma.$connect();
      }

      if (this.config.enableLogging) {
        console.log('PersistentContextService initialized successfully');
      }
    } catch (error) {
      if (this.config.enableLogging) {
        console.error('Failed to initialize PersistentContextService:', error);
      }
      throw error;
    }
  }

  /**
   * Disconnect from the database
   */
  public async disconnect(): Promise<void> {
    try {
      if (this.ownsPrismaClient) {
        await this.prisma.$disconnect();
      }

      if (this.config.enableLogging) {
        console.log('PersistentContextService disconnected');
      }
    } catch (error) {
      if (this.config.enableLogging) {
        console.error('Error disconnecting PersistentContextService:', error);
      }
      throw error;
    }
  }

  /**
   * Generate embedding for text using OpenAI
   * @param text The text to generate an embedding for
   * @returns A vector embedding as an array of numbers
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      // Return zero vector if no API key is configured
      return new Array(1536).fill(0);
    }

    try {
      const startTime = Date.now();
      const response = await this.openai.embeddings.create({
        model: this.config.embeddingModel,
        input: text
      });

      if (this.config.enableMetrics) {
        metrics.histogram('persistent_context.embedding.duration', Date.now() - startTime);
        metrics.increment('persistent_context.embedding.success');
      }

      return response.data[0]?.embedding ?? new Array(1536).fill(0);
    } catch (error) {
      if (this.config.enableMetrics) {
        metrics.increment('persistent_context.embedding.error');
      }

      if (this.config.enableLogging) {
        console.error('Error generating embedding for persistent context:', error);
      }

      // Return zero vector on error
      return new Array(1536).fill(0);
    }
  }

  /**
   * Store session context in the database with vector embedding
   * @param input Context data to store
   * @returns The stored context record
   */
  public async storeContext(input: StoreContextInput): Promise<StoredContext> {
    try {
      const startTime = Date.now();

      // Generate embedding for the content
      const embedding = await this.generateEmbedding(input.content);
      const embeddingString = `[${embedding.join(',') }]`;

      // Store in database using raw query to handle pgvector type
      const result = await this.prisma.$queryRaw<Array<{
        id: number;
        content: string;
        session_id: string | null;
        user_id: number;
        workspace_id: number | null;
        metadata: unknown;
        created_at: Date;
        updated_at: Date;
      }>>`
        INSERT INTO session_contexts (
          content,
          session_id,
          user_id,
          workspace_id,
          metadata,
          embedding,
          created_at,
          updated_at
        ) VALUES (
          ${input.content},
          ${input.sessionId ?? null},
          ${input.userId},
          ${input.workspaceId ?? null},
          ${input.metadata ? JSON.stringify(input.metadata) : null}::jsonb,
          ${embeddingString}::vector,
          NOW(),
          NOW()
        )
        RETURNING id, content, session_id, user_id, workspace_id, metadata, created_at, updated_at
      `;

      if (this.config.enableMetrics) {
        metrics.histogram('persistent_context.store.duration', Date.now() - startTime);
        metrics.increment('persistent_context.store.success');
      }

      if (this.config.enableLogging) {
        console.log(`Stored context for user ${input.userId}, session ${input.sessionId ?? 'N/A'}`);
      }

      const row = result[0];
      if (!row) {
        throw new Error('Failed to store context: no row returned');
      }

      return {
        id: row.id,
        content: row.content,
        sessionId: row.session_id,
        userId: row.user_id,
        workspaceId: row.workspace_id,
        metadata: row.metadata as Record<string, unknown> | null,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (error) {
      if (this.config.enableMetrics) {
        metrics.increment('persistent_context.store.error');
      }

      if (this.config.enableLogging) {
        console.error('Error storing session context:', error);
      }

      throw error;
    }
  }

  /**
   * Retrieve session context from the database
   * @param options Retrieval options (filters, limits, ordering)
   * @returns Array of stored context records
   */
  public async retrieveContext(options: RetrieveContextOptions): Promise<StoredContext[]> {
    try {
      const startTime = Date.now();

      const {
        userId,
        sessionId,
        workspaceId,
        limit = 10,
        orderBy = 'createdAt',
        orderDirection = 'desc'
      } = options;

      // Build the where clause
      const whereConditions: string[] = [`user_id = ${userId}`];
      if (sessionId !== undefined) {
        whereConditions.push(`session_id = '${sessionId}'`);
      }
      if (workspaceId !== undefined) {
        whereConditions.push(`workspace_id = ${workspaceId}`);
      }

      const whereClause = whereConditions.join(' AND ');
      const orderColumn = orderBy === 'updatedAt' ? 'updated_at' : 'created_at';
      const orderDir = orderDirection.toUpperCase();

      // Query with filters
      const results = await this.prisma.$queryRaw<Array<{
        id: number;
        content: string;
        session_id: string | null;
        user_id: number;
        workspace_id: number | null;
        metadata: unknown;
        created_at: Date;
        updated_at: Date;
      }>>`
        SELECT
          id,
          content,
          session_id,
          user_id,
          workspace_id,
          metadata,
          created_at,
          updated_at
        FROM session_contexts
        WHERE ${whereClause}
        ORDER BY ${orderColumn} ${orderDir}
        LIMIT ${limit}
      `;

      if (this.config.enableMetrics) {
        metrics.histogram('persistent_context.retrieve.duration', Date.now() - startTime);
        metrics.increment('persistent_context.retrieve.success');
        metrics.gauge('persistent_context.retrieve.results', results.length);
      }

      if (this.config.enableLogging) {
        console.log(`Retrieved ${results.length} context(s) for user ${userId}`);
      }

      return results.map(row => ({
        id: row.id,
        content: row.content,
        sessionId: row.session_id,
        userId: row.user_id,
        workspaceId: row.workspace_id,
        metadata: row.metadata as Record<string, unknown> | null,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      if (this.config.enableMetrics) {
        metrics.increment('persistent_context.retrieve.error');
      }

      if (this.config.enableLogging) {
        console.error('Error retrieving session context:', error);
      }

      throw error;
    }
  }

  /**
   * Search for similar session contexts using vector similarity
   * @param query The search query text
   * @param options Search options (filters, limits, threshold)
   * @returns Array of search results with similarity scores
   */
  public async searchContext(query: string, options: SearchContextOptions): Promise<ContextSearchResult[]> {
    try {
      const startTime = Date.now();

      const {
        userId,
        sessionId,
        workspaceId,
        limit = 5,
        minSimilarity = 0.7
      } = options;

      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);
      const embeddingString = `[${queryEmbedding.join(',')}]`;

      // Build the where clause
      const whereConditions: string[] = [`user_id = ${userId}`];
      if (sessionId !== undefined) {
        whereConditions.push(`session_id = '${sessionId}'`);
      }
      if (workspaceId !== undefined) {
        whereConditions.push(`workspace_id = ${workspaceId}`);
      }

      const whereClause = whereConditions.join(' AND ');

      // Perform vector similarity search using cosine distance
      // pgvector's <=> operator returns cosine distance (0 = identical, 2 = opposite)
      // We convert to similarity score: 1 - (distance / 2)
      const results = await this.prisma.$queryRaw<Array<{
        id: number;
        content: string;
        session_id: string | null;
        user_id: number;
        workspace_id: number | null;
        metadata: unknown;
        created_at: Date;
        updated_at: Date;
        distance: number;
      }>>`
        SELECT
          id,
          content,
          session_id,
          user_id,
          workspace_id,
          metadata,
          created_at,
          updated_at,
          (embedding <=> ${embeddingString}::vector) as distance
        FROM session_contexts
        WHERE ${whereClause}
        ORDER BY embedding <=> ${embeddingString}::vector
        LIMIT ${limit}
      `;

      // Convert distance to similarity score and filter by threshold
      const searchResults: ContextSearchResult[] = results
        .map(row => {
          // Convert cosine distance to similarity: 1 - (distance / 2)
          // Distance range is [0, 2], similarity range is [0, 1]
          const similarity = 1 - (row.distance / 2);

          return {
            id: row.id,
            content: row.content,
            sessionId: row.session_id,
            userId: row.user_id,
            workspaceId: row.workspace_id,
            metadata: row.metadata as Record<string, unknown> | null,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            similarity
          };
        })
        .filter(result => result.similarity >= minSimilarity);

      if (this.config.enableMetrics) {
        metrics.histogram('persistent_context.search.duration', Date.now() - startTime);
        metrics.increment('persistent_context.search.success');
        metrics.gauge('persistent_context.search.results', searchResults.length);
      }

      if (this.config.enableLogging) {
        console.log(`Found ${searchResults.length} similar context(s) for user ${userId} (min similarity: ${minSimilarity})`);
      }

      return searchResults;
    } catch (error) {
      if (this.config.enableMetrics) {
        metrics.increment('persistent_context.search.error');
      }

      if (this.config.enableLogging) {
        console.error('Error searching session context:', error);
      }

      throw error;
    }
  }
}

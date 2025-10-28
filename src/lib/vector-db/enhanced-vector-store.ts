// vibecode-webgui/src/lib/vector-db/enhanced-vector-store.ts

import type {
  VectorDatabaseInterface,
  VectorDatabaseConfig,
  SearchOptions,
  SearchResult,
} from "./vector-database-interface";
import { EnhancedVectorDatabaseAdapter } from "./enhanced-vector-database-adapter";
import { getMetricsCollector } from "@/lib/db/database-metrics";

/**
 * A high‑level wrapper that exposes a simple vector store API while
 * internally delegating to {@link EnhancedVectorDatabaseAdapter}.
 *
 * The wrapper is instrumented with the global metrics collector so every
 * database operation emits:
 *   - query timings (total, average)
 *   - success / failure counts
 *   - provider‑specific statistics such as cache hits and provider switches.
 */
export class EnhancedVectorStore {
  private readonly db: EnhancedVectorDatabaseAdapter;
  private readonly metrics = getMetricsCollector();

  /**
   * @param adapter Concrete vector database adapter that implements
   *                `VectorDatabaseInterface`.
   * @param config   Configuration for the target provider.
   * @param retryConfig Optional retry configuration passed to
   *                    {@link EnhancedVectorDatabaseAdapter}.
   */
  constructor(
    adapter: VectorDatabaseInterface,
    config: VectorDatabaseConfig,
    retryConfig?: Partial<{
      maxRetries: number;
      backoffMs: number;
      timeoutMs: number;
    }>,
  ) {
    this.db = new EnhancedVectorDatabaseAdapter(adapter, config, retryConfig);
  }

  /** Initialise the underlying adapter (establish connections, etc.). */
  public async initialize(): Promise<void> {
    await this.db.initialize();
  }

  /**
   * Perform a vector similarity search.
   *
   * @param embedding The query vector.
   * @param options Optional search parameters such as workspaceId,
   *                limit, threshold, fileIds and cache usage.
   */
  public async search(
    embedding: number[],
    options?: SearchOptions,
  ): Promise<SearchResult[]> {
    const start = Date.now();
    try {
      const results = await this.db.search(embedding, options);
      // Assume all searches are performed via pgvector; adjust if multi‑provider
      this.metrics.recordVectorSearch(
        "pgvector",
        Date.now() - start,
        results.length,
        true,
      );
      return results;
    } catch (e) {
      this.metrics.recordVectorError("search");
      throw e;
    } finally {
      this.metrics.recordQuery(Date.now() - start, false);
    }
  }

  /**
   * Perform a text‑based search against the vector store.
   *
   * @param query   The natural language query string.
   * @param options Optional search parameters.
   */
  public async searchWithText(
    query: string,
    options?: SearchOptions,
  ): Promise<SearchResult[]> {
    const start = Date.now();
    try {
      const results = await this.db.searchWithText(query, options);
      this.metrics.recordVectorSearch(
        "pgvector",
        Date.now() - start,
        results.length,
        true,
      );
      return results;
    } catch (e) {
      this.metrics.recordVectorError("search");
      throw e;
    } finally {
      this.metrics.recordQuery(Date.now() - start, false);
    }
  }

  /**
   * Persist a set of text chunks as vector embeddings for a given file.
   *
   * @param fileId Identifier of the file to associate with these vectors.
   * @param chunks Array of chunk objects containing content and metadata.
   */
  public async storeChunks(
    fileId: number,
    chunks: {
      content: string;
      startLine?: number;
      endLine?: number;
      tokens: number;
    }[],
  ): Promise<void> {
    const start = Date.now();
    try {
      await this.db.storeChunks(fileId, chunks);
      this.metrics.recordVectorStore(
        chunks.length,
        "pgvector",
        Date.now() - start,
      );
    } catch (e) {
      this.metrics.recordVectorError("store");
      throw e;
    } finally {
      this.metrics.recordQuery(Date.now() - start, false);
    }
  }

  /**
   * Delete all vector embeddings associated with a specific file.
   *
   * @param fileId Identifier of the file whose vectors should be removed.
   */
  public async deleteFileChunks(fileId: number): Promise<void> {
    const start = Date.now();
    try {
      await this.db.deleteFileChunks(fileId);
    } catch (e) {
      this.metrics.recordVectorError("delete");
      throw e;
    } finally {
      this.metrics.recordQuery(Date.now() - start, false);
    }
  }
}

export default EnhancedVectorStore;

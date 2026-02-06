/**
 * ContextManager - Smart context window management for AI interactions
 *
 * Manages context window filling strategies, token optimization,
 * and intelligent prioritization of content for AI model interactions.
 */

import {
  ContextWindow,
  ContextItem,
  ContextItemType,
  ContextPriority,
  ContextStrategy,
  ContextWindowOptions,
  RankingCriteria,
  ContextUpdateEvent,
  ContextManagerStats,
  ContextItemMetadata,
  ModelTokenConfig,
  DEFAULT_RANKING_CRITERIA,
  MODEL_CONFIGS
} from '../../../types/context';
import { TokenCounter, getTokenCounter } from './token-counter';
import { FileRanker, FileMetadata } from './file-ranker';

/**
 * Options for ContextManager initialization
 */
export interface ContextManagerOptions {
  /** Default model for token counting */
  defaultModel?: string;
  /** Maximum utilization percentage (default: 90) */
  maxUtilization?: number;
  /** Token counter instance */
  tokenCounter?: TokenCounter;
  /** File ranker instance */
  fileRanker?: FileRanker;
  /** Enable automatic reranking on updates */
  autoRerank?: boolean;
  /** Callback for context updates */
  onUpdate?: (event: ContextUpdateEvent) => void;
  /** Embedding service for semantic ranking */
  embeddingService?: {
    generateEmbedding(text: string): Promise<number[]>;
  };
}

/**
 * Options for adding context items
 */
export interface AddItemOptions {
  /** Item priority */
  priority?: ContextPriority;
  /** Whether item is required (cannot be evicted) */
  isRequired?: boolean;
  /** Pre-computed token count */
  tokenCount?: number;
  /** Custom metadata */
  metadata?: Partial<ContextItemMetadata>;
  /** Relevance score override */
  relevanceScore?: number;
}

/**
 * ContextManager class for intelligent context window management
 */
export class ContextManager {
  private readonly tokenCounter: TokenCounter;
  private readonly fileRanker: FileRanker;
  private readonly options: Required<Omit<ContextManagerOptions, 'onUpdate' | 'embeddingService'>>;
  private readonly onUpdate?: ContextManagerOptions['onUpdate'];
  private readonly embeddingService?: ContextManagerOptions['embeddingService'];

  private currentWindow: ContextWindow | null = null;
  private allItems: Map<string, ContextItem> = new Map();
  private updateCount = 0;
  private lastRankingTimeMs = 0;

  constructor(options: ContextManagerOptions = {}) {
    this.tokenCounter = options.tokenCounter || getTokenCounter();
    this.fileRanker = options.fileRanker || new FileRanker({
      tokenCounter: this.tokenCounter,
      embeddingService: options.embeddingService
    });
    this.embeddingService = options.embeddingService;
    this.onUpdate = options.onUpdate;

    this.options = {
      defaultModel: options.defaultModel ?? 'gpt-4',
      maxUtilization: options.maxUtilization ?? 90,
      tokenCounter: this.tokenCounter,
      fileRanker: this.fileRanker,
      autoRerank: options.autoRerank ?? true
    };
  }

  /**
   * Create a new context window
   */
  createWindow(options: ContextWindowOptions): ContextWindow {
    const modelConfig = this.tokenCounter.getModelConfig(options.model);
    const strategy = options.strategy ?? ContextStrategy.HYBRID;
    const rankingCriteria: RankingCriteria = {
      ...DEFAULT_RANKING_CRITERIA,
      ...options.rankingCriteria
    };

    // Apply keyword boosts if provided
    if (options.boostKeywords) {
      for (const keyword of options.boostKeywords) {
        rankingCriteria.keywordBoosts[keyword] = 1.5;
      }
    }

    const maxTokens = Math.floor(
      (modelConfig.maxContextTokens - modelConfig.systemPromptReserved - modelConfig.responseReserved) *
      ((options.maxUtilization ?? this.options.maxUtilization) / 100)
    );

    const window: ContextWindow = {
      id: this.generateId(),
      modelConfig,
      strategy,
      items: [],
      totalTokens: 0,
      availableTokens: maxTokens,
      utilizationPercent: 0,
      isAtCapacity: false,
      excludedItems: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      rankingCriteria
    };

    // Add required items if provided
    if (options.requiredItems) {
      for (const item of options.requiredItems) {
        this.addItemToWindow(window, item);
      }
    }

    this.currentWindow = window;
    return window;
  }

  /**
   * Get the current context window
   */
  getWindow(): ContextWindow | null {
    return this.currentWindow;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add an item to the context window
   */
  addItem(
    type: ContextItemType,
    content: string,
    options: AddItemOptions = {}
  ): ContextItem | null {
    if (!this.currentWindow) {
      this.createWindow({ model: this.options.defaultModel });
    }

    const window = this.currentWindow!;
    const tokenCount = options.tokenCount ?? this.tokenCounter.count(content, window.modelConfig.model).count;

    const item: ContextItem = {
      id: this.generateId(),
      type,
      content,
      tokenCount,
      priority: options.priority ?? ContextPriority.MEDIUM,
      relevanceScore: options.relevanceScore ?? 0.5,
      recencyScore: 1.0, // New items start with full recency
      combinedScore: 0,
      isRequired: options.isRequired ?? false,
      metadata: {
        lastModified: new Date(),
        lastAccessed: new Date(),
        ...options.metadata
      },
      addedAt: new Date()
    };

    // Calculate combined score
    item.combinedScore = this.calculateCombinedScore(item, window.rankingCriteria);

    // Store in all items
    this.allItems.set(item.id, item);

    // Try to add to window
    const added = this.addItemToWindow(window, item);

    if (added) {
      this.emitUpdate('add', [item]);
      return item;
    }

    return null;
  }

  /**
   * Add item to window, handling capacity constraints
   */
  private addItemToWindow(window: ContextWindow, item: ContextItem): boolean {
    // Check if item fits
    if (item.tokenCount > window.availableTokens && !item.isRequired) {
      // Try to make room by evicting lower-priority items
      const evicted = this.evictToMakeRoom(window, item.tokenCount);
      if (!evicted && !item.isRequired) {
        window.excludedItems.push(item);
        return false;
      }
    }

    // Add item
    window.items.push(item);
    window.totalTokens += item.tokenCount;
    window.availableTokens -= item.tokenCount;
    window.utilizationPercent = (window.totalTokens /
      (window.modelConfig.maxContextTokens - window.modelConfig.systemPromptReserved - window.modelConfig.responseReserved)) * 100;
    window.isAtCapacity = window.availableTokens < 100;
    window.updatedAt = new Date();

    // Calculate cost if available
    if (window.modelConfig.inputCostPer1K) {
      window.estimatedCost = (window.totalTokens / 1000) * window.modelConfig.inputCostPer1K;
    }

    return true;
  }

  /**
   * Evict items to make room for new content
   */
  private evictToMakeRoom(window: ContextWindow, neededTokens: number): boolean {
    // Sort items by eviction priority (lowest combined score first, skip required)
    const evictable = window.items
      .filter(item => !item.isRequired)
      .sort((a, b) => a.combinedScore - b.combinedScore);

    let freedTokens = 0;
    const toEvict: ContextItem[] = [];

    for (const item of evictable) {
      if (freedTokens >= neededTokens) break;
      toEvict.push(item);
      freedTokens += item.tokenCount;
    }

    if (freedTokens < neededTokens) {
      return false; // Cannot free enough space
    }

    // Perform eviction
    for (const item of toEvict) {
      this.removeItemFromWindow(window, item.id);
      window.excludedItems.push(item);
    }

    if (toEvict.length > 0) {
      this.emitUpdate('remove', toEvict);
    }

    return true;
  }

  /**
   * Remove an item from the window
   */
  private removeItemFromWindow(window: ContextWindow, itemId: string): boolean {
    const index = window.items.findIndex(item => item.id === itemId);
    if (index === -1) return false;

    const item = window.items[index];
    window.items.splice(index, 1);
    window.totalTokens -= item.tokenCount;
    window.availableTokens += item.tokenCount;
    window.utilizationPercent = (window.totalTokens /
      (window.modelConfig.maxContextTokens - window.modelConfig.systemPromptReserved - window.modelConfig.responseReserved)) * 100;
    window.isAtCapacity = false;
    window.updatedAt = new Date();

    return true;
  }

  /**
   * Remove an item by ID
   */
  removeItem(itemId: string): boolean {
    if (!this.currentWindow) return false;

    const item = this.currentWindow.items.find(i => i.id === itemId);
    if (!item) return false;

    const removed = this.removeItemFromWindow(this.currentWindow, itemId);
    if (removed) {
      this.allItems.delete(itemId);
      this.emitUpdate('remove', [item]);
    }

    return removed;
  }

  /**
   * Calculate combined score for an item
   */
  private calculateCombinedScore(item: ContextItem, criteria: RankingCriteria): number {
    // Priority score (inverse of priority enum value, normalized)
    const priorityScore = 1 - ((item.priority - 1) / 4);

    // Calculate weighted score
    let score = (
      item.relevanceScore * criteria.relevanceWeight +
      item.recencyScore * criteria.recencyWeight +
      priorityScore * criteria.priorityWeight
    );

    // Apply type-based boost if applicable
    const ext = item.metadata.source?.split('.').pop()?.toLowerCase();
    if (ext && criteria.typeBoosts[ext]) {
      score *= criteria.typeBoosts[ext];
    }

    // Apply keyword boosts
    const contentLower = item.content.toLowerCase();
    for (const [keyword, boost] of Object.entries(criteria.keywordBoosts)) {
      if (contentLower.includes(keyword.toLowerCase())) {
        score *= Number(boost);
      }
    }

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Rerank all items in the context window
   */
  rerank(query?: string): void {
    if (!this.currentWindow) return;

    const startTime = performance.now();
    const window = this.currentWindow;

    // Update recency scores based on time since added
    const now = Date.now();
    const maxAge = window.rankingCriteria.recencyMaxAge;

    for (const item of window.items) {
      const age = now - item.addedAt.getTime();
      item.recencyScore = Math.max(0, 1 - (age / maxAge));

      // If query provided, update relevance scores
      if (query) {
        item.relevanceScore = this.calculateTextRelevance(item.content, query);
      }

      // Recalculate combined score
      item.combinedScore = this.calculateCombinedScore(item, window.rankingCriteria);
    }

    // Sort items by combined score
    window.items.sort((a, b) => b.combinedScore - a.combinedScore);

    this.lastRankingTimeMs = performance.now() - startTime;
    window.updatedAt = new Date();
    this.emitUpdate('rerank', window.items);
  }

  /**
   * Calculate text relevance score
   */
  private calculateTextRelevance(content: string, query: string): number {
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

    if (queryWords.length === 0) return 0.5;

    let matches = 0;
    for (const word of queryWords) {
      if (contentLower.includes(word)) {
        matches++;
      }
    }

    return matches / queryWords.length;
  }

  /**
   * Add files to context using file ranking
   */
  async addFiles(
    files: FileMetadata[],
    options: {
      query?: string;
      currentFile?: string;
      maxFiles?: number;
      strategy?: ContextStrategy;
    } = {}
  ): Promise<ContextItem[]> {
    if (!this.currentWindow) {
      this.createWindow({ model: this.options.defaultModel });
    }

    const window = this.currentWindow!;
    const strategy = options.strategy ?? window.strategy;
    const addedItems: ContextItem[] = [];

    // Rank files based on strategy
    let rankedFiles = this.fileRanker.rankFiles(files, {
      query: options.query,
      currentFile: options.currentFile,
      limit: options.maxFiles
    });

    // Apply strategy-specific filtering
    switch (strategy) {
      case ContextStrategy.RECENT_FILES:
        // Sort by recency
        rankedFiles.sort((a, b) => b.recencyScore - a.recencyScore);
        break;

      case ContextStrategy.RELATED_FILES:
        // Prioritize files related to current file
        if (options.currentFile) {
          const relatedPaths = this.fileRanker.getRelatedFiles(options.currentFile);
          rankedFiles = rankedFiles.filter(f => relatedPaths.includes(f.path));
        }
        break;

      case ContextStrategy.SEMANTIC:
        // Use semantic ranking if embeddings available
        if (this.embeddingService && options.query) {
          rankedFiles = await this.fileRanker.rankFilesSemanticly(files, {
            query: options.query,
            maxResults: options.maxFiles
          });
        }
        break;

      case ContextStrategy.HYBRID:
      default:
        // Already using hybrid ranking from fileRanker
        break;
    }

    // Add files to context
    for (const file of rankedFiles) {
      // Check if we have room
      if (window.availableTokens < file.tokenCount) {
        // Try to add truncated version
        const truncatedContent = this.tokenCounter.truncateToFit(
          file.content,
          window.availableTokens - 50, // Leave some buffer
          window.modelConfig.model
        );

        if (truncatedContent.length < 100) {
          // Too little content, skip
          continue;
        }

        file.content = truncatedContent;
        file.tokenCount = this.tokenCounter.count(truncatedContent, window.modelConfig.model).count;
      }

      const item = this.addItem(ContextItemType.FILE, file.content, {
        priority: this.priorityFromScore(file.finalScore),
        metadata: {
          source: file.path,
          language: file.metadata.language,
          lastModified: file.metadata.lastModified,
          relatedFiles: file.metadata.relatedFiles
        },
        relevanceScore: file.relevanceScore,
        tokenCount: file.tokenCount
      });

      if (item) {
        addedItems.push(item);
      }

      // Stop if at capacity
      if (window.isAtCapacity) break;
    }

    return addedItems;
  }

  /**
   * Convert score to priority
   */
  private priorityFromScore(score: number): ContextPriority {
    if (score >= 0.8) return ContextPriority.HIGH;
    if (score >= 0.5) return ContextPriority.MEDIUM;
    if (score >= 0.3) return ContextPriority.LOW;
    return ContextPriority.OPTIONAL;
  }

  /**
   * Add conversation messages to context
   */
  addConversation(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    options: { maxMessages?: number; truncateOld?: boolean } = {}
  ): ContextItem[] {
    const addedItems: ContextItem[] = [];
    const maxMessages = options.maxMessages ?? messages.length;

    // Take the most recent messages
    const recentMessages = messages.slice(-maxMessages);

    for (let i = 0; i < recentMessages.length; i++) {
      const message = recentMessages[i];
      const type = message.role === 'user'
        ? ContextItemType.USER_MESSAGE
        : message.role === 'assistant'
        ? ContextItemType.ASSISTANT_MESSAGE
        : ContextItemType.SYSTEM_PROMPT;

      // Calculate recency (more recent = higher score)
      const recencyScore = (i + 1) / recentMessages.length;

      const item = this.addItem(type, message.content, {
        priority: message.role === 'system' ? ContextPriority.CRITICAL : ContextPriority.HIGH,
        isRequired: message.role === 'system',
        metadata: {
          lastModified: new Date(),
          custom: { role: message.role, messageIndex: i }
        }
      });

      if (item) {
        item.recencyScore = recencyScore;
        item.combinedScore = this.calculateCombinedScore(item, this.currentWindow!.rankingCriteria);
        addedItems.push(item);
      }
    }

    return addedItems;
  }

  /**
   * Add RAG search results to context
   */
  addRAGResults(
    results: Array<{ content: string; score: number; metadata?: Record<string, unknown> }>
  ): ContextItem[] {
    const addedItems: ContextItem[] = [];

    for (const result of results) {
      const item = this.addItem(ContextItemType.RAG_RESULT, result.content, {
        priority: result.score > 0.8 ? ContextPriority.HIGH : ContextPriority.MEDIUM,
        relevanceScore: result.score,
        metadata: {
          source: result.metadata?.source as string,
          custom: result.metadata
        }
      });

      if (item) {
        addedItems.push(item);
      }
    }

    return addedItems;
  }

  /**
   * Build the final context string for API call
   */
  buildContextString(options: {
    separator?: string;
    includeMetadata?: boolean;
    format?: 'plain' | 'markdown' | 'xml';
  } = {}): string {
    if (!this.currentWindow) return '';

    const separator = options.separator ?? '\n\n---\n\n';
    const format = options.format ?? 'plain';
    const includeMetadata = options.includeMetadata ?? false;

    const window = this.currentWindow;
    const parts: string[] = [];

    // Group items by type for better organization
    const grouped = new Map<ContextItemType, ContextItem[]>();
    for (const item of window.items) {
      if (!grouped.has(item.type)) {
        grouped.set(item.type, []);
      }
      grouped.get(item.type)!.push(item);
    }

    // Build output based on format
    Array.from(grouped.entries()).forEach(([_type, items]) => {
      for (const item of items) {
        let content = item.content;

        if (includeMetadata && item.metadata.source) {
          switch (format) {
            case 'markdown':
              content = `### ${item.metadata.source}\n\`\`\`${item.metadata.language || ''}\n${content}\n\`\`\``;
              break;
            case 'xml':
              content = `<file path="${item.metadata.source}" language="${item.metadata.language || 'text'}">\n${content}\n</file>`;
              break;
            default:
              content = `[${item.metadata.source}]\n${content}`;
          }
        }

        parts.push(content);
      }
    });

    return parts.join(separator);
  }

  /**
   * Get context window statistics
   */
  getStats(): ContextManagerStats {
    const cacheStats = this.tokenCounter.getCacheStats();

    return {
      totalItems: this.allItems.size,
      activeItems: this.currentWindow?.items.length ?? 0,
      excludedItems: this.currentWindow?.excludedItems.length ?? 0,
      totalTokens: this.currentWindow?.totalTokens ?? 0,
      cacheHitRate: cacheStats.hitRate,
      averageRankingTimeMs: this.lastRankingTimeMs,
      updateCount: this.updateCount,
      lastUpdate: this.currentWindow?.updatedAt ?? new Date()
    };
  }

  /**
   * Emit update event
   */
  private emitUpdate(type: ContextUpdateEvent['type'], items: ContextItem[]): void {
    this.updateCount++;

    if (this.onUpdate) {
      this.onUpdate({
        type,
        items,
        previousTokens: this.currentWindow?.totalTokens ?? 0,
        newTokens: this.currentWindow?.totalTokens ?? 0,
        timestamp: new Date()
      });
    }
  }

  /**
   * Optimize the current context window
   */
  optimize(): void {
    if (!this.currentWindow) return;

    const window = this.currentWindow;

    // Remove duplicates by content hash
    const seen = new Set<string>();
    const toRemove: string[] = [];

    for (const item of window.items) {
      const hash = this.hashContent(item.content);
      if (seen.has(hash)) {
        if (!item.isRequired) {
          toRemove.push(item.id);
        }
      } else {
        seen.add(hash);
      }
    }

    for (const id of toRemove) {
      this.removeItem(id);
    }

    // Rerank to ensure optimal order
    this.rerank();

    // Try to add excluded items if space available
    for (const excludedItem of [...window.excludedItems]) {
      if (window.availableTokens >= excludedItem.tokenCount) {
        const index = window.excludedItems.indexOf(excludedItem);
        window.excludedItems.splice(index, 1);
        this.addItemToWindow(window, excludedItem);
      }
    }
  }

  /**
   * Simple content hash for deduplication
   */
  private hashContent(content: string): string {
    let hash = 0;
    const sample = content.slice(0, 500) + content.slice(-500);
    for (let i = 0; i < sample.length; i++) {
      const char = sample.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Clear the current context window
   */
  clear(): void {
    if (this.currentWindow) {
      const items = [...this.currentWindow.items];
      this.currentWindow.items = [];
      this.currentWindow.excludedItems = [];
      this.currentWindow.totalTokens = 0;
      this.currentWindow.availableTokens = this.tokenCounter.getAvailableContextTokens(
        this.currentWindow.modelConfig.model
      );
      this.currentWindow.utilizationPercent = 0;
      this.currentWindow.isAtCapacity = false;
      this.currentWindow.updatedAt = new Date();

      this.allItems.clear();
      this.emitUpdate('clear', items);
    }
  }

  /**
   * Switch to a different model
   */
  switchModel(model: string): void {
    if (!this.currentWindow) return;

    const newConfig = this.tokenCounter.getModelConfig(model);
    this.currentWindow.modelConfig = newConfig;

    // Recalculate available tokens
    const maxTokens = Math.floor(
      (newConfig.maxContextTokens - newConfig.systemPromptReserved - newConfig.responseReserved) *
      (this.options.maxUtilization / 100)
    );

    this.currentWindow.availableTokens = maxTokens - this.currentWindow.totalTokens;
    this.currentWindow.utilizationPercent = (this.currentWindow.totalTokens / maxTokens) * 100;
    this.currentWindow.isAtCapacity = this.currentWindow.availableTokens < 100;

    // If we're over capacity, evict items
    while (this.currentWindow.availableTokens < 0 && this.currentWindow.items.length > 0) {
      const evictable = this.currentWindow.items
        .filter(item => !item.isRequired)
        .sort((a, b) => a.combinedScore - b.combinedScore);

      if (evictable.length === 0) break;

      const toEvict = evictable[0];
      this.removeItemFromWindow(this.currentWindow, toEvict.id);
      this.currentWindow.excludedItems.push(toEvict);
    }

    this.rerank();
  }

  /**
   * Get token counter instance
   */
  getTokenCounter(): TokenCounter {
    return this.tokenCounter;
  }

  /**
   * Get file ranker instance
   */
  getFileRanker(): FileRanker {
    return this.fileRanker;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.clear();
    this.tokenCounter.dispose();
  }
}

/**
 * Create a context manager with default configuration
 */
export function createContextManager(options?: ContextManagerOptions): ContextManager {
  return new ContextManager(options);
}

/**
 * Singleton instance for convenience
 */
let defaultInstance: ContextManager | null = null;

/**
 * Get the default context manager instance
 */
export function getContextManager(): ContextManager {
  if (!defaultInstance) {
    defaultInstance = new ContextManager();
  }
  return defaultInstance;
}

export default ContextManager;

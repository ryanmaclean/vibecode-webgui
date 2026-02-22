/**
 * Context Integration Helper
 *
 * Utilities for integrating ContextManager into API routes.
 * Provides helpers for building context from chat requests, RAG results,
 * files, and conversation history with intelligent prioritization.
 */

import {
  ContextManager,
  ContextManagerOptions,
  AddItemOptions,
  ContextItem,
  ContextItemType,
  ContextPriority,
  ContextStrategy,
  ContextWindow,
  ContextWindowOptions,
  getContextManager
} from './index';

/**
 * Chat message format for context integration
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: {
    timestamp?: Date;
    model?: string;
    tokenCount?: number;
    [key: string]: unknown;
  };
}

/**
 * RAG context result format
 */
export interface RAGContextResult {
  context: string;
  workspaceId: string;
  relevanceScore: 'high' | 'medium' | 'low';
  strategiesUsed: number;
  totalLength: number;
  sources?: string[];
}

/**
 * File context item
 */
export interface FileContext {
  path: string;
  content: string;
  language?: string;
  isPinned?: boolean;
  relevanceScore?: number;
}

/**
 * Options for building context from a chat request
 */
export interface BuildContextOptions {
  /** Model to use for token counting */
  model: string;
  /** Context selection strategy */
  strategy?: ContextStrategy;
  /** Maximum utilization percentage */
  maxUtilization?: number;
  /** Previous messages to include */
  previousMessages?: ChatMessage[];
  /** RAG context result */
  ragContext?: RAGContextResult;
  /** Files to include */
  files?: FileContext[];
  /** Current user message */
  userMessage?: string;
  /** System prompt */
  systemPrompt?: string;
  /** Keywords to boost in ranking */
  boostKeywords?: string[];
  /** Custom context manager instance */
  contextManager?: ContextManager;
}

/**
 * Result from building context
 */
export interface BuiltContext {
  /** The context window */
  window: ContextWindow;
  /** Items that were included */
  includedItems: ContextItem[];
  /** Items that were excluded due to capacity */
  excludedItems: ContextItem[];
  /** Summary of what was included */
  summary: {
    totalTokens: number;
    utilizationPercent: number;
    messageCount: number;
    fileCount: number;
    ragIncluded: boolean;
    pinnedFileCount: number;
  };
  /** Context manager instance used */
  manager: ContextManager;
}

/**
 * Build context window from chat request components
 *
 * This is the main integration point for API routes. It takes all the
 * components of a chat request and intelligently builds a context window
 * that maximizes relevance within token limits.
 *
 * @param options - Options for building context
 * @returns Built context with window, included/excluded items, and summary
 *
 * @example
 * ```typescript
 * const result = await buildChatContext({
 *   model: 'gpt-4',
 *   strategy: ContextStrategy.HYBRID,
 *   previousMessages: messages,
 *   ragContext: ragResult,
 *   files: filesFromWorkspace,
 *   userMessage: currentMessage,
 *   systemPrompt: systemPromptText,
 *   boostKeywords: ['authentication', 'security']
 * });
 *
 * // Use result.window to get context for AI
 * // Use result.summary for metadata in response
 * ```
 */
export async function buildChatContext(
  options: BuildContextOptions
): Promise<BuiltContext> {
  const {
    model,
    strategy = ContextStrategy.HYBRID,
    maxUtilization = 85,
    previousMessages = [],
    ragContext,
    files = [],
    userMessage,
    systemPrompt,
    boostKeywords = [],
    contextManager
  } = options;

  // Get or create context manager
  const manager = contextManager || getContextManager();

  // Create context window
  const windowOptions: ContextWindowOptions = {
    model,
    strategy,
    maxUtilization,
    boostKeywords
  };

  const window = manager.createWindow(windowOptions);

  // Priority order for adding context:
  // 1. System prompt (CRITICAL - always required)
  // 2. User message (CRITICAL - always required)
  // 3. Pinned files (HIGH - user explicitly wants these)
  // 4. RAG context (HIGH - semantically relevant)
  // 5. Recent assistant messages (MEDIUM - for continuity)
  // 6. Recent user messages (MEDIUM - for continuity)
  // 7. Non-pinned files (MEDIUM-LOW - workspace context)
  // 8. Older messages (LOW - historical context)

  // Add system prompt (required)
  if (systemPrompt) {
    manager.addItem(
      ContextItemType.SYSTEM_PROMPT,
      systemPrompt,
      {
        priority: ContextPriority.CRITICAL,
        isRequired: true,
        metadata: { source: 'system' }
      }
    );
  }

  // Add current user message (required)
  if (userMessage) {
    manager.addItem(
      ContextItemType.USER_MESSAGE,
      userMessage,
      {
        priority: ContextPriority.CRITICAL,
        isRequired: true,
        metadata: {
          source: 'user',
          lastAccessed: new Date()
        }
      }
    );
  }

  // Add pinned files (high priority, required)
  const pinnedFiles = files.filter(f => f.isPinned);
  for (const file of pinnedFiles) {
    manager.addItem(
      ContextItemType.FILE,
      file.content,
      {
        priority: ContextPriority.HIGH,
        isRequired: true,
        relevanceScore: file.relevanceScore ?? 0.9,
        metadata: {
          source: file.path,
          language: file.language,
          tags: ['pinned']
        }
      }
    );
  }

  // Add RAG context (high priority if available)
  if (ragContext) {
    const relevanceScoreMap = {
      high: 0.95,
      medium: 0.75,
      low: 0.5
    };

    manager.addItem(
      ContextItemType.RAG_RESULT,
      ragContext.context,
      {
        priority: ContextPriority.HIGH,
        isRequired: false,
        relevanceScore: relevanceScoreMap[ragContext.relevanceScore],
        metadata: {
          source: ragContext.workspaceId,
          tags: ['rag', 'semantic-search'],
          custom: {
            strategiesUsed: ragContext.strategiesUsed,
            sources: ragContext.sources
          }
        }
      }
    );
  }

  // Add previous messages with recency-based prioritization
  // Recent messages are more important for context continuity
  const sortedMessages = [...previousMessages].reverse(); // Most recent first

  for (let i = 0; i < sortedMessages.length; i++) {
    const message = sortedMessages[i];
    const recencyScore = Math.max(0.3, 1 - (i / sortedMessages.length) * 0.7);

    // Assistant messages slightly higher priority than user messages
    // for understanding conversation flow
    const priority = i < 3
      ? ContextPriority.HIGH
      : i < 8
        ? ContextPriority.MEDIUM
        : ContextPriority.LOW;

    const itemType = message.role === 'assistant'
      ? ContextItemType.ASSISTANT_MESSAGE
      : message.role === 'system'
        ? ContextItemType.SYSTEM_PROMPT
        : ContextItemType.USER_MESSAGE;

    manager.addItem(
      itemType,
      message.content,
      {
        priority,
        isRequired: false,
        relevanceScore: recencyScore,
        tokenCount: message.metadata?.tokenCount,
        metadata: {
          source: message.role,
          lastAccessed: message.metadata?.timestamp,
          custom: message.metadata
        }
      }
    );
  }

  // Add non-pinned files with their relevance scores
  const nonPinnedFiles = files.filter(f => !f.isPinned);
  for (const file of nonPinnedFiles) {
    manager.addItem(
      ContextItemType.FILE,
      file.content,
      {
        priority: ContextPriority.MEDIUM,
        isRequired: false,
        relevanceScore: file.relevanceScore ?? 0.5,
        metadata: {
          source: file.path,
          language: file.language
        }
      }
    );
  }

  // Get final window state
  const finalWindow = manager.getWindow();
  if (!finalWindow) {
    throw new Error('Failed to create context window');
  }

  // Build summary
  const includedItems = finalWindow.items;
  const excludedItems = finalWindow.excludedItems;

  const messageCount = includedItems.filter(item =>
    [
      ContextItemType.USER_MESSAGE,
      ContextItemType.ASSISTANT_MESSAGE,
      ContextItemType.CONVERSATION
    ].includes(item.type)
  ).length;

  const fileCount = includedItems.filter(item =>
    item.type === ContextItemType.FILE
  ).length;

  const ragIncluded = includedItems.some(item =>
    item.type === ContextItemType.RAG_RESULT
  );

  const pinnedFileCount = includedItems.filter(item =>
    item.type === ContextItemType.FILE &&
    item.metadata.tags?.includes('pinned')
  ).length;

  return {
    window: finalWindow,
    includedItems,
    excludedItems,
    summary: {
      totalTokens: finalWindow.totalTokens,
      utilizationPercent: finalWindow.utilizationPercent,
      messageCount,
      fileCount,
      ragIncluded,
      pinnedFileCount
    },
    manager
  };
}

/**
 * Format context window items into a single string for AI consumption
 *
 * @param window - Context window to format
 * @param options - Formatting options
 * @returns Formatted context string
 */
export function formatContextForAI(
  window: ContextWindow,
  options: {
    includeMetadata?: boolean;
    separator?: string;
  } = {}
): string {
  const {
    includeMetadata = false,
    separator = '\n\n---\n\n'
  } = options;

  const sections: string[] = [];

  // Group items by type for better organization
  const itemsByType = new Map<ContextItemType, ContextItem[]>();

  for (const item of window.items) {
    const existing = itemsByType.get(item.type) || [];
    existing.push(item);
    itemsByType.set(item.type, existing);
  }

  // Add system prompts first
  const systemPrompts = itemsByType.get(ContextItemType.SYSTEM_PROMPT) || [];
  for (const item of systemPrompts) {
    sections.push(item.content);
  }

  // Add RAG context
  const ragResults = itemsByType.get(ContextItemType.RAG_RESULT) || [];
  for (const item of ragResults) {
    if (includeMetadata) {
      sections.push(`[RAG Context - Relevance: ${item.relevanceScore.toFixed(2)}]\n${item.content}`);
    } else {
      sections.push(item.content);
    }
  }

  // Add files
  const files = itemsByType.get(ContextItemType.FILE) || [];
  for (const item of files) {
    if (includeMetadata && item.metadata.source) {
      const pinned = item.metadata.tags?.includes('pinned') ? ' [PINNED]' : '';
      sections.push(`[File: ${item.metadata.source}${pinned}]\n${item.content}`);
    } else {
      sections.push(item.content);
    }
  }

  // Add conversation history
  const messages = [
    ...(itemsByType.get(ContextItemType.USER_MESSAGE) || []),
    ...(itemsByType.get(ContextItemType.ASSISTANT_MESSAGE) || []),
    ...(itemsByType.get(ContextItemType.CONVERSATION) || [])
  ].sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime());

  for (const item of messages) {
    if (includeMetadata && item.metadata.source) {
      sections.push(`[${item.metadata.source}]\n${item.content}`);
    } else {
      sections.push(item.content);
    }
  }

  return sections.join(separator);
}

/**
 * Get context metadata for API response
 *
 * Returns useful metadata about the context that can be included
 * in API responses to show users what context was used.
 *
 * @param result - Built context result
 * @returns Metadata object
 */
export function getContextMetadata(result: BuiltContext): Record<string, unknown> {
  const { window, summary, excludedItems } = result;

  return {
    strategy: window.strategy,
    model: window.modelConfig.model,
    totalTokens: summary.totalTokens,
    availableTokens: window.availableTokens,
    utilizationPercent: Math.round(summary.utilizationPercent * 10) / 10,
    isAtCapacity: window.isAtCapacity,
    included: {
      messages: summary.messageCount,
      files: summary.fileCount,
      pinnedFiles: summary.pinnedFileCount,
      ragContext: summary.ragIncluded,
      totalItems: window.items.length
    },
    excluded: {
      totalItems: excludedItems.length,
      items: excludedItems.map(item => ({
        type: item.type,
        source: item.metadata.source,
        tokenCount: item.tokenCount,
        relevanceScore: item.relevanceScore
      }))
    },
    timestamp: window.updatedAt.toISOString()
  };
}

/**
 * Create a simple context manager instance for API routes
 *
 * Convenience function to create a configured context manager
 * with sensible defaults for API usage.
 *
 * @param options - Context manager options
 * @returns Context manager instance
 */
export function createAPIContextManager(
  options: Partial<ContextManagerOptions> = {}
): ContextManager {
  return new ContextManager({
    defaultModel: 'gpt-4',
    maxUtilization: 85,
    autoRerank: true,
    ...options
  });
}

/**
 * Estimate if content will fit in context window
 *
 * Quick check to see if content will likely fit before attempting
 * to add it to the context window.
 *
 * @param contentLength - Length of content in characters
 * @param window - Context window to check
 * @param safetyMargin - Safety margin percentage (default: 10%)
 * @returns Whether content will likely fit
 */
export function willFitInContext(
  contentLength: number,
  window: ContextWindow,
  safetyMargin = 0.1
): boolean {
  // Rough estimate: 1 token ≈ 4 characters for English text
  const estimatedTokens = Math.ceil(contentLength / 4);
  const availableWithMargin = window.availableTokens * (1 - safetyMargin);

  return estimatedTokens <= availableWithMargin;
}

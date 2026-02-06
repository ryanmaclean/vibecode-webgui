/**
 * AI Context Management Module
 *
 * Provides smart context window management for optimal AI interactions.
 * Includes token counting, file ranking, and context prioritization.
 */

// Core classes
export { ContextManager, createContextManager, getContextManager } from './context-manager';
export { TokenCounter, getTokenCounter, countTokens, estimateTokens } from './token-counter';
export { FileRanker } from './file-ranker';

// Types from context manager
export type {
  ContextManagerOptions,
  AddItemOptions
} from './context-manager';

// Types from token counter
export type {
  TokenCounterOptions
} from './token-counter';

// Types from file ranker
export type {
  FileMetadata,
  FileRankerOptions
} from './file-ranker';

// Re-export all types from the types module for convenience
export {
  ContextStrategy,
  ModelFamily,
  ContextItemType,
  ContextPriority,
  DEFAULT_RANKING_CRITERIA,
  MODEL_CONFIGS
} from '../../../types/context';

export type {
  ContextWindow,
  ContextItem,
  ContextItemMetadata,
  RankingCriteria,
  ContextWindowOptions,
  TokenCountResult,
  FileRankingResult,
  ContextUpdateEvent,
  ContextManagerStats,
  FileDependency,
  FileChangeEvent,
  SemanticSearchOptions,
  ModelTokenConfig
} from '../../../types/context';

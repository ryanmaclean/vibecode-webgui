/**
 * Search Web Worker
 *
 * Offloads search computation from the main thread to prevent UI freezing
 * when searching through large files. Processes file chunks and returns
 * search matches without blocking the editor.
 *
 * Key features:
 * - Processes file chunks independently for parallelization
 * - Memory-efficient incremental search
 * - Supports case-sensitive/insensitive search
 * - Supports regular expression search
 * - Supports whole word matching
 * - Progress reporting for long-running operations
 */

import type { FileChunk } from '../lib/editor/file-chunking';

/**
 * Message types for worker communication
 */
export type SearchWorkerMessageType =
  | 'SEARCH_CHUNK'
  | 'SEARCH_COMPLETE'
  | 'SEARCH_ERROR'
  | 'CANCEL'
  | 'PROGRESS';

/**
 * Search options for controlling search behavior
 */
export interface SearchOptions {
  /** Case-sensitive search */
  caseSensitive: boolean;
  /** Use regular expression */
  useRegex: boolean;
  /** Match whole words only */
  wholeWord: boolean;
  /** Maximum number of matches to return (0 = unlimited) */
  maxMatches?: number;
}

/**
 * Input message for searching a chunk
 */
export interface SearchChunkMessage {
  type: 'SEARCH_CHUNK';
  payload: {
    chunk: FileChunk;
    query: string;
    options: SearchOptions;
    searchId: string;
  };
}

/**
 * Represents a search match within a line
 */
export interface SearchMatch {
  /** Absolute line number in the file (0-based) */
  lineNumber: number;
  /** Column where the match starts (0-based) */
  startColumn: number;
  /** Column where the match ends (0-based) */
  endColumn: number;
  /** The matched text */
  matchedText: string;
  /** The full line content containing the match */
  lineContent: string;
  /** Context before the match (up to 50 chars) */
  contextBefore: string;
  /** Context after the match (up to 50 chars) */
  contextAfter: string;
}

/**
 * Response message for completed search
 */
export interface SearchCompleteMessage {
  type: 'SEARCH_COMPLETE';
  payload: {
    chunk: FileChunk;
    matches: SearchMatch[];
    searchId: string;
    duration: number;
    totalMatches: number;
  };
}

/**
 * Error message from worker
 */
export interface SearchErrorMessage {
  type: 'SEARCH_ERROR';
  payload: {
    searchId: string;
    error: string;
  };
}

/**
 * Progress update message
 */
export interface SearchProgressMessage {
  type: 'PROGRESS';
  payload: {
    searchId: string;
    linesProcessed: number;
    totalLines: number;
    matchesFound: number;
  };
}

/**
 * Cancel message to stop processing
 */
export interface SearchCancelMessage {
  type: 'CANCEL';
  payload: {
    searchId?: string;
  };
}

/**
 * Union type for all worker messages
 */
export type SearchWorkerMessage =
  | SearchChunkMessage
  | SearchCompleteMessage
  | SearchErrorMessage
  | SearchProgressMessage
  | SearchCancelMessage;

/**
 * Escapes special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Creates a regex pattern from search query and options
 */
function createSearchPattern(query: string, options: SearchOptions): RegExp {
  let pattern = query;

  if (!options.useRegex) {
    // Escape special regex characters for literal search
    pattern = escapeRegex(query);
  }

  if (options.wholeWord) {
    // Add word boundary markers
    pattern = `\\b${pattern}\\b`;
  }

  const flags = options.caseSensitive ? 'g' : 'gi';

  try {
    return new RegExp(pattern, flags);
  } catch (error) {
    throw new Error(`Invalid search pattern: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Searches a single line for matches
 */
function searchLine(
  line: string,
  lineNumber: number,
  pattern: RegExp,
  maxMatches: number
): SearchMatch[] {
  const matches: SearchMatch[] = [];

  // Reset regex state
  pattern.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(line)) !== null) {
    const startColumn = match.index;
    const matchedText = match[0];
    const endColumn = startColumn + matchedText.length;

    // Extract context
    const contextStart = Math.max(0, startColumn - 50);
    const contextEnd = Math.min(line.length, endColumn + 50);
    const contextBefore = line.substring(contextStart, startColumn);
    const contextAfter = line.substring(endColumn, contextEnd);

    matches.push({
      lineNumber,
      startColumn,
      endColumn,
      matchedText,
      lineContent: line,
      contextBefore,
      contextAfter,
    });

    // Check if we've reached max matches
    if (maxMatches > 0 && matches.length >= maxMatches) {
      break;
    }

    // Prevent infinite loop on zero-length matches
    if (match[0].length === 0) {
      pattern.lastIndex++;
    }
  }

  return matches;
}

/**
 * Process a chunk of content for search matches
 */
function processSearchChunk(
  chunk: FileChunk,
  query: string,
  options: SearchOptions,
  searchId: string,
  onProgress?: (linesProcessed: number, totalLines: number, matchesFound: number) => void
): SearchMatch[] {
  const lines = chunk.content.split('\n');
  const matches: SearchMatch[] = [];
  const pattern = createSearchPattern(query, options);
  const maxMatches = options.maxMatches || 0;

  for (let i = 0; i < lines.length; i++) {
    const absoluteLineNumber = chunk.startLine + i;
    const lineMatches = searchLine(lines[i], absoluteLineNumber, pattern, maxMatches);

    matches.push(...lineMatches);

    // Report progress every 100 lines
    if (onProgress && i % 100 === 0) {
      onProgress(i + 1, lines.length, matches.length);
    }

    // Check if we've reached max matches
    if (maxMatches > 0 && matches.length >= maxMatches) {
      break;
    }
  }

  return matches;
}

/**
 * Active search operations
 */
let activeSearches: Set<string> = new Set();

/**
 * Worker message handler
 */
self.addEventListener('message', (event: MessageEvent<SearchWorkerMessage>) => {
  const message = event.data;

  switch (message.type) {
    case 'SEARCH_CHUNK': {
      const { chunk, query, options, searchId } = message.payload;

      // Track active search
      activeSearches.add(searchId);

      const startTime = performance.now();

      try {
        // Validate query
        if (!query || query.length === 0) {
          throw new Error('Search query cannot be empty');
        }

        // Process the chunk with progress reporting
        const matches = processSearchChunk(
          chunk,
          query,
          options,
          searchId,
          (linesProcessed, totalLines, matchesFound) => {
            // Send progress update
            if (activeSearches.has(searchId)) {
              const progressMessage: SearchProgressMessage = {
                type: 'PROGRESS',
                payload: {
                  searchId,
                  linesProcessed,
                  totalLines,
                  matchesFound,
                },
              };
              self.postMessage(progressMessage);
            }
          }
        );

        const duration = performance.now() - startTime;

        // Check if still active (not cancelled)
        if (activeSearches.has(searchId)) {
          const response: SearchCompleteMessage = {
            type: 'SEARCH_COMPLETE',
            payload: {
              chunk,
              matches,
              searchId,
              duration,
              totalMatches: matches.length,
            },
          };

          self.postMessage(response);
        }
      } catch (error) {
        const errorMessage: SearchErrorMessage = {
          type: 'SEARCH_ERROR',
          payload: {
            searchId,
            error: error instanceof Error ? error.message : String(error),
          },
        };

        self.postMessage(errorMessage);
      } finally {
        // Clean up
        activeSearches.delete(searchId);
      }

      break;
    }

    case 'CANCEL': {
      const { searchId } = message.payload;

      if (searchId) {
        // Cancel specific search
        activeSearches.delete(searchId);
      } else {
        // Cancel all searches
        activeSearches.clear();
      }

      break;
    }

    default:
      // Ignore unknown message types
      break;
  }
});

/**
 * Worker ready signal
 */
self.postMessage({ type: 'READY' });

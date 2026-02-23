/**
 * Search Optimizer with Chunked Search Algorithm
 *
 * Provides efficient search capabilities for large files by processing content
 * in chunks. This prevents UI freezing and memory exhaustion when searching
 * through very large files.
 *
 * Key features:
 * - Chunked search algorithm for large files
 * - Support for case-sensitive and case-insensitive search
 * - Regular expression search support
 * - Progress reporting for long-running searches
 * - Deduplication of matches across chunk boundaries
 * - Cancellation support
 * - Memory-efficient incremental processing
 */

import {
  type FileChunk,
  type ChunkedFile,
  chunkFileContent,
  DEFAULT_CHUNK_SIZE,
  CHUNK_OVERLAP,
} from './file-chunking';

/**
 * Represents a single search match
 */
export interface SearchMatch {
  /** Line number where match was found (0-based) */
  line: number;

  /** Column where match starts (0-based) */
  column: number;

  /** Column where match ends (0-based, exclusive) */
  endColumn: number;

  /** The matched text */
  matchedText: string;

  /** The complete line containing the match */
  lineText: string;

  /** Context before the match (if available) */
  beforeContext?: string;

  /** Context after the match (if available) */
  afterContext?: string;
}

/**
 * Search options
 */
export interface SearchOptions {
  /** Case-sensitive search */
  caseSensitive?: boolean;

  /** Use regular expression */
  useRegex?: boolean;

  /** Match whole word only */
  wholeWord?: boolean;

  /** Number of context lines before match */
  contextBefore?: number;

  /** Number of context lines after match */
  contextAfter?: number;

  /** Maximum number of matches to return (0 = unlimited) */
  maxMatches?: number;

  /** Chunk size for search operation (in lines) */
  chunkSize?: number;

  /** Overlap size for search operation (in lines) */
  overlapSize?: number;
}

/**
 * Search progress callback
 */
export type SearchProgressCallback = (
  chunksProcessed: number,
  totalChunks: number,
  matchesFound: number
) => void;

/**
 * Search result
 */
export interface SearchResult {
  /** Array of matches found */
  matches: SearchMatch[];

  /** Total number of matches found */
  totalMatches: number;

  /** Number of chunks processed */
  chunksProcessed: number;

  /** Total number of chunks */
  totalChunks: number;

  /** Search duration in milliseconds */
  duration: number;

  /** Whether search was cancelled */
  cancelled: boolean;

  /** Whether max matches limit was reached */
  limitReached: boolean;
}

/**
 * Search state for cancellation support
 */
class SearchState {
  private cancelled = false;

  cancel(): void {
    this.cancelled = true;
  }

  isCancelled(): boolean {
    return this.cancelled;
  }
}

/**
 * Chunked search engine for large files
 */
export class ChunkedSearch {
  private searchState: SearchState | null = null;

  /**
   * Searches for a pattern in file content
   *
   * @param content - The file content to search
   * @param pattern - The search pattern (string or regex)
   * @param options - Search options
   * @param onProgress - Optional progress callback
   * @returns Search result with all matches
   */
  async search(
    content: string,
    pattern: string,
    options: SearchOptions = {},
    onProgress?: SearchProgressCallback
  ): Promise<SearchResult> {
    const startTime = performance.now();

    // Create new search state for cancellation
    this.searchState = new SearchState();

    // Set defaults
    const {
      caseSensitive = false,
      useRegex = false,
      wholeWord = false,
      contextBefore = 0,
      contextAfter = 0,
      maxMatches = 0,
      chunkSize = DEFAULT_CHUNK_SIZE.SEARCH,
      overlapSize = CHUNK_OVERLAP.SEARCH,
    } = options;

    // Chunk the content
    const chunkedFile = chunkFileContent(content, {
      chunkSize,
      overlapSize,
      operationType: 'SEARCH',
    });

    // Compile search regex
    const searchRegex = this.compileSearchRegex(pattern, {
      caseSensitive,
      useRegex,
      wholeWord,
    });

    // Search through chunks
    const allMatches: SearchMatch[] = [];
    const seenMatches = new Set<string>(); // For deduplication
    let chunksProcessed = 0;
    let limitReached = false;

    for (const chunk of chunkedFile.chunks) {
      // Check for cancellation
      if (this.searchState.isCancelled()) {
        return {
          matches: allMatches,
          totalMatches: allMatches.length,
          chunksProcessed,
          totalChunks: chunkedFile.metadata.totalChunks,
          duration: performance.now() - startTime,
          cancelled: true,
          limitReached: false,
        };
      }

      // Search in chunk
      const chunkMatches = this.searchInChunk(
        chunk,
        searchRegex,
        contextBefore,
        contextAfter,
        content
      );

      // Deduplicate matches (handle overlaps)
      for (const match of chunkMatches) {
        const matchKey = `${match.line}:${match.column}:${match.matchedText}`;

        if (!seenMatches.has(matchKey)) {
          seenMatches.add(matchKey);
          allMatches.push(match);

          // Check max matches limit
          if (maxMatches > 0 && allMatches.length >= maxMatches) {
            limitReached = true;
            break;
          }
        }
      }

      chunksProcessed++;

      // Report progress
      if (onProgress) {
        onProgress(chunksProcessed, chunkedFile.metadata.totalChunks, allMatches.length);
      }

      // Break if limit reached
      if (limitReached) {
        break;
      }
    }

    const duration = performance.now() - startTime;

    return {
      matches: allMatches,
      totalMatches: allMatches.length,
      chunksProcessed,
      totalChunks: chunkedFile.metadata.totalChunks,
      duration,
      cancelled: false,
      limitReached,
    };
  }

  /**
   * Cancels the current search operation
   */
  cancel(): void {
    if (this.searchState) {
      this.searchState.cancel();
    }
  }

  /**
   * Compiles search pattern into a regex
   */
  private compileSearchRegex(
    pattern: string,
    options: { caseSensitive: boolean; useRegex: boolean; wholeWord: boolean }
  ): RegExp {
    let regexPattern = pattern;

    if (!options.useRegex) {
      // Escape special regex characters
      regexPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Add whole word boundaries if needed
    if (options.wholeWord) {
      regexPattern = `\\b${regexPattern}\\b`;
    }

    const flags = options.caseSensitive ? 'g' : 'gi';

    try {
      return new RegExp(regexPattern, flags);
    } catch (error) {
      throw new Error(
        `Invalid search pattern: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Searches within a single chunk
   */
  private searchInChunk(
    chunk: FileChunk,
    regex: RegExp,
    contextBefore: number,
    contextAfter: number,
    fullContent: string
  ): SearchMatch[] {
    const matches: SearchMatch[] = [];
    const lines = chunk.content.split('\n');

    // Search each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const absoluteLineNumber = chunk.startLine + i;

      // Reset regex lastIndex for global flag
      regex.lastIndex = 0;

      // Find all matches in this line
      let match: RegExpExecArray | null;
      while ((match = regex.exec(line)) !== null) {
        const column = match.index;
        const matchedText = match[0];
        const endColumn = column + matchedText.length;

        // Get context if requested
        const beforeContext = this.getContext(
          fullContent,
          absoluteLineNumber,
          contextBefore,
          'before'
        );

        const afterContext = this.getContext(
          fullContent,
          absoluteLineNumber,
          contextAfter,
          'after'
        );

        matches.push({
          line: absoluteLineNumber,
          column,
          endColumn,
          matchedText,
          lineText: line,
          beforeContext,
          afterContext,
        });

        // Prevent infinite loop on zero-length matches
        if (match[0].length === 0) {
          regex.lastIndex++;
        }
      }
    }

    return matches;
  }

  /**
   * Gets context lines before or after a match
   */
  private getContext(
    content: string,
    lineNumber: number,
    contextLines: number,
    direction: 'before' | 'after'
  ): string | undefined {
    if (contextLines === 0) {
      return undefined;
    }

    const allLines = content.split('\n');

    if (direction === 'before') {
      const startLine = Math.max(0, lineNumber - contextLines);
      const contextLineArray = allLines.slice(startLine, lineNumber);
      return contextLineArray.length > 0 ? contextLineArray.join('\n') : undefined;
    } else {
      const endLine = Math.min(allLines.length, lineNumber + 1 + contextLines);
      const contextLineArray = allLines.slice(lineNumber + 1, endLine);
      return contextLineArray.length > 0 ? contextLineArray.join('\n') : undefined;
    }
  }
}

/**
 * Searches for a pattern in file content (convenience function)
 *
 * @param content - The file content to search
 * @param pattern - The search pattern
 * @param options - Search options
 * @param onProgress - Optional progress callback
 * @returns Search result with all matches
 */
export async function searchInChunks(
  content: string,
  pattern: string,
  options?: SearchOptions,
  onProgress?: SearchProgressCallback
): Promise<SearchResult> {
  const search = new ChunkedSearch();
  return search.search(content, pattern, options, onProgress);
}

/**
 * Finds all occurrences of a pattern in content (simple synchronous version)
 *
 * @param content - The content to search
 * @param pattern - The search pattern
 * @param caseSensitive - Whether to perform case-sensitive search
 * @returns Array of matches
 */
export function findAllMatches(
  content: string,
  pattern: string,
  caseSensitive: boolean = false
): SearchMatch[] {
  const matches: SearchMatch[] = [];
  const lines = content.split('\n');

  const flags = caseSensitive ? 'g' : 'gi';
  const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escapedPattern, flags);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    regex.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(line)) !== null) {
      matches.push({
        line: i,
        column: match.index,
        endColumn: match.index + match[0].length,
        matchedText: match[0],
        lineText: line,
      });

      // Prevent infinite loop on zero-length matches
      if (match[0].length === 0) {
        regex.lastIndex++;
      }
    }
  }

  return matches;
}

/**
 * Counts occurrences of a pattern in content
 *
 * @param content - The content to search
 * @param pattern - The search pattern
 * @param options - Search options
 * @returns Number of matches found
 */
export async function countMatches(
  content: string,
  pattern: string,
  options?: SearchOptions
): Promise<number> {
  const result = await searchInChunks(content, pattern, {
    ...options,
    contextBefore: 0,
    contextAfter: 0,
  });

  return result.totalMatches;
}

/**
 * Checks if a pattern exists in content
 *
 * @param content - The content to search
 * @param pattern - The search pattern
 * @param options - Search options
 * @returns Whether the pattern was found
 */
export async function hasMatch(
  content: string,
  pattern: string,
  options?: SearchOptions
): Promise<boolean> {
  const result = await searchInChunks(content, pattern, {
    ...options,
    maxMatches: 1,
    contextBefore: 0,
    contextAfter: 0,
  });

  return result.totalMatches > 0;
}

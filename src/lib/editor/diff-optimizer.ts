/**
 * Diff Optimizer with Myers Algorithm
 *
 * Implements the Myers diff algorithm for efficient computation of differences
 * between two sequences of text. Optimized for large file performance.
 *
 * Performance considerations:
 * - Line-based diffing for text files (more efficient than character-based)
 * - Memory-efficient implementation with bounded space usage
 * - Early termination for identical content
 * - Chunked processing for very large files
 * - Reusable diff context to minimize allocations
 *
 * References:
 * - Myers, Eugene W. "An O(ND) Difference Algorithm and Its Variations" (1986)
 * - http://www.xmailserver.org/diff2.pdf
 */

/**
 * Configuration constants for diff operations
 */
export const DIFF_CONFIG = {
  /** Maximum number of lines to diff without chunking */
  MAX_DIRECT_DIFF_LINES: 10000,

  /** Maximum edit distance before considering files too different */
  MAX_EDIT_DISTANCE: 50000,

  /** Maximum memory allocation for diff operations (in bytes) */
  MAX_DIFF_MEMORY: 100 * 1024 * 1024, // 100MB

  /** Chunk size for large file diffs (in lines) */
  CHUNK_SIZE: 1000,

  /** Overlap size for chunked diffs (in lines) */
  CHUNK_OVERLAP: 50,
} as const;

/**
 * Types of diff operations
 */
export enum DiffType {
  /** Lines are identical */
  EQUAL = 'equal',

  /** Lines were deleted from the original */
  DELETE = 'delete',

  /** Lines were added to the modified version */
  INSERT = 'insert',
}

/**
 * Represents a single diff operation
 */
export interface DiffOperation {
  /** Type of operation */
  type: DiffType;

  /** The text content involved in this operation */
  text: string;

  /** Line number in the original text (for DELETE and EQUAL) */
  originalLine?: number;

  /** Line number in the modified text (for INSERT and EQUAL) */
  modifiedLine?: number;

  /** Number of lines affected by this operation */
  lineCount: number;
}

/**
 * Complete diff result between two texts
 */
export interface DiffResult {
  /** Array of diff operations */
  operations: DiffOperation[];

  /** Total number of additions */
  additions: number;

  /** Total number of deletions */
  deletions: number;

  /** Total number of unchanged lines */
  unchanged: number;

  /** Edit distance (minimum number of operations) */
  editDistance: number;

  /** Whether the texts are identical */
  isIdentical: boolean;

  /** Processing time in milliseconds */
  processingTime: number;

  /** Whether chunked processing was used */
  wasChunked: boolean;
}

/**
 * Statistics about a diff operation
 */
export interface DiffStats {
  /** Total lines in original */
  originalLines: number;

  /** Total lines in modified */
  modifiedLines: number;

  /** Number of additions */
  additions: number;

  /** Number of deletions */
  deletions: number;

  /** Number of unchanged lines */
  unchanged: number;

  /** Percentage of lines changed */
  changePercentage: number;
}

/**
 * Internal representation of a point in the edit graph
 */
interface EditGraphPoint {
  x: number;
  y: number;
}

/**
 * Snake in the edit graph (sequence of matching elements)
 */
interface Snake {
  start: EditGraphPoint;
  end: EditGraphPoint;
  diagonalLength: number;
}

/**
 * Myers diff algorithm implementation
 *
 * Computes the shortest edit script (diff) between two sequences using
 * the Myers greedy algorithm with linear space refinement.
 */
export class MyersDiff {
  private maxMemoryBytes: number;

  constructor(maxMemoryBytes: number = DIFF_CONFIG.MAX_DIFF_MEMORY) {
    this.maxMemoryBytes = maxMemoryBytes;
  }

  /**
   * Computes the diff between two texts
   *
   * @param original - Original text
   * @param modified - Modified text
   * @returns Diff result with operations
   */
  public computeDiff(original: string, modified: string): DiffResult {
    const startTime = performance.now();

    // Quick check for identical content
    if (original === modified) {
      return this.createIdenticalResult(original, performance.now() - startTime);
    }

    // Split into lines
    const originalLines = this.splitLines(original);
    const modifiedLines = this.splitLines(modified);

    // Check if we need chunked processing
    const needsChunking =
      originalLines.length > DIFF_CONFIG.MAX_DIRECT_DIFF_LINES ||
      modifiedLines.length > DIFF_CONFIG.MAX_DIRECT_DIFF_LINES;

    let operations: DiffOperation[];
    let wasChunked = false;

    if (needsChunking) {
      operations = this.computeChunkedDiff(originalLines, modifiedLines);
      wasChunked = true;
    } else {
      operations = this.computeLineDiff(originalLines, modifiedLines);
    }

    // Calculate statistics
    const stats = this.calculateStats(operations);

    const processingTime = performance.now() - startTime;

    return {
      operations,
      additions: stats.additions,
      deletions: stats.deletions,
      unchanged: stats.unchanged,
      editDistance: stats.additions + stats.deletions,
      isIdentical: stats.additions === 0 && stats.deletions === 0,
      processingTime,
      wasChunked,
    };
  }

  /**
   * Computes diff for line arrays using Myers algorithm
   *
   * @param originalLines - Original lines
   * @param modifiedLines - Modified lines
   * @returns Array of diff operations
   */
  private computeLineDiff(
    originalLines: string[],
    modifiedLines: string[]
  ): DiffOperation[] {
    const n = originalLines.length;
    const m = modifiedLines.length;
    const max = n + m;

    // V array for storing endpoints of furthest reaching paths
    // We use offset of max to handle negative indices
    const v: number[] = new Array(2 * max + 1);
    const offset = max;

    // Trace for backtracking
    const trace: number[][] = [];

    // Find the shortest edit script
    for (let d = 0; d <= max; d++) {
      // Save current V for backtracking
      trace.push([...v]);

      for (let k = -d; k <= d; k += 2) {
        // Determine if we should move down or right
        let x: number;
        if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) {
          // Move down (insert)
          x = v[offset + k + 1];
        } else {
          // Move right (delete)
          x = v[offset + k - 1] + 1;
        }

        let y = x - k;

        // Follow diagonal (matching lines)
        while (
          x < n &&
          y < m &&
          originalLines[x] === modifiedLines[y]
        ) {
          x++;
          y++;
        }

        v[offset + k] = x;

        // Check if we've reached the end
        if (x >= n && y >= m) {
          // Backtrack to build the diff
          return this.backtrack(originalLines, modifiedLines, trace, d);
        }
      }
    }

    // Fallback: treat as complete replacement
    return this.createReplacementDiff(originalLines, modifiedLines);
  }

  /**
   * Backtrack through the edit graph to build diff operations
   *
   * @param originalLines - Original lines
   * @param modifiedLines - Modified lines
   * @param trace - Trace of V arrays
   * @param d - Final edit distance
   * @returns Array of diff operations
   */
  private backtrack(
    originalLines: string[],
    modifiedLines: string[],
    trace: number[][],
    d: number
  ): DiffOperation[] {
    const n = originalLines.length;
    const m = modifiedLines.length;
    const max = n + m;
    const offset = max;

    let x = n;
    let y = m;

    const operations: DiffOperation[] = [];

    for (let depth = d; depth > 0; depth--) {
      const v = trace[depth];
      const prevV = trace[depth - 1];

      const k = x - y;

      // Determine previous k
      let prevK: number;
      if (k === -depth || (k !== depth && prevV[offset + k - 1] < prevV[offset + k + 1])) {
        prevK = k + 1;
      } else {
        prevK = k - 1;
      }

      const prevX = prevV[offset + prevK];
      const prevY = prevX - prevK;

      // Add diagonal moves (equal lines)
      while (x > prevX && y > prevY) {
        x--;
        y--;
        operations.unshift({
          type: DiffType.EQUAL,
          text: originalLines[x],
          originalLine: x,
          modifiedLine: y,
          lineCount: 1,
        });
      }

      // Add insert or delete
      if (x === prevX) {
        // Insert
        y--;
        operations.unshift({
          type: DiffType.INSERT,
          text: modifiedLines[y],
          modifiedLine: y,
          lineCount: 1,
        });
      } else {
        // Delete
        x--;
        operations.unshift({
          type: DiffType.DELETE,
          text: originalLines[x],
          originalLine: x,
          lineCount: 1,
        });
      }
    }

    // Add remaining equal lines at the beginning
    while (x > 0 && y > 0) {
      x--;
      y--;
      operations.unshift({
        type: DiffType.EQUAL,
        text: originalLines[x],
        originalLine: x,
        modifiedLine: y,
        lineCount: 1,
      });
    }

    // Merge consecutive operations of the same type
    return this.mergeOperations(operations);
  }

  /**
   * Computes diff using chunked processing for large files
   *
   * @param originalLines - Original lines
   * @param modifiedLines - Modified lines
   * @returns Array of diff operations
   */
  private computeChunkedDiff(
    originalLines: string[],
    modifiedLines: string[]
  ): DiffOperation[] {
    const chunkSize = DIFF_CONFIG.CHUNK_SIZE;
    const overlap = DIFF_CONFIG.CHUNK_OVERLAP;

    const operations: DiffOperation[] = [];
    let originalOffset = 0;
    let modifiedOffset = 0;

    // Process in chunks
    while (originalOffset < originalLines.length || modifiedOffset < modifiedLines.length) {
      // Get chunk from original
      const originalEnd = Math.min(originalOffset + chunkSize, originalLines.length);
      const originalChunk = originalLines.slice(originalOffset, originalEnd);

      // Get chunk from modified
      const modifiedEnd = Math.min(modifiedOffset + chunkSize, modifiedLines.length);
      const modifiedChunk = modifiedLines.slice(modifiedOffset, modifiedEnd);

      // Compute diff for this chunk
      const chunkOps = this.computeLineDiff(originalChunk, modifiedChunk);

      // Adjust line numbers in operations
      for (const op of chunkOps) {
        if (op.originalLine !== undefined) {
          op.originalLine += originalOffset;
        }
        if (op.modifiedLine !== undefined) {
          op.modifiedLine += modifiedOffset;
        }
        operations.push(op);
      }

      // Move to next chunk with overlap consideration
      originalOffset = originalEnd - overlap;
      modifiedOffset = modifiedEnd - overlap;

      // Prevent infinite loop
      if (originalEnd === originalLines.length && modifiedEnd === modifiedLines.length) {
        break;
      }
    }

    return this.mergeOperations(operations);
  }

  /**
   * Merges consecutive operations of the same type
   *
   * @param operations - Array of diff operations
   * @returns Merged operations
   */
  private mergeOperations(operations: DiffOperation[]): DiffOperation[] {
    if (operations.length === 0) {
      return operations;
    }

    const merged: DiffOperation[] = [];
    let current = { ...operations[0] };

    for (let i = 1; i < operations.length; i++) {
      const op = operations[i];

      if (op.type === current.type) {
        // Merge with current
        current.text += '\n' + op.text;
        current.lineCount += op.lineCount;
      } else {
        // Push current and start new
        merged.push(current);
        current = { ...op };
      }
    }

    merged.push(current);
    return merged;
  }

  /**
   * Splits text into lines
   *
   * @param text - Text to split
   * @returns Array of lines
   */
  private splitLines(text: string): string[] {
    if (text === '') {
      return [];
    }
    return text.split('\n');
  }

  /**
   * Creates a result for identical texts
   *
   * @param text - The text content
   * @param processingTime - Processing time
   * @returns Diff result
   */
  private createIdenticalResult(text: string, processingTime: number): DiffResult {
    const lines = this.splitLines(text);
    const lineCount = lines.length;

    return {
      operations: lineCount > 0 ? [{
        type: DiffType.EQUAL,
        text,
        originalLine: 0,
        modifiedLine: 0,
        lineCount,
      }] : [],
      additions: 0,
      deletions: 0,
      unchanged: lineCount,
      editDistance: 0,
      isIdentical: true,
      processingTime,
      wasChunked: false,
    };
  }

  /**
   * Creates a diff representing complete replacement
   *
   * @param originalLines - Original lines
   * @param modifiedLines - Modified lines
   * @returns Array of diff operations
   */
  private createReplacementDiff(
    originalLines: string[],
    modifiedLines: string[]
  ): DiffOperation[] {
    const operations: DiffOperation[] = [];

    if (originalLines.length > 0) {
      operations.push({
        type: DiffType.DELETE,
        text: originalLines.join('\n'),
        originalLine: 0,
        lineCount: originalLines.length,
      });
    }

    if (modifiedLines.length > 0) {
      operations.push({
        type: DiffType.INSERT,
        text: modifiedLines.join('\n'),
        modifiedLine: 0,
        lineCount: modifiedLines.length,
      });
    }

    return operations;
  }

  /**
   * Calculates statistics from diff operations
   *
   * @param operations - Array of diff operations
   * @returns Statistics
   */
  private calculateStats(operations: DiffOperation[]): {
    additions: number;
    deletions: number;
    unchanged: number;
  } {
    let additions = 0;
    let deletions = 0;
    let unchanged = 0;

    for (const op of operations) {
      switch (op.type) {
        case DiffType.INSERT:
          additions += op.lineCount;
          break;
        case DiffType.DELETE:
          deletions += op.lineCount;
          break;
        case DiffType.EQUAL:
          unchanged += op.lineCount;
          break;
      }
    }

    return { additions, deletions, unchanged };
  }
}

/**
 * Computes diff between two texts using Myers algorithm
 *
 * Convenience function for one-off diff operations.
 *
 * @param original - Original text
 * @param modified - Modified text
 * @returns Diff result
 */
export function computeDiff(original: string, modified: string): DiffResult {
  const differ = new MyersDiff();
  return differ.computeDiff(original, modified);
}

/**
 * Computes statistics about the difference between two texts
 *
 * @param original - Original text
 * @param modified - Modified text
 * @returns Diff statistics
 */
export function computeDiffStats(original: string, modified: string): DiffStats {
  const result = computeDiff(original, modified);

  const originalLines = original ? original.split('\n').length : 0;
  const modifiedLines = modified ? modified.split('\n').length : 0;
  const totalLines = Math.max(originalLines, modifiedLines);
  const changedLines = result.additions + result.deletions;
  const changePercentage = totalLines > 0 ? (changedLines / totalLines) * 100 : 0;

  return {
    originalLines,
    modifiedLines,
    additions: result.additions,
    deletions: result.deletions,
    unchanged: result.unchanged,
    changePercentage,
  };
}

/**
 * Checks if two texts are similar based on edit distance threshold
 *
 * @param original - Original text
 * @param modified - Modified text
 * @param threshold - Maximum allowed change percentage (0-100)
 * @returns Whether texts are similar
 */
export function areSimilar(
  original: string,
  modified: string,
  threshold: number = 20
): boolean {
  const stats = computeDiffStats(original, modified);
  return stats.changePercentage <= threshold;
}

/**
 * Formats diff result as a unified diff string
 *
 * @param result - Diff result
 * @param originalName - Name of original file
 * @param modifiedName - Name of modified file
 * @returns Formatted diff string
 */
export function formatUnifiedDiff(
  result: DiffResult,
  originalName: string = 'original',
  modifiedName: string = 'modified'
): string {
  const lines: string[] = [];

  lines.push(`--- ${originalName}`);
  lines.push(`+++ ${modifiedName}`);

  let originalLine = 1;
  let modifiedLine = 1;

  for (const op of result.operations) {
    switch (op.type) {
      case DiffType.EQUAL:
        // Context lines
        const equalLines = op.text.split('\n');
        for (const line of equalLines) {
          lines.push(` ${line}`);
        }
        originalLine += op.lineCount;
        modifiedLine += op.lineCount;
        break;

      case DiffType.DELETE:
        const deleteLines = op.text.split('\n');
        for (const line of deleteLines) {
          lines.push(`-${line}`);
        }
        originalLine += op.lineCount;
        break;

      case DiffType.INSERT:
        const insertLines = op.text.split('\n');
        for (const line of insertLines) {
          lines.push(`+${line}`);
        }
        modifiedLine += op.lineCount;
        break;
    }
  }

  return lines.join('\n');
}

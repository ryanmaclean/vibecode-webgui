/**
 * File Chunking Constants and Utilities
 *
 * Centralized file chunking configuration to optimize performance when working
 * with large files in the editor and AI operations.
 *
 * Performance considerations:
 * - Chunk sizes are optimized for editor rendering and AI processing
 * - Memory usage is bounded by maximum chunk size limits
 * - Overlap ensures context continuity across chunks
 * - Resource-specific limits based on typical use cases
 */

/**
 * Default chunk sizes by operation type (in lines)
 * Optimized for different use cases and performance characteristics
 */
export const DEFAULT_CHUNK_SIZE = {
  /** General editor operations - balanced for rendering */
  EDITOR: 1000,

  /** Syntax highlighting - smaller chunks for faster processing */
  SYNTAX_HIGHLIGHT: 500,

  /** AI operations - larger chunks for better context */
  AI_PROCESSING: 2000,

  /** Search/grep operations - medium chunks */
  SEARCH: 1500,

  /** Diff operations - smaller chunks for accuracy */
  DIFF: 500,

  /** File analysis - larger chunks for overview */
  ANALYSIS: 3000,
} as const;

/**
 * Maximum chunk sizes by operation type (in lines)
 * Upper bounds to prevent memory exhaustion
 */
export const MAX_CHUNK_SIZE = {
  /** Maximum for general operations */
  DEFAULT: 5000,

  /** Editor rendering - prevent UI freezing */
  EDITOR: 5000,

  /** Syntax highlighting - prevent worker overload */
  SYNTAX_HIGHLIGHT: 2000,

  /** AI operations - balance context vs. token limits */
  AI_PROCESSING: 10000,

  /** Search operations */
  SEARCH: 5000,

  /** Diff operations */
  DIFF: 2000,

  /** File analysis */
  ANALYSIS: 10000,
} as const;

/**
 * Minimum chunk sizes by operation type (in lines)
 * Lower bounds to ensure meaningful chunks
 */
export const MIN_CHUNK_SIZE = {
  /** Minimum for general operations */
  DEFAULT: 100,

  /** Editor rendering */
  EDITOR: 100,

  /** Syntax highlighting */
  SYNTAX_HIGHLIGHT: 50,

  /** AI operations - ensure enough context */
  AI_PROCESSING: 500,

  /** Search operations */
  SEARCH: 100,

  /** Diff operations */
  DIFF: 50,

  /** File analysis */
  ANALYSIS: 200,
} as const;

/**
 * Overlap sizes for maintaining context between chunks (in lines)
 * Prevents context loss at chunk boundaries
 */
export const CHUNK_OVERLAP = {
  /** Default overlap */
  DEFAULT: 50,

  /** Editor operations - minimal overlap */
  EDITOR: 20,

  /** Syntax highlighting - overlap for highlighting context */
  SYNTAX_HIGHLIGHT: 10,

  /** AI operations - larger overlap for context continuity */
  AI_PROCESSING: 100,

  /** Search operations - overlap for match context */
  SEARCH: 25,

  /** Diff operations - overlap for diff context */
  DIFF: 5,

  /** File analysis - larger overlap for analysis context */
  ANALYSIS: 50,
} as const;

/**
 * Performance thresholds for determining when to use chunking
 */
export const CHUNKING_THRESHOLDS = {
  /** Files larger than this should be chunked (in lines) */
  LARGE_FILE: 1000,

  /** Files larger than this MUST be chunked (in lines) */
  VERY_LARGE_FILE: 10000,

  /** Maximum file size to process without chunking (in bytes) */
  MAX_NON_CHUNKED_SIZE: 1024 * 1024, // 1MB

  /** Maximum total file size to process (in bytes) */
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
} as const;

/**
 * Represents a chunk of file content
 */
export interface FileChunk {
  /** Chunk identifier (0-based index) */
  index: number;

  /** Starting line number (0-based) */
  startLine: number;

  /** Ending line number (0-based, exclusive) */
  endLine: number;

  /** Number of lines in this chunk */
  lineCount: number;

  /** The actual content of the chunk */
  content: string;

  /** Whether this chunk has overlap with the previous chunk */
  hasOverlapStart: boolean;

  /** Whether this chunk has overlap with the next chunk */
  hasOverlapEnd: boolean;

  /** Number of overlapping lines at the start */
  overlapStartLines: number;

  /** Number of overlapping lines at the end */
  overlapEndLines: number;
}

/**
 * Metadata about the chunked file
 */
export interface ChunkMetadata {
  /** Total number of chunks */
  totalChunks: number;

  /** Total number of lines in the file */
  totalLines: number;

  /** Total size in bytes */
  totalBytes: number;

  /** Chunk size used (in lines) */
  chunkSize: number;

  /** Overlap size used (in lines) */
  overlapSize: number;

  /** Operation type this chunking is optimized for */
  operationType: keyof typeof DEFAULT_CHUNK_SIZE;

  /** Whether the file was actually chunked */
  isChunked: boolean;
}

/**
 * Complete result of chunking operation
 */
export interface ChunkedFile {
  /** Array of file chunks */
  chunks: FileChunk[];

  /** Metadata about the chunking operation */
  metadata: ChunkMetadata;
}

/**
 * Parameters for chunk creation
 */
export interface ChunkParams {
  /** Desired chunk size in lines */
  chunkSize?: number;

  /** Desired overlap size in lines */
  overlapSize?: number;

  /** Operation type to optimize for */
  operationType?: keyof typeof DEFAULT_CHUNK_SIZE;

  /** Force chunking even for small files */
  forceChunking?: boolean;
}

/**
 * Validates and normalizes chunk parameters
 *
 * @param params - Raw chunk parameters
 * @param operationType - Default operation type if not specified
 * @returns Normalized chunk parameters
 */
export function validateChunkParams(
  params: ChunkParams = {},
  operationType: keyof typeof DEFAULT_CHUNK_SIZE = 'EDITOR'
): Required<Omit<ChunkParams, 'forceChunking'>> & Pick<ChunkParams, 'forceChunking'> {
  const opType = params.operationType || operationType;

  // Get default and bounds for the operation type
  const defaultSize = DEFAULT_CHUNK_SIZE[opType];
  const minSize = MIN_CHUNK_SIZE[opType];
  const maxSize = MAX_CHUNK_SIZE[opType];
  const defaultOverlap = CHUNK_OVERLAP[opType];

  // Validate and normalize chunk size
  let chunkSize = params.chunkSize !== undefined ? params.chunkSize : defaultSize;
  if (chunkSize < minSize) {
    chunkSize = minSize;
  } else if (chunkSize > maxSize) {
    chunkSize = maxSize;
  }

  // Validate and normalize overlap size
  let overlapSize = params.overlapSize !== undefined ? params.overlapSize : defaultOverlap;
  // Overlap cannot be larger than half the chunk size
  const maxOverlap = Math.floor(chunkSize / 2);
  if (overlapSize < 0) {
    overlapSize = 0;
  } else if (overlapSize > maxOverlap) {
    overlapSize = maxOverlap;
  }

  return {
    chunkSize,
    overlapSize,
    operationType: opType,
    forceChunking: params.forceChunking,
  };
}

/**
 * Determines if a file should be chunked based on its size
 *
 * @param lineCount - Number of lines in the file
 * @param byteSize - Size of the file in bytes
 * @param forceChunking - Force chunking regardless of size
 * @returns Whether the file should be chunked
 */
export function shouldChunkFile(
  lineCount: number,
  byteSize: number,
  forceChunking: boolean = false
): boolean {
  if (forceChunking) {
    return true;
  }

  // Check if file exceeds size thresholds
  if (lineCount >= CHUNKING_THRESHOLDS.LARGE_FILE) {
    return true;
  }

  if (byteSize >= CHUNKING_THRESHOLDS.MAX_NON_CHUNKED_SIZE) {
    return true;
  }

  return false;
}

/**
 * Splits file content into chunks with optional overlap
 *
 * @param content - The complete file content
 * @param params - Chunking parameters
 * @returns Chunked file with metadata
 */
export function chunkFileContent(
  content: string,
  params: ChunkParams = {}
): ChunkedFile {
  const lines = content.split('\n');
  const totalLines = lines.length;
  const totalBytes = new Blob([content]).size;

  // Validate and normalize parameters
  const validatedParams = validateChunkParams(params);
  const { chunkSize, overlapSize, operationType, forceChunking } = validatedParams;

  // Determine if chunking is needed
  const isChunked = shouldChunkFile(totalLines, totalBytes, forceChunking);

  // If not chunked, return single chunk
  if (!isChunked) {
    return {
      chunks: [
        {
          index: 0,
          startLine: 0,
          endLine: totalLines,
          lineCount: totalLines,
          content,
          hasOverlapStart: false,
          hasOverlapEnd: false,
          overlapStartLines: 0,
          overlapEndLines: 0,
        },
      ],
      metadata: {
        totalChunks: 1,
        totalLines,
        totalBytes,
        chunkSize,
        overlapSize,
        operationType,
        isChunked: false,
      },
    };
  }

  // Create chunks with overlap
  const chunks: FileChunk[] = [];
  let currentLine = 0;

  while (currentLine < totalLines) {
    const chunkIndex = chunks.length;

    // Calculate start line (including overlap from previous chunk)
    const startLine = chunkIndex === 0 ? 0 : Math.max(0, currentLine - overlapSize);

    // Calculate end line
    const endLine = Math.min(currentLine + chunkSize, totalLines);

    // Extract chunk content
    const chunkLines = lines.slice(startLine, endLine);
    const chunkContent = chunkLines.join('\n');

    // Determine overlap information
    const hasOverlapStart = chunkIndex > 0 && overlapSize > 0;
    const hasOverlapEnd = endLine < totalLines && overlapSize > 0;
    const overlapStartLines = hasOverlapStart ? Math.min(overlapSize, startLine) : 0;
    const overlapEndLines = hasOverlapEnd ? Math.min(overlapSize, totalLines - endLine) : 0;

    chunks.push({
      index: chunkIndex,
      startLine,
      endLine,
      lineCount: endLine - startLine,
      content: chunkContent,
      hasOverlapStart,
      hasOverlapEnd,
      overlapStartLines,
      overlapEndLines,
    });

    // Move to next chunk (accounting for overlap)
    currentLine = endLine;
  }

  return {
    chunks,
    metadata: {
      totalChunks: chunks.length,
      totalLines,
      totalBytes,
      chunkSize,
      overlapSize,
      operationType,
      isChunked: true,
    },
  };
}

/**
 * Gets a specific chunk by index
 *
 * @param chunkedFile - The chunked file
 * @param index - Chunk index to retrieve
 * @returns The requested chunk or undefined if index is out of bounds
 */
export function getChunk(chunkedFile: ChunkedFile, index: number): FileChunk | undefined {
  if (index < 0 || index >= chunkedFile.chunks.length) {
    return undefined;
  }
  return chunkedFile.chunks[index];
}

/**
 * Gets chunks in a specific line range
 *
 * @param chunkedFile - The chunked file
 * @param startLine - Start line (inclusive)
 * @param endLine - End line (exclusive)
 * @returns Array of chunks that overlap with the line range
 */
export function getChunksInRange(
  chunkedFile: ChunkedFile,
  startLine: number,
  endLine: number
): FileChunk[] {
  return chunkedFile.chunks.filter(
    (chunk) =>
      // Chunk overlaps with the requested range
      chunk.startLine < endLine && chunk.endLine > startLine
  );
}

/**
 * Reassembles chunks back into complete content
 *
 * @param chunks - Array of chunks to reassemble
 * @param removeOverlap - Whether to remove overlap when reassembling
 * @returns Reassembled content
 */
export function reassembleChunks(chunks: FileChunk[], removeOverlap: boolean = true): string {
  if (chunks.length === 0) {
    return '';
  }

  if (chunks.length === 1) {
    return chunks[0].content;
  }

  // Sort chunks by index to ensure correct order
  const sortedChunks = [...chunks].sort((a, b) => a.index - b.index);

  if (!removeOverlap) {
    // Simple concatenation
    return sortedChunks.map((chunk) => chunk.content).join('\n');
  }

  // Remove overlap during reassembly
  const parts: string[] = [];

  for (let i = 0; i < sortedChunks.length; i++) {
    const chunk = sortedChunks[i];
    const lines = chunk.content.split('\n');

    if (i === 0) {
      // First chunk - include everything
      parts.push(chunk.content);
    } else {
      // Subsequent chunks - skip overlap lines
      const skipLines = chunk.overlapStartLines;
      const relevantLines = lines.slice(skipLines);
      if (relevantLines.length > 0) {
        parts.push(relevantLines.join('\n'));
      }
    }
  }

  return parts.join('\n');
}

/**
 * Estimates memory usage for chunking operation
 *
 * @param totalBytes - Total file size in bytes
 * @param chunkSize - Chunk size in lines
 * @param averageLineLength - Average line length in bytes
 * @returns Estimated memory usage in bytes
 */
export function estimateChunkMemoryUsage(
  totalBytes: number,
  chunkSize: number,
  averageLineLength: number = 80
): number {
  // Estimate number of chunks
  const estimatedLines = Math.ceil(totalBytes / averageLineLength);
  const estimatedChunks = Math.ceil(estimatedLines / chunkSize);

  // Memory for chunk metadata (rough estimate)
  const metadataPerChunk = 200; // bytes for FileChunk object overhead

  // Total memory estimate
  const contentMemory = totalBytes; // Original content
  const chunkMemory = estimatedChunks * chunkSize * averageLineLength; // Chunked content
  const metadataMemory = estimatedChunks * metadataPerChunk;

  return contentMemory + chunkMemory + metadataMemory;
}

/**
 * Checks if estimated memory usage is within safe limits
 *
 * @param totalBytes - Total file size in bytes
 * @param chunkSize - Chunk size in lines
 * @param memoryLimit - Memory limit in bytes (default 512MB)
 * @returns Whether the operation is within memory limits
 */
export function isWithinMemoryLimits(
  totalBytes: number,
  chunkSize: number,
  memoryLimit: number = 512 * 1024 * 1024 // 512MB default
): boolean {
  const estimatedUsage = estimateChunkMemoryUsage(totalBytes, chunkSize);
  return estimatedUsage <= memoryLimit;
}

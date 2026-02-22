/**
 * Syntax Highlighting Web Worker
 *
 * Offloads syntax highlighting computation from the main thread to prevent UI freezing
 * when working with large files. Processes file chunks and returns tokenized/highlighted
 * content without blocking the editor.
 *
 * Key features:
 * - Processes file chunks independently for parallelization
 * - Memory-efficient incremental processing
 * - Language-aware tokenization
 * - Progress reporting for long-running operations
 */

import type { FileChunk } from '../lib/editor/file-chunking';

/**
 * Message types for worker communication
 */
export type WorkerMessageType =
  | 'HIGHLIGHT_CHUNK'
  | 'HIGHLIGHT_COMPLETE'
  | 'HIGHLIGHT_ERROR'
  | 'CANCEL'
  | 'PROGRESS';

/**
 * Input message for highlighting a chunk
 */
export interface HighlightChunkMessage {
  type: 'HIGHLIGHT_CHUNK';
  payload: {
    chunk: FileChunk;
    language: string;
    chunkId: string;
  };
}

/**
 * Response message for completed highlighting
 */
export interface HighlightCompleteMessage {
  type: 'HIGHLIGHT_COMPLETE';
  payload: {
    chunk: FileChunk;
    tokens: TokenizedLine[];
    chunkId: string;
    duration: number;
  };
}

/**
 * Error message from worker
 */
export interface HighlightErrorMessage {
  type: 'HIGHLIGHT_ERROR';
  payload: {
    chunkId: string;
    error: string;
  };
}

/**
 * Progress update message
 */
export interface ProgressMessage {
  type: 'PROGRESS';
  payload: {
    chunkId: string;
    linesProcessed: number;
    totalLines: number;
  };
}

/**
 * Cancel message to stop processing
 */
export interface CancelMessage {
  type: 'CANCEL';
  payload: {
    chunkId?: string;
  };
}

/**
 * Union type for all worker messages
 */
export type WorkerMessage =
  | HighlightChunkMessage
  | HighlightCompleteMessage
  | HighlightErrorMessage
  | ProgressMessage
  | CancelMessage;

/**
 * Represents a tokenized line of code
 */
export interface TokenizedLine {
  lineNumber: number;
  tokens: Token[];
}

/**
 * Represents a single token in a line
 */
export interface Token {
  type: TokenType;
  value: string;
  startColumn: number;
  endColumn: number;
}

/**
 * Token types for syntax highlighting
 */
export type TokenType =
  | 'keyword'
  | 'identifier'
  | 'string'
  | 'number'
  | 'comment'
  | 'operator'
  | 'punctuation'
  | 'whitespace'
  | 'type'
  | 'function'
  | 'variable'
  | 'constant'
  | 'property'
  | 'parameter'
  | 'class'
  | 'interface'
  | 'namespace'
  | 'decorator'
  | 'regex'
  | 'unknown';

/**
 * Simple tokenizer for basic syntax highlighting
 * This is a lightweight implementation - Monaco will handle full highlighting
 * This worker is primarily for pre-processing and chunking large files
 */
function tokenizeLine(line: string, lineNumber: number, language: string): TokenizedLine {
  const tokens: Token[] = [];

  // Simple whitespace-based tokenization for now
  // In production, this would integrate with Monaco's tokenizer or a dedicated library
  let currentColumn = 0;

  // Split by whitespace but preserve it
  const parts = line.split(/(\s+)/);

  for (const part of parts) {
    if (part.length === 0) continue;

    const isWhitespace = /^\s+$/.test(part);
    const type = isWhitespace ? 'whitespace' : detectTokenType(part, language);

    tokens.push({
      type,
      value: part,
      startColumn: currentColumn,
      endColumn: currentColumn + part.length,
    });

    currentColumn += part.length;
  }

  return {
    lineNumber,
    tokens,
  };
}

/**
 * Detects the type of a token based on content and language
 * This is a basic implementation - Monaco provides more sophisticated tokenization
 */
function detectTokenType(token: string, language: string): TokenType {
  // Keywords (TypeScript/JavaScript)
  const keywords = new Set([
    'const', 'let', 'var', 'function', 'class', 'interface', 'type', 'enum',
    'import', 'export', 'default', 'from', 'as', 'if', 'else', 'for', 'while',
    'do', 'switch', 'case', 'break', 'continue', 'return', 'throw', 'try',
    'catch', 'finally', 'async', 'await', 'yield', 'new', 'delete', 'typeof',
    'instanceof', 'void', 'this', 'super', 'extends', 'implements', 'public',
    'private', 'protected', 'static', 'readonly', 'abstract', 'namespace',
  ]);

  // Check for keywords
  if (keywords.has(token)) {
    return 'keyword';
  }

  // Check for strings
  if (/^["'`]/.test(token)) {
    return 'string';
  }

  // Check for numbers
  if (/^\d+(\.\d+)?$/.test(token)) {
    return 'number';
  }

  // Check for comments
  if (/^(\/\/|\/\*|\*\/|\*)/.test(token)) {
    return 'comment';
  }

  // Check for operators
  if (/^[+\-*/%=<>!&|^~?:]+$/.test(token)) {
    return 'operator';
  }

  // Check for punctuation
  if (/^[{}()\[\];,.]$/.test(token)) {
    return 'punctuation';
  }

  // Check for function calls (identifier followed by parenthesis)
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*\($/.test(token)) {
    return 'function';
  }

  // Check for types (PascalCase)
  if (/^[A-Z][a-zA-Z0-9]*$/.test(token)) {
    return 'type';
  }

  // Check for constants (UPPER_CASE)
  if (/^[A-Z][A-Z0-9_]*$/.test(token)) {
    return 'constant';
  }

  // Check for identifiers
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(token)) {
    return 'identifier';
  }

  return 'unknown';
}

/**
 * Process a chunk of code for syntax highlighting
 */
function processChunk(
  chunk: FileChunk,
  language: string,
  chunkId: string,
  onProgress?: (linesProcessed: number, totalLines: number) => void
): TokenizedLine[] {
  const lines = chunk.content.split('\n');
  const tokenizedLines: TokenizedLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const absoluteLineNumber = chunk.startLine + i;
    const tokenizedLine = tokenizeLine(lines[i], absoluteLineNumber, language);
    tokenizedLines.push(tokenizedLine);

    // Report progress every 100 lines
    if (onProgress && i % 100 === 0) {
      onProgress(i + 1, lines.length);
    }
  }

  return tokenizedLines;
}

/**
 * Active processing state
 */
let activeProcessing: Set<string> = new Set();

/**
 * Worker message handler
 */
self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  switch (message.type) {
    case 'HIGHLIGHT_CHUNK': {
      const { chunk, language, chunkId } = message.payload;

      // Track active processing
      activeProcessing.add(chunkId);

      const startTime = performance.now();

      try {
        // Process the chunk with progress reporting
        const tokens = processChunk(chunk, language, chunkId, (linesProcessed, totalLines) => {
          // Send progress update
          if (activeProcessing.has(chunkId)) {
            const progressMessage: ProgressMessage = {
              type: 'PROGRESS',
              payload: {
                chunkId,
                linesProcessed,
                totalLines,
              },
            };
            self.postMessage(progressMessage);
          }
        });

        const duration = performance.now() - startTime;

        // Check if still active (not cancelled)
        if (activeProcessing.has(chunkId)) {
          const response: HighlightCompleteMessage = {
            type: 'HIGHLIGHT_COMPLETE',
            payload: {
              chunk,
              tokens,
              chunkId,
              duration,
            },
          };

          self.postMessage(response);
        }
      } catch (error) {
        const errorMessage: HighlightErrorMessage = {
          type: 'HIGHLIGHT_ERROR',
          payload: {
            chunkId,
            error: error instanceof Error ? error.message : String(error),
          },
        };

        self.postMessage(errorMessage);
      } finally {
        // Clean up
        activeProcessing.delete(chunkId);
      }

      break;
    }

    case 'CANCEL': {
      const { chunkId } = message.payload;

      if (chunkId) {
        // Cancel specific chunk
        activeProcessing.delete(chunkId);
      } else {
        // Cancel all processing
        activeProcessing.clear();
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

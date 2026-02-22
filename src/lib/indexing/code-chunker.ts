/**
 * Code Chunker for Semantic Indexing
 * Intelligently splits source code into chunks for embedding generation
 */

import { TokenCounter } from '../ai/context/token-counter'

/**
 * Language detected from file extension
 */
export enum CodeLanguage {
  TYPESCRIPT = 'typescript',
  JAVASCRIPT = 'javascript',
  PYTHON = 'python',
  GO = 'go',
  RUST = 'rust',
  JAVA = 'java',
  CPP = 'cpp',
  C = 'c',
  MARKDOWN = 'markdown',
  UNKNOWN = 'unknown',
}

/**
 * Configuration for chunking behavior
 */
export interface ChunkingConfig {
  /** Target tokens per chunk (default: 500) */
  targetTokensPerChunk?: number
  /** Maximum tokens per chunk (default: 1000) */
  maxTokensPerChunk?: number
  /** Minimum tokens per chunk (default: 50) */
  minTokensPerChunk?: number
  /** Number of lines to overlap between chunks (default: 15) */
  overlapLines?: number
  /** Model to use for token counting (default: 'gpt-4') */
  model?: string
}

/**
 * A chunk of code with metadata
 */
export interface CodeChunk {
  content: string
  startLine: number
  endLine: number
  tokens: number
  language: CodeLanguage
  hasImports: boolean
}

/**
 * Language-specific patterns for detecting code boundaries
 */
interface LanguagePatterns {
  functionPattern?: RegExp
  classPattern?: RegExp
  importPattern?: RegExp
  commentPattern?: RegExp
}

const LANGUAGE_PATTERNS: Record<CodeLanguage, LanguagePatterns> = {
  [CodeLanguage.TYPESCRIPT]: {
    functionPattern: /^(?:export\s+)?(?:async\s+)?(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s+)?\()/m,
    classPattern: /^(?:export\s+)?(?:abstract\s+)?class\s+\w+/m,
    importPattern: /^import\s+.+from\s+['"].+['"]|^import\s+['"].+['"]|^export\s+.+from\s+['"].+['"]/m,
    commentPattern: /^\/\/|^\/\*|^\*/m,
  },
  [CodeLanguage.JAVASCRIPT]: {
    functionPattern: /^(?:export\s+)?(?:async\s+)?(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s+)?\()/m,
    classPattern: /^(?:export\s+)?class\s+\w+/m,
    importPattern: /^import\s+.+from\s+['"].+['"]|^import\s+['"].+['"]|^export\s+.+from\s+['"].+['"]/m,
    commentPattern: /^\/\/|^\/\*|^\*/m,
  },
  [CodeLanguage.PYTHON]: {
    functionPattern: /^(?:async\s+)?def\s+\w+/m,
    classPattern: /^class\s+\w+/m,
    importPattern: /^import\s+\w+|^from\s+[\w.]+\s+import/m,
    commentPattern: /^#|^"""|^'''/m,
  },
  [CodeLanguage.GO]: {
    functionPattern: /^func\s+(?:\(\w+\s+\*?\w+\)\s+)?\w+/m,
    classPattern: /^type\s+\w+\s+struct/m,
    importPattern: /^import\s+\(|^import\s+".*"/m,
    commentPattern: /^\/\/|^\/\*/m,
  },
  [CodeLanguage.RUST]: {
    functionPattern: /^(?:pub\s+)?(?:async\s+)?fn\s+\w+/m,
    classPattern: /^(?:pub\s+)?struct\s+\w+|^(?:pub\s+)?enum\s+\w+/m,
    importPattern: /^use\s+[\w:]+/m,
    commentPattern: /^\/\/|^\/\*|^\/\/!/m,
  },
  [CodeLanguage.JAVA]: {
    functionPattern: /^(?:public|private|protected)\s+(?:static\s+)?(?:\w+\s+)?[\w<>]+\s+\w+\s*\(/m,
    classPattern: /^(?:public|private|protected)\s+(?:abstract\s+)?class\s+\w+/m,
    importPattern: /^import\s+[\w.]+/m,
    commentPattern: /^\/\/|^\/\*|^\*/m,
  },
  [CodeLanguage.CPP]: {
    functionPattern: /^(?:inline\s+)?(?:virtual\s+)?(?:\w+\s+)?[\w:]+\s+\w+\s*\(/m,
    classPattern: /^(?:template\s+<[^>]+>\s+)?class\s+\w+|^struct\s+\w+/m,
    importPattern: /^#include\s+[<"][\w./]+[>"]/m,
    commentPattern: /^\/\/|^\/\*/m,
  },
  [CodeLanguage.C]: {
    functionPattern: /^(?:static\s+)?(?:inline\s+)?[\w\s*]+\s+\w+\s*\(/m,
    classPattern: /^struct\s+\w+|^typedef\s+struct/m,
    importPattern: /^#include\s+[<"][\w./]+[>"]/m,
    commentPattern: /^\/\/|^\/\*/m,
  },
  [CodeLanguage.MARKDOWN]: {
    importPattern: undefined,
    commentPattern: /^<!--|^>/m,
  },
  [CodeLanguage.UNKNOWN]: {},
}

/**
 * File extension to language mapping
 */
const EXTENSION_MAP: Record<string, CodeLanguage> = {
  '.ts': CodeLanguage.TYPESCRIPT,
  '.tsx': CodeLanguage.TYPESCRIPT,
  '.js': CodeLanguage.JAVASCRIPT,
  '.jsx': CodeLanguage.JAVASCRIPT,
  '.py': CodeLanguage.PYTHON,
  '.go': CodeLanguage.GO,
  '.rs': CodeLanguage.RUST,
  '.java': CodeLanguage.JAVA,
  '.cpp': CodeLanguage.CPP,
  '.cc': CodeLanguage.CPP,
  '.cxx': CodeLanguage.CPP,
  '.c': CodeLanguage.C,
  '.h': CodeLanguage.C,
  '.hpp': CodeLanguage.CPP,
  '.md': CodeLanguage.MARKDOWN,
  '.markdown': CodeLanguage.MARKDOWN,
}

/**
 * CodeChunker class for intelligent code splitting
 */
export class CodeChunker {
  private readonly tokenCounter: TokenCounter
  private readonly config: Required<ChunkingConfig>

  constructor(config: ChunkingConfig = {}) {
    this.tokenCounter = new TokenCounter()
    this.config = {
      targetTokensPerChunk: config.targetTokensPerChunk ?? 500,
      maxTokensPerChunk: config.maxTokensPerChunk ?? 1000,
      minTokensPerChunk: config.minTokensPerChunk ?? 50,
      overlapLines: config.overlapLines ?? 15,
      model: config.model ?? 'gpt-4',
    }
  }

  /**
   * Detect programming language from file path or extension
   */
  detectLanguage(filePath: string): CodeLanguage {
    const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
    return EXTENSION_MAP[ext] || CodeLanguage.UNKNOWN
  }

  /**
   * Extract imports/dependencies from the start of the file
   */
  private extractImports(lines: string[], language: CodeLanguage): string[] {
    const patterns = LANGUAGE_PATTERNS[language]
    if (!patterns.importPattern) {
      return []
    }

    const imports: string[] = []
    for (let i = 0; i < Math.min(50, lines.length); i++) {
      const line = lines[i].trim()
      if (patterns.importPattern.test(line)) {
        imports.push(lines[i])
      } else if (imports.length > 0 && line && !patterns.commentPattern?.test(line)) {
        // Stop when we hit non-import, non-comment code
        break
      }
    }

    return imports
  }

  /**
   * Find natural split points in code (function/class boundaries)
   */
  private findSplitPoints(lines: string[], language: CodeLanguage): number[] {
    const patterns = LANGUAGE_PATTERNS[language]
    const splitPoints: number[] = [0]

    // Look for function and class declarations
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      if (
        (patterns.functionPattern && patterns.functionPattern.test(line)) ||
        (patterns.classPattern && patterns.classPattern.test(line))
      ) {
        // Don't create split points too close together
        const lastSplitPoint = splitPoints[splitPoints.length - 1]
        if (i - lastSplitPoint > 10) {
          splitPoints.push(i)
        }
      }
    }

    // Add end point
    if (splitPoints[splitPoints.length - 1] !== lines.length) {
      splitPoints.push(lines.length)
    }

    return splitPoints
  }

  /**
   * Create a chunk from a range of lines
   */
  private createChunk(
    lines: string[],
    startLine: number,
    endLine: number,
    language: CodeLanguage,
    imports: string[]
  ): CodeChunk {
    const chunkLines = lines.slice(startLine, endLine)
    const hasImports = imports.length > 0 && startLine === 0

    // Add imports to non-first chunks for context
    const content = startLine > 0 && imports.length > 0
      ? `${imports.join('\n')}\n// ...\n${chunkLines.join('\n')}`
      : chunkLines.join('\n')

    const tokenResult = this.tokenCounter.count(content, this.config.model)

    return {
      content,
      startLine: startLine + 1, // 1-indexed for human readability
      endLine: endLine, // 1-indexed, inclusive
      tokens: tokenResult.count,
      language,
      hasImports,
    }
  }

  /**
   * Split lines into chunks with overlap
   */
  private splitWithOverlap(
    lines: string[],
    splitPoints: number[],
    language: CodeLanguage,
    imports: string[]
  ): CodeChunk[] {
    const chunks: CodeChunk[] = []

    for (let i = 0; i < splitPoints.length - 1; i++) {
      let start = splitPoints[i]
      let end = splitPoints[i + 1]

      // Apply overlap (except for the first chunk)
      if (i > 0) {
        start = Math.max(0, start - this.config.overlapLines)
      }

      // Create initial chunk
      let chunk = this.createChunk(lines, start, end, language, imports)

      // If chunk is too large, split it further
      while (chunk.tokens > this.config.maxTokensPerChunk) {
        // Binary search for a good split point
        let targetEnd = start + Math.floor((end - start) / 2)

        chunk = this.createChunk(lines, start, targetEnd, language, imports)

        if (chunk.tokens <= this.config.maxTokensPerChunk) {
          chunks.push(chunk)
          // Start next chunk with overlap
          start = targetEnd - this.config.overlapLines
          chunk = this.createChunk(lines, start, end, language, imports)
        } else {
          // Still too large, split smaller
          end = targetEnd
        }
      }

      // Only add chunks that meet minimum size requirement
      if (chunk.tokens >= this.config.minTokensPerChunk) {
        chunks.push(chunk)
      }
    }

    return chunks
  }

  /**
   * Chunk source code file into semantically meaningful pieces
   */
  chunkFile(filePath: string, content: string): CodeChunk[] {
    const language = this.detectLanguage(filePath)
    const lines = content.split('\n')

    // Handle empty or very small files
    if (lines.length === 0 || content.trim().length === 0) {
      return []
    }

    // Extract imports/dependencies
    const imports = this.extractImports(lines, language)

    // For very small files, return as a single chunk
    const singleChunkTokens = this.tokenCounter.count(content, this.config.model).count
    if (singleChunkTokens <= this.config.targetTokensPerChunk) {
      return [
        {
          content,
          startLine: 1,
          endLine: lines.length,
          tokens: singleChunkTokens,
          language,
          hasImports: imports.length > 0,
        },
      ]
    }

    // Find natural split points (functions, classes)
    const splitPoints = this.findSplitPoints(lines, language)

    // If no natural splits found, use simple line-based chunking
    if (splitPoints.length <= 2) {
      const linesPerChunk = Math.ceil(
        lines.length / Math.ceil(singleChunkTokens / this.config.targetTokensPerChunk)
      )
      const simpleSplitPoints = [0]
      for (let i = linesPerChunk; i < lines.length; i += linesPerChunk) {
        simpleSplitPoints.push(i)
      }
      simpleSplitPoints.push(lines.length)

      return this.splitWithOverlap(lines, simpleSplitPoints, language, imports)
    }

    // Use natural split points with overlap
    return this.splitWithOverlap(lines, splitPoints, language, imports)
  }

  /**
   * Chunk multiple files in batch
   */
  chunkFiles(files: Array<{ path: string; content: string }>): Map<string, CodeChunk[]> {
    const results = new Map<string, CodeChunk[]>()

    for (const file of files) {
      try {
        const chunks = this.chunkFile(file.path, file.content)
        results.set(file.path, chunks)
      } catch (error) {
        console.error(`Error chunking file ${file.path}:`, error)
        results.set(file.path, [])
      }
    }

    return results
  }

  /**
   * Get chunking statistics for a file
   */
  getChunkingStats(filePath: string, content: string): {
    totalLines: number
    totalTokens: number
    language: CodeLanguage
    estimatedChunks: number
    hasImports: boolean
  } {
    const language = this.detectLanguage(filePath)
    const lines = content.split('\n')
    const imports = this.extractImports(lines, language)
    const totalTokens = this.tokenCounter.count(content, this.config.model).count
    const estimatedChunks = Math.max(1, Math.ceil(totalTokens / this.config.targetTokensPerChunk))

    return {
      totalLines: lines.length,
      totalTokens,
      language,
      estimatedChunks,
      hasImports: imports.length > 0,
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.tokenCounter.dispose()
  }
}

/**
 * Singleton instance for convenience
 */
let defaultInstance: CodeChunker | null = null

/**
 * Get the default CodeChunker instance
 */
export function getCodeChunker(config?: ChunkingConfig): CodeChunker {
  if (!defaultInstance) {
    defaultInstance = new CodeChunker(config)
  }
  return defaultInstance
}

/**
 * Quick chunking using default instance
 */
export function chunkFile(filePath: string, content: string): CodeChunk[] {
  return getCodeChunker().chunkFile(filePath, content)
}

export default CodeChunker

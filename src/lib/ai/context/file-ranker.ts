/**
 * FileRanker - Intelligent file ranking for context selection
 *
 * Provides relevance scoring, recency weighting, and dependency analysis
 * to prioritize files for AI context windows.
 */

import {
  RankingCriteria,
  FileRankingResult,
  ContextItemMetadata,
  DEFAULT_RANKING_CRITERIA,
  SemanticSearchOptions
} from '../../../types/context';
import { TokenCounter } from './token-counter';

/**
 * File metadata for ranking
 */
export interface FileMetadata {
  path: string;
  content: string;
  lastModified: Date;
  lastAccessed?: Date;
  size: number;
  language?: string;
  imports?: string[];
  exports?: string[];
}

/**
 * Options for FileRanker initialization
 */
export interface FileRankerOptions {
  /** Custom ranking criteria */
  rankingCriteria?: Partial<RankingCriteria>;
  /** Token counter instance (will create one if not provided) */
  tokenCounter?: TokenCounter;
  /** Model to use for token counting */
  model?: string;
  /** Enable dependency analysis */
  analyzeDependencies?: boolean;
  /** Embedding service for semantic ranking */
  embeddingService?: {
    generateEmbedding(text: string): Promise<number[]>;
  };
  /** Maximum file size to process (bytes) */
  maxFileSize?: number;
}

/**
 * Dependency graph node
 */
interface DependencyNode {
  path: string;
  imports: Set<string>;
  importedBy: Set<string>;
  depth: number;
}

/**
 * FileRanker class for intelligent file ranking
 */
export class FileRanker {
  private readonly criteria: RankingCriteria;
  private readonly tokenCounter: TokenCounter;
  private readonly options: Required<Omit<FileRankerOptions, 'rankingCriteria' | 'embeddingService'>>;
  private readonly embeddingService?: FileRankerOptions['embeddingService'];
  private dependencyGraph: Map<string, DependencyNode> = new Map();
  private embeddingCache: Map<string, number[]> = new Map();

  constructor(options: FileRankerOptions = {}) {
    this.criteria = {
      ...DEFAULT_RANKING_CRITERIA,
      ...options.rankingCriteria
    };
    this.tokenCounter = options.tokenCounter || new TokenCounter();
    this.embeddingService = options.embeddingService;
    this.options = {
      tokenCounter: this.tokenCounter,
      model: options.model ?? 'gpt-4',
      analyzeDependencies: options.analyzeDependencies ?? true,
      maxFileSize: options.maxFileSize ?? 1024 * 1024 // 1MB default
    };
  }

  /**
   * Parse imports from file content based on language
   */
  private parseImports(content: string, language?: string): string[] {
    const imports: string[] = [];

    // TypeScript/JavaScript imports
    if (!language || ['typescript', 'javascript', 'ts', 'tsx', 'js', 'jsx'].includes(language)) {
      // ES6 imports
      const es6Pattern = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
      let match;
      while ((match = es6Pattern.exec(content)) !== null) {
        imports.push(match[1]);
      }

      // CommonJS requires
      const cjsPattern = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
      while ((match = cjsPattern.exec(content)) !== null) {
        imports.push(match[1]);
      }

      // Dynamic imports
      const dynamicPattern = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
      while ((match = dynamicPattern.exec(content)) !== null) {
        imports.push(match[1]);
      }
    }

    // Python imports
    if (language === 'python' || language === 'py') {
      const pythonPattern = /(?:from\s+(\S+)\s+import|import\s+(\S+))/g;
      let match;
      while ((match = pythonPattern.exec(content)) !== null) {
        imports.push(match[1] || match[2]);
      }
    }

    // Go imports
    if (language === 'go') {
      const goPattern = /import\s+(?:\(\s*)?["']([^"']+)["']/g;
      let match;
      while ((match = goPattern.exec(content)) !== null) {
        imports.push(match[1]);
      }
    }

    // Rust imports
    if (language === 'rust' || language === 'rs') {
      const rustPattern = /use\s+([^;{]+)/g;
      let match;
      while ((match = rustPattern.exec(content)) !== null) {
        imports.push(match[1].trim());
      }
    }

    return Array.from(new Set(imports));
  }

  /**
   * Detect language from file path
   */
  private detectLanguage(path: string): string | undefined {
    const ext = path.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      go: 'go',
      rs: 'rust',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      rb: 'ruby',
      php: 'php',
      md: 'markdown',
      json: 'json',
      yaml: 'yaml',
      yml: 'yaml'
    };
    return ext ? langMap[ext] : undefined;
  }

  /**
   * Build dependency graph from files
   */
  buildDependencyGraph(files: FileMetadata[]): void {
    this.dependencyGraph.clear();

    // Initialize nodes
    for (const file of files) {
      const language = file.language || this.detectLanguage(file.path);
      const imports = file.imports || this.parseImports(file.content, language);

      this.dependencyGraph.set(file.path, {
        path: file.path,
        imports: new Set(imports),
        importedBy: new Set(),
        depth: 0
      });
    }

    // Build reverse dependencies
    Array.from(this.dependencyGraph.entries()).forEach(([path, node]) => {
      Array.from(node.imports).forEach(importPath => {
        // Try to resolve import to actual file path
        const resolved = this.resolveImport(importPath, path);
        if (resolved && this.dependencyGraph.has(resolved)) {
          this.dependencyGraph.get(resolved)!.importedBy.add(path);
        }
      });
    });

    // Calculate depth (distance from entry points)
    this.calculateDepths();
  }

  /**
   * Resolve import path to file path
   */
  private resolveImport(importPath: string, fromPath: string): string | null {
    // Handle relative imports
    if (importPath.startsWith('.')) {
      const fromDir = fromPath.split('/').slice(0, -1).join('/');
      const parts = importPath.split('/');
      const resolved = fromDir.split('/');

      for (const part of parts) {
        if (part === '.') continue;
        if (part === '..') {
          resolved.pop();
        } else {
          resolved.push(part);
        }
      }

      const resolvedPath = resolved.join('/');

      // Try common extensions
      const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];
      for (const ext of extensions) {
        const candidate = resolvedPath + ext;
        if (this.dependencyGraph.has(candidate)) {
          return candidate;
        }
      }
    }

    // Handle alias imports (e.g., @/lib/...)
    if (importPath.startsWith('@/')) {
      const aliasPath = importPath.replace('@/', 'src/');
      const extensions = ['', '.ts', '.tsx', '.js', '.jsx'];
      for (const ext of extensions) {
        const candidate = aliasPath + ext;
        if (this.dependencyGraph.has(candidate)) {
          return candidate;
        }
      }
    }

    return null;
  }

  /**
   * Calculate depths using BFS from entry points
   */
  private calculateDepths(): void {
    // Find entry points (files not imported by others or index files)
    const entryPoints: string[] = [];

    Array.from(this.dependencyGraph.entries()).forEach(([path, node]) => {
      if (node.importedBy.size === 0 ||
          path.includes('index.') ||
          path.includes('main.') ||
          path.includes('app.')) {
        entryPoints.push(path);
        node.depth = 0;
      }
    });

    // BFS from entry points
    const visited = new Set<string>(entryPoints);
    const queue = [...entryPoints];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const node = this.dependencyGraph.get(current)!;

      Array.from(node.imports).forEach(importPath => {
        const resolved = this.resolveImport(importPath, current);
        if (resolved && !visited.has(resolved)) {
          visited.add(resolved);
          const importNode = this.dependencyGraph.get(resolved);
          if (importNode) {
            importNode.depth = node.depth + 1;
            queue.push(resolved);
          }
        }
      });
    }
  }

  /**
   * Calculate relevance score based on query matching
   */
  private calculateRelevanceScore(
    file: FileMetadata,
    query?: string,
    embedding?: number[]
  ): number {
    if (!query) return 0.5; // Neutral score if no query

    let score = 0;

    // Text-based relevance
    const queryLower = query.toLowerCase();
    const contentLower = file.content.toLowerCase();
    const pathLower = file.path.toLowerCase();

    // Check path match
    const pathTerms = queryLower.split(/\s+/);
    for (const term of pathTerms) {
      if (pathLower.includes(term)) {
        score += 0.2;
      }
    }

    // Check content match with TF calculation
    const words = queryLower.split(/\s+/).filter(w => w.length > 2);
    const contentWords = contentLower.split(/\W+/);
    const wordFreq = new Map<string, number>();

    for (const word of contentWords) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }

    for (const queryWord of words) {
      const freq = wordFreq.get(queryWord) || 0;
      if (freq > 0) {
        // Log scale to avoid over-weighting frequently mentioned terms
        score += 0.1 * Math.log10(freq + 1);
      }
    }

    // Semantic relevance if embeddings available
    if (embedding && this.embeddingCache.has(file.path)) {
      const fileEmbedding = this.embeddingCache.get(file.path)!;
      const similarity = this.cosineSimilarity(embedding, fileEmbedding);
      score += similarity * 0.4; // Weight semantic similarity
    }

    // Apply keyword boosts
    for (const [keyword, boost] of Object.entries(this.criteria.keywordBoosts)) {
      if (contentLower.includes(keyword.toLowerCase())) {
        score *= boost;
      }
    }

    // Normalize to 0-1
    return Math.min(1, Math.max(0, score));
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }

  /**
   * Calculate recency score based on modification/access time
   */
  private calculateRecencyScore(file: FileMetadata): number {
    const now = Date.now();
    const lastModified = file.lastModified.getTime();
    const lastAccessed = file.lastAccessed?.getTime() || lastModified;

    // Use the more recent of modification or access
    const mostRecent = Math.max(lastModified, lastAccessed);
    const age = now - mostRecent;

    // Decay function: score decreases as age increases
    // Full score for files modified within the last hour
    // Half score at recencyMaxAge
    const halfLife = this.criteria.recencyMaxAge / 2;
    const decayFactor = Math.exp(-age / halfLife * Math.LN2);

    return Math.max(0, Math.min(1, decayFactor));
  }

  /**
   * Calculate proximity score based on file location and imports
   */
  private calculateProximityScore(
    file: FileMetadata,
    currentFile?: string
  ): number {
    if (!currentFile) return 0.5;

    let score = 0;

    // Check same directory
    const fileDir = file.path.split('/').slice(0, -1).join('/');
    const currentDir = currentFile.split('/').slice(0, -1).join('/');

    if (fileDir === currentDir) {
      score += 0.4;
    } else {
      // Calculate directory distance
      const fileParts = fileDir.split('/');
      const currentParts = currentDir.split('/');
      let commonParts = 0;

      for (let i = 0; i < Math.min(fileParts.length, currentParts.length); i++) {
        if (fileParts[i] === currentParts[i]) {
          commonParts++;
        } else {
          break;
        }
      }

      const distance = (fileParts.length - commonParts) + (currentParts.length - commonParts);
      score += 0.3 * Math.exp(-distance / 3);
    }

    // Check import relationship
    const node = this.dependencyGraph.get(file.path);
    const currentNode = this.dependencyGraph.get(currentFile);

    if (node && currentNode) {
      // Direct import
      if (currentNode.imports.has(file.path) || node.imports.has(currentFile)) {
        score += 0.3;
      }

      // Shared imports
      const sharedImports = new Set(
        Array.from(node.imports).filter(x => currentNode.imports.has(x))
      );
      if (sharedImports.size > 0) {
        score += 0.1 * Math.min(sharedImports.size / 5, 1);
      }
    }

    return Math.min(1, score);
  }

  /**
   * Calculate dependency score based on graph analysis
   */
  private calculateDependencyScore(file: FileMetadata): number {
    if (!this.options.analyzeDependencies) return 0.5;

    const node = this.dependencyGraph.get(file.path);
    if (!node) return 0.5;

    let score = 0;

    // Score based on being imported by others (importance)
    const importedByCount = node.importedBy.size;
    score += 0.3 * Math.min(importedByCount / 10, 1);

    // Score based on depth (central files are more important)
    const depthScore = 1 - (node.depth / 10);
    score += 0.3 * Math.max(0, depthScore);

    // Score based on number of imports (files that import many things are often key)
    const importCount = node.imports.size;
    score += 0.2 * Math.min(importCount / 20, 1);

    // Bonus for being an index or main file
    if (file.path.includes('index.') || file.path.includes('main.') || file.path.includes('app.')) {
      score += 0.2;
    }

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Calculate combined score with weights
   */
  private calculateCombinedScore(
    relevanceScore: number,
    recencyScore: number,
    proximityScore: number,
    dependencyScore: number,
    fileType?: string
  ): number {
    let score = (
      relevanceScore * this.criteria.relevanceWeight +
      recencyScore * this.criteria.recencyWeight +
      proximityScore * this.criteria.proximityWeight +
      dependencyScore * (1 - this.criteria.relevanceWeight - this.criteria.recencyWeight - this.criteria.proximityWeight)
    );

    // Apply priority weight adjustment based on type
    score *= this.criteria.priorityWeight + (1 - this.criteria.priorityWeight);

    // Apply type boost if applicable
    if (fileType && this.criteria.typeBoosts[fileType]) {
      score *= this.criteria.typeBoosts[fileType];
    }

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Generate embedding for a file (if embedding service available)
   */
  async generateEmbedding(file: FileMetadata): Promise<number[] | null> {
    if (!this.embeddingService) return null;

    try {
      // Create a summary for embedding (path + first 1000 chars of content)
      const summary = `${file.path}\n${file.content.slice(0, 1000)}`;
      const embedding = await this.embeddingService.generateEmbedding(summary);
      this.embeddingCache.set(file.path, embedding);
      return embedding;
    } catch {
      return null;
    }
  }

  /**
   * Rank a single file
   */
  rankFile(
    file: FileMetadata,
    options: {
      query?: string;
      queryEmbedding?: number[];
      currentFile?: string;
    } = {}
  ): FileRankingResult {
    const language = file.language || this.detectLanguage(file.path);
    const ext = file.path.split('.').pop()?.toLowerCase();

    // Calculate individual scores
    const relevanceScore = this.calculateRelevanceScore(
      file,
      options.query,
      options.queryEmbedding
    );
    const recencyScore = this.calculateRecencyScore(file);
    const proximityScore = this.calculateProximityScore(file, options.currentFile);
    const dependencyScore = this.calculateDependencyScore(file);

    // Calculate combined score
    const finalScore = this.calculateCombinedScore(
      relevanceScore,
      recencyScore,
      proximityScore,
      dependencyScore,
      ext
    );

    // Generate ranking reason
    const reasons: string[] = [];
    if (relevanceScore > 0.7) reasons.push('highly relevant to query');
    if (recencyScore > 0.7) reasons.push('recently modified');
    if (proximityScore > 0.7) reasons.push('close to current file');
    if (dependencyScore > 0.7) reasons.push('important dependency');

    // Calculate token count
    const tokenResult = this.tokenCounter.count(file.content, this.options.model);

    const metadata: ContextItemMetadata = {
      source: file.path,
      language,
      lastModified: file.lastModified,
      lastAccessed: file.lastAccessed,
      relatedFiles: file.imports
    };

    return {
      path: file.path,
      content: file.content,
      tokenCount: tokenResult.count,
      relevanceScore,
      recencyScore,
      proximityScore,
      dependencyScore,
      finalScore,
      metadata,
      rankingReason: reasons.length > 0
        ? `Selected because: ${reasons.join(', ')}`
        : 'Included based on overall scoring'
    };
  }

  /**
   * Rank multiple files
   */
  rankFiles(
    files: FileMetadata[],
    options: {
      query?: string;
      queryEmbedding?: number[];
      currentFile?: string;
      limit?: number;
      minScore?: number;
    } = {}
  ): FileRankingResult[] {
    // Filter out files that are too large
    const validFiles = files.filter(f => f.size <= this.options.maxFileSize);

    // Build dependency graph if enabled
    if (this.options.analyzeDependencies) {
      this.buildDependencyGraph(validFiles);
    }

    // Rank all files
    const results = validFiles.map(file =>
      this.rankFile(file, {
        query: options.query,
        queryEmbedding: options.queryEmbedding,
        currentFile: options.currentFile
      })
    );

    // Filter by minimum score
    const minScore = options.minScore ?? this.criteria.minRelevanceThreshold;
    const filtered = results.filter(r => r.finalScore >= minScore);

    // Sort by final score (descending)
    filtered.sort((a, b) => b.finalScore - a.finalScore);

    // Apply limit
    if (options.limit) {
      return filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Rank files for semantic search
   */
  async rankFilesSemanticly(
    files: FileMetadata[],
    options: SemanticSearchOptions
  ): Promise<FileRankingResult[]> {
    if (!this.embeddingService) {
      // Fallback to text-based ranking
      return this.rankFiles(files, {
        query: options.query,
        limit: options.maxResults
      });
    }

    // Generate query embedding
    const queryEmbedding = await this.embeddingService.generateEmbedding(options.query);

    // Generate embeddings for files that don't have cached embeddings
    await Promise.all(
      files
        .filter(f => !this.embeddingCache.has(f.path))
        .slice(0, 50) // Limit concurrent embedding generations
        .map(f => this.generateEmbedding(f))
    );

    // Rank with embeddings
    const results = this.rankFiles(files, {
      query: options.query,
      queryEmbedding,
      limit: options.maxResults,
      minScore: options.minSimilarity
    });

    return results;
  }

  /**
   * Get related files based on dependency analysis
   */
  getRelatedFiles(
    filePath: string,
    options: { depth?: number; includeReverse?: boolean } = {}
  ): string[] {
    const depth = options.depth ?? 2;
    const includeReverse = options.includeReverse ?? true;

    const related = new Set<string>();
    const visited = new Set<string>();
    const queue: Array<{ path: string; currentDepth: number }> = [{ path: filePath, currentDepth: 0 }];

    while (queue.length > 0) {
      const { path, currentDepth } = queue.shift()!;

      if (visited.has(path) || currentDepth > depth) continue;
      visited.add(path);

      const node = this.dependencyGraph.get(path);
      if (!node) continue;

      // Add forward dependencies (imports)
      Array.from(node.imports).forEach(importPath => {
        const resolved = this.resolveImport(importPath, path);
        if (resolved && !visited.has(resolved)) {
          related.add(resolved);
          queue.push({ path: resolved, currentDepth: currentDepth + 1 });
        }
      });

      // Add reverse dependencies (imported by)
      if (includeReverse) {
        Array.from(node.importedBy).forEach(importerPath => {
          if (!visited.has(importerPath)) {
            related.add(importerPath);
            queue.push({ path: importerPath, currentDepth: currentDepth + 1 });
          }
        });
      }
    }

    return Array.from(related);
  }

  /**
   * Update ranking criteria
   */
  updateCriteria(newCriteria: Partial<RankingCriteria>): void {
    Object.assign(this.criteria, newCriteria);
  }

  /**
   * Get current ranking criteria
   */
  getCriteria(): RankingCriteria {
    return { ...this.criteria };
  }

  /**
   * Clear caches
   */
  clearCaches(): void {
    this.embeddingCache.clear();
    this.dependencyGraph.clear();
  }
}

export default FileRanker;

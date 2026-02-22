/**
 * Large File Optimizer for Monaco Editor
 *
 * Provides optimized Monaco editor configuration for large files to prevent
 * UI freezing, crashes, and performance degradation.
 *
 * Performance considerations:
 * - Disables expensive features for large files (minimap, code lens, etc.)
 * - Implements progressive optimization levels based on file size
 * - Reduces memory usage through strategic feature toggling
 * - Maintains essential editing functionality while optimizing performance
 *
 * @module lib/editor/large-file-optimizer
 */

import type * as monaco from 'monaco-editor';

// ============================================================================
// Constants and Thresholds
// ============================================================================

/**
 * File size thresholds for optimization levels (in lines)
 * Based on CHUNKING_THRESHOLDS from file-chunking.ts
 */
export const FILE_SIZE_THRESHOLDS = {
  /** Small files - no optimizations needed */
  SMALL: 1000,

  /** Medium files - minimal optimizations */
  MEDIUM: 5000,

  /** Large files - moderate optimizations */
  LARGE: 10000,

  /** Very large files - aggressive optimizations */
  VERY_LARGE: 20000,

  /** Extreme files - maximum optimizations */
  EXTREME: 50000,
} as const;

/**
 * File size thresholds by byte size
 */
export const BYTE_SIZE_THRESHOLDS = {
  /** Small files */
  SMALL: 100 * 1024, // 100KB

  /** Medium files */
  MEDIUM: 500 * 1024, // 500KB

  /** Large files */
  LARGE: 1024 * 1024, // 1MB

  /** Very large files */
  VERY_LARGE: 5 * 1024 * 1024, // 5MB

  /** Extreme files */
  EXTREME: 10 * 1024 * 1024, // 10MB
} as const;

// ============================================================================
// Types
// ============================================================================

/**
 * File size category
 */
export type FileSizeCategory = 'small' | 'medium' | 'large' | 'very-large' | 'extreme';

/**
 * Optimization level
 */
export type OptimizationLevel = 'none' | 'minimal' | 'moderate' | 'aggressive' | 'maximum';

/**
 * File size information
 */
export interface FileSizeInfo {
  /** Number of lines in the file */
  lineCount: number;

  /** File size in bytes */
  byteSize: number;

  /** Calculated file size category */
  category: FileSizeCategory;

  /** Recommended optimization level */
  optimizationLevel: OptimizationLevel;

  /** Whether the file should be considered "large" */
  isLarge: boolean;

  /** Estimated memory usage (bytes) */
  estimatedMemoryUsage: number;
}

/**
 * Optimization configuration options
 */
export interface OptimizationOptions {
  /** Force a specific optimization level */
  forceLevel?: OptimizationLevel;

  /** Custom line count threshold */
  customThreshold?: number;

  /** Enable/disable specific features regardless of optimization level */
  overrides?: Partial<monaco.editor.IStandaloneEditorConstructionOptions>;

  /** Enable debug logging */
  debug?: boolean;
}

// ============================================================================
// File Size Detection
// ============================================================================

/**
 * Determines file size category based on line count and byte size
 *
 * @param lineCount - Number of lines in the file
 * @param byteSize - Size of the file in bytes
 * @returns File size category
 */
export function getFileSizeCategory(lineCount: number, byteSize: number): FileSizeCategory {
  // Check line count thresholds
  if (lineCount >= FILE_SIZE_THRESHOLDS.EXTREME || byteSize >= BYTE_SIZE_THRESHOLDS.EXTREME) {
    return 'extreme';
  }
  if (lineCount >= FILE_SIZE_THRESHOLDS.VERY_LARGE || byteSize >= BYTE_SIZE_THRESHOLDS.VERY_LARGE) {
    return 'very-large';
  }
  if (lineCount >= FILE_SIZE_THRESHOLDS.LARGE || byteSize >= BYTE_SIZE_THRESHOLDS.LARGE) {
    return 'large';
  }
  if (lineCount >= FILE_SIZE_THRESHOLDS.MEDIUM || byteSize >= BYTE_SIZE_THRESHOLDS.MEDIUM) {
    return 'medium';
  }
  return 'small';
}

/**
 * Maps file size category to optimization level
 *
 * @param category - File size category
 * @returns Recommended optimization level
 */
export function getOptimizationLevel(category: FileSizeCategory): OptimizationLevel {
  const levelMap: Record<FileSizeCategory, OptimizationLevel> = {
    small: 'none',
    medium: 'minimal',
    large: 'moderate',
    'very-large': 'aggressive',
    extreme: 'maximum',
  };
  return levelMap[category];
}

/**
 * Analyzes file size and returns detailed information
 *
 * @param content - File content (string)
 * @returns File size information with recommendations
 */
export function analyzeFileSize(content: string): FileSizeInfo {
  const lines = content.split('\n');
  const lineCount = lines.length;
  const byteSize = new Blob([content]).size;
  const category = getFileSizeCategory(lineCount, byteSize);
  const optimizationLevel = getOptimizationLevel(category);
  const isLarge = category !== 'small';

  // Estimate memory usage (rough calculation)
  // Monaco typically uses 2-3x the file size in memory
  const estimatedMemoryUsage = byteSize * 2.5;

  return {
    lineCount,
    byteSize,
    category,
    optimizationLevel,
    isLarge,
    estimatedMemoryUsage,
  };
}

/**
 * Quick check if content qualifies as a large file
 *
 * @param content - File content or line count
 * @returns Whether the file is considered large
 */
export function isLargeFile(content: string | number): boolean {
  if (typeof content === 'number') {
    return content >= FILE_SIZE_THRESHOLDS.LARGE;
  }
  const lineCount = content.split('\n').length;
  return lineCount >= FILE_SIZE_THRESHOLDS.LARGE;
}

// ============================================================================
// Monaco Editor Options by Optimization Level
// ============================================================================

/**
 * Base editor options (no optimizations)
 */
const BASE_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  // Default Monaco settings
  minimap: { enabled: true },
  scrollBeyondLastLine: false,
  automaticLayout: true,
  fontSize: 14,
  lineNumbers: 'on',
  glyphMargin: true,
  folding: true,
  lineDecorationsWidth: 10,
  lineNumbersMinChars: 3,
  renderLineHighlight: 'all',
  scrollbar: {
    useShadows: true,
    verticalScrollbarSize: 10,
    horizontalScrollbarSize: 10,
  },
};

/**
 * Minimal optimizations for medium files (1K-5K lines)
 * Disables non-essential visual features
 */
const MINIMAL_OPTIMIZATIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  ...BASE_OPTIONS,
  minimap: { enabled: false },
  codeLens: false,
  occurrencesHighlight: 'off',
  renderLineHighlight: 'line',
  scrollbar: {
    useShadows: false,
    verticalScrollbarSize: 8,
    horizontalScrollbarSize: 8,
  },
};

/**
 * Moderate optimizations for large files (5K-10K lines)
 * Disables expensive computation features
 */
const MODERATE_OPTIMIZATIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  ...MINIMAL_OPTIMIZATIONS,
  folding: false,
  glyphMargin: false,
  lightbulb: { enabled: 'off' as monaco.editor.ShowLightbulbIconMode },
  links: false,
  colorDecorators: false,
  renderWhitespace: 'none',
  renderControlCharacters: false,
};

/**
 * Aggressive optimizations for very large files (10K-20K lines)
 * Significantly reduces rendering overhead
 */
const AGGRESSIVE_OPTIMIZATIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  ...MODERATE_OPTIMIZATIONS,
  matchBrackets: 'never',
  hover: { enabled: false },
  parameterHints: { enabled: false },
  suggest: {
    showIcons: false,
    showStatusBar: false,
  },
  quickSuggestions: false,
  wordBasedSuggestions: 'off',
  renderValidationDecorations: 'off',
};

/**
 * Maximum optimizations for extreme files (20K+ lines)
 * Disables all non-critical features for bare-minimum editing
 */
const MAXIMUM_OPTIMIZATIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  ...AGGRESSIVE_OPTIMIZATIONS,
  lineNumbers: 'off',
  glyphMargin: false,
  folding: false,
  lineDecorationsWidth: 0,
  lineNumbersMinChars: 0,
  renderLineHighlight: 'none',
  selectionHighlight: false,
  unicodeHighlight: {
    ambiguousCharacters: false,
    invisibleCharacters: false,
  },
  bracketPairColorization: { enabled: false },
  guides: {
    indentation: false,
    bracketPairs: false,
    highlightActiveIndentation: false,
  },
};

/**
 * Gets Monaco editor options for a specific optimization level
 *
 * @param level - Optimization level
 * @returns Monaco editor options
 */
function getOptionsForLevel(
  level: OptimizationLevel
): monaco.editor.IStandaloneEditorConstructionOptions {
  const optionsMap: Record<OptimizationLevel, monaco.editor.IStandaloneEditorConstructionOptions> =
    {
      none: BASE_OPTIONS,
      minimal: MINIMAL_OPTIMIZATIONS,
      moderate: MODERATE_OPTIMIZATIONS,
      aggressive: AGGRESSIVE_OPTIMIZATIONS,
      maximum: MAXIMUM_OPTIMIZATIONS,
    };
  return optionsMap[level];
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Gets optimized Monaco editor options based on file content
 *
 * @param content - File content
 * @param options - Optimization configuration options
 * @returns Optimized Monaco editor options
 *
 * @example
 * ```typescript
 * const content = fs.readFileSync('large-file.ts', 'utf-8');
 * const editorOptions = getOptimizedEditorOptions(content);
 * const editor = monaco.editor.create(container, {
 *   value: content,
 *   language: 'typescript',
 *   ...editorOptions,
 * });
 * ```
 */
export function getOptimizedEditorOptions(
  content: string,
  options: OptimizationOptions = {}
): monaco.editor.IStandaloneEditorConstructionOptions {
  // Analyze file size
  const sizeInfo = analyzeFileSize(content);

  // Determine optimization level
  const level = options.forceLevel || sizeInfo.optimizationLevel;

  // Get base options for level
  const baseOptions = getOptionsForLevel(level);

  // Apply custom overrides
  const finalOptions = {
    ...baseOptions,
    ...options.overrides,
  };

  // Debug logging
  if (options.debug) {
    console.info('[LargeFileOptimizer] File analysis:', {
      lineCount: sizeInfo.lineCount,
      byteSize: sizeInfo.byteSize,
      category: sizeInfo.category,
      optimizationLevel: level,
      estimatedMemoryUsage: `${(sizeInfo.estimatedMemoryUsage / 1024 / 1024).toFixed(2)}MB`,
    });
  }

  return finalOptions;
}

/**
 * Gets optimized Monaco editor options based on line count
 * Useful when content is not yet loaded
 *
 * @param lineCount - Number of lines in the file
 * @param options - Optimization configuration options
 * @returns Optimized Monaco editor options
 *
 * @example
 * ```typescript
 * const lineCount = 50000;
 * const editorOptions = getOptimizedEditorOptionsByLineCount(lineCount);
 * ```
 */
export function getOptimizedEditorOptionsByLineCount(
  lineCount: number,
  options: OptimizationOptions = {}
): monaco.editor.IStandaloneEditorConstructionOptions {
  // Estimate byte size (rough approximation: 80 chars per line)
  const estimatedByteSize = lineCount * 80;

  // Get category and level
  const category = getFileSizeCategory(lineCount, estimatedByteSize);
  const level = options.forceLevel || getOptimizationLevel(category);

  // Get base options for level
  const baseOptions = getOptionsForLevel(level);

  // Apply custom overrides
  const finalOptions = {
    ...baseOptions,
    ...options.overrides,
  };

  // Debug logging
  if (options.debug) {
    console.info('[LargeFileOptimizer] Optimization by line count:', {
      lineCount,
      category,
      optimizationLevel: level,
    });
  }

  return finalOptions;
}

/**
 * Determines if optimizations should be applied based on file size
 *
 * @param content - File content or line count
 * @returns Whether optimizations are recommended
 */
export function shouldOptimize(content: string | number): boolean {
  if (typeof content === 'number') {
    return content >= FILE_SIZE_THRESHOLDS.MEDIUM;
  }
  const sizeInfo = analyzeFileSize(content);
  return sizeInfo.optimizationLevel !== 'none';
}

/**
 * Gets a human-readable description of optimization recommendations
 *
 * @param content - File content
 * @returns Optimization recommendation message
 */
export function getOptimizationRecommendation(content: string): string {
  const sizeInfo = analyzeFileSize(content);

  const messages: Record<OptimizationLevel, string> = {
    none: 'No optimizations needed. File is small enough for full features.',
    minimal:
      'Minimal optimizations recommended. Some visual features will be disabled for better performance.',
    moderate:
      'Moderate optimizations recommended. Expensive computation features will be disabled.',
    aggressive:
      'Aggressive optimizations recommended. Only essential editing features will be enabled.',
    maximum:
      'Maximum optimizations required. File is extremely large. Only basic editing will be available.',
  };

  return messages[sizeInfo.optimizationLevel];
}

// ============================================================================
// Exports
// ============================================================================

export default {
  analyzeFileSize,
  getOptimizedEditorOptions,
  getOptimizedEditorOptionsByLineCount,
  getFileSizeCategory,
  getOptimizationLevel,
  isLargeFile,
  shouldOptimize,
  getOptimizationRecommendation,
  FILE_SIZE_THRESHOLDS,
  BYTE_SIZE_THRESHOLDS,
};

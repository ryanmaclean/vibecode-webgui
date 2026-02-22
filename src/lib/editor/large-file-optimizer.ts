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
 * - Integrates with virtualized editor for viewport-based rendering
 * - Provides virtualization-aware optimizations for extremely large files
 * - Monitors memory usage during editor lifecycle to detect leaks
 *
 * @module lib/editor/large-file-optimizer
 */

import type * as monaco from 'monaco-editor';
import {
  MemoryMonitor,
  getMemorySnapshot,
  trackMemoryUsage,
  withMemoryTracking,
  type MemorySnapshot,
  type MemoryTrackingResult,
  type MemoryMonitorConfig,
  type MemoryMonitorReport
} from '@/lib/performance/memory-monitor';

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

/**
 * Virtualization thresholds for viewport-based rendering
 * Aligned with virtualized-editor.ts configuration
 */
export const VIRTUALIZATION_THRESHOLDS = {
  /** Enable virtualization for files exceeding this line count */
  ENABLE_VIRTUALIZATION: 5000,

  /** Force aggressive virtualization for files exceeding this line count */
  FORCE_VIRTUALIZATION: 20000,

  /** Recommended overscan size (lines to render outside viewport) */
  VIEWPORT_OVERSCAN: 100,

  /** Estimated viewport height in lines (typical screen) */
  TYPICAL_VIEWPORT_HEIGHT: 50,
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

  /** Whether virtualization is recommended for this file */
  shouldVirtualize: boolean;

  /** Whether aggressive virtualization is recommended */
  shouldForceVirtualization: boolean;
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

  /** Enable virtualization-aware optimizations */
  enableVirtualization?: boolean;

  /** Force virtualization regardless of file size */
  forceVirtualization?: boolean;

  /** Viewport height hint for virtualization calculations (lines) */
  viewportHeight?: number;
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

  // Determine virtualization recommendations
  const shouldVirtualize = lineCount >= VIRTUALIZATION_THRESHOLDS.ENABLE_VIRTUALIZATION;
  const shouldForceVirtualization = lineCount >= VIRTUALIZATION_THRESHOLDS.FORCE_VIRTUALIZATION;

  return {
    lineCount,
    byteSize,
    category,
    optimizationLevel,
    isLarge,
    estimatedMemoryUsage,
    shouldVirtualize,
    shouldForceVirtualization,
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
 * Virtualization-optimized settings for viewport-based rendering
 * Used when virtualized editor wrapper is active
 * Focuses on optimizing rendering within viewport boundaries
 */
const VIRTUALIZED_OPTIMIZATIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  ...AGGRESSIVE_OPTIMIZATIONS,
  // Keep line numbers for navigation context in virtualized view
  lineNumbers: 'on',
  // Disable decorations that span beyond viewport
  glyphMargin: false,
  folding: false,
  // Optimize scrollbar for large files with viewport rendering
  scrollbar: {
    useShadows: false,
    verticalScrollbarSize: 6,
    horizontalScrollbarSize: 6,
    // Enable smooth scrolling for virtualized content
    handleMouseWheel: true,
    alwaysConsumeMouseWheel: false,
  },
  // Optimize for viewport-based rendering
  renderLineHighlight: 'line',
  selectionHighlight: false,
  // Disable features that require full-document analysis
  occurrencesHighlight: 'off',
  unicodeHighlight: {
    ambiguousCharacters: false,
    invisibleCharacters: false,
  },
  // Keep basic bracket matching for editing within viewport
  matchBrackets: 'never',
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
 *
 * @example With virtualization
 * ```typescript
 * const content = fs.readFileSync('very-large-file.ts', 'utf-8');
 * const editorOptions = getOptimizedEditorOptions(content, {
 *   enableVirtualization: true,
 *   viewportHeight: 50,
 * });
 * const editor = monaco.editor.create(container, {
 *   value: content,
 *   language: 'typescript',
 *   ...editorOptions,
 * });
 * // Then wrap with createVirtualizedEditor for viewport-based rendering
 * ```
 */
export function getOptimizedEditorOptions(
  content: string,
  options: OptimizationOptions = {}
): monaco.editor.IStandaloneEditorConstructionOptions {
  // Analyze file size
  const sizeInfo = analyzeFileSize(content);

  // Check if virtualization should be applied
  const useVirtualization =
    options.enableVirtualization ||
    options.forceVirtualization ||
    (sizeInfo.shouldVirtualize && options.enableVirtualization !== false);

  // Determine optimization level
  let level = options.forceLevel || sizeInfo.optimizationLevel;

  // Get base options for level
  let baseOptions = getOptionsForLevel(level);

  // Apply virtualization-specific optimizations if enabled
  if (useVirtualization && sizeInfo.shouldVirtualize) {
    baseOptions = {
      ...baseOptions,
      ...VIRTUALIZED_OPTIMIZATIONS,
    };
  }

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
      virtualizationEnabled: useVirtualization,
      shouldVirtualize: sizeInfo.shouldVirtualize,
      shouldForceVirtualization: sizeInfo.shouldForceVirtualization,
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
 *
 * @example With virtualization
 * ```typescript
 * const lineCount = 50000;
 * const editorOptions = getOptimizedEditorOptionsByLineCount(lineCount, {
 *   enableVirtualization: true,
 * });
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

  // Determine virtualization needs
  const shouldVirtualize = lineCount >= VIRTUALIZATION_THRESHOLDS.ENABLE_VIRTUALIZATION;
  const useVirtualization =
    options.enableVirtualization ||
    options.forceVirtualization ||
    (shouldVirtualize && options.enableVirtualization !== false);

  // Get base options for level
  let baseOptions = getOptionsForLevel(level);

  // Apply virtualization-specific optimizations if enabled
  if (useVirtualization && shouldVirtualize) {
    baseOptions = {
      ...baseOptions,
      ...VIRTUALIZED_OPTIMIZATIONS,
    };
  }

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
      virtualizationEnabled: useVirtualization,
      shouldVirtualize,
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
// Virtualization Utilities
// ============================================================================

/**
 * Determines if virtualization should be enabled for the given file
 *
 * @param content - File content or line count
 * @returns Whether viewport-based virtualization is recommended
 *
 * @example
 * ```typescript
 * const content = largeFileContent;
 * if (shouldEnableVirtualization(content)) {
 *   // Use createVirtualizedEditor wrapper
 * }
 * ```
 */
export function shouldEnableVirtualization(content: string | number): boolean {
  const lineCount = typeof content === 'number' ? content : content.split('\n').length;
  return lineCount >= VIRTUALIZATION_THRESHOLDS.ENABLE_VIRTUALIZATION;
}

/**
 * Calculates viewport-aware optimization configuration
 *
 * @param lineCount - Total number of lines in the file
 * @param viewportHeight - Height of the viewport in lines (default: typical screen)
 * @returns Optimization configuration optimized for viewport rendering
 *
 * @example
 * ```typescript
 * const config = getViewportOptimizedConfig(50000, 50);
 * const editorOptions = getOptimizedEditorOptionsByLineCount(50000, config);
 * ```
 */
export function getViewportOptimizedConfig(
  lineCount: number,
  viewportHeight: number = VIRTUALIZATION_THRESHOLDS.TYPICAL_VIEWPORT_HEIGHT
): OptimizationOptions {
  const shouldVirtualize = shouldEnableVirtualization(lineCount);
  const shouldForce = lineCount >= VIRTUALIZATION_THRESHOLDS.FORCE_VIRTUALIZATION;

  return {
    enableVirtualization: shouldVirtualize,
    forceVirtualization: shouldForce,
    viewportHeight,
    debug: false,
  };
}

/**
 * Estimates the number of lines that should be kept in memory for viewport rendering
 *
 * @param viewportHeight - Height of the viewport in lines
 * @param overscan - Number of lines to render outside viewport (default: recommended)
 * @returns Total number of lines to keep loaded
 *
 * @example
 * ```typescript
 * const linesToLoad = estimateViewportMemoryLines(50, 100);
 * // linesToLoad = 250 (viewport + overscan on both sides)
 * ```
 */
export function estimateViewportMemoryLines(
  viewportHeight: number = VIRTUALIZATION_THRESHOLDS.TYPICAL_VIEWPORT_HEIGHT,
  overscan: number = VIRTUALIZATION_THRESHOLDS.VIEWPORT_OVERSCAN
): number {
  // Viewport + overscan on top + overscan on bottom
  return viewportHeight + overscan * 2;
}

/**
 * Calculates memory savings from virtualization
 *
 * @param totalLines - Total number of lines in the file
 * @param viewportHeight - Height of the viewport in lines
 * @param avgCharsPerLine - Average characters per line (default: 80)
 * @returns Estimated memory savings in bytes
 */
export function estimateVirtualizationMemorySavings(
  totalLines: number,
  viewportHeight: number = VIRTUALIZATION_THRESHOLDS.TYPICAL_VIEWPORT_HEIGHT,
  avgCharsPerLine: number = 80
): {
  totalMemory: number;
  viewportMemory: number;
  savings: number;
  savingsPercent: number;
} {
  const viewportLines = estimateViewportMemoryLines(viewportHeight);
  const totalMemory = totalLines * avgCharsPerLine * 2.5; // Monaco memory multiplier
  const viewportMemory = viewportLines * avgCharsPerLine * 2.5;
  const savings = Math.max(0, totalMemory - viewportMemory);
  const savingsPercent = totalMemory > 0 ? (savings / totalMemory) * 100 : 0;

  return {
    totalMemory,
    viewportMemory,
    savings,
    savingsPercent,
  };
}

// ============================================================================
// Memory Monitoring Integration
// ============================================================================

/**
 * Default memory monitoring configuration for editor sessions
 */
export const EDITOR_MEMORY_CONFIG: MemoryMonitorConfig = {
  warnThresholdMB: 512,
  criticalThresholdMB: 1024,
  monitoringIntervalMs: 5000,
  autoLog: true,
  label: 'editor-session'
};

/**
 * Creates a memory monitor configured for editor lifecycle tracking
 *
 * @param config - Optional configuration overrides
 * @returns Configured MemoryMonitor instance
 *
 * @example
 * ```typescript
 * const monitor = createEditorMemoryMonitor({ label: 'large-file-edit' });
 * monitor.start();
 * // ... perform editor operations ...
 * const report = monitor.stop();
 * console.log(`Peak memory: ${report.peakMemoryMB}MB`);
 * ```
 */
export function createEditorMemoryMonitor(config?: Partial<MemoryMonitorConfig>): MemoryMonitor {
  return new MemoryMonitor({
    ...EDITOR_MEMORY_CONFIG,
    ...config
  });
}

/**
 * Tracks memory usage during file loading operation
 *
 * @param operation - Description of the file operation
 * @param fn - Async function that loads the file
 * @param fileSize - Optional file size info for logging
 * @returns Result with memory tracking data
 *
 * @example
 * ```typescript
 * const result = await trackFileLoadMemory('load-50k-lines', async () => {
 *   return await loadLargeFile();
 * }, { lineCount: 50000 });
 *
 * console.log(`File loaded in ${result.durationMs}ms`);
 * console.log(`Memory delta: ${result.memoryDelta.deltaMB}MB`);
 * ```
 */
export async function trackFileLoadMemory<T>(
  operation: string,
  fn: () => Promise<T> | T,
  fileSize?: { lineCount?: number; byteSize?: number }
): Promise<MemoryTrackingResult<T>> {
  const fullOperation = fileSize?.lineCount
    ? `${operation} (${fileSize.lineCount} lines)`
    : operation;

  return withMemoryTracking(fullOperation, fn, {
    warnThresholdMB: 100, // Warn if loading adds >100MB
    autoLog: true
  });
}

/**
 * Tracks memory usage during editor operations (scroll, search, etc.)
 *
 * @param operation - Description of the editor operation
 * @param fn - Function to execute
 * @returns Result with memory tracking data
 *
 * @example
 * ```typescript
 * const result = await trackEditorOperation('search-in-large-file', async () => {
 *   return await performSearch(query);
 * });
 * ```
 */
export async function trackEditorOperation<T>(
  operation: string,
  fn: () => Promise<T> | T
): Promise<MemoryTrackingResult<T>> {
  return withMemoryTracking(`editor-op: ${operation}`, fn, {
    warnThresholdMB: 50, // Warn if operation adds >50MB
    autoLog: true
  });
}

/**
 * Gets current memory snapshot with editor-specific context
 *
 * @param label - Optional label for the snapshot
 * @param fileInfo - Optional file information for context
 * @returns Memory snapshot
 *
 * @example
 * ```typescript
 * const snapshot = getEditorMemorySnapshot('after-file-load', {
 *   lineCount: 50000,
 *   category: 'extreme'
 * });
 * ```
 */
export function getEditorMemorySnapshot(
  label?: string,
  fileInfo?: { lineCount?: number; category?: FileSizeCategory }
): MemorySnapshot {
  const snapshot = getMemorySnapshot();

  if (label || fileInfo) {
    trackMemoryUsage(
      label ?? (fileInfo?.category ? `editor-${fileInfo.category}` : 'editor'),
      EDITOR_MEMORY_CONFIG
    );
  }

  return snapshot;
}

/**
 * Monitors memory during extended editor session and detects potential leaks
 *
 * @param sessionLabel - Label for the session
 * @param config - Optional configuration
 * @returns Object with start, stop, and getReport methods
 *
 * @example
 * ```typescript
 * const session = monitorEditorSession('extended-editing');
 * session.start();
 *
 * // ... user edits for 30 minutes ...
 *
 * const report = session.stop();
 * if (report.memoryGrowthMB > 200) {
 *   console.warn('Significant memory growth detected');
 * }
 * ```
 */
export function monitorEditorSession(
  sessionLabel: string,
  config?: Partial<MemoryMonitorConfig>
): {
  monitor: MemoryMonitor;
  start: () => void;
  stop: () => MemoryMonitorReport;
  isRunning: () => boolean;
  detectLeak: () => ReturnType<MemoryMonitor['detectMemoryLeak']>;
} {
  const monitor = createEditorMemoryMonitor({
    ...config,
    label: sessionLabel
  });

  return {
    monitor,
    start: () => monitor.start(),
    stop: () => monitor.stop(),
    isRunning: () => monitor.isRunning(),
    detectLeak: () => monitor.detectMemoryLeak()
  };
}

/**
 * Tracks memory for editor initialization with optimization level
 *
 * @param optimizationLevel - The optimization level being applied
 * @param fn - Function that initializes the editor
 * @returns Result with memory tracking data
 *
 * @example
 * ```typescript
 * const result = await trackEditorInitialization('aggressive', async () => {
 *   return await initializeMonacoEditor(options);
 * });
 * ```
 */
export async function trackEditorInitialization<T>(
  optimizationLevel: OptimizationLevel,
  fn: () => Promise<T> | T
): Promise<MemoryTrackingResult<T>> {
  return withMemoryTracking(`editor-init: ${optimizationLevel}`, fn, {
    warnThresholdMB: 150, // Warn if initialization uses >150MB
    autoLog: true
  });
}

// ============================================================================
// Exports
// ============================================================================

export default {
  // Core analysis functions
  analyzeFileSize,
  getOptimizedEditorOptions,
  getOptimizedEditorOptionsByLineCount,
  getFileSizeCategory,
  getOptimizationLevel,
  isLargeFile,
  shouldOptimize,
  getOptimizationRecommendation,

  // Virtualization utilities
  shouldEnableVirtualization,
  getViewportOptimizedConfig,
  estimateViewportMemoryLines,
  estimateVirtualizationMemorySavings,

  // Memory monitoring integration
  createEditorMemoryMonitor,
  trackFileLoadMemory,
  trackEditorOperation,
  getEditorMemorySnapshot,
  monitorEditorSession,
  trackEditorInitialization,

  // Constants
  FILE_SIZE_THRESHOLDS,
  BYTE_SIZE_THRESHOLDS,
  VIRTUALIZATION_THRESHOLDS,
  EDITOR_MEMORY_CONFIG,
};

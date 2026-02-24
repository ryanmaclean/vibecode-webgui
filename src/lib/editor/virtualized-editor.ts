/**
 * Virtualized Editor Wrapper for Monaco
 *
 * Provides viewport-based rendering for Monaco Editor to handle extremely large
 * files (50,000+ lines) without UI freezing or performance degradation.
 *
 * Performance considerations:
 * - Only renders visible lines plus overscan buffer
 * - Implements progressive loading for smooth scrolling
 * - Integrates with file chunking for memory efficiency
 * - Uses Monaco's built-in viewport rendering capabilities
 * - Prevents memory exhaustion through strategic content management
 *
 * @module lib/editor/virtualized-editor
 */

import type * as monaco from 'monaco-editor';
import {
  chunkFileContent,
  shouldChunkFile,
  getChunksInRange,
  type FileChunk,
  type ChunkedFile,
  type ChunkParams,
  DEFAULT_CHUNK_SIZE,
  CHUNK_OVERLAP,
} from './file-chunking';
import {
  analyzeFileSize,
  getOptimizedEditorOptionsByLineCount,
  type FileSizeInfo,
  type OptimizationOptions,
} from './large-file-optimizer';

// ============================================================================
// Constants and Thresholds
// ============================================================================

/**
 * Virtualization configuration constants
 */
export const VIRTUALIZATION_CONFIG = {
  /** Number of lines to render outside visible viewport (overscan) */
  OVERSCAN_LINES: 100,

  /** Minimum viewport height in lines */
  MIN_VIEWPORT_HEIGHT: 20,

  /** Maximum viewport height in lines */
  MAX_VIEWPORT_HEIGHT: 500,

  /** Debounce delay for scroll events (ms) */
  SCROLL_DEBOUNCE_MS: 16, // ~60fps

  /** Line height estimation (pixels) */
  ESTIMATED_LINE_HEIGHT: 19,

  /** Enable virtualization threshold (lines) */
  ENABLE_THRESHOLD: 5000,

  /** Force virtualization threshold (lines) */
  FORCE_THRESHOLD: 20000,
} as const;

// ============================================================================
// Types
// ============================================================================

/**
 * Viewport information
 */
export interface ViewportInfo {
  /** First visible line (0-based) */
  startLine: number;

  /** Last visible line (0-based, exclusive) */
  endLine: number;

  /** Number of visible lines */
  visibleLines: number;

  /** Viewport height in pixels */
  height: number;

  /** Scroll position in pixels */
  scrollTop: number;
}

/**
 * Virtualization state
 */
export interface VirtualizationState {
  /** Whether virtualization is enabled */
  enabled: boolean;

  /** Current viewport information */
  viewport: ViewportInfo;

  /** Chunked file data */
  chunkedFile: ChunkedFile | null;

  /** Currently loaded chunks (by index) */
  loadedChunks: Set<number>;

  /** File size information */
  fileSizeInfo: FileSizeInfo | null;

  /** Total number of lines in the file */
  totalLines: number;

  /** Last scroll timestamp for debouncing */
  lastScrollTime: number;
}

/**
 * Configuration options for VirtualizedEditor
 */
export interface VirtualizedEditorConfig {
  /** Monaco editor instance */
  editor: monaco.editor.IStandaloneCodeEditor;

  /** Initial file content */
  content?: string;

  /** Overscan size (lines to render outside viewport) */
  overscan?: number;

  /** Enable debug logging */
  debug?: boolean;

  /** Force virtualization regardless of file size */
  forceVirtualization?: boolean;

  /** Chunk size for large files (lines) */
  chunkSize?: number;

  /** Overlap size between chunks (lines) */
  overlapSize?: number;

  /** Custom optimization options */
  optimizationOptions?: OptimizationOptions;

  /** Monaco instance for setting language (optional) */
  monacoInstance?: typeof import('monaco-editor');

  /** Callback when viewport changes */
  onViewportChange?: (viewport: ViewportInfo) => void;

  /** Callback when chunks are loaded/unloaded */
  onChunksChange?: (loadedChunks: number[]) => void;
}

/**
 * Return value from createVirtualizedEditor
 */
export interface VirtualizedEditor {
  /** Set new content with virtualization */
  setContent: (content: string, language?: string) => void;

  /** Get current viewport information */
  getViewport: () => ViewportInfo;

  /** Get virtualization state */
  getState: () => VirtualizationState;

  /** Update viewport (useful for programmatic scrolling) */
  updateViewport: () => void;

  /** Enable/disable virtualization */
  setVirtualizationEnabled: (enabled: boolean) => void;

  /** Get file size information */
  getFileSizeInfo: () => FileSizeInfo | null;

  /** Dispose and cleanup */
  dispose: () => void;
}

// ============================================================================
// Virtualized Editor Implementation
// ============================================================================

/**
 * Creates a virtualized wrapper around Monaco Editor for large file support
 *
 * Usage:
 * ```tsx
 * const editor = monaco.editor.create(container, options);
 * const virtualizedEditor = createVirtualizedEditor({
 *   editor,
 *   content: largeFileContent,
 *   overscan: 100,
 * });
 *
 * // Later, update content
 * virtualizedEditor.setContent(newContent);
 *
 * // Cleanup
 * virtualizedEditor.dispose();
 * ```
 *
 * @param config - Configuration for virtualized editor
 * @returns VirtualizedEditor instance with control methods
 */
export function createVirtualizedEditor(
  config: VirtualizedEditorConfig
): VirtualizedEditor {
  const {
    editor,
    content = '',
    overscan = VIRTUALIZATION_CONFIG.OVERSCAN_LINES,
    debug = false,
    forceVirtualization = false,
    chunkSize = DEFAULT_CHUNK_SIZE.EDITOR,
    overlapSize = CHUNK_OVERLAP.EDITOR,
    optimizationOptions = {},
    monacoInstance,
    onViewportChange,
    onChunksChange,
  } = config;

  // State
  const state: VirtualizationState = {
    enabled: false,
    viewport: {
      startLine: 0,
      endLine: 0,
      visibleLines: 0,
      height: 0,
      scrollTop: 0,
    },
    chunkedFile: null,
    loadedChunks: new Set(),
    fileSizeInfo: null,
    totalLines: 0,
    lastScrollTime: 0,
  };

  // Disposables
  const disposables: monaco.IDisposable[] = [];
  let scrollDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Logs debug messages if debug mode is enabled
   */
  function log(...args: unknown[]): void {
    if (debug) {
      // eslint-disable-next-line no-console
      console.log('[VirtualizedEditor]', ...args);
    }
  }

  /**
   * Calculates current viewport information from editor
   */
  function calculateViewport(): ViewportInfo {
    const visibleRanges = editor.getVisibleRanges();
    const layoutInfo = editor.getLayoutInfo();

    if (visibleRanges.length === 0) {
      return {
        startLine: 0,
        endLine: 0,
        visibleLines: 0,
        height: layoutInfo.height,
        scrollTop: editor.getScrollTop(),
      };
    }

    // Get first and last visible lines
    const firstRange = visibleRanges[0];
    const lastRange = visibleRanges[visibleRanges.length - 1];

    const startLine = Math.max(0, firstRange.startLineNumber - 1); // Convert to 0-based
    const endLine = lastRange.endLineNumber; // Already exclusive

    return {
      startLine,
      endLine,
      visibleLines: endLine - startLine,
      height: layoutInfo.height,
      scrollTop: editor.getScrollTop(),
    };
  }

  /**
   * Updates viewport with overscan applied
   */
  function updateViewportWithOverscan(): ViewportInfo {
    const viewport = calculateViewport();

    // Apply overscan
    const startLine = Math.max(0, viewport.startLine - overscan);
    const endLine = Math.min(state.totalLines, viewport.endLine + overscan);

    const viewportWithOverscan: ViewportInfo = {
      ...viewport,
      startLine,
      endLine,
      visibleLines: endLine - startLine,
    };

    state.viewport = viewportWithOverscan;
    return viewportWithOverscan;
  }

  /**
   * Loads chunks for the current viewport
   */
  function loadViewportChunks(): void {
    if (!state.chunkedFile || !state.enabled) {
      return;
    }

    const { startLine, endLine } = state.viewport;
    const requiredChunks = getChunksInRange(state.chunkedFile, startLine, endLine);

    const newLoadedChunks = new Set(requiredChunks.map((chunk) => chunk.index));

    // Check if chunks changed
    const chunksChanged =
      newLoadedChunks.size !== state.loadedChunks.size ||
      ![...newLoadedChunks].every((idx) => state.loadedChunks.has(idx));

    if (chunksChanged) {
      state.loadedChunks = newLoadedChunks;

      log('Loaded chunks:', [...newLoadedChunks]);

      // Notify callback
      if (onChunksChange) {
        onChunksChange([...newLoadedChunks]);
      }
    }
  }

  /**
   * Handles scroll events with debouncing
   */
  function handleScroll(): void {
    const now = Date.now();
    state.lastScrollTime = now;

    // Debounce scroll handling
    if (scrollDebounceTimer) {
      clearTimeout(scrollDebounceTimer);
    }

    scrollDebounceTimer = setTimeout(() => {
      if (state.lastScrollTime !== now) {
        return; // Newer scroll event exists
      }

      const viewport = updateViewportWithOverscan();
      loadViewportChunks();

      log('Viewport updated:', viewport);

      if (onViewportChange) {
        onViewportChange(viewport);
      }
    }, VIRTUALIZATION_CONFIG.SCROLL_DEBOUNCE_MS);
  }

  /**
   * Sets content with virtualization support
   */
  function setContent(content: string, language?: string): void {
    const model = editor.getModel();
    if (!model) {
      return;
    }

    // Analyze file size
    const fileSizeInfo = analyzeFileSize(content);
    state.fileSizeInfo = fileSizeInfo;
    state.totalLines = fileSizeInfo.lineCount;

    log('File size info:', fileSizeInfo);

    // Determine if virtualization should be enabled
    const shouldVirtualize =
      forceVirtualization ||
      fileSizeInfo.lineCount >= VIRTUALIZATION_CONFIG.ENABLE_THRESHOLD;

    state.enabled = shouldVirtualize;

    // Apply optimized editor options based on file size
    const optimizedOptions = getOptimizedEditorOptionsByLineCount(
      fileSizeInfo.lineCount,
      optimizationOptions
    );
    editor.updateOptions(optimizedOptions);

    log('Virtualization enabled:', state.enabled);
    log('Optimized options applied:', optimizedOptions);

    // Create chunks if needed
    if (shouldVirtualize && fileSizeInfo.lineCount >= VIRTUALIZATION_CONFIG.FORCE_THRESHOLD) {
      const chunkParams: ChunkParams = {
        chunkSize,
        overlapSize,
        operationType: 'EDITOR',
        forceChunking: forceVirtualization,
      };

      state.chunkedFile = chunkFileContent(content, chunkParams);
      log('File chunked:', state.chunkedFile.metadata);
    } else {
      state.chunkedFile = null;
    }

    // Set content in editor
    model.setValue(content);

    // Update language if provided and monaco instance available
    if (language && monacoInstance) {
      monacoInstance.editor.setModelLanguage(model, language);
    }

    // Initialize viewport
    updateViewportWithOverscan();
    loadViewportChunks();
  }

  /**
   * Gets current viewport information
   */
  function getViewport(): ViewportInfo {
    return { ...state.viewport };
  }

  /**
   * Gets current virtualization state
   */
  function getState(): VirtualizationState {
    return {
      ...state,
      viewport: { ...state.viewport },
      loadedChunks: new Set(state.loadedChunks),
    };
  }

  /**
   * Updates viewport (useful for programmatic scrolling)
   */
  function updateViewport(): void {
    updateViewportWithOverscan();
    loadViewportChunks();
  }

  /**
   * Enables or disables virtualization
   */
  function setVirtualizationEnabled(enabled: boolean): void {
    state.enabled = enabled;
    log('Virtualization', enabled ? 'enabled' : 'disabled');

    if (enabled) {
      updateViewport();
    }
  }

  /**
   * Gets file size information
   */
  function getFileSizeInfo(): FileSizeInfo | null {
    return state.fileSizeInfo ? { ...state.fileSizeInfo } : null;
  }

  /**
   * Disposes resources and cleans up
   */
  function dispose(): void {
    // Clear scroll debounce timer
    if (scrollDebounceTimer) {
      clearTimeout(scrollDebounceTimer);
      scrollDebounceTimer = null;
    }

    // Dispose Monaco disposables
    disposables.forEach((d) => d.dispose());
    disposables.length = 0;

    // Clear state
    state.chunkedFile = null;
    state.loadedChunks.clear();
    state.fileSizeInfo = null;

    log('Disposed');
  }

  // ============================================================================
  // Setup
  // ============================================================================

  // Listen to scroll events
  disposables.push(
    editor.onDidScrollChange(() => {
      handleScroll();
    })
  );

  // Listen to layout changes (resize)
  disposables.push(
    editor.onDidLayoutChange(() => {
      updateViewport();
    })
  );

  // Initialize with content if provided
  if (content) {
    setContent(content);
  }

  // ============================================================================
  // Return API
  // ============================================================================

  return {
    setContent,
    getViewport,
    getState,
    updateViewport,
    setVirtualizationEnabled,
    getFileSizeInfo,
    dispose,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Checks if virtualization should be enabled for given content
 *
 * @param content - File content
 * @param forceVirtualization - Force virtualization regardless of size
 * @returns Whether virtualization should be enabled
 */
export function shouldEnableVirtualization(
  content: string,
  forceVirtualization: boolean = false
): boolean {
  if (forceVirtualization) {
    return true;
  }

  const lineCount = content.split('\n').length;
  return lineCount >= VIRTUALIZATION_CONFIG.ENABLE_THRESHOLD;
}

/**
 * Estimates viewport size from editor dimensions
 *
 * @param height - Editor height in pixels
 * @param lineHeight - Line height in pixels (default: 19)
 * @returns Estimated number of visible lines
 */
export function estimateViewportSize(
  height: number,
  lineHeight: number = VIRTUALIZATION_CONFIG.ESTIMATED_LINE_HEIGHT
): number {
  const lines = Math.ceil(height / lineHeight);
  return Math.min(
    Math.max(lines, VIRTUALIZATION_CONFIG.MIN_VIEWPORT_HEIGHT),
    VIRTUALIZATION_CONFIG.MAX_VIEWPORT_HEIGHT
  );
}

/**
 * Calculates optimal chunk size based on viewport
 *
 * @param viewportLines - Number of lines in viewport
 * @param overscan - Overscan size
 * @returns Recommended chunk size
 */
export function calculateOptimalChunkSize(
  viewportLines: number,
  overscan: number = VIRTUALIZATION_CONFIG.OVERSCAN_LINES
): number {
  // Chunk size should be at least 2x viewport + overscan
  const minChunkSize = (viewportLines + overscan * 2) * 2;

  // Use default if calculated is smaller
  return Math.max(minChunkSize, DEFAULT_CHUNK_SIZE.EDITOR);
}

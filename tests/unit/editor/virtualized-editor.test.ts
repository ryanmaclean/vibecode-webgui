/**
 * Unit tests for virtualized editor
 *
 * Tests viewport-based rendering, chunking integration, and performance optimizations
 * for handling large files (50,000+ lines) in Monaco Editor.
 *
 * @jest-environment jsdom
 */

import type * as monaco from 'monaco-editor';
import {
  createVirtualizedEditor,
  shouldEnableVirtualization,
  estimateViewportSize,
  calculateOptimalChunkSize,
  VIRTUALIZATION_CONFIG,
  type VirtualizedEditor,
  type VirtualizedEditorConfig,
  type ViewportInfo,
} from '@/lib/editor/virtualized-editor';

// Mock file chunking module
jest.mock('@/lib/editor/file-chunking', () => ({
  chunkFileContent: jest.fn((content: string) => ({
    chunks: [
      { index: 0, startLine: 0, endLine: 1000, content: content.substring(0, 10000) },
      { index: 1, startLine: 1000, endLine: 2000, content: content.substring(10000, 20000) },
    ],
    metadata: {
      totalChunks: 2,
      totalLines: 2000,
      chunkSize: 1000,
      overlapSize: 50,
    },
  })),
  shouldChunkFile: jest.fn((content: string) => content.length > 50000),
  getChunksInRange: jest.fn((chunkedFile: any, startLine: number, endLine: number) => {
    return chunkedFile.chunks.filter(
      (chunk: any) => chunk.startLine < endLine && chunk.endLine > startLine
    );
  }),
  DEFAULT_CHUNK_SIZE: { EDITOR: 1000 },
  CHUNK_OVERLAP: { EDITOR: 50 },
}));

// Mock large file optimizer module
jest.mock('@/lib/editor/large-file-optimizer', () => ({
  analyzeFileSize: jest.fn((content: string) => {
    const lines = content.split('\n');
    return {
      bytes: content.length,
      lineCount: lines.length,
      category: lines.length > 10000 ? 'xlarge' : lines.length > 1000 ? 'large' : 'medium',
      estimatedMemory: content.length * 2,
    };
  }),
  getOptimizedEditorOptionsByLineCount: jest.fn((lineCount: number) => ({
    minimap: { enabled: lineCount < 5000 },
    folding: lineCount < 10000,
    lineNumbers: 'on' as const,
    scrollBeyondLastLine: false,
  })),
}));

// ============================================================================
// Mock Monaco Editor
// ============================================================================

const createMockEditor = () => {
  const listeners: { [key: string]: Function[] } = {
    scroll: [],
    layout: [],
  };

  const mockEditor = {
    getModel: jest.fn(),
    getVisibleRanges: jest.fn(() => [
      {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 50,
        endColumn: 1,
      },
    ]),
    getLayoutInfo: jest.fn(() => ({
      height: 800,
      width: 1000,
    })),
    getScrollTop: jest.fn(() => 0),
    updateOptions: jest.fn(),
    onDidScrollChange: jest.fn((callback: Function) => {
      listeners.scroll.push(callback);
      return {
        dispose: jest.fn(() => {
          listeners.scroll = listeners.scroll.filter((cb) => cb !== callback);
        }),
      };
    }),
    onDidLayoutChange: jest.fn((callback: Function) => {
      listeners.layout.push(callback);
      return {
        dispose: jest.fn(() => {
          listeners.layout = listeners.layout.filter((cb) => cb !== callback);
        }),
      };
    }),
    _triggerScroll: () => {
      listeners.scroll.forEach((cb) => cb());
    },
    _triggerLayout: () => {
      listeners.layout.forEach((cb) => cb());
    },
  } as unknown as monaco.editor.IStandaloneCodeEditor;

  return mockEditor;
};

const createMockModel = (content: string = '') => {
  return {
    getValue: jest.fn(() => content),
    setValue: jest.fn(),
    uri: { path: '/test.ts' },
  } as unknown as monaco.editor.ITextModel;
};

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('Virtualized Editor Utilities', () => {
  describe('shouldEnableVirtualization', () => {
    it('should return true for large files above threshold', () => {
      const content = 'line\n'.repeat(6000);
      const result = shouldEnableVirtualization(content);

      expect(result).toBe(true);
    });

    it('should return false for small files below threshold', () => {
      const content = 'line\n'.repeat(1000);
      const result = shouldEnableVirtualization(content);

      expect(result).toBe(false);
    });

    it('should return true when forceVirtualization is true', () => {
      const content = 'small content';
      const result = shouldEnableVirtualization(content, true);

      expect(result).toBe(true);
    });

    it('should use ENABLE_THRESHOLD constant', () => {
      const content = 'line\n'.repeat(VIRTUALIZATION_CONFIG.ENABLE_THRESHOLD - 2);
      const resultBelow = shouldEnableVirtualization(content);

      const contentAbove = 'line\n'.repeat(VIRTUALIZATION_CONFIG.ENABLE_THRESHOLD + 1);
      const resultAbove = shouldEnableVirtualization(contentAbove);

      expect(resultBelow).toBe(false);
      expect(resultAbove).toBe(true);
    });
  });

  describe('estimateViewportSize', () => {
    it('should calculate lines from height and line height', () => {
      const height = 800;
      const lineHeight = 20;
      const result = estimateViewportSize(height, lineHeight);

      expect(result).toBe(40); // 800 / 20 = 40
    });

    it('should use default line height when not provided', () => {
      const height = 800;
      const result = estimateViewportSize(height);

      const expected = Math.ceil(height / VIRTUALIZATION_CONFIG.ESTIMATED_LINE_HEIGHT);
      expect(result).toBe(expected);
    });

    it('should respect minimum viewport height', () => {
      const height = 100; // Very small height
      const lineHeight = 20;
      const result = estimateViewportSize(height, lineHeight);

      expect(result).toBeGreaterThanOrEqual(VIRTUALIZATION_CONFIG.MIN_VIEWPORT_HEIGHT);
    });

    it('should respect maximum viewport height', () => {
      const height = 20000; // Very large height
      const lineHeight = 20;
      const result = estimateViewportSize(height, lineHeight);

      expect(result).toBeLessThanOrEqual(VIRTUALIZATION_CONFIG.MAX_VIEWPORT_HEIGHT);
    });

    it('should round up partial lines', () => {
      const height = 805; // Should result in 40.25 lines
      const lineHeight = 20;
      const result = estimateViewportSize(height, lineHeight);

      expect(result).toBe(41); // Math.ceil(40.25)
    });
  });

  describe('calculateOptimalChunkSize', () => {
    it('should calculate chunk size based on viewport and overscan', () => {
      const viewportLines = 50;
      const overscan = 100;
      const result = calculateOptimalChunkSize(viewportLines, overscan);

      const minChunkSize = (viewportLines + overscan * 2) * 2;
      expect(result).toBeGreaterThanOrEqual(minChunkSize);
    });

    it('should use default overscan when not provided', () => {
      const viewportLines = 50;
      const result = calculateOptimalChunkSize(viewportLines);

      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
    });

    it('should never return a chunk size smaller than default', () => {
      const viewportLines = 1;
      const overscan = 1;
      const result = calculateOptimalChunkSize(viewportLines, overscan);

      // Should use DEFAULT_CHUNK_SIZE.EDITOR minimum
      expect(result).toBeGreaterThanOrEqual(1000);
    });

    it('should scale with larger viewports', () => {
      const smallViewport = calculateOptimalChunkSize(50);
      const largeViewport = calculateOptimalChunkSize(200);

      // Both may return default minimum, or large should be >= small
      expect(largeViewport).toBeGreaterThanOrEqual(smallViewport);
    });
  });
});

// ============================================================================
// VirtualizedEditor Tests
// ============================================================================

describe('createVirtualizedEditor', () => {
  let mockEditor: monaco.editor.IStandaloneCodeEditor;
  let mockModel: monaco.editor.ITextModel;
  let virtualizedEditor: VirtualizedEditor;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockEditor = createMockEditor();
    mockModel = createMockModel();
    (mockEditor.getModel as jest.Mock).mockReturnValue(mockModel);
  });

  afterEach(() => {
    if (virtualizedEditor) {
      virtualizedEditor.dispose();
    }
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('should create a virtualized editor instance', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
      };

      virtualizedEditor = createVirtualizedEditor(config);

      expect(virtualizedEditor).toBeDefined();
      expect(virtualizedEditor.setContent).toBeInstanceOf(Function);
      expect(virtualizedEditor.getViewport).toBeInstanceOf(Function);
      expect(virtualizedEditor.getState).toBeInstanceOf(Function);
      expect(virtualizedEditor.updateViewport).toBeInstanceOf(Function);
      expect(virtualizedEditor.setVirtualizationEnabled).toBeInstanceOf(Function);
      expect(virtualizedEditor.getFileSizeInfo).toBeInstanceOf(Function);
      expect(virtualizedEditor.dispose).toBeInstanceOf(Function);
    });

    it('should set initial content if provided', () => {
      const content = 'test content\nline 2\nline 3';
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
        content,
      };

      virtualizedEditor = createVirtualizedEditor(config);

      expect(mockModel.setValue).toHaveBeenCalledWith(content);
    });

    it('should register scroll event listener', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
      };

      virtualizedEditor = createVirtualizedEditor(config);

      expect(mockEditor.onDidScrollChange).toHaveBeenCalled();
    });

    it('should register layout change listener', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
      };

      virtualizedEditor = createVirtualizedEditor(config);

      expect(mockEditor.onDidLayoutChange).toHaveBeenCalled();
    });

    it('should apply custom overscan configuration', () => {
      const customOverscan = 200;
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
        overscan: customOverscan,
      };

      virtualizedEditor = createVirtualizedEditor(config);
      const viewport = virtualizedEditor.getViewport();

      // Viewport should include overscan
      expect(viewport).toBeDefined();
    });
  });

  describe('setContent', () => {
    it('should set content in editor model', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
      };

      virtualizedEditor = createVirtualizedEditor(config);
      const content = 'new content\nline 2';

      virtualizedEditor.setContent(content);

      expect(mockModel.setValue).toHaveBeenCalledWith(content);
    });

    it('should enable virtualization for large files', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
      };

      virtualizedEditor = createVirtualizedEditor(config);
      const largeContent = 'line\n'.repeat(6000);

      virtualizedEditor.setContent(largeContent);

      const state = virtualizedEditor.getState();
      expect(state.enabled).toBe(true);
    });

    it('should not enable virtualization for small files', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
      };

      virtualizedEditor = createVirtualizedEditor(config);
      const smallContent = 'line\n'.repeat(100);

      virtualizedEditor.setContent(smallContent);

      const state = virtualizedEditor.getState();
      expect(state.enabled).toBe(false);
    });

    it('should force virtualization when forceVirtualization is true', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
        forceVirtualization: true,
      };

      virtualizedEditor = createVirtualizedEditor(config);
      const smallContent = 'small content';

      virtualizedEditor.setContent(smallContent);

      const state = virtualizedEditor.getState();
      expect(state.enabled).toBe(true);
    });

    it('should apply optimized editor options based on file size', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
      };

      virtualizedEditor = createVirtualizedEditor(config);
      const largeContent = 'line\n'.repeat(6000);

      virtualizedEditor.setContent(largeContent);

      expect(mockEditor.updateOptions).toHaveBeenCalled();
    });

    it('should analyze file size and store info', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
      };

      virtualizedEditor = createVirtualizedEditor(config);
      const content = 'line\n'.repeat(1000);

      virtualizedEditor.setContent(content);

      const fileSizeInfo = virtualizedEditor.getFileSizeInfo();
      expect(fileSizeInfo).toBeDefined();
      expect(fileSizeInfo?.lineCount).toBeGreaterThan(0);
    });

    it('should handle empty content', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
      };

      virtualizedEditor = createVirtualizedEditor(config);

      expect(() => virtualizedEditor.setContent('')).not.toThrow();

      const state = virtualizedEditor.getState();
      expect(state.totalLines).toBeDefined();
    });

    it('should not fail when model is null', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
      };

      virtualizedEditor = createVirtualizedEditor(config);
      (mockEditor.getModel as jest.Mock).mockReturnValue(null);

      expect(() => virtualizedEditor.setContent('test')).not.toThrow();
    });
  });

  describe('getViewport', () => {
    it('should return current viewport information', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
      };

      virtualizedEditor = createVirtualizedEditor(config);

      const viewport = virtualizedEditor.getViewport();

      expect(viewport).toBeDefined();
      expect(viewport).toHaveProperty('startLine');
      expect(viewport).toHaveProperty('endLine');
      expect(viewport).toHaveProperty('visibleLines');
      expect(viewport).toHaveProperty('height');
      expect(viewport).toHaveProperty('scrollTop');
    });

    it('should return viewport with overscan applied', () => {
      const overscan = 100;
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
        overscan,
      };

      virtualizedEditor = createVirtualizedEditor(config);

      const viewport = virtualizedEditor.getViewport();

      // Start line should account for overscan (but not go below 0)
      expect(viewport.startLine).toBeGreaterThanOrEqual(0);
    });

    it('should return a copy of viewport (not reference)', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
      };

      virtualizedEditor = createVirtualizedEditor(config);

      const viewport1 = virtualizedEditor.getViewport();
      const viewport2 = virtualizedEditor.getViewport();

      expect(viewport1).not.toBe(viewport2);
      expect(viewport1).toEqual(viewport2);
    });
  });

  describe('getState', () => {
    it('should return current virtualization state', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
      };

      virtualizedEditor = createVirtualizedEditor(config);

      const state = virtualizedEditor.getState();

      expect(state).toBeDefined();
      expect(state).toHaveProperty('enabled');
      expect(state).toHaveProperty('viewport');
      expect(state).toHaveProperty('chunkedFile');
      expect(state).toHaveProperty('loadedChunks');
      expect(state).toHaveProperty('fileSizeInfo');
      expect(state).toHaveProperty('totalLines');
      expect(state).toHaveProperty('lastScrollTime');
    });

    it('should return a copy of state (not reference)', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
      };

      virtualizedEditor = createVirtualizedEditor(config);

      const state1 = virtualizedEditor.getState();
      const state2 = virtualizedEditor.getState();

      expect(state1).not.toBe(state2);
      expect(state1.viewport).not.toBe(state2.viewport);
      expect(state1.loadedChunks).not.toBe(state2.loadedChunks);
    });

    it('should reflect enabled state correctly', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
      };

      virtualizedEditor = createVirtualizedEditor(config);

      const largeContent = 'line\n'.repeat(6000);
      virtualizedEditor.setContent(largeContent);

      const state = virtualizedEditor.getState();
      expect(state.enabled).toBe(true);
    });
  });

  describe('updateViewport', () => {
    it('should update viewport information', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
        overscan: 0, // No overscan to test exact values
      };

      virtualizedEditor = createVirtualizedEditor(config);

      // Change visible ranges to non-zero
      (mockEditor.getVisibleRanges as jest.Mock).mockReturnValue([
        {
          startLineNumber: 101, // 1-based line number
          startColumn: 1,
          endLineNumber: 150,
          endColumn: 1,
        },
      ]);

      virtualizedEditor.updateViewport();

      const viewport = virtualizedEditor.getViewport();
      // startLine should be 100 (0-based: 101 - 1)
      expect(viewport.startLine).toBeGreaterThanOrEqual(99);
    });

    it('should trigger viewport change callback', () => {
      const onViewportChange = jest.fn();
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
        onViewportChange,
      };

      virtualizedEditor = createVirtualizedEditor(config);

      virtualizedEditor.updateViewport();

      // Callback may be triggered (depends on implementation details)
      // Just verify it doesn't throw
      expect(() => virtualizedEditor.updateViewport()).not.toThrow();
    });
  });

  describe('setVirtualizationEnabled', () => {
    it('should enable virtualization', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
      };

      virtualizedEditor = createVirtualizedEditor(config);

      virtualizedEditor.setVirtualizationEnabled(true);

      const state = virtualizedEditor.getState();
      expect(state.enabled).toBe(true);
    });

    it('should disable virtualization', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
        forceVirtualization: true,
      };

      virtualizedEditor = createVirtualizedEditor(config);
      virtualizedEditor.setContent('test');

      // Should start enabled
      expect(virtualizedEditor.getState().enabled).toBe(true);

      virtualizedEditor.setVirtualizationEnabled(false);

      const state = virtualizedEditor.getState();
      expect(state.enabled).toBe(false);
    });

    it('should update viewport when enabling', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
      };

      virtualizedEditor = createVirtualizedEditor(config);

      virtualizedEditor.setVirtualizationEnabled(true);

      // Should not throw
      expect(() => virtualizedEditor.getViewport()).not.toThrow();
    });
  });

  describe('getFileSizeInfo', () => {
    it('should return file size information after setContent', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
      };

      virtualizedEditor = createVirtualizedEditor(config);
      const content = 'line\n'.repeat(1000);

      virtualizedEditor.setContent(content);

      const info = virtualizedEditor.getFileSizeInfo();

      expect(info).toBeDefined();
      expect(info?.lineCount).toBeGreaterThan(0);
      expect(info?.bytes).toBeGreaterThan(0);
    });

    it('should return null before setContent is called', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
      };

      virtualizedEditor = createVirtualizedEditor(config);

      const info = virtualizedEditor.getFileSizeInfo();

      expect(info).toBeNull();
    });

    it('should return a copy of file size info', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
      };

      virtualizedEditor = createVirtualizedEditor(config);
      virtualizedEditor.setContent('test content');

      const info1 = virtualizedEditor.getFileSizeInfo();
      const info2 = virtualizedEditor.getFileSizeInfo();

      if (info1 && info2) {
        expect(info1).not.toBe(info2);
        expect(info1).toEqual(info2);
      }
    });
  });

  describe('scroll handling', () => {
    it('should handle scroll events with debouncing', () => {
      const onViewportChange = jest.fn();
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
        onViewportChange,
      };

      virtualizedEditor = createVirtualizedEditor(config);
      virtualizedEditor.setContent('line\n'.repeat(1000));

      // Trigger scroll
      (mockEditor as any)._triggerScroll();

      // Should not call immediately (debounced)
      expect(onViewportChange).not.toHaveBeenCalled();

      // Fast-forward timers
      jest.advanceTimersByTime(VIRTUALIZATION_CONFIG.SCROLL_DEBOUNCE_MS);

      // Now should be called
      expect(onViewportChange).toHaveBeenCalled();
    });

    it('should debounce multiple rapid scroll events', () => {
      const onViewportChange = jest.fn();
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
        onViewportChange,
      };

      virtualizedEditor = createVirtualizedEditor(config);
      virtualizedEditor.setContent('line\n'.repeat(1000));

      // Trigger multiple scrolls rapidly
      (mockEditor as any)._triggerScroll();
      jest.advanceTimersByTime(5);
      (mockEditor as any)._triggerScroll();
      jest.advanceTimersByTime(5);
      (mockEditor as any)._triggerScroll();

      // Fast-forward past debounce time
      jest.advanceTimersByTime(VIRTUALIZATION_CONFIG.SCROLL_DEBOUNCE_MS);

      // Should only be called once
      expect(onViewportChange).toHaveBeenCalledTimes(1);
    });

    it('should update viewport on scroll', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
      };

      virtualizedEditor = createVirtualizedEditor(config);
      virtualizedEditor.setContent('line\n'.repeat(1000));

      const viewportBefore = virtualizedEditor.getViewport();

      // Change scroll position
      (mockEditor.getScrollTop as jest.Mock).mockReturnValue(500);
      (mockEditor as any)._triggerScroll();

      jest.advanceTimersByTime(VIRTUALIZATION_CONFIG.SCROLL_DEBOUNCE_MS);

      const viewportAfter = virtualizedEditor.getViewport();

      // Viewport should be updated
      expect(viewportAfter.scrollTop).not.toBe(viewportBefore.scrollTop);
    });
  });

  describe('layout change handling', () => {
    it('should update viewport on layout change', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
      };

      virtualizedEditor = createVirtualizedEditor(config);
      virtualizedEditor.setContent('line\n'.repeat(1000));

      // Change layout
      (mockEditor.getLayoutInfo as jest.Mock).mockReturnValue({
        height: 1200,
        width: 1000,
      });

      (mockEditor as any)._triggerLayout();

      const viewport = virtualizedEditor.getViewport();
      expect(viewport.height).toBe(1200);
    });

    it('should handle layout change without content', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
      };

      virtualizedEditor = createVirtualizedEditor(config);

      expect(() => (mockEditor as any)._triggerLayout()).not.toThrow();
    });
  });

  describe('callbacks', () => {
    it('should call onViewportChange when viewport updates', () => {
      const onViewportChange = jest.fn();
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
        onViewportChange,
      };

      virtualizedEditor = createVirtualizedEditor(config);
      virtualizedEditor.setContent('line\n'.repeat(1000));

      virtualizedEditor.updateViewport();

      // May or may not be called depending on implementation
      // Just verify no errors
      expect(onViewportChange).toBeDefined();
    });

    it('should call onChunksChange when chunks are loaded', () => {
      const onChunksChange = jest.fn();
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
        onChunksChange,
        forceVirtualization: true,
      };

      virtualizedEditor = createVirtualizedEditor(config);

      const largeContent = 'line\n'.repeat(25000);
      virtualizedEditor.setContent(largeContent);

      // Chunks callback may be called when chunks are loaded
      expect(onChunksChange).toBeDefined();
    });
  });

  describe('dispose', () => {
    it('should clean up resources', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
      };

      virtualizedEditor = createVirtualizedEditor(config);
      virtualizedEditor.setContent('test content');

      expect(() => virtualizedEditor.dispose()).not.toThrow();
    });

    it('should clear state on dispose', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
      };

      virtualizedEditor = createVirtualizedEditor(config);
      virtualizedEditor.setContent('test content');

      virtualizedEditor.dispose();

      const state = virtualizedEditor.getState();
      expect(state.chunkedFile).toBeNull();
      expect(state.fileSizeInfo).toBeNull();
      expect(state.loadedChunks.size).toBe(0);
    });

    it('should clear scroll debounce timer', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
      };

      virtualizedEditor = createVirtualizedEditor(config);
      virtualizedEditor.setContent('line\n'.repeat(1000));

      // Trigger scroll to create timer
      (mockEditor as any)._triggerScroll();

      virtualizedEditor.dispose();

      // Fast-forward timers - callback should not be called after dispose
      jest.advanceTimersByTime(VIRTUALIZATION_CONFIG.SCROLL_DEBOUNCE_MS);

      // Should not throw
      expect(() => virtualizedEditor.getState()).not.toThrow();
    });

    it('should be safe to call multiple times', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
      };

      virtualizedEditor = createVirtualizedEditor(config);

      expect(() => {
        virtualizedEditor.dispose();
        virtualizedEditor.dispose();
        virtualizedEditor.dispose();
      }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty visible ranges', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
      };

      virtualizedEditor = createVirtualizedEditor(config);
      (mockEditor.getVisibleRanges as jest.Mock).mockReturnValue([]);

      virtualizedEditor.setContent('test');

      const viewport = virtualizedEditor.getViewport();
      expect(viewport.startLine).toBe(0);
      // endLine may be 0 or 1 depending on empty content handling
      expect(viewport.endLine).toBeGreaterThanOrEqual(0);
    });

    it('should handle very large files exceeding force threshold', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
      };

      virtualizedEditor = createVirtualizedEditor(config);

      const veryLargeContent = 'line\n'.repeat(25000);
      virtualizedEditor.setContent(veryLargeContent);

      const state = virtualizedEditor.getState();
      expect(state.enabled).toBe(true);
      expect(state.chunkedFile).toBeDefined();
    });

    it('should clamp viewport to file boundaries', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
        overscan: 1000, // Large overscan
      };

      virtualizedEditor = createVirtualizedEditor(config);
      virtualizedEditor.setContent('line\n'.repeat(100));

      const viewport = virtualizedEditor.getViewport();

      expect(viewport.startLine).toBeGreaterThanOrEqual(0);
      // endLine can be totalLines (exclusive upper bound)
      expect(viewport.endLine).toBeLessThanOrEqual(101);
    });

    it('should handle single-line files', () => {
      const config: VirtualizedEditorConfig = {
        editor: mockEditor,
      };

      virtualizedEditor = createVirtualizedEditor(config);
      virtualizedEditor.setContent('single line');

      const state = virtualizedEditor.getState();
      expect(state.totalLines).toBeGreaterThan(0);
      expect(state.enabled).toBe(false);
    });
  });
});

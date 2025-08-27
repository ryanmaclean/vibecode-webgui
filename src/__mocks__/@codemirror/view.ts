import { vi } from 'vitest';

// Create a mock EditorView constructor
const EditorView = vi.fn().mockImplementation((props: any) => {
  const mockView = {
    dom: document.createElement('div'),
    contentDOM: document.createElement('div'),
    scrollDOM: document.createElement('div'),
    state: { 
      field: vi.fn(),
      sliceDoc: vi.fn().mockReturnValue(''),
      doc: { toString: () => '' },
      selection: { main: { from: 0, to: 0 } },
      docChanged: false,
    },
    viewport: { from: 0, to: 0 },
    viewportLineBlocks: [],
    viewportLineHeights: { length: 0 },
    visibleRanges: [{ from: 0, to: 0 }],
    domAtPos: vi.fn().mockReturnValue({ node: document.createElement('div'), offset: 0 }),
    posAtDOM: vi.fn().mockReturnValue(0),
    coordsAtPos: vi.fn().mockReturnValue({ top: 0, left: 0, bottom: 0, right: 0 }),
    posAtCoords: vi.fn().mockReturnValue({ pos: 0, inside: 0 }),
    dispatch: vi.fn(),
    update: vi.fn(),
    setState: vi.fn(),
    destroy: vi.fn(),
    focus: vi.fn(),
    hasFocus: vi.fn().mockReturnValue(false),
    scrollIntoView: vi.fn(),
    requestMeasure: vi.fn(),
    requestMeasureOfHeights: vi.fn(),
    measureRequest: { read: vi.fn(), write: vi.fn() },
    updateViewport: vi.fn(),
    ...props
  };
  
  // Add some test helpers
  mockView.state.doc = {
    ...mockView.state.doc,
    length: 0,
    lines: 1,
    lineAt: vi.fn().mockReturnValue({ from: 0, to: 0, number: 1 }),
    line: vi.fn().mockReturnValue({ from: 0, to: 0, number: 1 }),
    replace: vi.fn(),
    toString: vi.fn().mockReturnValue(''),
  };
  
  return mockView;
});

// Add static methods and properties
Object.assign(EditorView, {
  theme: vi.fn().mockImplementation((spec: any) => ({
    theme: spec
  })),
  updateListener: vi.fn().mockReturnValue({}),
  domEventHandlers: vi.fn().mockReturnValue({}),
  lineNumbers: vi.fn().mockReturnValue({}),
  highlightActiveLineGutter: vi.fn().mockReturnValue({}),
  highlightSpecialChars: vi.fn().mockReturnValue({}),
  drawSelection: vi.fn().mockReturnValue({}),
  dropCursor: vi.fn().mockReturnValue({}),
  rectangularSelection: vi.fn().mockReturnValue({}),
  crosshairCursor: vi.fn().mockReturnValue({}),
  highlightActiveLine: vi.fn().mockReturnValue({}),
  keymap: vi.fn().mockReturnValue({}),
  placeholder: vi.fn().mockReturnValue({}),
  tooltips: {
    hoverTooltip: vi.fn().mockReturnValue({})
  },
  showTooltip: vi.fn(),
  Decoration: {
    mark: vi.fn().mockReturnValue({}),
    widget: vi.fn().mockReturnValue({}),
    replace: vi.fn().mockReturnValue({}),
    set: vi.fn().mockReturnValue({}),
    none: []
  },
  ViewPlugin: {
    define: vi.fn().mockReturnValue({})
  },
  logException: vi.fn(),
  EditorState: {
    create: vi.fn().mockReturnValue({
      field: vi.fn(),
      doc: { toString: () => '' },
      selection: { main: { from: 0, to: 0 } },
      docChanged: false
    })
  },
  EditorSelection: {
    range: vi.fn().mockReturnValue({}),
    cursor: vi.fn().mockReturnValue({})
  },
  StateEffect: {
    define: vi.fn().mockReturnValue(() => {})
  },
  StateField: {
    define: vi.fn().mockReturnValue({})
  },
  syntaxHighlighting: vi.fn().mockReturnValue({}),
  gutter: vi.fn().mockReturnValue({}),
  foldGutter: vi.fn().mockReturnValue({}),
  indentOnInput: vi.fn().mockReturnValue({}),
  indentUnit: vi.fn().mockReturnValue({}),
  history: vi.fn().mockReturnValue({}),
  defaultHighlightStyle: { 
    style: vi.fn().mockReturnValue({}) 
  },
  getToolbar: vi.fn().mockReturnValue([]),
  getTooltip: vi.fn().mockReturnValue(null),
  getTooltips: vi.fn().mockReturnValue([]),
  getPanel: vi.fn().mockReturnValue(null),
  getPanelPos: vi.fn().mockReturnValue({}),
  getPanelView: vi.fn().mockReturnValue({}),
  getPanelViews: vi.fn().mockReturnValue({}),
  getPanelPositions: vi.fn().mockReturnValue({}),
  getPanelViewport: vi.fn().mockReturnValue({}),
  getPanelViewports: vi.fn().mockReturnValue({}),
  getPanelViewportAt: vi.fn().mockReturnValue({}),
  getPanelViewportsAt: vi.fn().mockReturnValue({}),
  getPanelViewportForPos: vi.fn().mockReturnValue({}),
  getPanelViewportsForPos: vi.fn().mockReturnValue({}),
  getPanelViewportForLine: vi.fn().mockReturnValue({}),
  getPanelViewportsForLine: vi.fn().mockReturnValue({}),
  getPanelViewportForRange: vi.fn().mockReturnValue({}),
  getPanelViewportsForRange: vi.fn().mockReturnValue({}),
  getPanelViewportForSelection: vi.fn().mockReturnValue({}),
  getPanelViewportsForSelection: vi.fn().mockReturnValue({}),
  getPanelViewportForCursor: vi.fn().mockReturnValue({}),
  getPanelViewportsForCursor: vi.fn().mockReturnValue({}),
  getPanelViewportForCoords: vi.fn().mockReturnValue({}),
  getPanelViewportsForCoords: vi.fn().mockReturnValue({}),
  getPanelViewportForDOM: vi.fn().mockReturnValue({}),
  getPanelViewportsForDOM: vi.fn().mockReturnValue({}),
  getTheme: vi.fn().mockReturnValue({}),
  getThemeExtensions: vi.fn().mockReturnValue([]),
  pluginField: vi.fn().mockReturnValue({}),
  scrollIntoView: vi.fn().mockReturnValue({}),
  baseTheme: vi.fn().mockReturnValue({}),
  editable: vi.fn().mockReturnValue({}),
  closeTooltips: vi.fn().mockReturnValue({}),
  repositionTooltips: vi.fn().mockReturnValue({})
});

// Export the mock and individual mocks
export { EditorView };

export const keymap = vi.fn().mockReturnValue({});
export const drawSelection = vi.fn().mockReturnValue({});
export const dropCursor = vi.fn().mockReturnValue({});
export const rectangularSelection = vi.fn().mockReturnValue({});
export const highlightActiveLineGutter = vi.fn().mockReturnValue({});
export const highlightSpecialChars = vi.fn().mockReturnValue({});
export const history = vi.fn().mockReturnValue({});
export const foldGutter = vi.fn().mockReturnValue({});
export const indentOnInput = vi.fn().mockReturnValue({});
export const syntaxHighlighting = vi.fn().mockReturnValue({});
export const defaultHighlightStyle = { fallback: true };

export const Decoration = {
  mark: vi.fn().mockReturnValue({}),
  widget: vi.fn().mockReturnValue({}),
  replace: vi.fn().mockReturnValue({}),
  set: vi.fn().mockReturnValue({}),
  none: []
};

export const ViewPlugin = {
  define: vi.fn().mockReturnValue({})
};

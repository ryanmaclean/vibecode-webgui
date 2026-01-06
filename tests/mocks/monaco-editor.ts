/**
 * Mock for Monaco Editor
 */

export const mockEditor = {
  getValue: jest.fn(() => ''),
  setValue: jest.fn(),
  getModel: jest.fn(() => null),
  setModel: jest.fn(),
  dispose: jest.fn(),
  layout: jest.fn(),
  focus: jest.fn(),
  onDidChangeModelContent: jest.fn(() => ({ dispose: jest.fn() })),
  onDidChangeCursorPosition: jest.fn(() => ({ dispose: jest.fn() })),
  getPosition: jest.fn(() => ({ lineNumber: 1, column: 1 })),
  setPosition: jest.fn(),
  revealLine: jest.fn(),
  deltaDecorations: jest.fn(() => []),
};

export const mockMonaco = {
  editor: {
    create: jest.fn(() => mockEditor),
    createModel: jest.fn(),
    setModelLanguage: jest.fn(),
    defineTheme: jest.fn(),
    setTheme: jest.fn(),
  },
  languages: {
    register: jest.fn(),
    setMonarchTokensProvider: jest.fn(),
    setLanguageConfiguration: jest.fn(),
    registerCompletionItemProvider: jest.fn(),
  },
  KeyCode: {},
  KeyMod: {},
};

export default mockMonaco;

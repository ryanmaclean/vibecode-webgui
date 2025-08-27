import { CollaborationUser } from '../components/collaboration/types';

type MockUserOptions = Partial<CollaborationUser>;

export const createMockUser = (overrides: MockUserOptions = {}): CollaborationUser => ({
  id: 'user1',
  name: 'Test User',
  email: 'test@example.com',
  color: '#007bff',
  ...overrides
});

type MockEditorOptions = {
  content?: string;
  selection?: { from: number; to: number };
};

export const createMockEditorView = (options: MockEditorOptions = {}) => {
  const { content = '', selection = { from: 0, to: 0 } } = options;
  
  return {
    state: {
      doc: { toString: () => content },
      selection: { main: { head: selection.from, anchor: selection.to } },
      update: jest.fn()
    },
    updateListener: jest.fn(),
    domEventHandlers: jest.fn(),
    theme: jest.fn(),
    lineWrapping: jest.fn(),
    dispatch: jest.fn(),
  };
};

export const createMockAwareness = () => ({
  setLocalState: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  getStates: jest.fn().mockReturnValue(new Map())
});

export const createMockYText = (initialContent = '') => ({
  insert: jest.fn(),
  delete: jest.fn(),
  length: initialContent.length,
  toJSON: jest.fn().mockReturnValue(initialContent)
});

export const createMockProvider = (awareness: ReturnType<typeof createMockAwareness>) => ({
  awareness,
  on: jest.fn(),
  off: jest.fn()
});

export const setupCollaborationMocks = () => {
  const mockAwareness = createMockAwareness();
  const mockYText = createMockYText();
  const mockProvider = createMockProvider(mockAwareness);
  const mockJoinSession = jest.fn().mockResolvedValue({
    provider: mockProvider,
    yText: mockYText,
    destroy: jest.fn()
  });
  
  const mockLeaveSession = jest.fn().mockResolvedValue(true);
  
  return {
    mockAwareness,
    mockYText,
    mockProvider,
    mockJoinSession,
    mockLeaveSession
  };
};

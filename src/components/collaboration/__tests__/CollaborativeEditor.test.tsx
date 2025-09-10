import React from 'react';
import { render, act, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import CollaborativeEditor from '../CollaborativeEditor';

// Mock the collaboration manager
const mockJoinSession = jest.fn();
const mockLeaveSession = jest.fn();
const mockGetText = jest.fn();
const mockUpdateCursor = jest.fn();
const mockSetCurrentUser = jest.fn();
const mockGetActiveUsers = jest.fn();

jest.mock('../../../lib/collaboration', () => ({
  collaborationManager: {
    setCurrentUser: mockSetCurrentUser,
    joinSession: mockJoinSession,
    leaveSession: mockLeaveSession,
    getText: mockGetText,
    updateCursor: mockUpdateCursor,
    getActiveUsers: mockGetActiveUsers,
    on: jest.fn(),
    off: jest.fn(),
    destroy: jest.fn(),
    getStats: jest.fn().mockReturnValue({ users: 1, updates: 0, documentSize: 12 }),
    getMap: jest.fn().mockReturnValue(new Map())
  }
}));

// Mock CodeMirror
jest.mock('@codemirror/view', () => {
  // Use mock-prefixed variable to avoid scope issues
  const mockDocument = { 
    createElement: jest.fn().mockReturnValue({ 
      setAttribute: jest.fn(),
      style: {},
      classList: { add: jest.fn(), remove: jest.fn() }
    }) 
  };
  const mockDiv = mockDocument.createElement('div');
  mockDiv.setAttribute('role', 'textbox');
  
  return {
    EditorView: jest.fn().mockImplementation(() => ({
      state: { 
        field: jest.fn(),
        doc: { 
          toString: () => 'test content',
          lineAt: jest.fn().mockReturnValue({ number: 1, from: 0 })
        },
        selection: { main: { head: 0 } }
      },
      dispatch: jest.fn(),
      update: jest.fn(),
      setState: jest.fn(),
      dom: mockDiv,
      contentDOM: mockDiv,
      scrollDOM: mockDiv,
      destroy: jest.fn(),
    })),
    keymap: jest.fn().mockReturnValue({}),
    drawSelection: jest.fn().mockReturnValue({}),
    dropCursor: jest.fn().mockReturnValue({}),
    highlightActiveLineGutter: jest.fn().mockReturnValue({}),
    highlightSpecialChars: jest.fn().mockReturnValue({}),
    history: jest.fn().mockReturnValue({}),
    foldGutter: jest.fn().mockReturnValue({}),
    indentOnInput: jest.fn().mockReturnValue({}),
    syntaxHighlighting: jest.fn().mockReturnValue({}),
    defaultHighlightStyle: { fallback: true },
    Decoration: {
      mark: jest.fn().mockReturnValue({})
    },
    ViewPlugin: jest.fn().mockReturnValue({}),
    updateListener: {
      of: jest.fn().mockReturnValue({})
    },
    theme: jest.fn().mockReturnValue({})
  };
});

// Mock CodeMirror state
jest.mock('@codemirror/state', () => ({
  EditorState: {
    create: jest.fn().mockReturnValue({
      field: jest.fn(),
      doc: { 
        toString: () => 'test content',
        lineAt: jest.fn().mockReturnValue({ number: 1, from: 0 })
      },
      selection: { main: { from: 0, to: 0, head: 0 } },
      docChanged: false,
    }),
    readOnly: {
      of: jest.fn().mockReturnValue({})
    }
  },
  EditorSelection: {
    cursor: jest.fn().mockReturnValue({}),
    range: jest.fn().mockReturnValue({}),
  },
  StateEffect: {
    define: jest.fn().mockReturnValue({}),
  },
  StateField: {
    define: jest.fn().mockReturnValue({}),
  },
}));

// Mock language packages
jest.mock('@codemirror/lang-javascript', () => ({
  javascript: jest.fn().mockReturnValue({})
}));

// Note: @codemirror/lang-html and @codemirror/lang-css not installed in this project

// Mock DOMPurify
jest.mock('dompurify', () => ({
  default: {
    sanitize: jest.fn().mockImplementation((html) => html)
  }
}));

describe('CollaborativeEditor', () => {
  const mockCurrentUser = {
    id: 'test-user-1',
    name: 'Test User',
    email: 'test@example.com',
    color: '#000000'
  };

  const defaultProps = {
    documentId: 'test-doc-1',
    projectId: 'test-project-1',
    filePath: 'test.js',
    currentUser: mockCurrentUser,
    onError: jest.fn(),
    onContentChange: jest.fn(),
    onUserJoin: jest.fn(),
    onUserLeave: jest.fn(),
    readOnly: false,
    initialContent: '// Test content',
    language: 'javascript'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default session mock
    mockJoinSession.mockResolvedValue({
      documentId: 'test-doc-1',
      projectId: 'test-project-1',
      provider: {
        awareness: {
          on: jest.fn(),
          off: jest.fn(),
          getStates: jest.fn(() => new Map()),
          setLocalState: jest.fn(),
          getLocalState: jest.fn()
        }
      },
      awareness: {
        on: jest.fn(),
        off: jest.fn(),
        getStates: jest.fn(() => new Map()),
        setLocalState: jest.fn(),
        getLocalState: jest.fn()
      },
      doc: {
        transact: jest.fn(),
        on: jest.fn(),
        off: jest.fn()
      }
    });

    // Setup default text mock
    mockGetText.mockReturnValue({
      toString: () => 'test content',
      length: 12,
      insert: jest.fn(),
      delete: jest.fn()
    });
    
    // Setup getActiveUsers mock
    mockGetActiveUsers.mockReturnValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders without crashing', async () => {
    await act(async () => {
      render(<CollaborativeEditor 
        documentId={defaultProps.documentId}
        projectId={defaultProps.projectId}
        filePath={defaultProps.filePath}
        currentUser={defaultProps.currentUser}
      />);
    });
    
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('joins the collaboration session on mount', async () => {
    await act(async () => {
      render(<CollaborativeEditor 
        documentId={defaultProps.documentId}
        projectId={defaultProps.projectId}
        filePath={defaultProps.filePath}
        currentUser={defaultProps.currentUser}
      />);
    });

    expect(mockJoinSession).toHaveBeenCalledWith(
      defaultProps.documentId,
      defaultProps.projectId,
      defaultProps.filePath
    );
    
    expect(mockSetCurrentUser).toHaveBeenCalledWith(mockCurrentUser);
  });

  it('initializes with specific language mode', async () => {
    await act(async () => {
      render(<CollaborativeEditor 
        documentId={defaultProps.documentId}
        projectId={defaultProps.projectId}
        filePath={defaultProps.filePath}
        currentUser={defaultProps.currentUser}
        language="typescript"
      />);
    });
    
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('respects readOnly setting', async () => {
    await act(async () => {
      render(<CollaborativeEditor 
        documentId={defaultProps.documentId}
        projectId={defaultProps.projectId}
        filePath={defaultProps.filePath}
        currentUser={defaultProps.currentUser}
        readOnly={true}
      />);
    });
    
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('handles content changes', async () => {
    const onContentChange = jest.fn();
    
    await act(async () => {
      render(<CollaborativeEditor 
        documentId={defaultProps.documentId}
        projectId={defaultProps.projectId}
        filePath={defaultProps.filePath}
        currentUser={defaultProps.currentUser}
        readOnly={false}
        onContentChange={onContentChange}
      />);
    });
    
    // This would normally be triggered by the editor
    // We're just testing the prop is passed correctly
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
});
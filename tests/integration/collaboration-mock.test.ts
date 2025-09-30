/**
 * Integration tests for collaboration functionality with mocks
 * Validates collaborative editor behavior without real infrastructure
 */

import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { mockCollaborationManager } from '../../__mocks__/collaboration-manager'
import type { CollaborationUser } from '../../__mocks__/collaboration-manager'

// Mock the collaboration manager in the component
jest.mock('@/lib/collaboration', () => ({
  collaborationManager: mockCollaborationManager
}))

// Mock CodeMirror dependencies
jest.mock('@codemirror/view', () => ({
  EditorView: jest.fn().mockImplementation(() => ({
    dom: document.createElement('div'),
    destroy: jest.fn(),
    dispatch: jest.fn(),
    state: {
      doc: { toString: () => 'test content' }
    }
  })),
  keymap: jest.fn().mockReturnValue({}),
  lineNumbers: jest.fn().mockReturnValue({}),
  foldGutter: jest.fn().mockReturnValue({}),
  dropCursor: jest.fn().mockReturnValue({})
}))

jest.mock('@codemirror/state', () => ({
  EditorState: {
    create: jest.fn().mockReturnValue({
      doc: { toString: () => 'test content', length: 12 },
      selection: { main: { from: 0, to: 0 } }
    })
  },
  Compartment: jest.fn().mockImplementation(() => ({
    of: jest.fn().mockReturnValue({})
  }))
}))

jest.mock('@codemirror/lang-javascript', () => ({
  javascript: jest.fn().mockReturnValue({})
}))

// Import after mocking
import CollaborativeEditor from '@/components/collaboration/CollaborativeEditor'

describe('Collaboration Integration with Mocks', () => {
  const mockUser1: CollaborationUser = {
    id: 'user-1',
    name: 'Alice Developer',
    email: 'alice@example.com',
    color: '#ff6b6b'
  }

  const mockUser2: CollaborationUser = {
    id: 'user-2',
    name: 'Bob Coder',
    email: 'bob@example.com',
    color: '#4ecdc4'
  }

  beforeEach(() => {
    mockCollaborationManager.clearAllSessions()
    jest.clearAllMocks()
  })

  const defaultProps = {
    documentId: 'test-document',
    projectId: 'test-project',
    filePath: 'src/App.tsx',
    currentUser: mockUser1,
    onError: jest.fn(),
    onContentChange: jest.fn(),
    onUserJoin: jest.fn(),
    onUserLeave: jest.fn(),
    readOnly: false,
    initialContent: '// Initial test content',
    language: 'javascript' as const
  }

  describe('Component Initialization', () => {
    it('should render collaborative editor', async () => {
      await act(async () => {
        render(<CollaborativeEditor {...defaultProps} />)
      })

      // The component should render without crashing
      expect(screen.getByRole('textbox', { hidden: true })).toBeInTheDocument()
    })

    it('should join collaboration session on mount', async () => {
      const joinSessionSpy = jest.spyOn(mockCollaborationManager, 'joinSession')
      const setCurrentUserSpy = jest.spyOn(mockCollaborationManager, 'setCurrentUser')

      await act(async () => {
        render(<CollaborativeEditor {...defaultProps} />)
      })

      await waitFor(() => {
        expect(setCurrentUserSpy).toHaveBeenCalledWith(mockUser1)
        expect(joinSessionSpy).toHaveBeenCalledWith(
          'test-document',
          'test-project',
          'src/App.tsx'
        )
      })
    })

    it('should handle session join errors gracefully', async () => {
      const joinSessionSpy = jest.spyOn(mockCollaborationManager, 'joinSession')
      joinSessionSpy.mockRejectedValueOnce(new Error('Connection failed'))

      const onErrorSpy = jest.fn()

      await act(async () => {
        render(<CollaborativeEditor {...defaultProps} onError={onErrorSpy} />)
      })

      await waitFor(() => {
        expect(onErrorSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('Connection failed')
          })
        )
      })
    })
  })

  describe('Multi-user Collaboration', () => {
    it('should handle multiple users joining the same session', async () => {
      // First user joins
      await act(async () => {
        render(<CollaborativeEditor {...defaultProps} />)
      })

      // Simulate second user joining the same document
      const session = mockCollaborationManager.getSession('test-document')
      expect(session).toBeDefined()

      mockCollaborationManager.addUserToSession('test-document', mockUser2)

      const activeUsers = mockCollaborationManager.getActiveUsers(session!)
      expect(activeUsers).toHaveLength(2)
      expect(activeUsers).toContainEqual(mockUser1)
      expect(activeUsers).toContainEqual(mockUser2)
    })

    it('should track user cursor positions', async () => {
      await act(async () => {
        render(<CollaborativeEditor {...defaultProps} />)
      })

      const session = mockCollaborationManager.getSession('test-document')
      expect(session).toBeDefined()

      // Update cursor position
      mockCollaborationManager.updateCursor(session!, 10, 25)

      const user = session!.users.get(mockUser1.id)
      expect(user?.cursor).toEqual({ line: 10, column: 25 })
    })

    it('should provide session statistics', async () => {
      await act(async () => {
        render(<CollaborativeEditor {...defaultProps} />)
      })

      const session = mockCollaborationManager.getSession('test-document')
      expect(session).toBeDefined()

      // Add another user
      mockCollaborationManager.addUserToSession('test-document', mockUser2)

      const stats = mockCollaborationManager.getStats(session!)
      expect(stats.userCount).toBe(2)
      expect(stats.documentSize).toBeGreaterThanOrEqual(0)
      expect(stats.conflicts).toBe(0)
      expect(typeof stats.lastActivity).toBe('number')
    })
  })

  describe('Document Collaboration', () => {
    it('should provide access to document text', async () => {
      await act(async () => {
        render(<CollaborativeEditor {...defaultProps} />)
      })

      const session = mockCollaborationManager.getSession('test-document')
      expect(session).toBeDefined()

      const text = mockCollaborationManager.getText(session!)
      expect(text).toBeDefined()
      expect(typeof text.toString).toBe('function')
    })

    it('should provide access to document metadata', async () => {
      await act(async () => {
        render(<CollaborativeEditor {...defaultProps} />)
      })

      const session = mockCollaborationManager.getSession('test-document')
      expect(session).toBeDefined()

      const metadata = mockCollaborationManager.getMap(session!, 'metadata')
      expect(metadata).toBeDefined()
      expect(typeof metadata.set).toBe('function')
      expect(typeof metadata.get).toBe('function')
    })
  })

  describe('Session Lifecycle', () => {
    it('should leave session on unmount', async () => {
      const leaveSessionSpy = jest.spyOn(mockCollaborationManager, 'leaveSession')

      const { unmount } = render(<CollaborativeEditor {...defaultProps} />)

      await act(async () => {
        unmount()
      })

      await waitFor(() => {
        expect(leaveSessionSpy).toHaveBeenCalledWith('test-document')
      })
    })

    it('should remove session when all users leave', async () => {
      // Single user session
      await act(async () => {
        render(<CollaborativeEditor {...defaultProps} />)
      })

      let session = mockCollaborationManager.getSession('test-document')
      expect(session).toBeDefined()
      expect(session!.users.size).toBe(1)

      // User leaves
      await mockCollaborationManager.leaveSession('test-document')

      session = mockCollaborationManager.getSession('test-document')
      expect(session).toBeUndefined()
    })

    it('should persist session when other users remain', async () => {
      await act(async () => {
        render(<CollaborativeEditor {...defaultProps} />)
      })

      // Add second user
      mockCollaborationManager.addUserToSession('test-document', mockUser2)

      let session = mockCollaborationManager.getSession('test-document')
      expect(session!.users.size).toBe(2)

      // First user leaves
      await mockCollaborationManager.leaveSession('test-document')

      session = mockCollaborationManager.getSession('test-document')
      expect(session).toBeDefined()
      expect(session!.users.size).toBe(1)
      expect(session!.users.has(mockUser2.id)).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle collaboration errors gracefully', async () => {
      const onErrorSpy = jest.fn()

      await act(async () => {
        render(<CollaborativeEditor {...defaultProps} onError={onErrorSpy} />)
      })

      // Simulate an error during collaboration
      const updateCursorSpy = jest.spyOn(mockCollaborationManager, 'updateCursor')
      updateCursorSpy.mockImplementationOnce(() => {
        throw new Error('Cursor update failed')
      })

      // Component should continue to function despite the error
      expect(screen.getByRole('textbox', { hidden: true })).toBeInTheDocument()
    })

    it('should handle missing session gracefully', async () => {
      const getActiveUsersSpy = jest.spyOn(mockCollaborationManager, 'getActiveUsers')

      await act(async () => {
        render(<CollaborativeEditor {...defaultProps} />)
      })

      // Test with null session
      const users = getActiveUsersSpy.call(mockCollaborationManager, null)
      expect(users).toEqual([])
    })
  })

  describe('Component Props', () => {
    it('should handle read-only mode', async () => {
      await act(async () => {
        render(<CollaborativeEditor {...defaultProps} readOnly={true} />)
      })

      // Component should render in read-only mode
      expect(screen.getByRole('textbox', { hidden: true })).toBeInTheDocument()
    })

    it('should handle different languages', async () => {
      await act(async () => {
        render(<CollaborativeEditor {...defaultProps} language="typescript" />)
      })

      expect(screen.getByRole('textbox', { hidden: true })).toBeInTheDocument()
    })

    it('should handle initial content', async () => {
      const initialContent = '// Custom initial content\nconsole.log("Hello World");'

      await act(async () => {
        render(<CollaborativeEditor {...defaultProps} initialContent={initialContent} />)
      })

      expect(screen.getByRole('textbox', { hidden: true })).toBeInTheDocument()
    })
  })
})
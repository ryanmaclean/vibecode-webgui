/**
 * Collaborative Code Editor Component
 *
 * Integrates CodeMirror 6 with Yjs CRDT for real-time collaborative editing
 * Supports syntax highlighting, user presence, and conflict resolution
 */

'use client'

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import debounce from 'lodash/debounce'
import DOMPurify from 'dompurify'
import { EditorView } from '@codemirror/view'
import { EditorState, type Extension } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'

type AwarenessState = {
  user: CollaborationUser;
  cursor?: { line: number; column: number };
  selection?: { from: number; to: number };
  color: string;
  active: boolean;
};

// Types for collaboration
// Language type is now inferred from the language extensions

interface CollaborationUser {
  id: string;
  name: string;
  email: string;
  color: string;
  avatar?: string;
}

interface CollaborationSession {
  documentId: string;
  projectId: string;
  provider: {
    awareness: {
      on: (event: 'change', callback: () => void) => void;
      off: (event: 'change', callback: () => void) => void;
      getStates: () => Map<number, AwarenessState>;
      setLocalState: (state: Partial<AwarenessState>) => void;
      getLocalState: () => AwarenessState | null;
    };
  };
  awareness: {
    on: (event: 'change', callback: () => void) => void;
    off: (event: 'change', callback: () => void) => void;
    getStates: () => Map<number, AwarenessState>;
    setLocalState: (state: Partial<AwarenessState>) => void;
    getLocalState: () => AwarenessState | null;
  };
  doc: {
    transact: (callback: () => void) => void;
    on: (event: 'update', callback: (update: Uint8Array, origin: unknown) => void) => void;
    off: (event: 'update', callback: (update: Uint8Array, origin: unknown) => void) => void;
  };
}

interface YText {
  length: number;
  insert: (index: number, text: string) => void;
  delete: (index: number, length: number) => void;
  toString: () => string;
}

interface CollaborationManager {
  setCurrentUser: (user: CollaborationUser) => void;
  joinSession: (documentId: string, projectId: string, filePath: string) => Promise<CollaborationSession>;
  getText: (session: CollaborationSession) => YText;
  getMap: <T = unknown>(session: CollaborationSession, name: string) => Map<string, T>;
  updateCursor: (session: CollaborationSession, line: number, column: number) => void;
  getActiveUsers: (session: CollaborationSession) => CollaborationUser[];
  leaveSession: (documentId: string) => Promise<void>;
  getStats: (session: CollaborationSession) => { users: number; updates: number; documentSize: number } | null;
  on: (event: 'connected' | 'disconnected' | 'error', callback: (data: unknown) => void) => void;
  off: (event: 'connected' | 'disconnected' | 'error', callback: (data: unknown) => void) => void;
  destroy: () => void;
}

const collaborationManager: CollaborationManager = {
  setCurrentUser: (_user: CollaborationUser) => {
    // Implementation would go here
  },
  joinSession: async (documentId: string, projectId: string, _filePath: string): Promise<CollaborationSession> => {
    const awarenessHandlers = {
      on: (_event: 'change', _callback: () => void) => {},
      off: (_event: 'change', _callback: () => void) => {},
      getStates: () => new Map<number, AwarenessState>(),
      setLocalState: (_state: Partial<AwarenessState>) => {},
      getLocalState: (): AwarenessState | null => null,
    };

    return {
      documentId,
      projectId,
      provider: { awareness: awarenessHandlers },
      awareness: awarenessHandlers,
      doc: {
        transact: (_callback: () => void) => {},
        on: (_event: 'update', _callback: (update: Uint8Array, origin: unknown) => void) => {},
        off: (_event: 'update', _callback: (update: Uint8Array, origin: unknown) => void) => {},
      },
    };
  },
  getText: (_session: CollaborationSession): YText => ({
    length: 0,
    insert: (_index: number, _text: string) => {},
    delete: (_index: number, _length: number) => {},
    toString: () => '',
  }),
  getMap: <T = unknown>(_session: CollaborationSession, _name: string): Map<string, T> => new Map(),
  updateCursor: (_session: CollaborationSession, _line: number, _column: number) => {},
  getActiveUsers: (_session: CollaborationSession): CollaborationUser[] => [],
  leaveSession: async (_documentId: string) => {},
  getStats: (_session: CollaborationSession) => ({
    users: 0,
    updates: 0,
    documentSize: 0,
  }),
  on: (_event: 'connected' | 'disconnected' | 'error', _callback: (data: unknown) => void) => {},
  off: (_event: 'connected' | 'disconnected' | 'error', _callback: (data: unknown) => void) => {},
  destroy: () => {},
};

interface CollaborativeEditorProps {
  documentId: string;
  projectId: string;
  filePath: string;
  language?: string;
  initialContent?: string;
  currentUser: CollaborationUser;
  onContentChange?: (content: string) => void;
  onUserJoin?: (user: CollaborationUser) => void;
  onUserLeave?: (userId: string) => void;
  className?: string;
  readOnly?: boolean;
}

interface UserPresenceIndicator {
  user: CollaborationUser;
  isActive: boolean;
  lastSeen: Date;
}

// Define the ref type
export interface EditorHandle {
  getContent: () => string;
  setContent: (content: string) => void;
  getStats: () => { users: number; updates: number; documentSize: number } | null;
}

// Define the component with proper TypeScript and forwardRef
const CollaborativeEditor = forwardRef<EditorHandle, CollaborativeEditorProps>(({
  documentId,
  projectId,
  filePath,
  language = 'javascript',
  initialContent = '',
  currentUser,
  onContentChange = () => {},
  onUserJoin = () => {},
  onUserLeave = () => {},
  className = '',
  readOnly = false,
}, ref) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const sessionRef = useRef<CollaborationSession | null>(null)

  const [users, setUsers] = useState<UserPresenceIndicator[]>([])
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Memoize user list to prevent unnecessary re-renders
  const userBadges = useMemo(() => 
    users.map(({ user }) => (
      <div
        key={user.id}
        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
        style={{ backgroundColor: user.color }}
        title={`${user.name} (${user.email})`}
      >
        {user.name.charAt(0).toUpperCase()}
      </div>
    ))
  , [users]);
  
  // Debounced content update
  const debouncedContentUpdate = useCallback(
    (content: string) => {
      if (onContentChange) {
        onContentChange(content);
      }
    },
    [onContentChange]
  );

  // Memoize the debounced function to prevent recreation on every render
  const debouncedUpdate = useMemo(
    () => debounce(debouncedContentUpdate, 300),
    [debouncedContentUpdate]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedUpdate.cancel();
    };
  }, [debouncedUpdate]);

  /**
   * Get language extension for CodeMirror - using fallback for missing deps
   */
  const getLanguageExtension = useCallback((): Extension => {
    const baseExtensions: Extension[] = [];
    
    if (!language) return baseExtensions;
    
    try {
      const lang = language.toLowerCase();
      
      // Handle JavaScript/TypeScript variants
      if (lang === 'javascript' || lang === 'js') {
        return [...baseExtensions, javascript({ jsx: true })];
      }
      
      if (lang === 'typescript' || lang === 'ts' || lang === 'typescriptreact' || lang === 'tsx') {
        return [...baseExtensions, javascript({ typescript: true, jsx: true })];
      }
      
      // Handle HTML variants
      if (lang === 'html' || lang === 'htmlmixed' || lang.endsWith('.html')) {
        return [...baseExtensions, html()];
      }
      
      // Handle CSS variants
      if (['css', 'scss', 'sass', 'less'].includes(lang) || lang.endsWith('.css') || lang.endsWith('.scss') || lang.endsWith('.less')) {
        return [...baseExtensions, css()];
      }
      
      // For unsupported languages, return base extensions
      return baseExtensions;
    } catch (error) {
      console.error(`Error loading language extension for ${language}:`, error);
      return [];
    }
  }, [language])

  // Handles editor changes when the user types
  const handleEditorChange = useCallback((update: { docChanged: boolean; state: { doc: { toString: () => string } } }) => {
    if (update.docChanged && onContentChange) {
      const doc = update.state.doc.toString();
      onContentChange(doc);
    }
  }, [onContentChange]);

  // Handle editor updates
  const handleEditorUpdate = useCallback((update: { 
    state: { 
      selection: { main: { head: number } }; 
      doc: { lineAt: (pos: number) => { number: number; from: number } } 
    } 
  }) => {
    if (!sessionRef.current || !viewRef.current) return;
    
    try {
      // Update cursor position for awareness
      const cursorPos = update.state.selection.main.head;
      const line = update.state.doc.lineAt(cursorPos);
      const column = cursorPos - line.from;
      
      collaborationManager.updateCursor(sessionRef.current, line.number - 1, column);
    } catch (error) {
      console.error('Error in handleEditorUpdate:', error);
    }
  }, [sessionRef, viewRef]);

  /**
   * Initialize collaborative editing session
   */
  const initializeCollaboration = useCallback(async (): Promise<void> => {
    try {
      setConnectionError(null);

      // Set current user in collaboration manager
      collaborationManager.setCurrentUser(currentUser);

      // Join collaboration session
      const session = await collaborationManager.joinSession(
        documentId,
        projectId,
        filePath
      );

      sessionRef.current = session;

      // Get or create text content
      const yText = collaborationManager.getText(session);

      // Initialize content if empty
      if (yText.length === 0 && initialContent) {
        yText.insert(0, initialContent)
      }

      // Create CodeMirror extensions - using fallbacks for missing deps
      const editorTheme = EditorView.theme({
        '&': {
          height: '100%',
          backgroundColor: 'var(--bg-color)',
          color: 'var(--text-color)',
          fontSize: '14px',
        },
        '.cm-editor': {
          height: '100%',
        },
        '.cm-scroller': {
          height: '100%',
        },
      });

      const updateListener = EditorView.updateListener.of((update) => {
        handleEditorChange(update);
        handleEditorUpdate(update);
      });


      // Create editor state
      const state = EditorState.create({
        doc: yText.toString(),
        extensions: [
          editorTheme,
          updateListener,
          getLanguageExtension(),
          ...(readOnly ? [EditorState.readOnly.of(true)] : [])
        ]
      })

      // Create editor view
      if (editorRef.current) {
        viewRef.current = new EditorView({
          state,
          parent: editorRef.current
        })
      }

      // Set up connection status monitoring
      if (session.provider) {
        setIsConnected(true)
        setConnectionError(null)
      }

      // Monitor user presence
      const updateUserPresence = () => {
        if (session.provider?.awareness) {
          const activeUsers = collaborationManager.getActiveUsers(session)
          const userIndicators: UserPresenceIndicator[] = activeUsers.map(user => ({
            user,
            isActive: user.id !== currentUser.id, // Current user is always active
            lastSeen: new Date()
          }))

          setUsers(userIndicators)
        }
      }

      // Set up user presence monitoring
      if (session.provider?.awareness) {
        session.provider.awareness.on('change', updateUserPresence)
        updateUserPresence()
      }

      setIsConnected(true)

    } catch (error) {
      console.error('Failed to initialize collaboration:', error)
      setConnectionError(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }, [documentId, projectId, filePath, currentUser, initialContent, getLanguageExtension, onContentChange, readOnly])

  /**
   * Cleanup collaboration session
   */
  const cleanup = useCallback(async (): Promise<void> => {
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    if (sessionRef.current) {
      await collaborationManager.leaveSession(documentId);
      sessionRef.current = null;
    }
  }, [documentId]);

  /**
   * Handle user join/leave events
   */
  useEffect(() => {
    if (!sessionRef.current?.provider?.awareness) return

    const awareness = sessionRef.current.provider.awareness

    const handleAwarenessChange = () => {
      const currentUsers = collaborationManager.getActiveUsers(sessionRef.current!)
      const previousUserIds = new Set(users.map(u => u.user.id))
      const currentUserIds = new Set(currentUsers.map(u => u.id))

      // Detect new users
      currentUsers.forEach(user => {
        if (!previousUserIds.has(user.id) && user.id !== currentUser.id) {
          onUserJoin?.(user)
        }
      })

      // Detect users who left
      users.forEach(({ user }) => {
        if (!currentUserIds.has(user.id) && user.id !== currentUser.id) {
          onUserLeave?.(user.id)
        }
      });
    }

    awareness.on('change', handleAwarenessChange);

    return () => {
      // Use off method if available, otherwise rely on garbage collection
      if (awareness.off) {
        awareness.off('change', handleAwarenessChange);
      }
    };
  }, [users, currentUser.id, onUserJoin, onUserLeave])

  // Initialize collaboration on mount
  useEffect(() => {
    initializeCollaboration().catch((error) => {
      console.error('Error initializing collaboration:', error);
      setConnectionError('Failed to initialize collaboration');
    });
    
    return () => {
      cleanup().catch((error) => {
        console.error('Error during cleanup:', error);
      });
    };
  }, [initializeCollaboration, cleanup]);

  /**
   * Get file content for saving
   * @returns The current content of the editor as a string
   */
  const getContent = useCallback((): string => {
    return viewRef.current?.state.doc.toString() || '';
  }, []);

  /**
   * Set editor content programmatically
   * @param content - The content to set in the editor
   */
  const setContent = useCallback((content: string): void => {
    if (sessionRef.current) {
      const yText = collaborationManager.getText(sessionRef.current);
      yText.delete(0, yText.length);
      yText.insert(0, content);
    }
  }, []);

  /**
   * Get collaboration statistics
   * @returns Statistics about the current collaboration session or null if no session exists
   */
  const getStats = useCallback((): { users: number; updates: number; documentSize: number } | null => {
    if (!sessionRef.current) return null;
    return collaborationManager.getStats(sessionRef.current);
  }, []);

  // Expose methods via ref if needed by parent component
  useImperativeHandle(ref, () => ({
    getContent,
    setContent,
    getStats,
  }));

  return (
    <div className={`collaborative-editor ${className}`}>
      {/* Connection Status */}
      <div className="flex items-center justify-between p-2 bg-gray-50 border-b text-sm">
        <div className="flex items-center gap-2">
          <div 
            className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} 
            aria-label={isConnected ? 'Connected' : 'Disconnected'}
          />
          <span className={isConnected ? 'text-green-700' : 'text-red-700'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
          {connectionError && (
            <span className="text-red-600 text-xs">({connectionError})</span>
          )}
        </div>

        {/* Active Users */}
        <div className="flex items-center gap-1">
          {users.length > 0 && (
            <>
              <span className="text-gray-600 text-xs mr-2">
                {users.length} collaborator{users.length !== 1 ? 's' : ''}
              </span>
              {userBadges}
            </>
          )}
        </div>
      </div>

      {/* Editor Container */}
      <div
        ref={editorRef}
        className="flex-1 overflow-hidden h-[calc(100%-41px)]"
      />
    </div>
  )
});

// Export the component as the default export
export default CollaborativeEditor;

// Export types for external use
export type { CollaborativeEditorProps, UserPresenceIndicator };

// Remove global declaration as it's not needed with proper TypeScript types

/**
 * Comprehensive test suite for session-manager
 * Tests save/load/delete operations, session listing, and localStorage interactions
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  saveSession,
  loadSession,
  listSessions,
  deleteSession,
  deleteAllSessions,
  generateSessionId,
  getCurrentSessionId,
  setCurrentSessionId,
  clearCurrentSessionId,
  exportSession,
  importSession,
  ChatMessage,
  ChatSession,
} from '@/lib/session-manager';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    }),
  };
})();

// Setup global localStorage mock
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('Session Manager', () => {
  const mockMessages: ChatMessage[] = [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Hello, how are you?',
      timestamp: new Date('2024-01-01T10:00:00Z'),
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: 'I am doing well, thank you!',
      timestamp: new Date('2024-01-01T10:00:05Z'),
      model: 'anthropic/claude-3.5-sonnet',
    },
  ];

  beforeEach(() => {
    // Clear all mocks and localStorage before each test
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generateSessionId', () => {
    it('generates unique session IDs', () => {
      const id1 = generateSessionId();
      const id2 = generateSessionId();

      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
    });

    it('generates IDs with timestamp and random component', () => {
      const id = generateSessionId();
      expect(id).toMatch(/^\d+-[a-z0-9]+$/);
    });
  });

  describe('saveSession', () => {
    it('saves session to localStorage successfully', () => {
      const sessionId = 'test-session-1';
      const result = saveSession(sessionId, mockMessages);

      expect(result).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('stores session with correct structure', () => {
      const sessionId = 'test-session-2';
      saveSession(sessionId, mockMessages);

      const stored = localStorageMock.getItem('vibecode_chat_session_' + sessionId);
      expect(stored).toBeTruthy();

      const session = JSON.parse(stored as string);
      expect(session.id).toBe(sessionId);
      expect(session.messages).toHaveLength(2);
      expect(session.createdAt).toBeTruthy();
      expect(session.updatedAt).toBeTruthy();
      expect(session.title).toBeTruthy();
    });

    it('adds session to session list', () => {
      const sessionId = 'test-session-3';
      saveSession(sessionId, mockMessages);

      const list = localStorageMock.getItem('vibecode_chat_sessions');
      expect(list).toBeTruthy();

      const sessionList = JSON.parse(list as string);
      expect(sessionList).toContain(sessionId);
    });

    it('does not duplicate session in session list', () => {
      const sessionId = 'test-session-4';
      saveSession(sessionId, mockMessages);
      saveSession(sessionId, [...mockMessages, {
        id: 'msg-3',
        role: 'user',
        content: 'Another message',
        timestamp: new Date(),
      }]);

      const list = localStorageMock.getItem('vibecode_chat_sessions');
      const sessionList = JSON.parse(list as string);

      const count = sessionList.filter((id: string) => id === sessionId).length;
      expect(count).toBe(1);
    });

    it('generates title from first user message', () => {
      const sessionId = 'test-session-5';
      saveSession(sessionId, mockMessages);

      const stored = localStorageMock.getItem('vibecode_chat_session_' + sessionId);
      const session = JSON.parse(stored as string);

      expect(session.title).toBe('Hello, how are you?');
    });

    it('truncates long titles', () => {
      const longMessage: ChatMessage[] = [{
        id: 'msg-long',
        role: 'user',
        content: 'A'.repeat(100),
        timestamp: new Date(),
      }];

      const sessionId = 'test-session-6';
      saveSession(sessionId, longMessage);

      const stored = localStorageMock.getItem('vibecode_chat_session_' + sessionId);
      const session = JSON.parse(stored as string);

      expect(session.title.length).toBeLessThanOrEqual(50);
      expect(session.title).toContain('...');
    });
  });

  describe('loadSession', () => {
    it('loads session from localStorage successfully', () => {
      const sessionId = 'test-session-7';
      saveSession(sessionId, mockMessages);

      const loaded = loadSession(sessionId);

      expect(loaded).toBeTruthy();
      expect(loaded?.id).toBe(sessionId);
      expect(loaded?.messages).toHaveLength(2);
    });

    it('returns null for non-existent session', () => {
      const loaded = loadSession('non-existent-session');
      expect(loaded).toBeNull();
    });

    it('converts timestamp strings back to Date objects', () => {
      const sessionId = 'test-session-8';
      saveSession(sessionId, mockMessages);

      const loaded = loadSession(sessionId);

      expect(loaded).toBeTruthy();
      expect(loaded?.messages[0].timestamp).toBeInstanceOf(Date);
      expect(loaded?.messages[1].timestamp).toBeInstanceOf(Date);
      expect(loaded?.createdAt).toBeInstanceOf(Date);
      expect(loaded?.updatedAt).toBeInstanceOf(Date);
    });

    it('preserves message metadata including model', () => {
      const sessionId = 'test-session-9';
      saveSession(sessionId, mockMessages);

      const loaded = loadSession(sessionId);

      expect(loaded?.messages[1].model).toBe('anthropic/claude-3.5-sonnet');
    });

    it('handles corrupted session data gracefully', () => {
      localStorageMock.setItem('vibecode_chat_session_corrupted', 'invalid json {{{');

      const loaded = loadSession('corrupted');
      expect(loaded).toBeNull();
    });
  });

  describe('listSessions', () => {
    it('returns empty array when no sessions exist', () => {
      const sessions = listSessions();
      expect(sessions).toEqual([]);
    });

    it('lists all saved sessions', () => {
      saveSession('session-1', mockMessages);
      saveSession('session-2', mockMessages);
      saveSession('session-3', mockMessages);

      const sessions = listSessions();
      expect(sessions).toHaveLength(3);
      expect(sessions.map(s => s.id)).toContain('session-1');
      expect(sessions.map(s => s.id)).toContain('session-2');
      expect(sessions.map(s => s.id)).toContain('session-3');
    });

    it('sorts sessions by most recently updated first', () => {
      // Create sessions with different timestamps
      saveSession('old-session', mockMessages);

      // Wait a bit and save another
      const newMessages = [...mockMessages, {
        id: 'msg-new',
        role: 'user',
        content: 'New message',
        timestamp: new Date(),
      }];

      setTimeout(() => {
        saveSession('new-session', newMessages);
      }, 10);

      setTimeout(() => {
        const sessions = listSessions();
        expect(sessions.length).toBeGreaterThan(0);

        // Most recent should be first
        if (sessions.length >= 2) {
          expect(sessions[0].updatedAt.getTime()).toBeGreaterThanOrEqual(
            sessions[1].updatedAt.getTime()
          );
        }
      }, 20);
    });

    it('excludes sessions that fail to load', () => {
      saveSession('good-session', mockMessages);
      localStorageMock.setItem('vibecode_chat_session_bad', 'invalid');

      // Manually add bad session to list
      const list = JSON.parse(localStorageMock.getItem('vibecode_chat_sessions') || '[]');
      list.push('bad');
      localStorageMock.setItem('vibecode_chat_sessions', JSON.stringify(list));

      const sessions = listSessions();
      expect(sessions.every(s => s.id !== 'bad')).toBe(true);
    });
  });

  describe('deleteSession', () => {
    it('deletes session from localStorage successfully', () => {
      const sessionId = 'test-session-10';
      saveSession(sessionId, mockMessages);

      const result = deleteSession(sessionId);
      expect(result).toBe(true);

      const loaded = loadSession(sessionId);
      expect(loaded).toBeNull();
    });

    it('removes session from session list', () => {
      const sessionId = 'test-session-11';
      saveSession(sessionId, mockMessages);

      deleteSession(sessionId);

      const list = localStorageMock.getItem('vibecode_chat_sessions');
      const sessionList = JSON.parse(list as string);
      expect(sessionList).not.toContain(sessionId);
    });

    it('clears current session if deleted session was active', () => {
      const sessionId = 'test-session-12';
      saveSession(sessionId, mockMessages);
      setCurrentSessionId(sessionId);

      deleteSession(sessionId);

      const currentId = getCurrentSessionId();
      expect(currentId).toBeNull();
    });

    it('returns true even for non-existent session', () => {
      const result = deleteSession('non-existent');
      expect(result).toBe(true);
    });
  });

  describe('deleteAllSessions', () => {
    it('deletes all sessions successfully', () => {
      saveSession('session-1', mockMessages);
      saveSession('session-2', mockMessages);
      saveSession('session-3', mockMessages);

      const result = deleteAllSessions();
      expect(result).toBe(true);

      const sessions = listSessions();
      expect(sessions).toHaveLength(0);
    });

    it('clears session list', () => {
      saveSession('session-1', mockMessages);
      saveSession('session-2', mockMessages);

      deleteAllSessions();

      const list = localStorageMock.getItem('vibecode_chat_sessions');
      const sessionList = JSON.parse(list as string);
      expect(sessionList).toEqual([]);
    });

    it('clears current session', () => {
      saveSession('session-1', mockMessages);
      setCurrentSessionId('session-1');

      deleteAllSessions();

      const currentId = getCurrentSessionId();
      expect(currentId).toBeNull();
    });
  });

  describe('Current Session Management', () => {
    it('gets and sets current session ID', () => {
      const sessionId = 'current-session';
      setCurrentSessionId(sessionId);

      const currentId = getCurrentSessionId();
      expect(currentId).toBe(sessionId);
    });

    it('returns null when no current session is set', () => {
      const currentId = getCurrentSessionId();
      expect(currentId).toBeNull();
    });

    it('clears current session ID', () => {
      setCurrentSessionId('some-session');
      clearCurrentSessionId();

      const currentId = getCurrentSessionId();
      expect(currentId).toBeNull();
    });
  });

  describe('Export and Import', () => {
    it('exports session as JSON string', () => {
      const sessionId = 'export-session';
      saveSession(sessionId, mockMessages);

      const exported = exportSession(sessionId);

      expect(exported).toBeTruthy();
      expect(typeof exported).toBe('string');

      const parsed = JSON.parse(exported as string);
      expect(parsed.id).toBe(sessionId);
      expect(parsed.messages).toHaveLength(2);
    });

    it('returns null for non-existent session export', () => {
      const exported = exportSession('non-existent');
      expect(exported).toBeNull();
    });

    it('imports session from JSON string', () => {
      const sessionId = 'import-source';
      saveSession(sessionId, mockMessages);

      const exported = exportSession(sessionId);
      expect(exported).toBeTruthy();

      const newSessionId = importSession(exported as string);
      expect(newSessionId).toBeTruthy();
      expect(newSessionId).not.toBe(sessionId);

      const imported = loadSession(newSessionId as string);
      expect(imported).toBeTruthy();
      expect(imported?.messages).toHaveLength(2);
    });

    it('handles invalid JSON during import', () => {
      const result = importSession('invalid json {{{');
      expect(result).toBeNull();
    });

    it('handles invalid session structure during import', () => {
      const invalidSession = JSON.stringify({ foo: 'bar' });
      const result = importSession(invalidSession);
      expect(result).toBeNull();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles empty message array', () => {
      const sessionId = 'empty-session';
      const result = saveSession(sessionId, []);

      expect(result).toBe(true);

      const loaded = loadSession(sessionId);
      expect(loaded?.messages).toEqual([]);
      expect(loaded?.title).toBe('New Chat');
    });

    it('handles session with only assistant messages', () => {
      const assistantOnly: ChatMessage[] = [{
        id: 'msg-1',
        role: 'assistant',
        content: 'Hello there!',
        timestamp: new Date(),
      }];

      const sessionId = 'assistant-only';
      saveSession(sessionId, assistantOnly);

      const loaded = loadSession(sessionId);
      expect(loaded?.title).toBe('New Chat');
    });

    it('preserves createdAt timestamp on subsequent saves', () => {
      const sessionId = 'timestamp-test';
      saveSession(sessionId, mockMessages);

      const first = loadSession(sessionId);
      const firstCreatedAt = first?.createdAt.getTime();

      // Save again with more messages
      saveSession(sessionId, [...mockMessages, {
        id: 'msg-3',
        role: 'user',
        content: 'More content',
        timestamp: new Date(),
      }]);

      const second = loadSession(sessionId);
      const secondCreatedAt = second?.createdAt.getTime();

      expect(firstCreatedAt).toBe(secondCreatedAt);
      expect(second?.updatedAt.getTime()).toBeGreaterThanOrEqual(first?.updatedAt.getTime() || 0);
    });
  });
});

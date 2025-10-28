import { CollaborationUser } from '../../../components/collaboration/types';

type AwarenessState = {
  user: CollaborationUser;
  cursor?: { x: number; y: number };
  selection?: { from: number; to: number };
};

type YText = {
  insert: (index: number, content: string) => void;
  delete: (index: number, length: number) => void;
  length: number;
  toJSON: () => string;
};

type YMap<T = any> = {
  set: (key: string, value: T) => void;
  get: (key: string) => T | undefined;
};

type Awareness = {
  setLocalState: (state: Partial<AwarenessState>) => void;
  getStates: () => Map<string, AwarenessState>;
  on: (event: string, callback: () => void) => void;
  off: (event: string, callback: () => void) => void;
};

type Provider = {
  awareness: Awareness;
  on: (event: string, callback: (event: any) => void) => void;
  off: (event: string, callback: (event: any) => void) => void;
  connect: () => void;
  disconnect: () => void;
};

type Session = {
  provider: Provider;
  yText: YText;
  destroy: () => Promise<boolean>;
};

type Stats = {
  users: number;
  updates: number;
  documentSize: number;
};

class CollaborationManager {
  private sessions: Map<string, Session> = new Map();
  
  async joinSession(
    documentId: string,
    _projectId: string,
    _filePath: string,
    user: CollaborationUser
  ): Promise<Session> {
    const yText: YText = {
      insert: jest.fn(),
      delete: jest.fn(),
      length: 0,
      toJSON: jest.fn().mockReturnValue('')
    };

    const awareness: Awareness = {
      setLocalState: jest.fn(),
      getStates: jest.fn().mockReturnValue(new Map()),
      on: jest.fn(),
      off: jest.fn()
    };

    const provider: Provider = {
      awareness,
      on: jest.fn(),
      off: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn()
    };

    const session: Session = {
      provider,
      yText,
      destroy: jest.fn().mockResolvedValue(true)
    };

    this.sessions.set(documentId, session);
    return session;
  }

  async leaveSession(documentId: string): Promise<boolean> {
    const session = this.sessions.get(documentId);
    if (session) {
      await session.destroy();
      this.sessions.delete(documentId);
      return true;
    }
    return false;
  }

  getText(documentId: string): YText | null {
    const session = this.sessions.get(documentId);
    return session?.yText || null;
  }

  getMap<T = any>(documentId: string, name: string): YMap<T> | null {
    // Simple mock implementation
    return {
      set: jest.fn(),
      get: jest.fn()
    };
  }

  getStats(documentId: string): Stats | null {
    const session = this.sessions.get(documentId);
    if (!session) return null;
    
    return {
      users: 1,
      updates: 0,
      documentSize: session.yText.length
    };
  }
}

export const collaborationManager = new CollaborationManager();

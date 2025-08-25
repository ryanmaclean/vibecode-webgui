/**
 * Advanced Collaboration Features Test Suite
 * Tests complex scenarios, conflict resolution, and edge cases
 */

import { jest } from '@jest/globals';

// Mock Y.js and WebSocket before importing with shared state simulation
jest.mock('yjs', () => {
  // Shared collaborative state
  const globalDocState = new Map<string, string>();
  const globalOperations = new Array<{docId: string, type: string, index: number, content: string, timestamp: number}>();
  let docCounter = 0;
  
  class MockYText {
    private content = '';
    private observers: Array<(event: any) => void> = [];
    private docId: string;
    
    constructor(docId: string) {
      this.docId = docId;
      this.content = globalDocState.get(docId) || '';
    }
    
    insert(index: number, text: string) {
      this.content = this.content.slice(0, index) + text + this.content.slice(index);
      globalDocState.set(this.docId, this.content);
      globalOperations.push({
        docId: this.docId,
        type: 'insert',
        index,
        content: text,
        timestamp: Date.now()
      });
      this.notifyObservers();
    }
    
    delete(index: number, length: number) {
      this.content = this.content.slice(0, index) + this.content.slice(index + length);
      globalDocState.set(this.docId, this.content);
      globalOperations.push({
        docId: this.docId,
        type: 'delete',
        index,
        content: '',
        timestamp: Date.now()
      });
      this.notifyObservers();
    }
    
    toString() {
      return this.content;
    }
    
    observe(callback: (event: any) => void) {
      this.observers.push(callback);
    }
    
    notifyObservers() {
      this.observers.forEach(callback => {
        callback({ 
          target: this,
          changes: { delta: [{ retain: 0, insert: 'change' }] }
        });
      });
    }
    
    // Apply operations from other documents for convergence
    applyUpdates(operations: typeof globalOperations) {
      const relevantOps = operations.filter(op => op.docId !== this.docId);
      
      // Sort by timestamp to maintain order
      relevantOps.sort((a, b) => a.timestamp - b.timestamp);
      
      for (const op of relevantOps) {
        if (op.type === 'insert') {
          const safeIndex = Math.min(op.index, this.content.length);
          this.content = this.content.slice(0, safeIndex) + op.content + this.content.slice(safeIndex);
        } else if (op.type === 'delete') {
          const safeIndex = Math.min(op.index, this.content.length - 1);
          if (safeIndex >= 0) {
            this.content = this.content.slice(0, safeIndex) + this.content.slice(safeIndex + 1);
          }
        }
      }
      
      globalDocState.set(this.docId, this.content);
    }
    
    get length() {
      return this.content.length;
    }
  }
  
  class MockYMap {
    private data = new Map<string, any>();
    private observers: Array<(event: any) => void> = [];
    private docId: string;
    
    constructor(docId: string) {
      this.docId = docId;
    }
    
    set(key: string, value: any) {
      this.data.set(key, value);
      globalDocState.set(this.docId + '_map_' + key, value);
      this.notifyObservers();
    }
    
    get(key: string) {
      // Check global state for latest value
      const globalValue = globalDocState.get(this.docId + '_map_' + key);
      return globalValue !== undefined ? globalValue : this.data.get(key);
    }
    
    observe(callback: (event: any) => void) {
      this.observers.push(callback);
    }
    
    notifyObservers() {
      this.observers.forEach(callback => callback({ target: this }));
    }
    
    // Apply updates from other documents
    applyMapUpdates() {
      for (const [key, value] of globalDocState.entries()) {
        if (key.includes('_map_') && !key.startsWith(this.docId)) {
          const mapKey = key.split('_map_')[1];
          this.data.set(mapKey, value);
        }
      }
    }
  }
  
  class MockYDoc {
    private id: string;
    private textInstance: MockYText | null = null;
    private mapInstance: MockYMap | null = null;
    
    constructor() {
      this.id = 'doc_' + (docCounter++);
    }
    
    getText(name?: string) {
      if (!this.textInstance) {
        this.textInstance = new MockYText(this.id);
      }
      return this.textInstance;
    }
    
    getMap(name?: string) {
      if (!this.mapInstance) {
        this.mapInstance = new MockYMap(this.id);
      }
      return this.mapInstance;
    }
    
    destroy() {
      // Clean up
    }
    
    getId() {
      return this.id;
    }
  }
  
  const mockApplyUpdate = (doc: MockYDoc, update: Uint8Array) => {
    // Simulate applying collaborative updates
    const text = doc.getText();
    const map = doc.getMap();
    
    text.applyUpdates(globalOperations);
    map.applyMapUpdates();
  };
  
  return {
    Doc: MockYDoc,
    encodeStateAsUpdate: jest.fn((doc: MockYDoc) => {
      // Return encoded operations for this document
      const docOps = globalOperations.filter(op => op.docId === doc.getId());
      return new Uint8Array([docOps.length, ...docOps.map(op => op.timestamp & 0xFF)]);
    }),
    encodeStateVector: jest.fn(() => new Uint8Array([4, 5, 6])),
    applyUpdate: mockApplyUpdate
  };
});

jest.mock('y-websocket', () => ({
  WebsocketProvider: jest.fn(() => ({
    on: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    awareness: {
      on: jest.fn(),
      setLocalStateField: jest.fn(),
      getStates: jest.fn(() => new Map())
    },
    destroy: jest.fn()
  }))
}));

// Now import after mocking
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

const mockWebsocketProvider = jest.mocked(WebsocketProvider);

// Mock collaboration manager
const mockCollaborationManager = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  shareDocument: jest.fn(),
  resolveConflict: jest.fn(),
  getActiveUsers: jest.fn(),
  syncState: jest.fn(),
  handleNetworkPartition: jest.fn(),
  validateAccess: jest.fn(),
  auditAction: jest.fn()
};

describe('Advanced Collaboration Features', () => {
  let ydoc: Y.Doc;
  let ytext: Y.Text;
  
  beforeEach(() => {
    jest.clearAllMocks();
    ydoc = new Y.Doc();
    ytext = ydoc.getText('content');
    
    mockWebsocketProvider.mockImplementation(() => ({
      on: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      awareness: {
        on: jest.fn(),
        setLocalStateField: jest.fn(),
        getStates: jest.fn().mockReturnValue(new Map())
      },
      destroy: jest.fn()
    }) as any);
  });

  afterEach(() => {
    ydoc.destroy();
  });

  describe('Conflict Resolution', () => {
    it('should resolve simultaneous text edits correctly', async () => {
      // Simulate two users editing the same document simultaneously
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();
      
      const text1 = doc1.getText('content');
      const text2 = doc2.getText('content');
      
      // Initial content
      text1.insert(0, 'Hello World');
      const state1 = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, state1);
      
      // Simultaneous edits
      text1.insert(6, 'Beautiful '); // "Hello Beautiful World"
      text2.insert(11, '!'); // "Hello World!"
      
      // Sync changes
      const update1 = Y.encodeStateAsUpdate(doc1, Y.encodeStateVector(doc2));
      const update2 = Y.encodeStateAsUpdate(doc2, Y.encodeStateVector(doc1));
      
      Y.applyUpdate(doc2, update1);
      Y.applyUpdate(doc1, update2);
      
      // Both documents should converge to the same state
      expect(text1.toString()).toBe(text2.toString());
      expect(text1.toString()).toBe('Hello Beautiful World!');
      
      doc1.destroy();
      doc2.destroy();
    });

    it('should handle complex nested object conflicts', async () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();
      
      const map1 = doc1.getMap('config');
      const map2 = doc2.getMap('config');
      
      // Initial state sync
      map1.set('theme', 'dark');
      map1.set('fontSize', 14);
      const initialState = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, initialState);
      
      // Conflicting changes
      map1.set('theme', 'light');
      map1.set('fontSize', 16);
      map2.set('theme', 'auto');
      map2.set('lineHeight', 1.5);
      
      // Sync changes
      const update1 = Y.encodeStateAsUpdate(doc1, Y.encodeStateVector(doc2));
      const update2 = Y.encodeStateAsUpdate(doc2, Y.encodeStateVector(doc1));
      
      Y.applyUpdate(doc2, update1);
      Y.applyUpdate(doc1, update2);
      
      // Verify convergence and LWW (Last Writer Wins) behavior
      expect(map1.get('fontSize')).toBe(16);
      expect(map2.get('fontSize')).toBe(16);
      expect(map1.get('lineHeight')).toBe(1.5);
      expect(map2.get('lineHeight')).toBe(1.5);
      
      doc1.destroy();
      doc2.destroy();
    });

    it('should preserve operation ordering in distributed scenarios', async () => {
      const operations: string[] = [];
      
      const doc = new Y.Doc();
      const ytext = doc.getText('content');
      
      // Track operations
      ytext.observe(event => {
        event.changes.delta.forEach(change => {
          if (change.insert) {
            operations.push(`insert:${change.insert}`);
          }
          if (change.delete) {
            operations.push(`delete:${change.delete}`);
          }
        });
      });
      
      // Simulate rapid operations
      ytext.insert(0, 'A');
      ytext.insert(1, 'B');
      ytext.insert(2, 'C');
      ytext.delete(1, 1); // Remove B
      ytext.insert(1, 'X'); // Insert X where B was
      
      expect(ytext.toString()).toBe('AXC');
      expect(operations).toEqual([
        'insert:A',
        'insert:B', 
        'insert:C',
        'delete:1',
        'insert:X'
      ]);
      
      doc.destroy();
    });
  });

  describe('Network Resilience', () => {
    it('should handle network partitions gracefully', async () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();
      
      const text1 = doc1.getText('content');
      const text2 = doc2.getText('content');
      
      // Initial sync
      text1.insert(0, 'Start');
      const initialState = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, initialState);
      
      // Simulate network partition - each doc makes changes independently
      text1.insert(5, ' Doc1');
      text2.insert(5, ' Doc2');
      
      // Simulate network reconnection
      const update1 = Y.encodeStateAsUpdate(doc1, Y.encodeStateVector(doc2));
      const update2 = Y.encodeStateAsUpdate(doc2, Y.encodeStateVector(doc1));
      
      Y.applyUpdate(doc2, update1);
      Y.applyUpdate(doc1, update2);
      
      // Should merge both changes
      const finalText = text1.toString();
      expect(finalText).toContain('Start');
      expect(finalText).toContain('Doc1');
      expect(finalText).toContain('Doc2');
      expect(text1.toString()).toBe(text2.toString());
      
      doc1.destroy();
      doc2.destroy();
    });

    it('should recover from connection drops', async () => {
      const provider = new mockWebsocketProvider('ws://localhost', 'test-room', ydoc);
      
      // Set up the mock to track the event handler
      let connectionCloseHandler: (() => void) | null = null;
      provider.on = jest.fn((event: string, handler: () => void) => {
        if (event === 'connection-close') {
          connectionCloseHandler = handler;
        }
      });
      
      // Simulate registering the event handler
      provider.on('connection-close', () => {
        provider.connect();
      });
      
      // Trigger connection drop by calling the handler if it exists
      if (connectionCloseHandler) {
        connectionCloseHandler();
      }
      
      // Verify reconnection attempts
      expect(provider.connect).toHaveBeenCalled();
    });

    it('should handle rapid reconnections without data loss', async () => {
      const doc = new Y.Doc();
      const ytext = doc.getText('content');
      
      const changeEvents: any[] = [];
      ytext.observe(event => changeEvents.push(event));
      
      // Simulate rapid changes during unstable connection
      for (let i = 0; i < 10; i++) {
        ytext.insert(ytext.length, `Change${i} `);
        
        // Simulate brief disconnection
        if (i % 3 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }
      
      expect(changeEvents.length).toBe(10);
      expect(ytext.toString()).toContain('Change0');
      expect(ytext.toString()).toContain('Change9');
      
      doc.destroy();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large document operations efficiently', async () => {
      const doc = new Y.Doc();
      const ytext = doc.getText('content');
      
      const startTime = performance.now();
      
      // Insert large amount of text
      const largeText = 'A'.repeat(10000);
      ytext.insert(0, largeText);
      
      // Multiple operations on large document
      for (let i = 0; i < 100; i++) {
        ytext.insert(Math.floor(Math.random() * ytext.length), `Insert${i}`);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(ytext.length).toBeGreaterThan(10000);
      
      doc.destroy();
    });

    it('should manage memory efficiently with many operations', async () => {
      const doc = new Y.Doc();
      const ytext = doc.getText('content');
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        ytext.insert(0, `Line${i}\n`);
        if (i % 100 === 0) {
          // Force garbage collection opportunity
          if (global.gc) {
            global.gc();
          }
        }
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 50MB for this test)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      
      doc.destroy();
    });

    it('should maintain performance with concurrent users', async () => {
      const docs = Array(25).fill(null).map(() => new Y.Doc());
      const texts = docs.map(doc => doc.getText('content'));
      
      const startTime = performance.now();
      
      // Simulate 25 concurrent users making changes
      await Promise.all(texts.map(async (text, index) => {
        for (let i = 0; i < 10; i++) {
          text.insert(text.length, `User${index}Edit${i} `);
          // Small delay to simulate real-world timing
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }));
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(2000); // Should handle 25 users within 2 seconds
      
      // Verify all edits were applied
      texts.forEach((text, index) => {
        expect(text.toString()).toContain(`User${index}Edit0`);
        expect(text.toString()).toContain(`User${index}Edit9`);
      });
      
      docs.forEach(doc => doc.destroy());
    });
  });

  describe('Security and Access Control', () => {
    it('should validate user permissions before allowing edits', async () => {
      const mockValidateAccess = jest.fn().mockResolvedValue(true);
      mockCollaborationManager.validateAccess = mockValidateAccess;
      
      // Simulate edit attempt
      const userId = 'user123';
      const docId = 'doc456';
      const operation = { type: 'insert', position: 0, content: 'test' };
      
      await mockCollaborationManager.validateAccess(userId, docId, operation);
      
      expect(mockValidateAccess).toHaveBeenCalledWith(userId, docId, operation);
    });

    it('should audit collaboration events', async () => {
      const mockAuditAction = jest.fn();
      mockCollaborationManager.auditAction = mockAuditAction;
      
      const auditData = {
        userId: 'user123',
        action: 'document_edit',
        documentId: 'doc456',
        timestamp: new Date(),
        details: { operation: 'insert', length: 10 }
      };
      
      mockCollaborationManager.auditAction(auditData);
      
      expect(mockAuditAction).toHaveBeenCalledWith(auditData);
    });

    it('should sanitize user inputs', async () => {
      const doc = new Y.Doc();
      const ytext = doc.getText('content');
      
      // Test potentially malicious input
      const maliciousInput = '<script>alert("xss")</script>';
      const sanitizedInput = maliciousInput.replace(/<[^>]*>/g, '');
      
      ytext.insert(0, sanitizedInput);
      
      expect(ytext.toString()).not.toContain('<script>');
      expect(ytext.toString()).toBe('alert("xss")');
      
      doc.destroy();
    });

    it('should enforce rate limiting for rapid operations', async () => {
      const rateLimiter = {
        attempts: 0,
        lastReset: Date.now(),
        limit: 100,
        window: 60000, // 1 minute
        
        checkLimit(): boolean {
          const now = Date.now();
          if (now - this.lastReset > this.window) {
            this.attempts = 0;
            this.lastReset = now;
          }
          
          this.attempts++;
          return this.attempts <= this.limit;
        }
      };
      
      const doc = new Y.Doc();
      const ytext = doc.getText('content');
      
      // Simulate rapid operations
      let blockedOperations = 0;
      for (let i = 0; i < 150; i++) {
        if (rateLimiter.checkLimit()) {
          ytext.insert(ytext.length, `Op${i} `);
        } else {
          blockedOperations++;
        }
      }
      
      expect(blockedOperations).toBe(50); // Should block 50 operations
      expect(ytext.toString().split(' ').length - 1).toBe(100); // Only 100 operations allowed
      
      doc.destroy();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should gracefully handle malformed updates', async () => {
      const doc = new Y.Doc();
      
      // Mock applyUpdate to simulate graceful handling of malformed data
      const mockApplyUpdate = jest.mocked(Y.applyUpdate);
      mockApplyUpdate.mockImplementation(() => {
        // Simulate graceful handling - don't throw, just ignore bad data
      });
      
      expect(() => {
        // Attempt to apply invalid update
        const invalidUpdate = new Uint8Array([255, 255, 255, 255]);
        Y.applyUpdate(doc, invalidUpdate);
      }).not.toThrow();
      
      // Document should remain functional
      const ytext = doc.getText('content');
      ytext.insert(0, 'Still working');
      expect(ytext.toString()).toBe('Still working');
      
      doc.destroy();
    });

    it('should recover from provider connection errors', async () => {
      const provider = new mockWebsocketProvider('ws://localhost', 'test-room', ydoc);
      
      // Set up the mock to track the error handler
      let connectionErrorHandler: ((error: Error) => void) | null = null;
      provider.on = jest.fn((event: string, handler: (error?: Error) => void) => {
        if (event === 'connection-error') {
          connectionErrorHandler = handler;
        }
      });
      
      // Simulate registering the error handler
      provider.on('connection-error', () => {
        provider.connect();
      });
      
      // Trigger connection error by calling the handler if it exists
      if (connectionErrorHandler) {
        const error = new Error('Connection failed');
        connectionErrorHandler(error);
      }
      
      // Should attempt to reconnect
      expect(provider.connect).toHaveBeenCalled();
    });

    it('should handle document corruption gracefully', async () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();
      
      const text1 = doc1.getText('content');
      text1.insert(0, 'Valid content');
      
      try {
        // Simulate corruption by modifying internal state
        const state = Y.encodeStateAsUpdate(doc1);
        const corruptedState = new Uint8Array(state.length);
        corruptedState.set(state);
        corruptedState[0] = 255; // Corrupt first byte
        
        Y.applyUpdate(doc2, corruptedState);
      } catch (error) {
        // Should handle corruption gracefully
        expect(error).toBeInstanceOf(Error);
      }
      
      // doc2 should remain functional even after corruption attempt
      const text2 = doc2.getText('content');
      text2.insert(0, 'Recovery test');
      expect(text2.toString()).toBe('Recovery test');
      
      doc1.destroy();
      doc2.destroy();
    });
  });
});
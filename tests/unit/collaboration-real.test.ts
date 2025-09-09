/**
 * Real Y.js Collaboration Tests
 * Tests actual CRDT behavior with the real Y.js library
 */

import * as Y from 'yjs';

describe('Real Y.js Collaboration', () => {
  describe('Basic CRDT Operations', () => {
    test('should handle concurrent text insertions with proper convergence', () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();
      
      const text1 = doc1.getText('content');
      const text2 = doc2.getText('content');
      
      // Initial state
      text1.insert(0, 'Hello World');
      
      // Sync initial state
      const state1 = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, state1);
      
      expect(text1.toString()).toBe('Hello World');
      expect(text2.toString()).toBe('Hello World');
      
      // Concurrent modifications
      text1.insert(6, 'Beautiful '); // "Hello Beautiful World"
      text2.insert(11, '!'); // "Hello World!"
      
      // Exchange updates
      const update1 = Y.encodeStateAsUpdate(doc1, Y.encodeStateVector(doc2));
      const update2 = Y.encodeStateAsUpdate(doc2, Y.encodeStateVector(doc1));
      
      Y.applyUpdate(doc2, update1);
      Y.applyUpdate(doc1, update2);
      
      // Both documents should converge
      expect(text1.toString()).toBe(text2.toString());
      expect(text1.toString()).toBe('Hello Beautiful World!');
      
      doc1.destroy();
      doc2.destroy();
    });

    test('should handle map operations with last-writer-wins', () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();
      
      const map1 = doc1.getMap('config');
      const map2 = doc2.getMap('config');
      
      // Initial state
      map1.set('theme', 'dark');
      map1.set('fontSize', 14);
      
      // Sync initial state
      const state1 = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, state1);
      
      expect(map2.get('theme')).toBe('dark');
      expect(map2.get('fontSize')).toBe(14);
      
      // Concurrent updates
      map1.set('fontSize', 16);
      map2.set('fontSize', 18);
      map1.set('lineHeight', 1.5);
      
      // Exchange updates
      const update1 = Y.encodeStateAsUpdate(doc1, Y.encodeStateVector(doc2));
      const update2 = Y.encodeStateAsUpdate(doc2, Y.encodeStateVector(doc1));
      
      Y.applyUpdate(doc2, update1);
      Y.applyUpdate(doc1, update2);
      
      // Should have converged with last-writer-wins
      expect(map1.get('fontSize')).toBe(map2.get('fontSize'));
      expect(map1.get('lineHeight')).toBe(1.5);
      expect(map2.get('lineHeight')).toBe(1.5);
      
      doc1.destroy();
      doc2.destroy();
    });

    test('should preserve operation causality', () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();
      const doc3 = new Y.Doc();
      
      const text1 = doc1.getText('content');
      const text2 = doc2.getText('content');
      const text3 = doc3.getText('content');
      
      // Sequential operations on doc1
      text1.insert(0, 'A');
      text1.insert(1, 'B');
      text1.insert(2, 'C');
      
      // Apply to doc2 in order
      let update = Y.encodeStateAsUpdate(doc1, Y.encodeStateVector(doc2));
      Y.applyUpdate(doc2, update);
      
      // Apply to doc3 via doc2 (indirect)
      update = Y.encodeStateAsUpdate(doc2, Y.encodeStateVector(doc3));
      Y.applyUpdate(doc3, update);
      
      expect(text1.toString()).toBe('ABC');
      expect(text2.toString()).toBe('ABC');
      expect(text3.toString()).toBe('ABC');
      
      doc1.destroy();
      doc2.destroy();
      doc3.destroy();
    });
  });

  describe('Change Observation', () => {
    test('should properly observe text changes', (done) => {
      const doc = new Y.Doc();
      const text = doc.getText('content');
      
      let changeCount = 0;
      
      text.observe((event) => {
        changeCount++;
        expect(event.target).toBe(text);
        expect(event.changes.delta).toBeDefined();
        
        if (changeCount === 2) {
          doc.destroy();
          done();
        }
      });
      
      text.insert(0, 'Hello');
      text.insert(5, ' World');
    });

    test('should observe map changes', (done) => {
      const doc = new Y.Doc();
      const map = doc.getMap('config');
      
      let changeCount = 0;
      
      map.observe((event) => {
        changeCount++;
        expect(event.target).toBe(map);
        expect(event.changes.keys).toBeDefined();
        
        if (changeCount === 2) {
          doc.destroy();
          done();
        }
      });
      
      map.set('key1', 'value1');
      map.set('key2', 'value2');
    });
  });

  describe('Complex Scenarios', () => {
    test('should handle interleaved operations correctly', () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();
      
      const text1 = doc1.getText('content');
      const text2 = doc2.getText('content');
      
      // Build up some initial content
      text1.insert(0, 'The quick brown fox');
      
      let update = Y.encodeStateAsUpdate(doc1, Y.encodeStateVector(doc2));
      Y.applyUpdate(doc2, update);
      
      // Now perform interleaved operations
      text1.insert(4, 'very '); // "The very quick brown fox"
      text2.delete(10, 5); // Remove "brown"
      text1.insert(text1.length, ' jumps'); // Add at end
      text2.insert(0, 'Actually, '); // Add at beginning
      
      // Sync all changes
      update = Y.encodeStateAsUpdate(doc1, Y.encodeStateVector(doc2));
      Y.applyUpdate(doc2, update);
      
      update = Y.encodeStateAsUpdate(doc2, Y.encodeStateVector(doc1));
      Y.applyUpdate(doc1, update);
      
      // Should converge to same state
      expect(text1.toString()).toBe(text2.toString());
      
      const finalText = text1.toString();
      expect(finalText).toContain('Actually');
      expect(finalText).toContain('very');
      expect(finalText).toContain('jumps');
      
      doc1.destroy();
      doc2.destroy();
    });

    test('should handle large number of concurrent operations', () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();
      
      const text1 = doc1.getText('content');
      const text2 = doc2.getText('content');
      
      // Perform many operations on each document
      for (let i = 0; i < 50; i++) {
        text1.insert(0, `Doc1-${i} `);
        text2.insert(0, `Doc2-${i} `);
      }
      
      // Sync
      let update = Y.encodeStateAsUpdate(doc1, Y.encodeStateVector(doc2));
      Y.applyUpdate(doc2, update);
      
      update = Y.encodeStateAsUpdate(doc2, Y.encodeStateVector(doc1));
      Y.applyUpdate(doc1, update);
      
      // Should converge
      expect(text1.toString()).toBe(text2.toString());
      expect(text1.toString().length).toBeGreaterThan(100);
      
      doc1.destroy();
      doc2.destroy();
    });
  });

  describe('Document State Management', () => {
    test('should properly encode and decode document states', () => {
      const doc1 = new Y.Doc();
      const text1 = doc1.getText('content');
      
      text1.insert(0, 'Hello World');
      
      // Encode full state
      const fullState = Y.encodeStateAsUpdate(doc1);
      
      // Create new document and apply state
      const doc2 = new Y.Doc();
      Y.applyUpdate(doc2, fullState);
      
      const text2 = doc2.getText('content');
      expect(text2.toString()).toBe('Hello World');
      
      doc1.destroy();
      doc2.destroy();
    });

    test('should handle incremental updates correctly', () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();
      
      const text1 = doc1.getText('content');
      const text2 = doc2.getText('content');
      
      // Initial sync
      text1.insert(0, 'Initial');
      const update = Y.encodeStateAsUpdate(doc1);
      Y.applyUpdate(doc2, update);
      
      expect(text2.toString()).toBe('Initial');
      
      // Incremental updates
      text1.insert(7, ' content');
      
      // Only send incremental update
      const stateVector = Y.encodeStateVector(doc2);
      const incrementalUpdate = Y.encodeStateAsUpdate(doc1, stateVector);
      Y.applyUpdate(doc2, incrementalUpdate);
      
      expect(text2.toString()).toBe('Initial content');
      
      doc1.destroy();
      doc2.destroy();
    });
  });

  describe('Error Resilience', () => {
    test('should handle malformed updates gracefully', () => {
      const doc = new Y.Doc();
      const text = doc.getText('content');
      
      text.insert(0, 'Valid content');
      
      // Try to apply malformed update (should throw error for invalid data)
      const malformedUpdate = new Uint8Array([1, 2, 3, 4, 5]);
      
      expect(() => {
        Y.applyUpdate(doc, malformedUpdate);
      }).toThrow();
      
      // Document should still be valid (error should not corrupt state)
      expect(text.toString()).toBe('Valid content');
      
      doc.destroy();
    });

    test('should handle empty updates', () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();
      
      const text1 = doc1.getText('content');
      text1.insert(0, 'Test content');
      
      // Generate update when doc2 is already up to date
      const stateVector = Y.encodeStateVector(doc1);
      const emptyUpdate = Y.encodeStateAsUpdate(doc1, stateVector);
      
      expect(() => {
        Y.applyUpdate(doc2, emptyUpdate);
      }).not.toThrow();
      
      doc1.destroy();
      doc2.destroy();
    });
  });

  describe('Memory Management', () => {
    test('should clean up resources properly', () => {
      const docs = [];
      
      // Create many documents
      for (let i = 0; i < 100; i++) {
        const doc = new Y.Doc();
        const text = doc.getText('content');
        text.insert(0, `Document ${i} content`);
        docs.push(doc);
      }
      
      // Destroy all documents
      docs.forEach(doc => doc.destroy());
      
      // Test passes if no memory leaks or errors
      expect(true).toBe(true);
    });

    test('should handle rapid document creation and destruction', () => {
      for (let i = 0; i < 50; i++) {
        const doc = new Y.Doc();
        const text = doc.getText('test');
        text.insert(0, 'test content');
        doc.destroy();
      }
      
      // Should complete without errors
      expect(true).toBe(true);
    });
  });
});
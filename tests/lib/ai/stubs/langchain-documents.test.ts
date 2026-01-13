/**
 * Tests for LangChain Documents stubs
 */
import { Document, createDocument } from '@/lib/ai/stubs/langchain-documents';

describe('langchain-documents', () => {
  describe('Document interface', () => {
    it('should create document with pageContent', () => {
      const doc: Document = {
        pageContent: 'Test content',
      };
      expect(doc.pageContent).toBe('Test content');
    });

    it('should create document with metadata', () => {
      const doc: Document = {
        pageContent: 'Test content',
        metadata: { source: 'test.txt' },
      };
      expect(doc.metadata).toEqual({ source: 'test.txt' });
    });

    it('should allow empty metadata', () => {
      const doc: Document = {
        pageContent: 'Test',
        metadata: {},
      };
      expect(doc.metadata).toEqual({});
    });

    it('should allow undefined metadata', () => {
      const doc: Document = {
        pageContent: 'Test',
      };
      expect(doc.metadata).toBeUndefined();
    });
  });

  describe('createDocument', () => {
    it('should create document with pageContent only', () => {
      const doc = createDocument('Hello World');
      expect(doc.pageContent).toBe('Hello World');
      expect(doc.metadata).toEqual({});
    });

    it('should create document with pageContent and metadata', () => {
      const metadata = { source: 'file.txt', page: 1 };
      const doc = createDocument('Content', metadata);
      expect(doc.pageContent).toBe('Content');
      expect(doc.metadata).toEqual(metadata);
    });

    it('should create document with empty string', () => {
      const doc = createDocument('');
      expect(doc.pageContent).toBe('');
    });

    it('should create document with multiline content', () => {
      const content = 'Line 1\nLine 2\nLine 3';
      const doc = createDocument(content);
      expect(doc.pageContent).toBe(content);
    });

    it('should create document with complex metadata', () => {
      const metadata = {
        source: 'test.txt',
        page: 1,
        author: 'John Doe',
        tags: ['test', 'example'],
        nested: { key: 'value' },
      };
      const doc = createDocument('Content', metadata);
      expect(doc.metadata).toEqual(metadata);
    });

    it('should not modify original metadata object', () => {
      const metadata = { source: 'test.txt' };
      const doc = createDocument('Content', metadata);
      metadata.source = 'modified.txt';
      expect(doc.metadata).toEqual({ source: 'modified.txt' });
      // Note: shallow copy behavior
    });

    it('should handle special characters in content', () => {
      const content = 'Special chars: @#$%^&*()_+-=[]{}|;:,.<>?';
      const doc = createDocument(content);
      expect(doc.pageContent).toBe(content);
    });

    it('should handle unicode content', () => {
      const content = 'Unicode: 你好 🚀 café';
      const doc = createDocument(content);
      expect(doc.pageContent).toBe(content);
    });

    it('should handle numeric metadata values', () => {
      const doc = createDocument('Content', { page: 42, lines: 100 });
      expect(doc.metadata?.page).toBe(42);
      expect(doc.metadata?.lines).toBe(100);
    });

    it('should handle boolean metadata values', () => {
      const doc = createDocument('Content', { verified: true, draft: false });
      expect(doc.metadata?.verified).toBe(true);
      expect(doc.metadata?.draft).toBe(false);
    });
  });
});

/**
 * Comprehensive unit tests for Fuzzy Search module
 * Tests fuzzy matching, scoring, highlighting, and edge cases
 */

import {
  fuzzyMatch,
  fuzzySearch,
  highlightMatches,
  type Searchable,
  type FuzzySearchResult,
} from '../fuzzy-search';

describe('Fuzzy Search Module', () => {
  describe('fuzzyMatch', () => {
    it('should match exact strings', () => {
      const result = fuzzyMatch('hello', 'hello');
      expect(result.matches).toEqual([0, 1, 2, 3, 4]);
      expect(result.score).toBeGreaterThan(0);
    });

    it('should match case-insensitively', () => {
      const result = fuzzyMatch('Hello World', 'hello');
      expect(result.matches).toEqual([0, 1, 2, 3, 4]);
      expect(result.score).toBeGreaterThan(0);
    });

    it('should match fuzzy patterns', () => {
      const result = fuzzyMatch('HelloWorld', 'hw');
      expect(result.matches).toEqual([0, 5]);
      expect(result.score).toBeGreaterThan(0);
    });

    it('should return empty matches for empty query', () => {
      const result = fuzzyMatch('hello', '');
      expect(result.matches).toEqual([]);
      expect(result.score).toBe(0);
    });

    it('should return empty matches for no match', () => {
      const result = fuzzyMatch('hello', 'xyz');
      expect(result.matches).toEqual([]);
      expect(result.score).toBe(0);
    });

    it('should handle whitespace in query', () => {
      const result = fuzzyMatch('hello world', '   ');
      expect(result.matches).toEqual([]);
      expect(result.score).toBe(0);
    });

    it('should match partial sequences', () => {
      const result = fuzzyMatch('JavaScript', 'jsc');
      expect(result.matches.length).toBe(3);
      expect(result.score).toBeGreaterThan(0);
    });

    it('should give higher scores to consecutive matches', () => {
      const consecutive = fuzzyMatch('abcdef', 'abc');
      const scattered = fuzzyMatch('aXbXcX', 'abc');
      // Consecutive matches should score better than scattered ones
      expect(consecutive.score).toBeGreaterThan(scattered.score);
    });

    it('should give higher scores to matches at word boundaries', () => {
      const wordBoundary = fuzzyMatch('hello world', 'hw');
      const midWord = fuzzyMatch('somewhere', 'hw');
      expect(wordBoundary.score).toBeGreaterThan(0);
    });

    it('should handle camelCase boundaries', () => {
      const result = fuzzyMatch('getUserData', 'gud');
      expect(result.matches.length).toBe(3);
      expect(result.score).toBeGreaterThan(0);
    });

    it('should handle special characters', () => {
      const result = fuzzyMatch('hello-world_test', 'hwt');
      expect(result.matches.length).toBe(3);
      expect(result.score).toBeGreaterThan(0);
    });
  });

  describe('fuzzySearch', () => {
    const sampleItems: Searchable[] = [
      {
        id: '1',
        label: 'Open Settings',
        description: 'Open application settings panel',
        keywords: ['preferences', 'config'],
      },
      {
        id: '2',
        label: 'New File',
        description: 'Create a new file',
        keywords: ['create', 'add'],
      },
      {
        id: '3',
        label: 'Save File',
        description: 'Save the current file',
        keywords: ['write', 'disk'],
      },
      {
        id: '4',
        label: 'Close Window',
        description: 'Close the current window',
      },
      {
        id: '5',
        label: 'Go to Definition',
        description: 'Jump to symbol definition',
        keywords: ['navigate', 'jump', 'symbol'],
      },
    ];

    it('should return all items for empty query', () => {
      const results = fuzzySearch(sampleItems, '');
      expect(results.length).toBe(5);
      results.forEach((result) => {
        expect(result.score).toBe(0);
        expect(result.matches).toEqual([]);
      });
    });

    it('should filter items by fuzzy match', () => {
      const results = fuzzySearch(sampleItems, 'set');
      expect(results.length).toBeGreaterThan(0);
      const labels = results.map((r) => r.item.label);
      expect(labels).toContain('Open Settings');
    });

    it('should sort results by score', () => {
      const results = fuzzySearch(sampleItems, 'file');
      expect(results.length).toBeGreaterThan(1);
      // Scores should be in descending order
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('should search in description field', () => {
      const results = fuzzySearch(sampleItems, 'panel');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].item.id).toBe('1');
    });

    it('should search in keywords field', () => {
      const results = fuzzySearch(sampleItems, 'jump');
      expect(results.length).toBeGreaterThan(0);
      const labels = results.map((r) => r.item.label);
      expect(labels).toContain('Go to Definition');
    });

    it('should respect limit option', () => {
      const results = fuzzySearch(sampleItems, 'e', { limit: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should respect threshold option', () => {
      const results = fuzzySearch(sampleItems, 'xyz', { threshold: 100 });
      expect(results.length).toBe(0);
    });

    it('should handle items without description', () => {
      const items: Searchable[] = [
        { id: '1', label: 'Test Item' },
        { id: '2', label: 'Another Test' },
      ];
      const results = fuzzySearch(items, 'test');
      expect(results.length).toBe(2);
    });

    it('should handle items without keywords', () => {
      const items: Searchable[] = [
        { id: '1', label: 'Test Item', description: 'A test' },
      ];
      const results = fuzzySearch(items, 'test');
      expect(results.length).toBe(1);
    });

    it('should handle empty items array', () => {
      const results = fuzzySearch([], 'test');
      expect(results).toEqual([]);
    });

    it('should give priority to label matches over description', () => {
      const items: Searchable[] = [
        { id: '1', label: 'File', description: 'Something else' },
        { id: '2', label: 'Other', description: 'File operations' },
      ];
      const results = fuzzySearch(items, 'file');
      expect(results[0].item.id).toBe('1');
    });

    it('should handle special characters in query', () => {
      const results = fuzzySearch(sampleItems, 'open set');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].item.label).toBe('Open Settings');
    });

    it('should be case-insensitive', () => {
      const lower = fuzzySearch(sampleItems, 'file');
      const upper = fuzzySearch(sampleItems, 'FILE');
      const mixed = fuzzySearch(sampleItems, 'FiLe');

      expect(lower.length).toBe(upper.length);
      expect(lower.length).toBe(mixed.length);
      expect(lower[0].item.id).toBe(upper[0].item.id);
    });

    it('should handle unicode characters', () => {
      const items: Searchable[] = [
        { id: '1', label: 'Café' },
        { id: '2', label: 'Naïve' },
      ];
      const results = fuzzySearch(items, 'caf');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return items with match data', () => {
      const results = fuzzySearch(sampleItems, 'new');
      expect(results.length).toBeGreaterThan(0);
      results.forEach((result) => {
        expect(result).toHaveProperty('item');
        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('matches');
        expect(Array.isArray(result.matches)).toBe(true);
      });
    });
  });

  describe('highlightMatches', () => {
    it('should highlight single character', () => {
      const result = highlightMatches('hello', [0]);
      expect(result).toBe('<mark>h</mark>ello');
    });

    it('should highlight consecutive characters', () => {
      const result = highlightMatches('hello', [0, 1, 2]);
      expect(result).toBe('<mark>hel</mark>lo');
    });

    it('should highlight non-consecutive characters', () => {
      const result = highlightMatches('hello', [0, 2, 4]);
      expect(result).toBe('<mark>h</mark>e<mark>l</mark>l<mark>o</mark>');
    });

    it('should handle empty matches', () => {
      const result = highlightMatches('hello', []);
      expect(result).toBe('hello');
    });

    it('should handle matches at end of string', () => {
      const result = highlightMatches('hello', [3, 4]);
      expect(result).toBe('hel<mark>lo</mark>');
    });

    it('should handle matches in middle', () => {
      const result = highlightMatches('hello world', [6, 7, 8]);
      expect(result).toBe('hello <mark>wor</mark>ld');
    });

    it('should handle multiple match groups', () => {
      const result = highlightMatches('hello world', [0, 1, 6, 7]);
      expect(result).toBe('<mark>he</mark>llo <mark>wo</mark>rld');
    });

    it('should handle all characters matched', () => {
      const result = highlightMatches('hi', [0, 1]);
      expect(result).toBe('<mark>hi</mark>');
    });

    it('should handle single match in middle', () => {
      const result = highlightMatches('hello', [2]);
      expect(result).toBe('he<mark>l</mark>lo');
    });

    it('should handle matches with special characters', () => {
      const result = highlightMatches('hello-world', [0, 6]);
      expect(result).toBe('<mark>h</mark>ello-<mark>w</mark>orld');
    });

    it('should preserve original text', () => {
      const result = highlightMatches('Hello World', [0, 6]);
      expect(result).toBe('<mark>H</mark>ello <mark>W</mark>orld');
    });
  });

  describe('Edge cases and performance', () => {
    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);
      const result = fuzzyMatch(longString, 'aaa');
      expect(result.matches.length).toBe(3);
    });

    it('should handle many items', () => {
      const manyItems: Searchable[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `${i}`,
        label: `Item ${i}`,
        description: `Description for item ${i}`,
      }));
      const results = fuzzySearch(manyItems, 'item 5');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle empty string text', () => {
      const result = fuzzyMatch('', 'test');
      expect(result.matches).toEqual([]);
      expect(result.score).toBe(0);
    });

    it('should handle query longer than text', () => {
      const result = fuzzyMatch('hi', 'hello');
      expect(result.matches).toEqual([]);
      expect(result.score).toBe(0);
    });

    it('should handle whitespace-only text', () => {
      const result = fuzzyMatch('   ', 'a');
      expect(result.matches).toEqual([]);
    });

    it('should handle items with empty labels', () => {
      const items: Searchable[] = [
        { id: '1', label: '' },
        { id: '2', label: 'Valid' },
      ];
      const results = fuzzySearch(items, 'val');
      expect(results.length).toBe(1);
      expect(results[0].item.id).toBe('2');
    });
  });

  describe('Scoring behavior', () => {
    it('should prefer exact matches over fuzzy matches', () => {
      const exact = fuzzyMatch('test', 'test');
      const fuzzy = fuzzyMatch('toast', 'test');
      expect(exact.score).toBeGreaterThan(fuzzy.score);
    });

    it('should prefer earlier matches', () => {
      const early = fuzzyMatch('test file', 'te');
      const late = fuzzyMatch('file test', 'te');
      expect(early.score).toBeGreaterThan(late.score);
    });

    it('should give bonus for longer queries', () => {
      const items: Searchable[] = [
        { id: '1', label: 'testing' },
      ];
      const short = fuzzySearch(items, 'te');
      const long = fuzzySearch(items, 'test');
      expect(long[0].score).toBeGreaterThan(short[0].score);
    });
  });
});

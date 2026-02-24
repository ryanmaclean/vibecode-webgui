/**
 * Tests for Search Optimizer
 */

import {
  ChunkedSearch,
  searchInChunks,
  findAllMatches,
  countMatches,
  hasMatch,
  type SearchMatch,
  type SearchOptions,
  type SearchResult,
  type SearchProgressCallback,
} from '@/lib/editor/search-optimizer';

describe('Search Optimizer', () => {
  describe('ChunkedSearch', () => {
    let search: ChunkedSearch;

    beforeEach(() => {
      search = new ChunkedSearch();
    });

    describe('basic search', () => {
      it('should find simple text matches', async () => {
        const content = 'hello world\nfoo bar\nhello again';
        const result = await search.search(content, 'hello');

        expect(result.matches).toHaveLength(2);
        expect(result.matches[0].line).toBe(0);
        expect(result.matches[0].matchedText).toBe('hello');
        expect(result.matches[1].line).toBe(2);
        expect(result.totalMatches).toBe(2);
        expect(result.cancelled).toBe(false);
      });

      it('should find multiple matches on same line', async () => {
        const content = 'test test test';
        const result = await search.search(content, 'test');

        expect(result.matches).toHaveLength(3);
        expect(result.matches[0].column).toBe(0);
        expect(result.matches[1].column).toBe(5);
        expect(result.matches[2].column).toBe(10);
      });

      it('should return empty array when no matches found', async () => {
        const content = 'hello world';
        const result = await search.search(content, 'notfound');

        expect(result.matches).toHaveLength(0);
        expect(result.totalMatches).toBe(0);
      });

      it('should include line text in matches', async () => {
        const content = 'hello world\nfoo bar';
        const result = await search.search(content, 'hello');

        expect(result.matches[0].lineText).toBe('hello world');
      });

      it('should set correct column and endColumn', async () => {
        const content = 'prefix hello suffix';
        const result = await search.search(content, 'hello');

        expect(result.matches[0].column).toBe(7);
        expect(result.matches[0].endColumn).toBe(12);
      });
    });

    describe('case sensitivity', () => {
      it('should be case-insensitive by default', async () => {
        const content = 'Hello HELLO hello';
        const result = await search.search(content, 'hello');

        expect(result.matches).toHaveLength(3);
      });

      it('should support case-sensitive search', async () => {
        const content = 'Hello HELLO hello';
        const result = await search.search(content, 'hello', {
          caseSensitive: true,
        });

        expect(result.matches).toHaveLength(1);
        expect(result.matches[0].matchedText).toBe('hello');
      });

      it('should respect case sensitivity with regex', async () => {
        const content = 'Hello World';
        const result = await search.search(content, 'hello', {
          caseSensitive: true,
          useRegex: false,
        });

        expect(result.matches).toHaveLength(0);
      });
    });

    describe('regex search', () => {
      it('should support regular expressions', async () => {
        const content = 'test123\ntest456\nabc789';
        const result = await search.search(content, 'test\\d+', {
          useRegex: true,
        });

        expect(result.matches).toHaveLength(2);
        expect(result.matches[0].matchedText).toBe('test123');
        expect(result.matches[1].matchedText).toBe('test456');
      });

      it('should escape special characters when not using regex', async () => {
        const content = 'price $100';
        const result = await search.search(content, '$100', {
          useRegex: false,
        });

        expect(result.matches).toHaveLength(1);
        expect(result.matches[0].matchedText).toBe('$100');
      });

      it('should handle complex regex patterns', async () => {
        const content = 'email@example.com\ntest@test.org';
        const result = await search.search(content, '[a-z]+@[a-z]+\\.[a-z]+', {
          useRegex: true,
        });

        expect(result.matches).toHaveLength(2);
      });

      it('should throw error for invalid regex', async () => {
        const content = 'test';

        await expect(
          search.search(content, '[invalid(', { useRegex: true })
        ).rejects.toThrow('Invalid search pattern');
      });
    });

    describe('whole word matching', () => {
      it('should match whole words only', async () => {
        const content = 'test testing tester test';
        const result = await search.search(content, 'test', {
          wholeWord: true,
        });

        expect(result.matches).toHaveLength(2);
        expect(result.matches[0].column).toBe(0);
        expect(result.matches[1].column).toBe(20);
      });

      it('should work with word boundaries', async () => {
        const content = 'hello world helloworld';
        const result = await search.search(content, 'hello', {
          wholeWord: true,
        });

        expect(result.matches).toHaveLength(1);
        expect(result.matches[0].column).toBe(0);
      });
    });

    describe('context lines', () => {
      it('should include context before match', async () => {
        const content = 'line1\nline2\nmatch\nline4';
        const result = await search.search(content, 'match', {
          contextBefore: 2,
        });

        expect(result.matches[0].beforeContext).toBe('line1\nline2');
      });

      it('should include context after match', async () => {
        const content = 'line1\nmatch\nline3\nline4';
        const result = await search.search(content, 'match', {
          contextAfter: 2,
        });

        expect(result.matches[0].afterContext).toBe('line3\nline4');
      });

      it('should handle context at file boundaries', async () => {
        const content = 'match\nline2';
        const result = await search.search(content, 'match', {
          contextBefore: 5,
        });

        expect(result.matches[0].beforeContext).toBeUndefined();
      });

      it('should include both before and after context', async () => {
        const content = 'line1\nline2\nmatch\nline4\nline5';
        const result = await search.search(content, 'match', {
          contextBefore: 1,
          contextAfter: 1,
        });

        expect(result.matches[0].beforeContext).toBe('line2');
        expect(result.matches[0].afterContext).toBe('line4');
      });

      it('should not include context when set to 0', async () => {
        const content = 'line1\nmatch\nline3';
        const result = await search.search(content, 'match', {
          contextBefore: 0,
          contextAfter: 0,
        });

        expect(result.matches[0].beforeContext).toBeUndefined();
        expect(result.matches[0].afterContext).toBeUndefined();
      });
    });

    describe('max matches limit', () => {
      it('should limit number of matches', async () => {
        const content = 'test\ntest\ntest\ntest\ntest';
        const result = await search.search(content, 'test', {
          maxMatches: 3,
        });

        expect(result.matches).toHaveLength(3);
        expect(result.totalMatches).toBe(3);
        expect(result.limitReached).toBe(true);
      });

      it('should not limit when maxMatches is 0', async () => {
        const content = 'test\ntest\ntest\ntest\ntest';
        const result = await search.search(content, 'test', {
          maxMatches: 0,
        });

        expect(result.matches).toHaveLength(5);
        expect(result.limitReached).toBe(false);
      });

      it('should set limitReached to false when not reaching limit', async () => {
        const content = 'test\ntest';
        const result = await search.search(content, 'test', {
          maxMatches: 10,
        });

        expect(result.matches).toHaveLength(2);
        expect(result.limitReached).toBe(false);
      });
    });

    describe('cancellation', () => {
      it('should cancel search in progress', async () => {
        const content = 'test\n'.repeat(10000);
        let progressCount = 0;

        // Start search with progress callback to cancel mid-search
        const searchPromise = search.search(content, 'test', {}, () => {
          progressCount++;
          // Cancel after first progress report
          if (progressCount === 1) {
            search.cancel();
          }
        });

        const result = await searchPromise;

        expect(result.cancelled).toBe(true);
        expect(result.matches.length).toBeLessThan(10000);
      });

      it('should allow completing search when not cancelled', async () => {
        const content = 'test\ntest\ntest';
        const result = await search.search(content, 'test');

        expect(result.cancelled).toBe(false);
        expect(result.matches).toHaveLength(3);
      });
    });

    describe('progress reporting', () => {
      it('should call progress callback', async () => {
        const content = 'test\n'.repeat(5000); // Large enough to trigger chunking
        const progressCalls: Array<{
          chunksProcessed: number;
          totalChunks: number;
          matchesFound: number;
        }> = [];

        const onProgress: SearchProgressCallback = (
          chunksProcessed,
          totalChunks,
          matchesFound
        ) => {
          progressCalls.push({ chunksProcessed, totalChunks, matchesFound });
        };

        await search.search(content, 'test', {}, onProgress);

        expect(progressCalls.length).toBeGreaterThan(0);
        expect(progressCalls[progressCalls.length - 1].chunksProcessed).toBe(
          progressCalls[progressCalls.length - 1].totalChunks
        );
      });

      it('should report increasing match counts', async () => {
        const content = 'test\n'.repeat(3000);
        const progressCalls: number[] = [];

        const onProgress: SearchProgressCallback = (_, __, matchesFound) => {
          progressCalls.push(matchesFound);
        };

        await search.search(content, 'test', {}, onProgress);

        // Check that match count increases or stays same
        for (let i = 1; i < progressCalls.length; i++) {
          expect(progressCalls[i]).toBeGreaterThanOrEqual(progressCalls[i - 1]);
        }
      });
    });

    describe('deduplication', () => {
      it('should deduplicate matches across chunk boundaries', async () => {
        // Small chunk size to force overlaps
        const content = 'test\n'.repeat(100);
        const result = await search.search(content, 'test', {
          chunkSize: 10,
          overlapSize: 5,
        });

        // Should have exactly 100 matches, not more due to overlaps
        expect(result.totalMatches).toBe(100);

        // Verify no duplicate matches at same position
        const positions = result.matches.map((m) => `${m.line}:${m.column}`);
        const uniquePositions = new Set(positions);
        expect(positions.length).toBe(uniquePositions.size);
      });
    });

    describe('search result metadata', () => {
      it('should include chunks processed', async () => {
        const content = 'test\n'.repeat(5000);
        const result = await search.search(content, 'test');

        expect(result.chunksProcessed).toBeGreaterThan(0);
        expect(result.totalChunks).toBeGreaterThan(0);
        expect(result.chunksProcessed).toBeLessThanOrEqual(result.totalChunks);
      });

      it('should include search duration', async () => {
        const content = 'test\ntest\ntest';
        const result = await search.search(content, 'test');

        expect(result.duration).toBeGreaterThanOrEqual(0);
        expect(typeof result.duration).toBe('number');
      });

      it('should report all chunks processed when complete', async () => {
        const content = 'test\ntest\ntest';
        const result = await search.search(content, 'test');

        expect(result.chunksProcessed).toBe(result.totalChunks);
      });
    });

    describe('edge cases', () => {
      it('should handle empty content', async () => {
        const result = await search.search('', 'test');

        expect(result.matches).toHaveLength(0);
        expect(result.totalMatches).toBe(0);
      });

      it('should handle empty pattern', async () => {
        const content = 'test';
        const result = await search.search(content, '');

        expect(result.matches).toBeDefined();
      });

      it('should handle single line content', async () => {
        const content = 'single line test';
        const result = await search.search(content, 'test');

        expect(result.matches).toHaveLength(1);
        expect(result.matches[0].line).toBe(0);
      });

      it('should handle very long lines', async () => {
        const longLine = 'a'.repeat(10000) + 'test' + 'b'.repeat(10000);
        const result = await search.search(longLine, 'test');

        expect(result.matches).toHaveLength(1);
        expect(result.matches[0].column).toBe(10000);
      });

      it('should handle unicode characters', async () => {
        const content = 'Hello 世界 test 🌍';
        const result = await search.search(content, 'test');

        expect(result.matches).toHaveLength(1);
        expect(result.matches[0].matchedText).toBe('test');
      });

      it('should handle newlines in pattern', async () => {
        const content = 'line1\nline2';
        const result = await search.search(content, 'line1\nline2', {
          useRegex: false,
        });

        // Newlines in pattern won't match because we search line by line
        expect(result.matches).toHaveLength(0);
      });
    });
  });

  describe('searchInChunks', () => {
    it('should be a convenience wrapper for ChunkedSearch', async () => {
      const content = 'hello world\nhello again';
      const result = await searchInChunks(content, 'hello');

      expect(result.matches).toHaveLength(2);
      expect(result.totalMatches).toBe(2);
    });

    it('should accept search options', async () => {
      const content = 'Hello HELLO hello';
      const result = await searchInChunks(content, 'hello', {
        caseSensitive: true,
      });

      expect(result.matches).toHaveLength(1);
    });

    it('should support progress callback', async () => {
      const content = 'test\n'.repeat(3000);
      let progressCalled = false;

      await searchInChunks(content, 'test', {}, () => {
        progressCalled = true;
      });

      expect(progressCalled).toBe(true);
    });

    it('should return search result with all metadata', async () => {
      const content = 'test';
      const result = await searchInChunks(content, 'test');

      expect(result).toHaveProperty('matches');
      expect(result).toHaveProperty('totalMatches');
      expect(result).toHaveProperty('chunksProcessed');
      expect(result).toHaveProperty('totalChunks');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('cancelled');
      expect(result).toHaveProperty('limitReached');
    });
  });

  describe('findAllMatches', () => {
    it('should find all matches synchronously', () => {
      const content = 'hello world\nhello again';
      const matches = findAllMatches(content, 'hello');

      expect(matches).toHaveLength(2);
      expect(matches[0].line).toBe(0);
      expect(matches[1].line).toBe(1);
    });

    it('should be case-insensitive by default', () => {
      const content = 'Hello HELLO hello';
      const matches = findAllMatches(content, 'hello');

      expect(matches).toHaveLength(3);
    });

    it('should support case-sensitive search', () => {
      const content = 'Hello HELLO hello';
      const matches = findAllMatches(content, 'hello', true);

      expect(matches).toHaveLength(1);
      expect(matches[0].matchedText).toBe('hello');
    });

    it('should include match metadata', () => {
      const content = 'prefix hello suffix';
      const matches = findAllMatches(content, 'hello');

      expect(matches[0]).toHaveProperty('line');
      expect(matches[0]).toHaveProperty('column');
      expect(matches[0]).toHaveProperty('endColumn');
      expect(matches[0]).toHaveProperty('matchedText');
      expect(matches[0]).toHaveProperty('lineText');
    });

    it('should return empty array when no matches', () => {
      const content = 'hello world';
      const matches = findAllMatches(content, 'notfound');

      expect(matches).toHaveLength(0);
    });

    it('should escape special regex characters', () => {
      const content = 'price $100 and $200';
      const matches = findAllMatches(content, '$');

      expect(matches).toHaveLength(2);
    });

    it('should handle empty content', () => {
      const matches = findAllMatches('', 'test');

      expect(matches).toHaveLength(0);
    });

    it('should find multiple matches on same line', () => {
      const content = 'test test test';
      const matches = findAllMatches(content, 'test');

      expect(matches).toHaveLength(3);
      expect(matches[0].column).toBe(0);
      expect(matches[1].column).toBe(5);
      expect(matches[2].column).toBe(10);
    });
  });

  describe('countMatches', () => {
    it('should count number of matches', async () => {
      const content = 'test\ntest\ntest';
      const count = await countMatches(content, 'test');

      expect(count).toBe(3);
    });

    it('should return 0 when no matches', async () => {
      const content = 'hello world';
      const count = await countMatches(content, 'notfound');

      expect(count).toBe(0);
    });

    it('should support search options', async () => {
      const content = 'Hello HELLO hello';
      const count = await countMatches(content, 'hello', {
        caseSensitive: true,
      });

      expect(count).toBe(1);
    });

    it('should handle large files', async () => {
      const content = 'test\n'.repeat(10000);
      const count = await countMatches(content, 'test');

      expect(count).toBe(10000);
    });

    it('should count matches with regex', async () => {
      const content = 'test123\ntest456\nabc789';
      const count = await countMatches(content, 'test\\d+', {
        useRegex: true,
      });

      expect(count).toBe(2);
    });
  });

  describe('hasMatch', () => {
    it('should return true when pattern exists', async () => {
      const content = 'hello world';
      const result = await hasMatch(content, 'hello');

      expect(result).toBe(true);
    });

    it('should return false when pattern not found', async () => {
      const content = 'hello world';
      const result = await hasMatch(content, 'notfound');

      expect(result).toBe(false);
    });

    it('should support search options', async () => {
      const content = 'Hello World';
      const result = await hasMatch(content, 'hello', {
        caseSensitive: true,
      });

      expect(result).toBe(false);
    });

    it('should be efficient and stop at first match', async () => {
      const content = 'test\n'.repeat(10000);
      const startTime = performance.now();

      const result = await hasMatch(content, 'test');

      const duration = performance.now() - startTime;

      expect(result).toBe(true);
      // Should be fast because it stops at first match
      // Not testing exact time as it varies, but checking it returns quickly
      expect(duration).toBeLessThan(1000);
    });

    it('should work with regex patterns', async () => {
      const content = 'test123';
      const result = await hasMatch(content, 'test\\d+', {
        useRegex: true,
      });

      expect(result).toBe(true);
    });

    it('should handle empty content', async () => {
      const result = await hasMatch('', 'test');

      expect(result).toBe(false);
    });
  });

  describe('SearchMatch interface', () => {
    it('should include all required fields', async () => {
      const content = 'hello world';
      const result = await searchInChunks(content, 'world');

      const match = result.matches[0];

      expect(match).toHaveProperty('line');
      expect(match).toHaveProperty('column');
      expect(match).toHaveProperty('endColumn');
      expect(match).toHaveProperty('matchedText');
      expect(match).toHaveProperty('lineText');
    });

    it('should have correct types for all fields', async () => {
      const content = 'hello world';
      const result = await searchInChunks(content, 'world');

      const match = result.matches[0];

      expect(typeof match.line).toBe('number');
      expect(typeof match.column).toBe('number');
      expect(typeof match.endColumn).toBe('number');
      expect(typeof match.matchedText).toBe('string');
      expect(typeof match.lineText).toBe('string');
    });

    it('should include optional context fields when requested', async () => {
      const content = 'line1\nline2\nmatch\nline4\nline5';
      const result = await searchInChunks(content, 'match', {
        contextBefore: 1,
        contextAfter: 1,
      });

      const match = result.matches[0];

      expect(match.beforeContext).toBeDefined();
      expect(match.afterContext).toBeDefined();
      expect(typeof match.beforeContext).toBe('string');
      expect(typeof match.afterContext).toBe('string');
    });

    it('should omit context fields when not requested', async () => {
      const content = 'line1\nmatch\nline3';
      const result = await searchInChunks(content, 'match');

      const match = result.matches[0];

      expect(match.beforeContext).toBeUndefined();
      expect(match.afterContext).toBeUndefined();
    });
  });

  describe('SearchResult interface', () => {
    it('should include all required metadata fields', async () => {
      const content = 'test';
      const result = await searchInChunks(content, 'test');

      expect(result).toHaveProperty('matches');
      expect(result).toHaveProperty('totalMatches');
      expect(result).toHaveProperty('chunksProcessed');
      expect(result).toHaveProperty('totalChunks');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('cancelled');
      expect(result).toHaveProperty('limitReached');
    });

    it('should have correct types for metadata fields', async () => {
      const content = 'test';
      const result = await searchInChunks(content, 'test');

      expect(Array.isArray(result.matches)).toBe(true);
      expect(typeof result.totalMatches).toBe('number');
      expect(typeof result.chunksProcessed).toBe('number');
      expect(typeof result.totalChunks).toBe('number');
      expect(typeof result.duration).toBe('number');
      expect(typeof result.cancelled).toBe('boolean');
      expect(typeof result.limitReached).toBe('boolean');
    });

    it('should have consistent totalMatches and matches length', async () => {
      const content = 'test\ntest\ntest';
      const result = await searchInChunks(content, 'test');

      expect(result.totalMatches).toBe(result.matches.length);
    });
  });
});

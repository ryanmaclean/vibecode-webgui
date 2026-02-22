/**
 * Unit tests for edit-distance.ts
 * Tests Levenshtein distance calculation and code comparison metrics
 */

import {
  calculateEditDistance,
  calculateEditDistanceWithMetrics,
  calculateEditDistanceIgnoringWhitespace,
  calculateCodeEditDistance,
  normalizeForComparison,
  classifyChangeMagnitude,
  type EditDistanceResult
} from '../edit-distance';

describe('Edit Distance Calculator', () => {
  describe('calculateEditDistance', () => {
    it('should return 0 for identical strings', () => {
      expect(calculateEditDistance('hello', 'hello')).toBe(0);
      expect(calculateEditDistance('', '')).toBe(0);
      expect(calculateEditDistance('test123', 'test123')).toBe(0);
    });

    it('should return length for empty to non-empty comparison', () => {
      expect(calculateEditDistance('', 'abc')).toBe(3);
      expect(calculateEditDistance('abc', '')).toBe(3);
      expect(calculateEditDistance('', 'hello world')).toBe(11);
    });

    it('should calculate single character substitution', () => {
      expect(calculateEditDistance('cat', 'bat')).toBe(1);
      expect(calculateEditDistance('hello', 'hallo')).toBe(1);
    });

    it('should calculate single character insertion', () => {
      expect(calculateEditDistance('cat', 'cats')).toBe(1);
      expect(calculateEditDistance('test', 'tests')).toBe(1);
    });

    it('should calculate single character deletion', () => {
      expect(calculateEditDistance('cats', 'cat')).toBe(1);
      expect(calculateEditDistance('tests', 'test')).toBe(1);
    });

    it('should calculate multiple edits', () => {
      // kitten → sitten (substitute k→s) → sittin (substitute e→i) → sitting (insert g)
      expect(calculateEditDistance('kitten', 'sitting')).toBe(3);

      // saturday → sunday: 3 edits
      expect(calculateEditDistance('saturday', 'sunday')).toBe(3);
    });

    it('should handle completely different strings', () => {
      expect(calculateEditDistance('abc', 'xyz')).toBe(3);
      expect(calculateEditDistance('hello', 'world')).toBe(4);
    });

    it('should be symmetric', () => {
      expect(calculateEditDistance('abc', 'def')).toBe(calculateEditDistance('def', 'abc'));
      expect(calculateEditDistance('short', 'longer')).toBe(calculateEditDistance('longer', 'short'));
    });

    it('should handle unicode characters', () => {
      expect(calculateEditDistance('café', 'cafe')).toBe(1);
      expect(calculateEditDistance('hello 👋', 'hello 👍')).toBe(1);
    });

    it('should handle long strings efficiently', () => {
      const long1 = 'a'.repeat(1000);
      const long2 = 'a'.repeat(999) + 'b';
      expect(calculateEditDistance(long1, long2)).toBe(1);
    });
  });

  describe('calculateEditDistanceWithMetrics', () => {
    it('should return comprehensive metrics for identical strings', () => {
      const result = calculateEditDistanceWithMetrics('hello', 'hello');

      expect(result.distance).toBe(0);
      expect(result.similarity).toBe(1.0);
      expect(result.originalLength).toBe(5);
      expect(result.modifiedLength).toBe(5);
      expect(result.changePercentage).toBe(0);
    });

    it('should calculate similarity score correctly', () => {
      // 1 edit out of 5 characters = 80% similarity
      const result = calculateEditDistanceWithMetrics('hello', 'hallo');

      expect(result.distance).toBe(1);
      expect(result.similarity).toBeCloseTo(0.8, 2);
      expect(result.changePercentage).toBeCloseTo(20, 2);
    });

    it('should handle empty strings', () => {
      const result = calculateEditDistanceWithMetrics('', '');

      expect(result.distance).toBe(0);
      expect(result.similarity).toBe(1.0);
      expect(result.originalLength).toBe(0);
      expect(result.modifiedLength).toBe(0);
      expect(result.changePercentage).toBe(0);
    });

    it('should calculate metrics for completely different strings', () => {
      const result = calculateEditDistanceWithMetrics('abc', 'xyz');

      expect(result.distance).toBe(3);
      expect(result.similarity).toBe(0);
      expect(result.originalLength).toBe(3);
      expect(result.modifiedLength).toBe(3);
      expect(result.changePercentage).toBe(100);
    });

    it('should handle length differences', () => {
      const result = calculateEditDistanceWithMetrics('cat', 'category');

      expect(result.distance).toBe(5);
      expect(result.originalLength).toBe(3);
      expect(result.modifiedLength).toBe(8);
      // Similarity based on max length (8)
      expect(result.similarity).toBeCloseTo(0.375, 2);
    });

    it('should clamp similarity to [0, 1] range', () => {
      const result1 = calculateEditDistanceWithMetrics('', 'test');
      expect(result1.similarity).toBeGreaterThanOrEqual(0);
      expect(result1.similarity).toBeLessThanOrEqual(1);

      const result2 = calculateEditDistanceWithMetrics('same', 'same');
      expect(result2.similarity).toBe(1.0);
    });

    it('should clamp change percentage to [0, 100] range', () => {
      const result1 = calculateEditDistanceWithMetrics('', 'test');
      expect(result1.changePercentage).toBeGreaterThanOrEqual(0);
      expect(result1.changePercentage).toBeLessThanOrEqual(100);

      const result2 = calculateEditDistanceWithMetrics('same', 'same');
      expect(result2.changePercentage).toBe(0);
    });
  });

  describe('normalizeForComparison', () => {
    it('should normalize line endings to \\n', () => {
      expect(normalizeForComparison('line1\r\nline2')).toBe('line1\nline2');
      expect(normalizeForComparison('line1\rline2')).toBe('line1\nline2');
      expect(normalizeForComparison('line1\nline2')).toBe('line1\nline2');
    });

    it('should trim leading and trailing whitespace', () => {
      expect(normalizeForComparison('  hello  ')).toBe('hello');
      expect(normalizeForComparison('\n\nhello\n\n')).toBe('hello');
      expect(normalizeForComparison('\t\thello\t\t')).toBe('hello');
    });

    it('should handle empty strings', () => {
      expect(normalizeForComparison('')).toBe('');
      expect(normalizeForComparison('   ')).toBe('');
    });

    it('should combine normalization steps', () => {
      expect(normalizeForComparison('  line1\r\nline2  ')).toBe('line1\nline2');
    });
  });

  describe('calculateEditDistanceIgnoringWhitespace', () => {
    it('should ignore different line endings', () => {
      const text1 = 'line1\nline2';
      const text2 = 'line1\r\nline2';
      expect(calculateEditDistanceIgnoringWhitespace(text1, text2)).toBe(0);
    });

    it('should ignore leading/trailing whitespace', () => {
      const text1 = 'hello world';
      const text2 = '  hello world  ';
      expect(calculateEditDistanceIgnoringWhitespace(text1, text2)).toBe(0);
    });

    it('should still detect content changes', () => {
      const text1 = '  hello  ';
      const text2 = '  world  ';
      expect(calculateEditDistanceIgnoringWhitespace(text1, text2)).toBe(4);
    });

    it('should handle code with different formatting', () => {
      const code1 = 'function foo() {\n  return 42;\n}';
      const code2 = '  function foo() {\n  return 42;\n}  ';
      // Should be identical after normalization
      expect(calculateEditDistanceIgnoringWhitespace(code1, code2)).toBe(0);
    });
  });

  describe('classifyChangeMagnitude', () => {
    it('should classify identical strings', () => {
      expect(classifyChangeMagnitude(1.0)).toBe('identical');
      expect(classifyChangeMagnitude(0.99)).toBe('identical');
    });

    it('should classify minor changes', () => {
      expect(classifyChangeMagnitude(0.98)).toBe('minor');
      expect(classifyChangeMagnitude(0.85)).toBe('minor');
      expect(classifyChangeMagnitude(0.80)).toBe('minor');
    });

    it('should classify moderate changes', () => {
      expect(classifyChangeMagnitude(0.79)).toBe('moderate');
      expect(classifyChangeMagnitude(0.65)).toBe('moderate');
      expect(classifyChangeMagnitude(0.50)).toBe('moderate');
    });

    it('should classify major changes', () => {
      expect(classifyChangeMagnitude(0.49)).toBe('major');
      expect(classifyChangeMagnitude(0.35)).toBe('major');
      expect(classifyChangeMagnitude(0.20)).toBe('major');
    });

    it('should classify complete rewrites', () => {
      expect(classifyChangeMagnitude(0.19)).toBe('complete');
      expect(classifyChangeMagnitude(0.05)).toBe('complete');
      expect(classifyChangeMagnitude(0.0)).toBe('complete');
    });
  });

  describe('calculateCodeEditDistance', () => {
    it('should provide comprehensive code metrics', () => {
      const suggestion = 'function add(a, b) { return a + b; }';
      const finalCode = 'function add(a, b) { return a + b; }';

      const result = calculateCodeEditDistance(suggestion, finalCode);

      expect(result.distance).toBe(0);
      expect(result.similarity).toBe(1.0);
      expect(result.whitespaceNormalizedDistance).toBe(0);
      expect(result.changeMagnitude).toBe('identical');
    });

    it('should detect minor formatting changes', () => {
      const suggestion = 'function add(a, b) { return a + b; }';
      const finalCode = 'function add(a, b) {\n  return a + b;\n}';

      const result = calculateCodeEditDistance(suggestion, finalCode);

      // Raw distance includes whitespace changes
      expect(result.distance).toBeGreaterThan(0);
      // But normalized distance should be 0 (only formatting changed)
      expect(result.whitespaceNormalizedDistance).toBe(0);
      // Overall should still be high similarity
      expect(result.similarity).toBeGreaterThan(0.8);
    });

    it('should detect content changes', () => {
      const suggestion = 'function add(a, b) { return a + b; }';
      const finalCode = 'function multiply(a, b) { return a * b; }';

      const result = calculateCodeEditDistance(suggestion, finalCode);

      expect(result.distance).toBeGreaterThan(0);
      expect(result.whitespaceNormalizedDistance).toBeGreaterThan(0);
      expect(result.similarity).toBeLessThan(1.0);
      expect(result.changeMagnitude).not.toBe('identical');
    });

    it('should classify change magnitude correctly', () => {
      // Identical code
      const result1 = calculateCodeEditDistance('const x = 1;', 'const x = 1;');
      expect(result1.changeMagnitude).toBe('identical');

      // Minor change (one character different)
      const result2 = calculateCodeEditDistance('const x = 1;', 'const x = 2;');
      expect(result2.changeMagnitude).toBe('minor');

      // Complete rewrite
      const result3 = calculateCodeEditDistance('const x = 1;', 'let foo = "bar";');
      expect(['major', 'complete']).toContain(result3.changeMagnitude);
    });

    it('should handle real-world code examples', () => {
      const suggestion = `function fetchUser(id) {
  return fetch(\`/api/users/\${id}\`);
}`;

      const finalCode = `async function fetchUser(id) {
  const response = await fetch(\`/api/users/\${id}\`);
  return response.json();
}`;

      const result = calculateCodeEditDistance(suggestion, finalCode);

      expect(result.distance).toBeGreaterThan(0);
      expect(result.similarity).toBeLessThan(1.0);
      expect(result.similarity).toBeGreaterThan(0);
      expect(['minor', 'moderate']).toContain(result.changeMagnitude);
    });

    it('should handle multiline code with different indentation', () => {
      const suggestion = `function test() {
return 42;
}`;

      const finalCode = `function test() {
  return 42;
}`;

      const result = calculateCodeEditDistance(suggestion, finalCode);

      // Different indentation creates raw distance
      expect(result.distance).toBeGreaterThan(0);
      // But normalized should show they're very similar
      expect(result.whitespaceNormalizedDistance).toBe(0);
      expect(result.changeMagnitude).toBe('minor');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long code blocks', () => {
      const longCode = 'const x = 1;\n'.repeat(100);
      const result = calculateCodeEditDistance(longCode, longCode);

      expect(result.distance).toBe(0);
      expect(result.similarity).toBe(1.0);
    });

    it('should handle special characters in code', () => {
      const suggestion = 'const regex = /[a-z]+/gi;';
      const finalCode = 'const regex = /[a-zA-Z]+/gi;';

      const result = calculateCodeEditDistance(suggestion, finalCode);

      expect(result.distance).toBe(3); // "A-Z" added (3 chars)
      expect(result.similarity).toBeLessThan(1.0);
    });

    it('should handle unicode in code comments', () => {
      const suggestion = '// TODO: fix this 🐛';
      const finalCode = '// TODO: fix this ✅';

      const result = calculateCodeEditDistance(suggestion, finalCode);

      expect(result.distance).toBeGreaterThan(0);
      expect(result.similarity).toBeGreaterThan(0.8); // Very similar except emoji
    });
  });

  describe('Performance', () => {
    it('should handle moderately large strings efficiently', () => {
      const str1 = 'a'.repeat(500) + 'b'.repeat(500);
      const str2 = 'a'.repeat(500) + 'c'.repeat(500);

      const startTime = Date.now();
      const distance = calculateEditDistance(str1, str2);
      const endTime = Date.now();

      expect(distance).toBe(500); // 500 substitutions
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in < 1 second
    });
  });

  describe('Real-World AI Suggestion Scenarios', () => {
    it('should measure suggestion accepted as-is', () => {
      const suggestion = 'console.log("Hello, World!");';
      const accepted = 'console.log("Hello, World!");';

      const result = calculateCodeEditDistance(suggestion, accepted);

      expect(result.changeMagnitude).toBe('identical');
      expect(result.similarity).toBe(1.0);
    });

    it('should measure suggestion with minor tweaks', () => {
      const suggestion = 'const greeting = "Hello";';
      const accepted = 'const greeting = "Hi there";';

      const result = calculateCodeEditDistance(suggestion, accepted);

      expect(result.changeMagnitude).toBe('moderate'); // similarity ~0.76, which is < 0.80 threshold for 'minor'
      expect(result.similarity).toBeGreaterThan(0.7);
    });

    it('should measure suggestion heavily modified', () => {
      const suggestion = 'let x = 1;';
      const accepted = 'const userId = getUserId();';

      const result = calculateCodeEditDistance(suggestion, accepted);

      expect(['major', 'complete']).toContain(result.changeMagnitude);
      expect(result.similarity).toBeLessThan(0.5);
    });
  });
});

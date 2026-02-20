/**
 * Edit Distance Calculator
 *
 * Implements the Levenshtein distance algorithm to measure the difference
 * between two strings. Used to quantify how much an AI suggestion was
 * modified before acceptance.
 *
 * The Levenshtein distance is the minimum number of single-character edits
 * (insertions, deletions, or substitutions) needed to transform one string
 * into another.
 *
 * @example
 * ```typescript
 * const distance = calculateEditDistance('kitten', 'sitting');
 * // Returns: 3
 * // - kitten → sitten (substitute 'k' with 's')
 * // - sitten → sittin (substitute 'e' with 'i')
 * // - sittin → sitting (insert 'g')
 * ```
 */

/**
 * Edit distance calculation result with metrics
 */
export interface EditDistanceResult {
  /** Raw edit distance (number of edits) */
  distance: number;
  /** Normalized similarity score (0-1, where 1 = identical) */
  similarity: number;
  /** Length of the original string */
  originalLength: number;
  /** Length of the modified string */
  modifiedLength: number;
  /** Percentage of characters changed (0-100) */
  changePercentage: number;
}

/**
 * Calculate Levenshtein edit distance between two strings
 *
 * Uses dynamic programming with O(m*n) time and O(min(m,n)) space complexity.
 * Optimized to use less memory by only keeping two rows of the DP matrix.
 *
 * @param original - The original string (e.g., AI suggestion)
 * @param modified - The modified string (e.g., final accepted code)
 * @returns Number of single-character edits needed to transform original to modified
 *
 * @example
 * ```typescript
 * calculateEditDistance('hello', 'hallo');  // Returns: 1
 * calculateEditDistance('', 'abc');          // Returns: 3
 * calculateEditDistance('same', 'same');     // Returns: 0
 * ```
 */
export function calculateEditDistance(original: string, modified: string): number {
  // Handle edge cases
  if (original === modified) return 0;
  if (original.length === 0) return modified.length;
  if (modified.length === 0) return original.length;

  // Ensure we iterate over the shorter string in the inner loop for optimization
  const short = original.length <= modified.length ? original : modified;
  const long = original.length <= modified.length ? modified : original;

  // We only need two rows of the DP matrix at any time
  let previousRow = Array.from({ length: short.length + 1 }, (_, i) => i);
  let currentRow = new Array(short.length + 1);

  // Build up the edit distance matrix row by row
  for (let i = 1; i <= long.length; i++) {
    currentRow[0] = i;

    for (let j = 1; j <= short.length; j++) {
      const insertCost = currentRow[j - 1] + 1;
      const deleteCost = previousRow[j] + 1;
      const substituteCost = previousRow[j - 1] + (long[i - 1] === short[j - 1] ? 0 : 1);

      currentRow[j] = Math.min(insertCost, deleteCost, substituteCost);
    }

    // Swap rows
    [previousRow, currentRow] = [currentRow, previousRow];
  }

  // The answer is in the last cell of the previous row
  return previousRow[short.length];
}

/**
 * Calculate edit distance with additional metrics
 *
 * Provides comprehensive metrics including normalized similarity score
 * and percentage of characters changed. Useful for analyzing the quality
 * of AI suggestions.
 *
 * @param original - The original string
 * @param modified - The modified string
 * @returns Edit distance result with multiple metrics
 *
 * @example
 * ```typescript
 * const result = calculateEditDistanceWithMetrics('hello', 'hallo');
 * // {
 * //   distance: 1,
 * //   similarity: 0.8,
 * //   originalLength: 5,
 * //   modifiedLength: 5,
 * //   changePercentage: 20
 * // }
 * ```
 */
export function calculateEditDistanceWithMetrics(
  original: string,
  modified: string
): EditDistanceResult {
  const distance = calculateEditDistance(original, modified);
  const maxLength = Math.max(original.length, modified.length);

  // Calculate similarity as 1 - (distance / maxLength)
  // If both strings are empty, similarity is 1.0
  const similarity = maxLength === 0 ? 1.0 : 1 - distance / maxLength;

  // Calculate percentage of characters changed
  const changePercentage = maxLength === 0 ? 0 : (distance / maxLength) * 100;

  return {
    distance,
    similarity: Math.max(0, Math.min(1, similarity)), // Clamp to [0, 1]
    originalLength: original.length,
    modifiedLength: modified.length,
    changePercentage: Math.max(0, Math.min(100, changePercentage)) // Clamp to [0, 100]
  };
}

/**
 * Normalize strings for edit distance calculation
 *
 * Removes whitespace differences and normalizes line endings
 * to focus on actual content changes rather than formatting.
 *
 * @param text - Text to normalize
 * @returns Normalized text
 */
export function normalizeForComparison(text: string): string {
  return text
    .replace(/\r\n/g, '\n')     // Normalize line endings
    .replace(/\r/g, '\n')       // Normalize line endings
    .replace(/\s+/g, ' ')       // Collapse multiple whitespace to single space
    .trim();                    // Remove leading/trailing whitespace
}

/**
 * Calculate edit distance ignoring whitespace differences
 *
 * Useful for comparing code where formatting might differ but
 * logic is the same.
 *
 * @param original - The original string
 * @param modified - The modified string
 * @returns Edit distance ignoring whitespace differences
 *
 * @example
 * ```typescript
 * // Different formatting, same content
 * calculateEditDistanceIgnoringWhitespace(
 *   'function foo() {\n  return 42;\n}',
 *   'function foo(){return 42;}'
 * );
 * // Returns distance based on content only
 * ```
 */
export function calculateEditDistanceIgnoringWhitespace(
  original: string,
  modified: string
): number {
  // Remove ALL whitespace for content-only comparison
  const normalizedOriginal = original.replace(/\s+/g, '');
  const normalizedModified = modified.replace(/\s+/g, '');
  return calculateEditDistance(normalizedOriginal, normalizedModified);
}

/**
 * Classify the magnitude of change based on similarity score
 *
 * @param similarity - Similarity score (0-1)
 * @returns Change magnitude classification
 */
export function classifyChangeMagnitude(similarity: number): 'identical' | 'minor' | 'moderate' | 'major' | 'complete' {
  if (similarity >= 0.99) return 'identical';
  if (similarity >= 0.80) return 'minor';
  if (similarity >= 0.50) return 'moderate';
  if (similarity >= 0.20) return 'major';
  return 'complete';
}

/**
 * Calculate edit distance for code suggestions
 *
 * Provides specialized handling for code comparison:
 * - Normalizes line endings
 * - Calculates both raw and whitespace-normalized distances
 * - Classifies change magnitude
 *
 * @param suggestion - Original AI suggestion
 * @param finalCode - Final accepted code
 * @returns Comprehensive edit distance metrics for code
 *
 * @example
 * ```typescript
 * const metrics = calculateCodeEditDistance(
 *   'function add(a, b) { return a + b; }',
 *   'function add(a, b) {\n  return a + b;\n}'
 * );
 * // Returns metrics showing minor formatting changes
 * ```
 */
export function calculateCodeEditDistance(
  suggestion: string,
  finalCode: string
): EditDistanceResult & {
  whitespaceNormalizedDistance: number;
  changeMagnitude: ReturnType<typeof classifyChangeMagnitude>;
} {
  const result = calculateEditDistanceWithMetrics(suggestion, finalCode);
  const whitespaceNormalizedDistance = calculateEditDistanceIgnoringWhitespace(
    suggestion,
    finalCode
  );
  const changeMagnitude = classifyChangeMagnitude(result.similarity);

  return {
    ...result,
    whitespaceNormalizedDistance,
    changeMagnitude
  };
}

/**
 * Fuzzy Search for Command Palette
 * Implements fast, case-insensitive fuzzy matching with scoring
 */

export interface FuzzySearchResult<T> {
  item: T;
  score: number;
  matches: number[];
}

export interface Searchable {
  id: string;
  label: string;
  description?: string;
  keywords?: string[];
}

/**
 * Calculate fuzzy match score
 * Higher score = better match
 * - Consecutive character matches get bonus points
 * - Matches at word boundaries get bonus points
 * - Earlier matches get bonus points
 */
function calculateScore(
  text: string,
  query: string,
  matches: number[]
): number {
  if (matches.length === 0) return 0;

  let score = 0;
  let consecutiveBonus = 0;

  // Base score from match count
  score = matches.length * 10;

  // Bonus for consecutive matches
  for (let i = 1; i < matches.length; i++) {
    if (matches[i] === matches[i - 1] + 1) {
      consecutiveBonus += 5;
    } else {
      consecutiveBonus = 0;
    }
    score += consecutiveBonus;
  }

  // Bonus for matches at word boundaries
  for (const matchIndex of matches) {
    if (matchIndex === 0) {
      score += 10; // Start of text
    } else if (
      text[matchIndex - 1] === ' ' ||
      text[matchIndex - 1] === '-' ||
      text[matchIndex - 1] === '_'
    ) {
      score += 8; // Word boundary
    } else if (
      text[matchIndex - 1] === text[matchIndex - 1].toLowerCase() &&
      text[matchIndex] === text[matchIndex].toUpperCase()
    ) {
      score += 8; // camelCase boundary
    }
  }

  // Penalty for late matches (prefer matches near the beginning)
  const avgPosition = matches.reduce((a, b) => a + b, 0) / matches.length;
  const positionPenalty = Math.floor(avgPosition / 2);
  score -= positionPenalty;

  // Bonus for query length (longer queries are more specific)
  score += query.length * 2;

  return Math.max(score, 0);
}

/**
 * Find fuzzy match positions in text
 * Returns array of matched character indices
 */
function findMatches(text: string, query: string): number[] {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matches: number[] = [];

  let queryIndex = 0;
  let textIndex = 0;

  while (queryIndex < lowerQuery.length && textIndex < lowerText.length) {
    if (lowerQuery[queryIndex] === lowerText[textIndex]) {
      matches.push(textIndex);
      queryIndex++;
    }
    textIndex++;
  }

  // Only return matches if all query characters were found
  return queryIndex === lowerQuery.length ? matches : [];
}

/**
 * Fuzzy search a single text field
 */
export function fuzzyMatch(text: string, query: string): {
  matches: number[];
  score: number;
} {
  if (!query || query.trim() === '') {
    return { matches: [], score: 0 };
  }

  const matches = findMatches(text, query);
  const score = calculateScore(text, query, matches);

  return { matches, score };
}

/**
 * Fuzzy search across multiple items
 * Returns sorted results by relevance score
 */
export function fuzzySearch<T extends Searchable>(
  items: T[],
  query: string,
  options: {
    limit?: number;
    threshold?: number;
  } = {}
): FuzzySearchResult<T>[] {
  const { limit = 50, threshold = 0 } = options;

  if (!query || query.trim() === '') {
    return items.slice(0, limit).map((item) => ({
      item,
      score: 0,
      matches: [],
    }));
  }

  const results: FuzzySearchResult<T>[] = [];

  for (const item of items) {
    let bestScore = 0;
    let bestMatches: number[] = [];

    // Search in label (primary field)
    const labelMatch = fuzzyMatch(item.label, query);
    if (labelMatch.score > bestScore) {
      bestScore = labelMatch.score;
      bestMatches = labelMatch.matches;
    }

    // Search in description
    if (item.description) {
      const descMatch = fuzzyMatch(item.description, query);
      // Description matches get 80% weight
      const descScore = descMatch.score * 0.8;
      if (descScore > bestScore) {
        bestScore = descScore;
        bestMatches = descMatch.matches;
      }
    }

    // Search in keywords
    if (item.keywords && item.keywords.length > 0) {
      for (const keyword of item.keywords) {
        const keywordMatch = fuzzyMatch(keyword, query);
        // Keyword matches get 90% weight
        const keywordScore = keywordMatch.score * 0.9;
        if (keywordScore > bestScore) {
          bestScore = keywordScore;
          bestMatches = keywordMatch.matches;
        }
      }
    }

    // Only include results above threshold
    if (bestScore > threshold) {
      results.push({
        item,
        score: bestScore,
        matches: bestMatches,
      });
    }
  }

  // Sort by score (descending) and limit results
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Highlight matched characters in text
 * Returns text with <mark> tags around matches
 */
export function highlightMatches(text: string, matches: number[]): string {
  if (matches.length === 0) return text;

  const result: string[] = [];
  let lastIndex = 0;

  for (let i = 0; i < matches.length; i++) {
    const matchIndex = matches[i];

    // Add text before match
    if (matchIndex > lastIndex) {
      result.push(text.slice(lastIndex, matchIndex));
    }

    // Start mark tag for new match group
    if (i === 0 || matches[i - 1] !== matchIndex - 1) {
      result.push('<mark>');
    }

    // Add matched character
    result.push(text[matchIndex]);

    // Close mark tag at end of match group
    if (i === matches.length - 1 || matches[i + 1] !== matchIndex + 1) {
      result.push('</mark>');
    }

    lastIndex = matchIndex + 1;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result.join('');
}

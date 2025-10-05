/**
 * Deterministic hashing-based local embedding generator.
 * Provides a lightweight fallback when external embedding providers
 * are unavailable or undesirable.
 */

const DEFAULT_DIMENSIONS = 1536;

const sanitizeToken = (token: string): string =>
  token
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();

const simpleHash = (input: string): number => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;  
  }
  return hash;
};

export const generateLocalEmbedding = (
  text: string,
  dimensions: number = DEFAULT_DIMENSIONS
): number[] => {
  const vector = new Array(dimensions).fill(0);

  const tokens = sanitizeToken(text)
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) {
    return vector;
  }

  tokens.forEach((token) => {
    const index = simpleHash(token) % dimensions;
    vector[index] += 1;
  });

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) {
    return vector;
  }

  return vector.map((value) => value / norm);
};

export const sanitizeText = (text: string): string =>
  text.replace(/\s+/g, ' ').replace(/\u0000/g, '').trim();

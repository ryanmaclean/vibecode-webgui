/**
 * Simple logger module for vector database operations
 */

export const logger = {
  error: (message: any) => {
    console.error('[VectorDB Error]', message);
  },
  warn: (message: any) => {
    console.warn('[VectorDB Warning]', message);
  },
  info: (message: any) => {
    console.info('[VectorDB Info]', message);
  },
  debug: (message: any) => {
    console.debug('[VectorDB Debug]', message);
  }
};
/**
 * Logger module for vector database operations
 * Supports both simple message logging and structured logging with metadata
 */

export const logger = {
  error: (message: any, metadata?: any) => {
    if (metadata) {
      console.error('[VectorDB Error]', message, metadata);
    } else {
      console.error('[VectorDB Error]', message);
    }
  },
  warn: (message: any, metadata?: any) => {
    if (metadata) {
      console.warn('[VectorDB Warning]', message, metadata);
    } else {
      console.warn('[VectorDB Warning]', message);
    }
  },
  info: (message: any, metadata?: any) => {
    if (metadata) {
      console.info('[VectorDB Info]', message, metadata);
    } else {
      console.info('[VectorDB Info]', message);
    }
  },
  debug: (message: any, metadata?: any) => {
    if (metadata) {
      console.debug('[VectorDB Debug]', message, metadata);
    } else {
      console.debug('[VectorDB Debug]', message);
    }
  }
};
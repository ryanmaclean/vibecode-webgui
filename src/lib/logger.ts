/**
 * Logger module for vector database operations.
 *
 * The logger supports optional metadata to provide structured logs that are
 * useful for monitoring and debugging.  All log levels are exposed as functions
 * that accept a message string (or any serialisable value) and an optional
 * `metadata` object.  When metadata is provided, it is appended to the console
 * output; otherwise only the primary message is logged.
 */

export const logger = {
  error: (message: any, metadata?: Record<string, unknown>) => {
    if (metadata) {
      console.error("[VectorDB Error]", message, metadata);
    } else {
      console.error("[VectorDB Error]", message);
    }
  },
  warn: (message: any, metadata?: Record<string, unknown>) => {
    if (metadata) {
      console.warn("[VectorDB Warning]", message, metadata);
    } else {
      console.warn("[VectorDB Warning]", message);
    }
  },
  info: (message: any, metadata?: Record<string, unknown>) => {
    if (metadata) {
      console.info("[VectorDB Info]", message, metadata);
    } else {
      console.info("[VectorDB Info]", message);
    }
  },
  debug: (message: any, metadata?: Record<string, unknown>) => {
    if (metadata) {
      console.debug("[VectorDB Debug]", message, metadata);
    } else {
      console.debug("[VectorDB Debug]", message);
    }
  },
};

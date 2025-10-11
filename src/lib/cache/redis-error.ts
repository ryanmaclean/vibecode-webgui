/**
 * Custom Redis Error class for VibeCode WebGUI
 * Provides detailed error information for Redis operations
 */

export class RedisError extends Error {
  constructor(
    message: string, 
    public readonly operation: string, 
    public readonly cause?: any
  ) {
    super(message);
    this.name = 'RedisError';
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RedisError);
    }
  }
}
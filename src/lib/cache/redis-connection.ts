/**
 * Redis Connection Manager for VibeCode WebGUI
 * Handles connection, reconnection, and monitoring of Redis
 */

import Redis from 'ioredis';
import { metrics } from '../server-monitoring';
import { RedisError } from './redis-error';
// import { logger } from '@/lib/logger';
// Type for the Redis client
export type RedisClientType = Redis;

// Maximum number of connection attempts before giving up
const MAX_CONNECTION_ATTEMPTS = 5;

// Types for configuration
type RedisConfig = 
  | { type: 'upstash'; url: string; token: string }
  | { type: 'standard'; url: string }
  | { 
      type: 'standard'; 
      host: string; 
      port: number; 
      password?: string; 
      db: number 
    };

/**
 * Redis connection manager
 */
export class RedisConnectionManager {
  private redis: RedisClientType | null = null;
  private connectionAttempts = 0;
  private readonly config: RedisConfig;
  private reconnecting = false;

  constructor() {
    this.config = this.getRedisConfig();
  }

  /**
   * Get Redis configuration from environment variables
   */
  private getRedisConfig(): RedisConfig {
    // Upstash Redis for production rate limiting
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      return {
        type: 'upstash',
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN
      };
    }
    
    // Standard Redis for development/self-hosted
    if (process.env.REDIS_URL) {
      return {
        type: 'standard',
        url: process.env.REDIS_URL
      };
    }
    
    // Fallback configuration
    return {
      type: 'standard',
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0')
    };
  }

  /**
   * Initialize Redis client with connection retry logic
   */
  initialize(): void {
    try {
      if (this.config.type === 'standard') {
        if ('url' in this.config) {
          this.redis = new Redis(this.config.url);
        } else {
          this.redis = new Redis({
            host: this.config.host,
            port: this.config.port,
            password: this.config.password,
            db: this.config.db,
            retryStrategy: (times) => {
              // Exponential backoff with a maximum delay of 10 seconds
              const delay = Math.min(times * 1000, 10000);
              this.connectionAttempts = times;
              console.info(`Redis connection attempt ${times}, retrying in ${delay}ms`);
              
              // Stop retrying after MAX_CONNECTION_ATTEMPTS
              if (times >= MAX_CONNECTION_ATTEMPTS) {
                console.error(`Max Redis connection attempts (${MAX_CONNECTION_ATTEMPTS}) reached. Giving up.`);
                return null; // Stop retrying
              }
              
              return delay;
            },
            enableReadyCheck: false,
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            keepAlive: 30000,
            family: 4,
            commandTimeout: 5000,
            connectTimeout: 10000,
          });
        }

        this.setupEventListeners();
      }
    } catch (error) {
      console.error('Redis client initialization failed:', error);
      metrics.increment('redis.initialization.failed');
      this.redis = null;
      throw new RedisError(
        'Failed to initialize Redis client', 
        'initialization', 
        error
      );
    }
  }

  /**
   * Setup event listeners for Redis client
   */
  private setupEventListeners(): void {
    if (!this.redis) return;

    this.redis.on('connect', () => {
      console.info('Redis connection established successfully');
      this.connectionAttempts = 0; // Reset counter on successful connection
      this.reconnecting = false;
      metrics.increment('redis.connection.success');
    });

    this.redis.on('error', (error: Error) => {
      console.error('Redis connection error:', error);
      metrics.increment('redis.connection.error');
    });

    this.redis.on('ready', () => {
      console.info('Redis client ready');
      metrics.increment('redis.ready');
    });
    
    this.redis.on('reconnecting', () => {
      console.info('Redis client reconnecting...');
      this.reconnecting = true;
      metrics.increment('redis.reconnect.attempt');
    });
    
    this.redis.on('end', () => {
      console.warn('Redis connection closed');
      metrics.increment('redis.connection.closed');
    });
  }

  /**
   * Get the Redis client instance
   */
  getClient(): RedisClientType | null {
    return this.redis;
  }

  /**
   * Check if Redis is connected
   */
  async isConnected(): Promise<boolean> {
    if (!this.redis) return false;

    try {
      // Use the ping command to check if the connection is alive
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }

  /**
   * Attempt to reconnect to Redis if disconnected
   */
  async reconnect(): Promise<boolean> {
    if (this.reconnecting) {
      console.info('Already attempting to reconnect to Redis...');
      return false;
    }
    
    if (this.redis) {
      try {
        // Check if we can ping Redis
        const result = await this.redis.ping();
        if (result === 'PONG') {
          return true; // Already connected
        }
      } catch (error) {
        // Existing connection failed, try to reinitialize
        console.info('Existing Redis connection failed, attempting to reconnect...');
        
        // Close the existing connection
        try {
          await this.redis.quit();
        } catch (quitError) {
          console.warn('Error closing existing Redis connection:', quitError);
        }
        
        this.redis = null;
      }
    }
    
    this.reconnecting = true;
    
    try {
      this.initialize();
      
      if (this.redis) {
        const result = await this.redis.ping();
        if (result === 'PONG') {
          console.info('Redis reconnection successful');
          this.reconnecting = false;
          return true;
        }
      }
    } catch (error) {
      console.error('Redis reconnection failed:', error);
      this.reconnecting = false;
    }
    
    return false;
  }

  /**
   * Close the Redis connection
   */
  async close(): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.quit();
        console.info('Redis connection closed successfully');
      } catch (error) {
        console.error('Error closing Redis connection:', error);
      } finally {
        this.redis = null;
      }
    }
  }
}

// Create and export a singleton instance
export const redisConnection = new RedisConnectionManager();

// Initialize the connection
try {
  redisConnection.initialize();
} catch (error) {
  console.error('Redis initialization error:', error);
  // We'll continue without Redis and handle failures gracefully in the CacheManager
}
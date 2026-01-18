/**
 * Redis/Valkey interface definitions for type safety
 */

import { Redis as IoRedis } from 'ioredis';

// Type augmentation for the Redis commands
export interface RedisCommands {
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<'OK'>;
  del(...keys: string[]): Promise<number>;
  exists(key: string): Promise<number>;
  mget(...keys: string[]): Promise<(string | null)[]>;
  pipeline(): Pipeline;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  info(section?: string): Promise<string>;
  dbsize(): Promise<number>;
  flushdb(): Promise<'OK'>;
  ping(): Promise<string>;
}

// Pipeline interface
export interface Pipeline {
  setex(key: string, seconds: number, value: string): Pipeline;
  exec(): Promise<[Error | null, any][]>;
}

// Extend the Redis type with our commands
export type EnhancedRedis = IoRedis & RedisCommands;

// Options for creating a standalone Redis connection
export interface StandaloneRedisOptions {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  retryDelayOnFailover?: number;
  enableReadyCheck?: boolean;
  maxRetriesPerRequest?: number;
  lazyConnect?: boolean;
  keepAlive?: number;
  family?: number;
  commandTimeout?: number;
  connectTimeout?: number;
}
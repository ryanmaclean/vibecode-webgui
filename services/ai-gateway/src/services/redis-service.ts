import { createClient, RedisClientType } from 'redis';
import { config } from '../config/environment';
import { logger } from '../utils/logger';

export class RedisService {
    private client: RedisClientType;
    private isConnected: boolean = false;

    constructor() {
        const redisUrl = config.redis.password 
            ? `redis://:${config.redis.password}@${config.redis.host}:${config.redis.port}/${config.redis.db}`
            : `redis://${config.redis.host}:${config.redis.port}/${config.redis.db}`;

        this.client = createClient({
            url: redisUrl,
            socket: {
                connectTimeout: 5000,
                reconnectStrategy: (retries) => {
                    if (retries > 10) {
                        logger.error('Redis max reconnection attempts reached');
                        return false;
                    }
                    const delay = Math.min(retries * 50, 2000);
                    logger.warn(`Redis reconnecting in ${delay}ms (attempt ${retries})`);
                    return delay;
                }
            }
        });

        // Event handlers
        this.client.on('error', (error) => {
            logger.error('Redis client error', { error });
            this.isConnected = false;
        });

        this.client.on('connect', () => {
            logger.info('Redis client connecting');
        });

        this.client.on('ready', () => {
            logger.info('Redis client ready');
            this.isConnected = true;
        });

        this.client.on('end', () => {
            logger.info('Redis client disconnected');
            this.isConnected = false;
        });

        this.client.on('reconnecting', () => {
            logger.info('Redis client reconnecting');
            this.isConnected = false;
        });
    }

    public async connect(): Promise<void> {
        try {
            await this.client.connect();
            logger.info('Redis connected successfully');
        } catch (error) {
            logger.error('Failed to connect to Redis', { error });
            throw error;
        }
    }

    public async disconnect(): Promise<void> {
        try {
            await this.client.quit();
            logger.info('Redis disconnected successfully');
        } catch (error) {
            logger.error('Error disconnecting from Redis', { error });
        }
    }

    public isReady(): boolean {
        return this.isConnected && this.client.isReady;
    }

    // Cache operations
    public async get(key: string): Promise<string | null> {
        try {
            if (!this.isReady()) {
                logger.warn('Redis not ready, skipping get operation', { key });
                return null;
            }
            const result = await this.client.get(key);
            return result || null;
        } catch (error) {
            logger.error('Redis get operation failed', { key, error });
            return null;
        }
    }

    public async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
        try {
            if (!this.isReady()) {
                logger.warn('Redis not ready, skipping set operation', { key });
                return false;
            }

            if (ttlSeconds) {
                await this.client.setEx(key, ttlSeconds, value);
            } else {
                await this.client.set(key, value);
            }
            return true;
        } catch (error) {
            logger.error('Redis set operation failed', { key, error });
            return false;
        }
    }

    public async del(key: string): Promise<boolean> {
        try {
            if (!this.isReady()) {
                logger.warn('Redis not ready, skipping del operation', { key });
                return false;
            }
            const result = await this.client.del(key);
            return result > 0;
        } catch (error) {
            logger.error('Redis del operation failed', { key, error });
            return false;
        }
    }

    // Hash operations
    public async hGet(key: string, field: string): Promise<string | null> {
        try {
            if (!this.isReady()) {
                logger.warn('Redis not ready, skipping hget operation', { key, field });
                return null;
            }
            const result = await this.client.hGet(key, field);
            return result || null;
        } catch (error) {
            logger.error('Redis hget operation failed', { key, field, error });
            return null;
        }
    }

    public async hSet(key: string, field: string, value: string): Promise<boolean> {
        try {
            if (!this.isReady()) {
                logger.warn('Redis not ready, skipping hset operation', { key, field });
                return false;
            }
            await this.client.hSet(key, field, value);
            return true;
        } catch (error) {
            logger.error('Redis hset operation failed', { key, field, error });
            return false;
        }
    }

    public async hGetAll(key: string): Promise<Record<string, string> | null> {
        try {
            if (!this.isReady()) {
                logger.warn('Redis not ready, skipping hgetall operation', { key });
                return null;
            }
            return await this.client.hGetAll(key);
        } catch (error) {
            logger.error('Redis hgetall operation failed', { key, error });
            return null;
        }
    }

    // List operations
    public async lPush(key: string, value: string): Promise<boolean> {
        try {
            if (!this.isReady()) {
                logger.warn('Redis not ready, skipping lpush operation', { key });
                return false;
            }
            await this.client.lPush(key, value);
            return true;
        } catch (error) {
            logger.error('Redis lpush operation failed', { key, error });
            return false;
        }
    }

    public async lRange(key: string, start: number, stop: number): Promise<string[]> {
        try {
            if (!this.isReady()) {
                logger.warn('Redis not ready, skipping lrange operation', { key });
                return [];
            }
            return await this.client.lRange(key, start, stop);
        } catch (error) {
            logger.error('Redis lrange operation failed', { key, error });
            return [];
        }
    }

    // Increment/Decrement operations
    public async incr(key: string): Promise<number | null> {
        try {
            if (!this.isReady()) {
                logger.warn('Redis not ready, skipping incr operation', { key });
                return null;
            }
            return await this.client.incr(key);
        } catch (error) {
            logger.error('Redis incr operation failed', { key, error });
            return null;
        }
    }

    public async incrBy(key: string, increment: number): Promise<number | null> {
        try {
            if (!this.isReady()) {
                logger.warn('Redis not ready, skipping incrby operation', { key });
                return null;
            }
            return await this.client.incrBy(key, increment);
        } catch (error) {
            logger.error('Redis incrby operation failed', { key, error });
            return null;
        }
    }

    // Expiration operations
    public async expire(key: string, seconds: number): Promise<boolean> {
        try {
            if (!this.isReady()) {
                logger.warn('Redis not ready, skipping expire operation', { key });
                return false;
            }
            const result = await this.client.expire(key, seconds);
            return result;
        } catch (error) {
            logger.error('Redis expire operation failed', { key, error });
            return false;
        }
    }

    public async ttl(key: string): Promise<number | null> {
        try {
            if (!this.isReady()) {
                logger.warn('Redis not ready, skipping ttl operation', { key });
                return null;
            }
            return await this.client.ttl(key);
        } catch (error) {
            logger.error('Redis ttl operation failed', { key, error });
            return null;
        }
    }

    // Key pattern operations
    public async keys(pattern: string): Promise<string[]> {
        try {
            if (!this.isReady()) {
                logger.warn('Redis not ready, skipping keys operation', { pattern });
                return [];
            }
            return await this.client.keys(pattern);
        } catch (error) {
            logger.error('Redis keys operation failed', { pattern, error });
            return [];
        }
    }

    // Utility methods for AI Gateway specific operations
    public async cacheResponse(cacheKey: string, response: any, ttlSeconds: number = config.caching.ttl): Promise<void> {
        const value = JSON.stringify({
            response,
            timestamp: Date.now(),
            ttl: ttlSeconds
        });
        await this.set(cacheKey, value, ttlSeconds);
    }

    public async getCachedResponse(cacheKey: string): Promise<any | null> {
        const cached = await this.get(cacheKey);
        if (!cached) {
            return null;
        }

        try {
            const parsed = JSON.parse(cached);
            return parsed.response;
        } catch (error) {
            logger.error('Failed to parse cached response', { cacheKey, error });
            await this.del(cacheKey); // Clean up invalid cache entry
            return null;
        }
    }

    public async trackUsage(userId: string, model: string, tokens: number, cost: number): Promise<void> {
        const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const userKey = `usage:user:${userId}:${date}`;
        const modelKey = `usage:model:${model}:${date}`;
        const globalKey = `usage:global:${date}`;

        // Track user usage
        await this.hSet(userKey, 'tokens', (parseInt(await this.hGet(userKey, 'tokens') || '0') + tokens).toString());
        await this.hSet(userKey, 'cost', (parseFloat(await this.hGet(userKey, 'cost') || '0') + cost).toString());
        await this.hSet(userKey, 'requests', (parseInt(await this.hGet(userKey, 'requests') || '0') + 1).toString());

        // Track model usage
        await this.hSet(modelKey, 'tokens', (parseInt(await this.hGet(modelKey, 'tokens') || '0') + tokens).toString());
        await this.hSet(modelKey, 'cost', (parseFloat(await this.hGet(modelKey, 'cost') || '0') + cost).toString());
        await this.hSet(modelKey, 'requests', (parseInt(await this.hGet(modelKey, 'requests') || '0') + 1).toString());

        // Track global usage
        await this.hSet(globalKey, 'tokens', (parseInt(await this.hGet(globalKey, 'tokens') || '0') + tokens).toString());
        await this.hSet(globalKey, 'cost', (parseFloat(await this.hGet(globalKey, 'cost') || '0') + cost).toString());
        await this.hSet(globalKey, 'requests', (parseInt(await this.hGet(globalKey, 'requests') || '0') + 1).toString());

        // Set expiration for usage keys (30 days)
        await this.expire(userKey, 30 * 24 * 60 * 60);
        await this.expire(modelKey, 30 * 24 * 60 * 60);
        await this.expire(globalKey, 30 * 24 * 60 * 60);
    }
}
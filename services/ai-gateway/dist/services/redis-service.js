"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const redis_1 = require("redis");
const environment_1 = require("../config/environment");
const logger_1 = require("../utils/logger");
class RedisService {
    constructor() {
        this.isConnected = false;
        const redisUrl = environment_1.config.redis.password
            ? `redis://:${environment_1.config.redis.password}@${environment_1.config.redis.host}:${environment_1.config.redis.port}/${environment_1.config.redis.db}`
            : `redis://${environment_1.config.redis.host}:${environment_1.config.redis.port}/${environment_1.config.redis.db}`;
        this.client = (0, redis_1.createClient)({
            url: redisUrl,
            socket: {
                connectTimeout: 5000,
                reconnectStrategy: (retries) => {
                    if (retries > 10) {
                        logger_1.logger.error('Redis max reconnection attempts reached');
                        return false;
                    }
                    const delay = Math.min(retries * 50, 2000);
                    logger_1.logger.warn(`Redis reconnecting in ${delay}ms (attempt ${retries})`);
                    return delay;
                }
            }
        });
        this.client.on('error', (error) => {
            logger_1.logger.error('Redis client error', { error });
            this.isConnected = false;
        });
        this.client.on('connect', () => {
            logger_1.logger.info('Redis client connecting');
        });
        this.client.on('ready', () => {
            logger_1.logger.info('Redis client ready');
            this.isConnected = true;
        });
        this.client.on('end', () => {
            logger_1.logger.info('Redis client disconnected');
            this.isConnected = false;
        });
        this.client.on('reconnecting', () => {
            logger_1.logger.info('Redis client reconnecting');
            this.isConnected = false;
        });
    }
    async connect() {
        try {
            await this.client.connect();
            logger_1.logger.info('Redis connected successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to connect to Redis', { error });
            throw error;
        }
    }
    async disconnect() {
        try {
            await this.client.quit();
            logger_1.logger.info('Redis disconnected successfully');
        }
        catch (error) {
            logger_1.logger.error('Error disconnecting from Redis', { error });
        }
    }
    isReady() {
        return this.isConnected && this.client.isReady;
    }
    async get(key) {
        try {
            if (!this.isReady()) {
                logger_1.logger.warn('Redis not ready, skipping get operation', { key });
                return null;
            }
            const result = await this.client.get(key);
            return result || null;
        }
        catch (error) {
            logger_1.logger.error('Redis get operation failed', { key, error });
            return null;
        }
    }
    async set(key, value, ttlSeconds) {
        try {
            if (!this.isReady()) {
                logger_1.logger.warn('Redis not ready, skipping set operation', { key });
                return false;
            }
            if (ttlSeconds) {
                await this.client.setEx(key, ttlSeconds, value);
            }
            else {
                await this.client.set(key, value);
            }
            return true;
        }
        catch (error) {
            logger_1.logger.error('Redis set operation failed', { key, error });
            return false;
        }
    }
    async del(key) {
        try {
            if (!this.isReady()) {
                logger_1.logger.warn('Redis not ready, skipping del operation', { key });
                return false;
            }
            const result = await this.client.del(key);
            return result > 0;
        }
        catch (error) {
            logger_1.logger.error('Redis del operation failed', { key, error });
            return false;
        }
    }
    async hGet(key, field) {
        try {
            if (!this.isReady()) {
                logger_1.logger.warn('Redis not ready, skipping hget operation', { key, field });
                return null;
            }
            const result = await this.client.hGet(key, field);
            return result || null;
        }
        catch (error) {
            logger_1.logger.error('Redis hget operation failed', { key, field, error });
            return null;
        }
    }
    async hSet(key, field, value) {
        try {
            if (!this.isReady()) {
                logger_1.logger.warn('Redis not ready, skipping hset operation', { key, field });
                return false;
            }
            await this.client.hSet(key, field, value);
            return true;
        }
        catch (error) {
            logger_1.logger.error('Redis hset operation failed', { key, field, error });
            return false;
        }
    }
    async hGetAll(key) {
        try {
            if (!this.isReady()) {
                logger_1.logger.warn('Redis not ready, skipping hgetall operation', { key });
                return null;
            }
            return await this.client.hGetAll(key);
        }
        catch (error) {
            logger_1.logger.error('Redis hgetall operation failed', { key, error });
            return null;
        }
    }
    async lPush(key, value) {
        try {
            if (!this.isReady()) {
                logger_1.logger.warn('Redis not ready, skipping lpush operation', { key });
                return false;
            }
            await this.client.lPush(key, value);
            return true;
        }
        catch (error) {
            logger_1.logger.error('Redis lpush operation failed', { key, error });
            return false;
        }
    }
    async lRange(key, start, stop) {
        try {
            if (!this.isReady()) {
                logger_1.logger.warn('Redis not ready, skipping lrange operation', { key });
                return [];
            }
            return await this.client.lRange(key, start, stop);
        }
        catch (error) {
            logger_1.logger.error('Redis lrange operation failed', { key, error });
            return [];
        }
    }
    async incr(key) {
        try {
            if (!this.isReady()) {
                logger_1.logger.warn('Redis not ready, skipping incr operation', { key });
                return null;
            }
            return await this.client.incr(key);
        }
        catch (error) {
            logger_1.logger.error('Redis incr operation failed', { key, error });
            return null;
        }
    }
    async incrBy(key, increment) {
        try {
            if (!this.isReady()) {
                logger_1.logger.warn('Redis not ready, skipping incrby operation', { key });
                return null;
            }
            return await this.client.incrBy(key, increment);
        }
        catch (error) {
            logger_1.logger.error('Redis incrby operation failed', { key, error });
            return null;
        }
    }
    async expire(key, seconds) {
        try {
            if (!this.isReady()) {
                logger_1.logger.warn('Redis not ready, skipping expire operation', { key });
                return false;
            }
            const result = await this.client.expire(key, seconds);
            return result;
        }
        catch (error) {
            logger_1.logger.error('Redis expire operation failed', { key, error });
            return false;
        }
    }
    async ttl(key) {
        try {
            if (!this.isReady()) {
                logger_1.logger.warn('Redis not ready, skipping ttl operation', { key });
                return null;
            }
            return await this.client.ttl(key);
        }
        catch (error) {
            logger_1.logger.error('Redis ttl operation failed', { key, error });
            return null;
        }
    }
    async keys(pattern) {
        try {
            if (!this.isReady()) {
                logger_1.logger.warn('Redis not ready, skipping keys operation', { pattern });
                return [];
            }
            return await this.client.keys(pattern);
        }
        catch (error) {
            logger_1.logger.error('Redis keys operation failed', { pattern, error });
            return [];
        }
    }
    async cacheResponse(cacheKey, response, ttlSeconds = environment_1.config.caching.ttl) {
        const value = JSON.stringify({
            response,
            timestamp: Date.now(),
            ttl: ttlSeconds
        });
        await this.set(cacheKey, value, ttlSeconds);
    }
    async getCachedResponse(cacheKey) {
        const cached = await this.get(cacheKey);
        if (!cached) {
            return null;
        }
        try {
            const parsed = JSON.parse(cached);
            return parsed.response;
        }
        catch (error) {
            logger_1.logger.error('Failed to parse cached response', { cacheKey, error });
            await this.del(cacheKey);
            return null;
        }
    }
    async trackUsage(userId, model, tokens, cost) {
        const date = new Date().toISOString().split('T')[0];
        const userKey = `usage:user:${userId}:${date}`;
        const modelKey = `usage:model:${model}:${date}`;
        const globalKey = `usage:global:${date}`;
        await this.hSet(userKey, 'tokens', (parseInt(await this.hGet(userKey, 'tokens') || '0') + tokens).toString());
        await this.hSet(userKey, 'cost', (parseFloat(await this.hGet(userKey, 'cost') || '0') + cost).toString());
        await this.hSet(userKey, 'requests', (parseInt(await this.hGet(userKey, 'requests') || '0') + 1).toString());
        await this.hSet(modelKey, 'tokens', (parseInt(await this.hGet(modelKey, 'tokens') || '0') + tokens).toString());
        await this.hSet(modelKey, 'cost', (parseFloat(await this.hGet(modelKey, 'cost') || '0') + cost).toString());
        await this.hSet(modelKey, 'requests', (parseInt(await this.hGet(modelKey, 'requests') || '0') + 1).toString());
        await this.hSet(globalKey, 'tokens', (parseInt(await this.hGet(globalKey, 'tokens') || '0') + tokens).toString());
        await this.hSet(globalKey, 'cost', (parseFloat(await this.hGet(globalKey, 'cost') || '0') + cost).toString());
        await this.hSet(globalKey, 'requests', (parseInt(await this.hGet(globalKey, 'requests') || '0') + 1).toString());
        await this.expire(userKey, 30 * 24 * 60 * 60);
        await this.expire(modelKey, 30 * 24 * 60 * 60);
        await this.expire(globalKey, 30 * 24 * 60 * 60);
    }
}
exports.RedisService = RedisService;
//# sourceMappingURL=redis-service.js.map

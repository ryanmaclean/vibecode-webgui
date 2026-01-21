import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { RedisService } from './redis-service';

type CacheEntry = {
    value: string;
    expiresAt: number;
};

class ResponseCache {
    private memoryCache = new Map<string, CacheEntry>();
    private redisService = new RedisService();
    private redisConnectPromise: Promise<void> | null = null;
    private redisEnabled = String(process.env.DISABLE_REDIS || '').toLowerCase() !== 'true';

    public async get(key: string): Promise<string | null> {
        if (await this.ensureRedisReady()) {
            const cached = await this.redisService.get(key);
            if (cached) {
                return cached;
            }
        }

        return this.getFromMemory(key);
    }

    public async set(key: string, value: string, ttlSeconds: number = config.caching.ttl): Promise<void> {
        if (await this.ensureRedisReady()) {
            await this.redisService.set(key, value, ttlSeconds);
            return;
        }

        this.setInMemory(key, value, ttlSeconds);
    }

    private async ensureRedisReady(): Promise<boolean> {
        if (!this.redisEnabled) {
            return false;
        }

        if (this.redisService.isReady()) {
            return true;
        }

        if (!this.redisConnectPromise) {
            this.redisConnectPromise = this.redisService.connect().catch((error) => {
                logger.warn('Response cache Redis connect failed, using in-memory cache', { error });
            });
        }

        await this.redisConnectPromise;
        return this.redisService.isReady();
    }

    private getFromMemory(key: string): string | null {
        const entry = this.memoryCache.get(key);
        if (!entry) {
            return null;
        }

        if (Date.now() > entry.expiresAt) {
            this.memoryCache.delete(key);
            return null;
        }

        return entry.value;
    }

    private setInMemory(key: string, value: string, ttlSeconds: number): void {
        if (config.caching.maxSize <= 0) {
            return;
        }

        this.pruneExpired();
        this.enforceMaxSize();

        this.memoryCache.set(key, {
            value,
            expiresAt: Date.now() + ttlSeconds * 1000
        });
    }

    private pruneExpired(): void {
        const now = Date.now();
        for (const [key, entry] of this.memoryCache.entries()) {
            if (now > entry.expiresAt) {
                this.memoryCache.delete(key);
            }
        }
    }

    private enforceMaxSize(): void {
        while (this.memoryCache.size >= config.caching.maxSize) {
            const oldestKey = this.memoryCache.keys().next().value;
            if (!oldestKey) {
                break;
            }
            this.memoryCache.delete(oldestKey);
        }
    }
}

export const responseCache = new ResponseCache();

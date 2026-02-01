import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { responseCache } from '../services/response-cache';
import { config } from '../config/environment';

type CacheOptions = {
    ttlSeconds?: number;
    keyPrefix?: string;
    varyByUser?: boolean;
};

function buildCacheKey(req: Request, keyPrefix: string, varyByUser: boolean): string {
    const identityParts = [req.method, req.originalUrl];

    if (varyByUser) {
        const userId = (req as { user?: { id?: string } }).user?.id;
        if (userId) {
            identityParts.push(String(userId));
        }
    }

    const hash = crypto.createHash('sha256')
        .update(identityParts.join('|'))
        .digest('hex');

    return `${keyPrefix}:${hash}`;
}

function shouldBypassCache(req: Request): boolean {
    const cacheControl = req.header('cache-control') || '';
    return cacheControl.includes('no-cache') || cacheControl.includes('no-store');
}

export function cacheResponse(options: CacheOptions = {}) {
    const ttlSeconds = options.ttlSeconds ?? config.caching.ttl;
    const keyPrefix = options.keyPrefix ?? 'cache:api';
    const varyByUser = options.varyByUser ?? false;

    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        if (req.method !== 'GET' || shouldBypassCache(req)) {
            next();
            return;
        }

        const cacheKey = buildCacheKey(req, keyPrefix, varyByUser);
        const cached = await responseCache.get(cacheKey);

        if (cached) {
            res.setHeader('X-Cache', 'HIT');
            res.type('json').send(cached);
            return;
        }

        res.setHeader('X-Cache', 'MISS');

        const originalJson: Response['json'] = res.json.bind(res);
        res.json = (body: unknown) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const payload = JSON.stringify(body);
                responseCache.set(cacheKey, payload, ttlSeconds).catch(() => {});
            }
            return originalJson(body);
        };

        next();
    };
}

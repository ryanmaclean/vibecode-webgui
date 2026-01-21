import cron from 'node-cron';
import { ModelRegistry } from '../services/model-registry';
import { RedisService } from '../services/redis-service';
import { logger } from './logger';

const modelRegistry = new ModelRegistry();
const redisService = new RedisService();

export function startCronJobs(): void {
    logger.info('Starting cron jobs');

    // Refresh models every hour
    cron.schedule('0 * * * *', async () => {
        try {
            logger.info('Starting scheduled model refresh');
            await modelRegistry.refreshModels();
            logger.info('Scheduled model refresh completed');
        } catch (error) {
            logger.error('Scheduled model refresh failed', { error });
        }
    });

    // Clean up old cache entries every 6 hours
    cron.schedule('0 */6 * * *', async () => {
        try {
            logger.info('Starting cache cleanup');
            await cleanupCache();
            logger.info('Cache cleanup completed');
        } catch (error) {
            logger.error('Cache cleanup failed', { error });
        }
    });

    // Generate daily usage reports at midnight
    cron.schedule('0 0 * * *', async () => {
        try {
            logger.info('Generating daily usage report');
            await generateDailyReport();
            logger.info('Daily usage report generated');
        } catch (error) {
            logger.error('Daily usage report generation failed', { error });
        }
    });

    // Clean up old usage data every week (keep last 30 days)
    cron.schedule('0 2 * * 0', async () => {
        try {
            logger.info('Starting usage data cleanup');
            await cleanupOldUsageData();
            logger.info('Usage data cleanup completed');
        } catch (error) {
            logger.error('Usage data cleanup failed', { error });
        }
    });

    logger.info('Cron jobs started successfully');
}

async function cleanupCache(): Promise<void> {
    try {
        // Get all cache keys
        const cacheKeys = await redisService.keys('cache:*');
        let expiredCount = 0;

        for (const key of cacheKeys) {
            const ttl = await redisService.ttl(key);

            // If TTL is -1, the key exists but has no expiration
            // If TTL is -2, the key doesn't exist
            // If TTL is 0 or negative, it's expired
            if (ttl === -1) {
                // Set a default expiration for keys without TTL
                await redisService.expire(key, 3600); // 1 hour
            } else if (ttl === -2 || ttl === 0) {
                await redisService.del(key);
                expiredCount++;
            }
        }

        logger.info('Cache cleanup completed', {
            totalKeys: cacheKeys.length,
            expiredKeys: expiredCount
        });
    } catch (error) {
        logger.error('Cache cleanup error', { error });
        throw error;
    }
}

async function generateDailyReport(): Promise<void> {
    try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0];

        // Get global usage for yesterday
        const globalUsage = await redisService.hGetAll(`usage:global:${dateStr}`);

        if (globalUsage && Object.keys(globalUsage).length > 0) {
            const report = {
                date: dateStr,
                totalRequests: parseInt(globalUsage.requests || '0'),
                totalTokens: parseInt(globalUsage.tokens || '0'),
                totalCost: parseFloat(globalUsage.cost || '0'),
                generatedAt: new Date().toISOString()
            };

            // Store the daily report
            await redisService.set(
                `report:daily:${dateStr}`,
                JSON.stringify(report),
                30 * 24 * 60 * 60 // Keep for 30 days
            );

            logger.info('Daily report generated', report);
        } else {
            logger.info('No usage data found for yesterday', { date: dateStr });
        }
    } catch (error) {
        logger.error('Daily report generation error', { error });
        throw error;
    }
}

async function cleanupOldUsageData(): Promise<void> {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 30); // Keep last 30 days

        // Get all usage keys
        const usageKeys = await redisService.keys('usage:*');
        let deletedCount = 0;

        for (const key of usageKeys) {
            // Extract date from key (format: usage:type:identifier:YYYY-MM-DD)
            const parts = key.split(':');
            if (parts.length >= 4) {
                const dateStr = parts[parts.length - 1];
                const keyDate = new Date(dateStr);

                if (!isNaN(keyDate.getTime()) && keyDate < cutoffDate) {
                    await redisService.del(key);
                    deletedCount++;
                }
            }
        }

        // Also cleanup old reports
        const reportKeys = await redisService.keys('report:daily:*');
        for (const key of reportKeys) {
            const dateStr = key.split(':')[2];
            const keyDate = new Date(dateStr);

            if (!isNaN(keyDate.getTime()) && keyDate < cutoffDate) {
                await redisService.del(key);
                deletedCount++;
            }
        }

        logger.info('Old usage data cleanup completed', {
            cutoffDate: cutoffDate.toISOString(),
            deletedKeys: deletedCount
        });
    } catch (error) {
        logger.error('Usage data cleanup error', { error });
        throw error;
    }
}

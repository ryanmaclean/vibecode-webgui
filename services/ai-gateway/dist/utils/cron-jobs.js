"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startCronJobs = startCronJobs;
const node_cron_1 = __importDefault(require("node-cron"));
const model_registry_1 = require("../services/model-registry");
const redis_service_1 = require("../services/redis-service");
const logger_1 = require("./logger");
const modelRegistry = new model_registry_1.ModelRegistry();
const redisService = new redis_service_1.RedisService();
function startCronJobs() {
    logger_1.logger.info('Starting cron jobs');
    node_cron_1.default.schedule('0 * * * *', async () => {
        try {
            logger_1.logger.info('Starting scheduled model refresh');
            await modelRegistry.refreshModels();
            logger_1.logger.info('Scheduled model refresh completed');
        }
        catch (error) {
            logger_1.logger.error('Scheduled model refresh failed', { error });
        }
    });
    node_cron_1.default.schedule('0 */6 * * *', async () => {
        try {
            logger_1.logger.info('Starting cache cleanup');
            await cleanupCache();
            logger_1.logger.info('Cache cleanup completed');
        }
        catch (error) {
            logger_1.logger.error('Cache cleanup failed', { error });
        }
    });
    node_cron_1.default.schedule('0 0 * * *', async () => {
        try {
            logger_1.logger.info('Generating daily usage report');
            await generateDailyReport();
            logger_1.logger.info('Daily usage report generated');
        }
        catch (error) {
            logger_1.logger.error('Daily usage report generation failed', { error });
        }
    });
    node_cron_1.default.schedule('0 2 * * 0', async () => {
        try {
            logger_1.logger.info('Starting usage data cleanup');
            await cleanupOldUsageData();
            logger_1.logger.info('Usage data cleanup completed');
        }
        catch (error) {
            logger_1.logger.error('Usage data cleanup failed', { error });
        }
    });
    logger_1.logger.info('Cron jobs started successfully');
}
async function cleanupCache() {
    try {
        const cacheKeys = await redisService.keys('cache:*');
        let expiredCount = 0;
        for (const key of cacheKeys) {
            const ttl = await redisService.ttl(key);
            if (ttl === -1) {
                await redisService.expire(key, 3600);
            }
            else if (ttl === -2 || ttl === 0) {
                await redisService.del(key);
                expiredCount++;
            }
        }
        logger_1.logger.info('Cache cleanup completed', {
            totalKeys: cacheKeys.length,
            expiredKeys: expiredCount
        });
    }
    catch (error) {
        logger_1.logger.error('Cache cleanup error', { error });
        throw error;
    }
}
async function generateDailyReport() {
    try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0];
        const globalUsage = await redisService.hGetAll(`usage:global:${dateStr}`);
        if (globalUsage && Object.keys(globalUsage).length > 0) {
            const report = {
                date: dateStr,
                totalRequests: parseInt(globalUsage.requests || '0'),
                totalTokens: parseInt(globalUsage.tokens || '0'),
                totalCost: parseFloat(globalUsage.cost || '0'),
                generatedAt: new Date().toISOString()
            };
            await redisService.set(`report:daily:${dateStr}`, JSON.stringify(report), 30 * 24 * 60 * 60);
            logger_1.logger.info('Daily report generated', report);
        }
        else {
            logger_1.logger.info('No usage data found for yesterday', { date: dateStr });
        }
    }
    catch (error) {
        logger_1.logger.error('Daily report generation error', { error });
        throw error;
    }
}
async function cleanupOldUsageData() {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 30);
        const usageKeys = await redisService.keys('usage:*');
        let deletedCount = 0;
        for (const key of usageKeys) {
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
        const reportKeys = await redisService.keys('report:daily:*');
        for (const key of reportKeys) {
            const dateStr = key.split(':')[2];
            const keyDate = new Date(dateStr);
            if (!isNaN(keyDate.getTime()) && keyDate < cutoffDate) {
                await redisService.del(key);
                deletedCount++;
            }
        }
        logger_1.logger.info('Old usage data cleanup completed', {
            cutoffDate: cutoffDate.toISOString(),
            deletedKeys: deletedCount
        });
    }
    catch (error) {
        logger_1.logger.error('Usage data cleanup error', { error });
        throw error;
    }
}
//# sourceMappingURL=cron-jobs.js.map

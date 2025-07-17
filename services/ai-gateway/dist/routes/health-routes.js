"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRoutes = void 0;
const express_1 = require("express");
const redis_service_1 = require("../services/redis-service");
const model_registry_1 = require("../services/model-registry");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
exports.healthRoutes = router;
const redisService = new redis_service_1.RedisService();
const modelRegistry = new model_registry_1.ModelRegistry();
router.get('/', (_req, res) => {
    res.json({
        status: 'healthy',
        service: 'vibecode-ai-gateway',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});
router.get('/detailed', async (_req, res) => {
    const checks = {
        redis: { status: 'unknown', latency: 0 },
        models: { status: 'unknown', count: 0 },
        memory: { status: 'healthy', usage: process.memoryUsage() },
        cpu: { status: 'healthy', uptime: process.uptime() }
    };
    try {
        const start = Date.now();
        const isReady = redisService.isReady();
        checks.redis.latency = Date.now() - start;
        checks.redis.status = isReady ? 'healthy' : 'unhealthy';
    }
    catch (error) {
        checks.redis.status = 'error';
        logger_1.logger.error('Redis health check failed', { error });
    }
    try {
        const models = modelRegistry.getModels();
        checks.models.count = models.length;
        checks.models.status = models.length > 0 ? 'healthy' : 'unhealthy';
    }
    catch (error) {
        checks.models.status = 'error';
        logger_1.logger.error('Model registry health check failed', { error });
    }
    const memUsage = process.memoryUsage();
    const memUsageMB = memUsage.heapUsed / 1024 / 1024;
    if (memUsageMB > 1000) {
        checks.memory.status = 'warning';
    }
    const allHealthy = Object.values(checks).every(check => check.status === 'healthy' || check.status === 'warning');
    const statusCode = allHealthy ? 200 : 503;
    res.status(statusCode).json({
        status: allHealthy ? 'healthy' : 'unhealthy',
        service: 'vibecode-ai-gateway',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        checks,
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        pid: process.pid
    });
});
router.get('/ready', async (_req, res) => {
    try {
        const redisReady = redisService.isReady();
        const modelsLoaded = modelRegistry.getModels().length > 0;
        if (redisReady && modelsLoaded) {
            res.json({
                status: 'ready',
                timestamp: new Date().toISOString()
            });
        }
        else {
            res.status(503).json({
                status: 'not ready',
                redis: redisReady,
                models: modelsLoaded,
                timestamp: new Date().toISOString()
            });
        }
    }
    catch (error) {
        logger_1.logger.error('Readiness check failed', { error });
        res.status(503).json({
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
        });
    }
});
router.get('/live', (_req, res) => {
    res.json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});
//# sourceMappingURL=health-routes.js.map

import { Router } from 'express';
import { Request, Response } from 'express';
import { RedisService } from '../services/redis-service';
import { ModelRegistry } from '../services/model-registry';
import { logger } from '../utils/logger';

const router = Router();
const redisService = new RedisService();
const modelRegistry = new ModelRegistry();

// Basic health check
router.get('/', (_req: Request, res: Response) => {
    res.json({
        status: 'healthy',
        service: 'vibecode-ai-gateway',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Detailed health check
router.get('/detailed', async (_req: Request, res: Response) => {
    const checks = {
        redis: { status: 'unknown', latency: 0 },
        models: { status: 'unknown', count: 0 },
        memory: { status: 'healthy', usage: process.memoryUsage() },
        cpu: { status: 'healthy', uptime: process.uptime() }
    };

    // Check Redis connection
    try {
        const start = Date.now();
        const isReady = redisService.isReady();
        checks.redis.latency = Date.now() - start;
        checks.redis.status = isReady ? 'healthy' : 'unhealthy';
    } catch (error) {
        checks.redis.status = 'error';
        logger.error('Redis health check failed', { error });
    }

    // Check model registry
    try {
        const models = modelRegistry.getModels();
        checks.models.count = models.length;
        checks.models.status = models.length > 0 ? 'healthy' : 'unhealthy';
    } catch (error) {
        checks.models.status = 'error';
        logger.error('Model registry health check failed', { error });
    }

    // Check memory usage
    const memUsage = process.memoryUsage();
    const memUsageMB = memUsage.heapUsed / 1024 / 1024;
    if (memUsageMB > 1000) { // 1GB threshold
        checks.memory.status = 'warning';
    }

    // Overall status
    const allHealthy = Object.values(checks).every(check => 
        check.status === 'healthy' || check.status === 'warning'
    );

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

// Readiness probe (for Kubernetes)
router.get('/ready', async (_req: Request, res: Response) => {
    try {
        const redisReady = redisService.isReady();
        const modelsLoaded = modelRegistry.getModels().length > 0;
        
        if (redisReady && modelsLoaded) {
            res.json({
                status: 'ready',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(503).json({
                status: 'not ready',
                redis: redisReady,
                models: modelsLoaded,
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        logger.error('Readiness check failed', { error });
        res.status(503).json({
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
        });
    }
});

// Liveness probe (for Kubernetes)
router.get('/live', (_req: Request, res: Response) => {
    res.json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

export { router as healthRoutes };
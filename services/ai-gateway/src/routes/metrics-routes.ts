import { Router } from 'express';
import { Request, Response } from 'express';
import { OpenRouterClient } from '../services/openrouter-client';
import { RedisService } from '../services/redis-service';
import { logger } from '../utils/logger';

const router = Router();
const openRouterClient = new OpenRouterClient();
const redisService = new RedisService();

// Basic metrics endpoint
router.get('/', async (_req: Request, res: Response) => {
    try {
        const metrics = {
            timestamp: new Date().toISOString(),
            service: 'vibecode-ai-gateway',
            version: '1.0.0',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            performance: await getPerformanceMetrics(),
            system: getSystemMetrics()
        };

        res.json(metrics);
    } catch (error) {
        logger.error('Failed to collect metrics', { error });
        res.status(500).json({
            error: 'Failed to collect metrics',
            timestamp: new Date().toISOString()
        });
    }
});

// Performance metrics for all models
router.get('/performance', async (_req: Request, res: Response) => {
    try {
        const allMetrics = openRouterClient.getAllPerformanceMetrics();
        
        res.json({
            metrics: allMetrics,
            count: allMetrics.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Failed to collect performance metrics', { error });
        res.status(500).json({
            error: 'Failed to collect performance metrics',
            timestamp: new Date().toISOString()
        });
    }
});

// Usage metrics by time period
router.get('/usage', async (req: Request, res: Response) => {
    try {
        const { days = '7' } = req.query;
        const dayCount = parseInt(days as string);
        
        const usageMetrics = await getUsageMetrics(dayCount);
        
        res.json({
            usage: usageMetrics,
            period: `${dayCount} days`,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Failed to collect usage metrics', { error });
        res.status(500).json({
            error: 'Failed to collect usage metrics',
            timestamp: new Date().toISOString()
        });
    }
});

// Cost metrics
router.get('/costs', async (req: Request, res: Response) => {
    try {
        const { days = '7' } = req.query;
        const dayCount = parseInt(days as string);
        
        const costMetrics = await getCostMetrics(dayCount);
        
        res.json({
            costs: costMetrics,
            period: `${dayCount} days`,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Failed to collect cost metrics', { error });
        res.status(500).json({
            error: 'Failed to collect cost metrics',
            timestamp: new Date().toISOString()
        });
    }
});

// Prometheus metrics format
router.get('/prometheus', async (_req: Request, res: Response) => {
    try {
        const performanceMetrics = openRouterClient.getAllPerformanceMetrics();
        const systemMetrics = getSystemMetrics();
        
        let prometheus = '';
        
        // System metrics
        prometheus += `# HELP vibecode_ai_gateway_uptime_seconds Process uptime in seconds\n`;
        prometheus += `# TYPE vibecode_ai_gateway_uptime_seconds gauge\n`;
        prometheus += `vibecode_ai_gateway_uptime_seconds ${process.uptime()}\n\n`;
        
        prometheus += `# HELP vibecode_ai_gateway_memory_usage_bytes Memory usage in bytes\n`;
        prometheus += `# TYPE vibecode_ai_gateway_memory_usage_bytes gauge\n`;
        prometheus += `vibecode_ai_gateway_memory_usage_bytes{type="rss"} ${systemMetrics.memory.rss}\n`;
        prometheus += `vibecode_ai_gateway_memory_usage_bytes{type="heapUsed"} ${systemMetrics.memory.heapUsed}\n`;
        prometheus += `vibecode_ai_gateway_memory_usage_bytes{type="heapTotal"} ${systemMetrics.memory.heapTotal}\n\n`;
        
        // Model performance metrics
        prometheus += `# HELP vibecode_ai_gateway_model_latency_ms Average model latency in milliseconds\n`;
        prometheus += `# TYPE vibecode_ai_gateway_model_latency_ms gauge\n`;
        
        prometheus += `# HELP vibecode_ai_gateway_model_success_rate Model success rate (0-1)\n`;
        prometheus += `# TYPE vibecode_ai_gateway_model_success_rate gauge\n`;
        
        prometheus += `# HELP vibecode_ai_gateway_model_requests_total Total requests per model\n`;
        prometheus += `# TYPE vibecode_ai_gateway_model_requests_total counter\n`;
        
        for (const metric of performanceMetrics) {
            const modelLabel = metric.model.replace(/[^a-zA-Z0-9_]/g, '_');
            prometheus += `vibecode_ai_gateway_model_latency_ms{model="${modelLabel}"} ${metric.averageLatency}\n`;
            prometheus += `vibecode_ai_gateway_model_success_rate{model="${modelLabel}"} ${metric.successRate}\n`;
            prometheus += `vibecode_ai_gateway_model_requests_total{model="${modelLabel}"} ${metric.totalRequests}\n`;
        }
        
        res.set('Content-Type', 'text/plain');
        res.send(prometheus);
    } catch (error) {
        logger.error('Failed to generate Prometheus metrics', { error });
        res.status(500).send('# Error generating metrics\n');
    }
});

// Helper functions
async function getPerformanceMetrics() {
    const allMetrics = openRouterClient.getAllPerformanceMetrics();
    
    if (allMetrics.length === 0) {
        return {
            averageLatency: 0,
            averageSuccessRate: 0,
            totalRequests: 0,
            modelCount: 0
        };
    }
    
    const totalRequests = allMetrics.reduce((sum, m) => sum + m.totalRequests, 0);
    const weightedLatency = allMetrics.reduce((sum, m) => sum + (m.averageLatency * m.totalRequests), 0);
    const weightedSuccessRate = allMetrics.reduce((sum, m) => sum + (m.successRate * m.totalRequests), 0);
    
    return {
        averageLatency: totalRequests > 0 ? weightedLatency / totalRequests : 0,
        averageSuccessRate: totalRequests > 0 ? weightedSuccessRate / totalRequests : 0,
        totalRequests,
        modelCount: allMetrics.length
    };
}

function getSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
        memory: memUsage,
        cpu: cpuUsage,
        uptime: process.uptime(),
        version: process.version,
        pid: process.pid,
        platform: process.platform,
        arch: process.arch
    };
}

async function getUsageMetrics(days: number) {
    const metrics = [];
    const now = new Date();
    
    for (let i = 0; i < days; i++) {
        const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
        const dateStr = date.toISOString().split('T')[0];
        
        try {
            const globalUsage = await redisService.hGetAll(`usage:global:${dateStr}`);
            
            metrics.push({
                date: dateStr,
                requests: parseInt(globalUsage?.requests || '0'),
                tokens: parseInt(globalUsage?.tokens || '0'),
                cost: parseFloat(globalUsage?.cost || '0')
            });
        } catch (error) {
            logger.error('Failed to get usage for date', { date: dateStr, error });
            metrics.push({
                date: dateStr,
                requests: 0,
                tokens: 0,
                cost: 0
            });
        }
    }
    
    return metrics.reverse(); // Return in chronological order
}

async function getCostMetrics(days: number) {
    const usageMetrics = await getUsageMetrics(days);
    
    const totalCost = usageMetrics.reduce((sum, m) => sum + m.cost, 0);
    const totalRequests = usageMetrics.reduce((sum, m) => sum + m.requests, 0);
    const totalTokens = usageMetrics.reduce((sum, m) => sum + m.tokens, 0);
    
    return {
        total: totalCost,
        average: totalRequests > 0 ? totalCost / totalRequests : 0,
        costPerToken: totalTokens > 0 ? totalCost / totalTokens : 0,
        daily: usageMetrics,
        period: `${days} days`
    };
}

export { router as metricsRoutes };
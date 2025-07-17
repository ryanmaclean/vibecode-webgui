import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/environment';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/error-handler';
import { authMiddleware } from './middleware/auth';
import { aiRoutes } from './routes/ai-routes';
import { healthRoutes } from './routes/health-routes';
import { metricsRoutes } from './routes/metrics-routes';
import { RedisService } from './services/redis-service';
import { ModelRegistry } from './services/model-registry';
import { startCronJobs } from './utils/cron-jobs';

class AIGatewayServer {
    private app: express.Application;
    private redisService: RedisService;
    private modelRegistry: ModelRegistry;

    constructor() {
        this.app = express();
        this.redisService = new RedisService();
        this.modelRegistry = new ModelRegistry();
        this.initializeMiddleware();
        this.initializeRoutes();
        this.initializeErrorHandling();
    }

    private initializeMiddleware(): void {
        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'", "https://openrouter.ai"],
                    fontSrc: ["'self'"],
                    objectSrc: ["'none'"],
                    mediaSrc: ["'self'"],
                    frameSrc: ["'none'"],
                }
            }
        }));

        // CORS configuration
        this.app.use(cors({
            origin: config.cors.allowedOrigins,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID']
        }));

        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: config.rateLimit.requestsPerWindow,
            message: {
                error: 'Too many requests',
                retryAfter: '15 minutes'
            },
            standardHeaders: true,
            legacyHeaders: false,
            skip: (req) => {
                // Skip rate limiting for health checks
                return req.path === '/health' || req.path === '/metrics';
            }
        });
        this.app.use(limiter);

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Request logging
        this.app.use((req, _res, next) => {
            const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            (req as any).requestId = requestId as string;

            logger.info('Incoming request', {
                requestId,
                method: req.method,
                url: req.url,
                userAgent: req.get('User-Agent'),
                ip: req.ip
            });

            next();
        });
    }

    private initializeRoutes(): void {
        // Health and monitoring routes
        this.app.use('/health', healthRoutes);
        this.app.use('/metrics', metricsRoutes);

        // API routes with authentication
        this.app.use('/api/v1', authMiddleware, aiRoutes);

        // Root endpoint
        this.app.get('/', (_req, res) => {
            res.json({
                service: 'VibeCode AI Gateway',
                version: '1.0.0',
                status: 'running',
                timestamp: new Date().toISOString(),
                endpoints: {
                    health: '/health',
                    metrics: '/metrics',
                    api: '/api/v1'
                }
            });
        });

        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Endpoint not found',
                path: req.originalUrl,
                method: req.method,
                timestamp: new Date().toISOString()
            });
        });
    }

    private initializeErrorHandling(): void {
        this.app.use(errorHandler);
    }

    public async start(): Promise<void> {
        try {
            // Initialize Redis connection
            await this.redisService.connect();
            logger.info('Redis connected successfully');

            // Initialize model registry
            await this.modelRegistry.initialize();
            logger.info('Model registry initialized');

            // Start cron jobs
            startCronJobs();
            logger.info('Cron jobs started');

            // Start server
            const port = config.server.port;
            this.app.listen(port, () => {
                logger.info(`AI Gateway server started`, {
                    port,
                    environment: config.environment,
                    nodeVersion: process.version,
                    pid: process.pid
                });
            });

            // Graceful shutdown handling
            process.on('SIGTERM', () => this.shutdown('SIGTERM'));
            process.on('SIGINT', () => this.shutdown('SIGINT'));

        } catch (error) {
            logger.error('Failed to start AI Gateway server', { error });
            process.exit(1);
        }
    }

    private async shutdown(signal: string): Promise<void> {
        logger.info(`Received ${signal}, shutting down gracefully`);

        try {
            await this.redisService.disconnect();
            logger.info('Redis disconnected');

            process.exit(0);
        } catch (error) {
            logger.error('Error during shutdown', { error });
            process.exit(1);
        }
    }
}

// Start the server
const server = new AIGatewayServer();
server.start().catch((error) => {
    logger.error('Failed to start server', { error });
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error });
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', { reason, promise });
    process.exit(1);
});

export default server;

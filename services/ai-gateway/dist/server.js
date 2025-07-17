"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const environment_1 = require("./config/environment");
const logger_1 = require("./utils/logger");
const error_handler_1 = require("./middleware/error-handler");
const auth_1 = require("./middleware/auth");
const ai_routes_1 = require("./routes/ai-routes");
const health_routes_1 = require("./routes/health-routes");
const metrics_routes_1 = require("./routes/metrics-routes");
const redis_service_1 = require("./services/redis-service");
const model_registry_1 = require("./services/model-registry");
const cron_jobs_1 = require("./utils/cron-jobs");
class AIGatewayServer {
    constructor() {
        this.app = (0, express_1.default)();
        this.redisService = new redis_service_1.RedisService();
        this.modelRegistry = new model_registry_1.ModelRegistry();
        this.initializeMiddleware();
        this.initializeRoutes();
        this.initializeErrorHandling();
    }
    initializeMiddleware() {
        this.app.use((0, helmet_1.default)({
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
        this.app.use((0, cors_1.default)({
            origin: environment_1.config.cors.allowedOrigins,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID']
        }));
        const limiter = (0, express_rate_limit_1.default)({
            windowMs: 15 * 60 * 1000,
            max: environment_1.config.rateLimit.requestsPerWindow,
            message: {
                error: 'Too many requests',
                retryAfter: '15 minutes'
            },
            standardHeaders: true,
            legacyHeaders: false,
            skip: (req) => {
                return req.path === '/health' || req.path === '/metrics';
            }
        });
        this.app.use(limiter);
        this.app.use(express_1.default.json({ limit: '10mb' }));
        this.app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
        this.app.use((req, _res, next) => {
            const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            req.requestId = requestId;
            logger_1.logger.info('Incoming request', {
                requestId,
                method: req.method,
                url: req.url,
                userAgent: req.get('User-Agent'),
                ip: req.ip
            });
            next();
        });
    }
    initializeRoutes() {
        this.app.use('/health', health_routes_1.healthRoutes);
        this.app.use('/metrics', metrics_routes_1.metricsRoutes);
        this.app.use('/api/v1', auth_1.authMiddleware, ai_routes_1.aiRoutes);
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
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Endpoint not found',
                path: req.originalUrl,
                method: req.method,
                timestamp: new Date().toISOString()
            });
        });
    }
    initializeErrorHandling() {
        this.app.use(error_handler_1.errorHandler);
    }
    async start() {
        try {
            await this.redisService.connect();
            logger_1.logger.info('Redis connected successfully');
            await this.modelRegistry.initialize();
            logger_1.logger.info('Model registry initialized');
            (0, cron_jobs_1.startCronJobs)();
            logger_1.logger.info('Cron jobs started');
            const port = environment_1.config.server.port;
            this.app.listen(port, () => {
                logger_1.logger.info(`AI Gateway server started`, {
                    port,
                    environment: environment_1.config.environment,
                    nodeVersion: process.version,
                    pid: process.pid
                });
            });
            process.on('SIGTERM', () => this.shutdown('SIGTERM'));
            process.on('SIGINT', () => this.shutdown('SIGINT'));
        }
        catch (error) {
            logger_1.logger.error('Failed to start AI Gateway server', { error });
            process.exit(1);
        }
    }
    async shutdown(signal) {
        logger_1.logger.info(`Received ${signal}, shutting down gracefully`);
        try {
            await this.redisService.disconnect();
            logger_1.logger.info('Redis disconnected');
            process.exit(0);
        }
        catch (error) {
            logger_1.logger.error('Error during shutdown', { error });
            process.exit(1);
        }
    }
}
const server = new AIGatewayServer();
server.start().catch((error) => {
    logger_1.logger.error('Failed to start server', { error });
    process.exit(1);
});
process.on('uncaughtException', (error) => {
    logger_1.logger.error('Uncaught exception', { error });
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    logger_1.logger.error('Unhandled rejection', { reason, promise });
    process.exit(1);
});
exports.default = server;
//# sourceMappingURL=server.js.map

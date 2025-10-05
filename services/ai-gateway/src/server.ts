import { createApp } from './app';
import { config } from './config/environment';
import { logger } from './utils/logger';
import { RedisService } from './services/redis-service';
import { ModelRegistry } from './services/model-registry';
import { startCronJobs } from './utils/cron-jobs';

class AIGatewayServer {
    private app;
    private redisService: RedisService;
    private modelRegistry: ModelRegistry;

    constructor() {
        this.app = createApp();
        this.redisService = new RedisService();
        this.modelRegistry = new ModelRegistry();
    }

    // App initialization (middleware/routes/error handling) is done in createApp()

    public async start(): Promise<void> {
        try {
            // Initialize Redis connection (optional for local smoke)
            const disableRedis = String(process.env.DISABLE_REDIS || '').toLowerCase() === 'true';
            if (disableRedis) {
                logger.warn('Redis is disabled by DISABLE_REDIS=true; starting without Redis');
            } else {
                try {
                    await this.redisService.connect();
                    logger.info('Redis connected successfully');
                } catch (err) {
                    // If explicitly allowed to start without Redis, continue; otherwise rethrow
                    const allowNoRedis = String(process.env.ALLOW_START_WITHOUT_REDIS || '').toLowerCase() === 'true';
                    if (allowNoRedis) {
                        logger.warn('Failed to connect to Redis; continuing because ALLOW_START_WITHOUT_REDIS=true', { error: err });
                    } else {
                        throw err;
                    }
                }
            }

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

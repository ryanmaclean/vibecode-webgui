"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const environment_1 = require("./config/environment");
const logger_1 = require("./utils/logger");
const redis_service_1 = require("./services/redis-service");
const model_registry_1 = require("./services/model-registry");
const cron_jobs_1 = require("./utils/cron-jobs");
class AIGatewayServer {
    constructor() {
        this.app = (0, app_1.createApp)();
        this.redisService = new redis_service_1.RedisService();
        this.modelRegistry = new model_registry_1.ModelRegistry();
    }
    async start() {
        try {
            const disableRedis = String(process.env.DISABLE_REDIS || '').toLowerCase() === 'true';
            if (disableRedis) {
                logger_1.logger.warn('Redis is disabled by DISABLE_REDIS=true; starting without Redis');
            }
            else {
                try {
                    await this.redisService.connect();
                    logger_1.logger.info('Redis connected successfully');
                }
                catch (err) {
                    const allowNoRedis = String(process.env.ALLOW_START_WITHOUT_REDIS || '').toLowerCase() === 'true';
                    if (allowNoRedis) {
                        logger_1.logger.warn('Failed to connect to Redis; continuing because ALLOW_START_WITHOUT_REDIS=true', { error: err });
                    }
                    else {
                        throw err;
                    }
                }
            }
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
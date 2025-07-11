"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const logger_1 = require("../utils/logger");
dotenv_1.default.config();
const requiredEnvVars = [
    'OPENROUTER_API_KEY',
    'JWT_SECRET'
];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
    logger_1.logger.error('Missing required environment variables', { missingEnvVars });
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}
exports.config = {
    environment: process.env.NODE_ENV || 'development',
    server: {
        port: parseInt(process.env.PORT || '3001', 10),
        host: process.env.HOST || '0.0.0.0'
    },
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0', 10)
    },
    openrouter: {
        apiKey: process.env.OPENROUTER_API_KEY,
        baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
        timeout: parseInt(process.env.OPENROUTER_TIMEOUT || '60000', 10)
    },
    auth: {
        jwtSecret: process.env.JWT_SECRET,
        jwtExpiration: process.env.JWT_EXPIRATION || '24h',
        apiKeys: process.env.API_KEYS ? process.env.API_KEYS.split(',') : []
    },
    rateLimit: {
        requestsPerWindow: parseInt(process.env.RATE_LIMIT_REQUESTS || '100', 10),
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10)
    },
    cors: {
        allowedOrigins: process.env.CORS_ALLOWED_ORIGINS
            ? process.env.CORS_ALLOWED_ORIGINS.split(',')
            : ['http://localhost:3000', 'http://localhost:8090', 'https://*.vibecode.dev']
    },
    caching: {
        ttl: parseInt(process.env.CACHE_TTL || '3600', 10),
        maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000', 10)
    },
    monitoring: {
        enableMetrics: process.env.ENABLE_METRICS !== 'false',
        enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING !== 'false'
    },
    models: {
        defaultModel: process.env.DEFAULT_MODEL || 'anthropic/claude-3-sonnet-20240229',
        fallbackModels: process.env.FALLBACK_MODELS
            ? process.env.FALLBACK_MODELS.split(',')
            : ['anthropic/claude-3-haiku-20240307', 'openai/gpt-3.5-turbo'],
        costThresholds: {
            warning: parseFloat(process.env.COST_WARNING_THRESHOLD || '10.0'),
            limit: parseFloat(process.env.COST_LIMIT_THRESHOLD || '100.0')
        }
    }
};
logger_1.logger.info('Configuration loaded', {
    environment: exports.config.environment,
    server: exports.config.server,
    redis: { ...exports.config.redis, password: exports.config.redis.password ? '[REDACTED]' : undefined },
    openrouter: { ...exports.config.openrouter, apiKey: '[REDACTED]' },
    models: exports.config.models
});
exports.default = exports.config;
//# sourceMappingURL=environment.js.map
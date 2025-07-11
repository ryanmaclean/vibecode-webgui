import dotenv from 'dotenv';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config();

interface Config {
    environment: string;
    server: {
        port: number;
        host: string;
    };
    redis: {
        host: string;
        port: number;
        password?: string;
        db: number;
    };
    openrouter: {
        apiKey: string;
        baseUrl: string;
        timeout: number;
    };
    auth: {
        jwtSecret: string;
        jwtExpiration: string;
        apiKeys: string[];
    };
    rateLimit: {
        requestsPerWindow: number;
        windowMs: number;
    };
    cors: {
        allowedOrigins: string[];
    };
    caching: {
        ttl: number;
        maxSize: number;
    };
    monitoring: {
        enableMetrics: boolean;
        enableRequestLogging: boolean;
    };
    models: {
        defaultModel: string;
        fallbackModels: string[];
        costThresholds: {
            warning: number;
            limit: number;
        };
    };
}

const requiredEnvVars = [
    'OPENROUTER_API_KEY',
    'JWT_SECRET'
];

// Validate required environment variables
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
    logger.error('Missing required environment variables', { missingEnvVars });
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

export const config: Config = {
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
        apiKey: process.env.OPENROUTER_API_KEY!,
        baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
        timeout: parseInt(process.env.OPENROUTER_TIMEOUT || '60000', 10)
    },
    
    auth: {
        jwtSecret: process.env.JWT_SECRET!,
        jwtExpiration: process.env.JWT_EXPIRATION || '24h',
        apiKeys: process.env.API_KEYS ? process.env.API_KEYS.split(',') : []
    },
    
    rateLimit: {
        requestsPerWindow: parseInt(process.env.RATE_LIMIT_REQUESTS || '100', 10),
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10) // 15 minutes
    },
    
    cors: {
        allowedOrigins: process.env.CORS_ALLOWED_ORIGINS 
            ? process.env.CORS_ALLOWED_ORIGINS.split(',')
            : ['http://localhost:3000', 'http://localhost:8090', 'https://*.vibecode.dev']
    },
    
    caching: {
        ttl: parseInt(process.env.CACHE_TTL || '3600', 10), // 1 hour
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

// Log configuration (excluding sensitive data)
logger.info('Configuration loaded', {
    environment: config.environment,
    server: config.server,
    redis: { ...config.redis, password: config.redis.password ? '[REDACTED]' : undefined },
    openrouter: { ...config.openrouter, apiKey: '[REDACTED]' },
    models: config.models
});

export default config;
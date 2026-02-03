import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';
const environment = process.env.NODE_ENV || 'development';

// Custom log format
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf((info) => {
        const { timestamp, level, message, ...meta } = info;
        return JSON.stringify({
            timestamp,
            level: level.toUpperCase(),
            message,
            service: 'ai-gateway',
            environment,
            pid: process.pid,
            ...meta
        });
    })
);

// Console format for development
const consoleFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'HH:mm:ss'
    }),
    winston.format.colorize(),
    winston.format.printf((info) => {
        const { timestamp, level, message, ...meta } = info;
        const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
        return `[${timestamp}] ${level}: ${message}${metaStr}`;
    })
);

// Create logger instance
export const logger = winston.createLogger({
    level: logLevel,
    format: logFormat,
    defaultMeta: {
        service: 'ai-gateway',
        environment,
        version: '1.0.0'
    },
    transports: [
        // Console transport (always enabled)
        new winston.transports.Console({
            format: environment === 'production' ? logFormat : consoleFormat
        })
    ],
    exitOnError: false
});

// Add file transport in production
if (environment === 'production') {
    logger.add(new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 50 * 1024 * 1024, // 50MB
        maxFiles: 5,
        tailable: true
    }));

    logger.add(new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 50 * 1024 * 1024, // 50MB
        maxFiles: 10,
        tailable: true
    }));
}

// Request logger middleware compatible format
type LogMeta = Record<string, unknown> | undefined;

export const requestLogger = {
    info: (message: string, meta?: LogMeta) => logger.info(message, meta),
    warn: (message: string, meta?: LogMeta) => logger.warn(message, meta),
    error: (message: string, meta?: LogMeta) => logger.error(message, meta),
    debug: (message: string, meta?: LogMeta) => logger.debug(message, meta)
};

// Performance logger for AI operations
export const performanceLogger = {
    logRequest: (operation: string, startTime: number, meta?: LogMeta) => {
        const duration = Date.now() - startTime;
        logger.info(`AI operation completed`, {
            operation,
            duration: `${duration}ms`,
            ...meta
        });
    },

    logError: (operation: string, startTime: number, error: unknown, meta?: LogMeta) => {
        const duration = Date.now() - startTime;
        const err = error as { message?: string; stack?: string };
        logger.error(`AI operation failed`, {
            operation,
            duration: `${duration}ms`,
            error: err?.message || String(error),
            stack: err?.stack,
            ...meta
        });
    }
};

export default logger;

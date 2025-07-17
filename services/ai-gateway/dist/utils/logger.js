"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.performanceLogger = exports.requestLogger = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const logLevel = process.env.LOG_LEVEL || 'info';
const environment = process.env.NODE_ENV || 'development';
const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
}), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json(), winston_1.default.format.printf((info) => {
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
}));
const consoleFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({
    format: 'HH:mm:ss'
}), winston_1.default.format.colorize(), winston_1.default.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
}));
exports.logger = winston_1.default.createLogger({
    level: logLevel,
    format: logFormat,
    defaultMeta: {
        service: 'ai-gateway',
        environment,
        version: '1.0.0'
    },
    transports: [
        new winston_1.default.transports.Console({
            format: environment === 'production' ? logFormat : consoleFormat
        })
    ],
    exitOnError: false
});
if (environment === 'production') {
    exports.logger.add(new winston_1.default.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 50 * 1024 * 1024,
        maxFiles: 5,
        tailable: true
    }));
    exports.logger.add(new winston_1.default.transports.File({
        filename: 'logs/combined.log',
        maxsize: 50 * 1024 * 1024,
        maxFiles: 10,
        tailable: true
    }));
}
exports.requestLogger = {
    info: (message, meta) => exports.logger.info(message, meta),
    warn: (message, meta) => exports.logger.warn(message, meta),
    error: (message, meta) => exports.logger.error(message, meta),
    debug: (message, meta) => exports.logger.debug(message, meta)
};
exports.performanceLogger = {
    logRequest: (operation, startTime, meta) => {
        const duration = Date.now() - startTime;
        exports.logger.info(`AI operation completed`, {
            operation,
            duration: `${duration}ms`,
            ...meta
        });
    },
    logError: (operation, startTime, error, meta) => {
        const duration = Date.now() - startTime;
        exports.logger.error(`AI operation failed`, {
            operation,
            duration: `${duration}ms`,
            error: error.message || error,
            stack: error.stack,
            ...meta
        });
    }
};
exports.default = exports.logger;
//# sourceMappingURL=logger.js.map

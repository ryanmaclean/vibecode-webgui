"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupGlobalErrorHandlers = exports.notFoundHandler = exports.asyncHandler = exports.errorHandler = exports.ServiceUnavailableError = exports.ExternalServiceError = exports.RateLimitError = exports.NotFoundError = exports.AuthorizationError = exports.AuthenticationError = exports.ValidationError = void 0;
const logger_1 = require("../utils/logger");
class ValidationError extends Error {
    constructor(message, details) {
        super(message);
        this.details = details;
        this.statusCode = 400;
        this.code = 'VALIDATION_ERROR';
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class AuthenticationError extends Error {
    constructor(message = 'Authentication required') {
        super(message);
        this.statusCode = 401;
        this.code = 'AUTHENTICATION_ERROR';
        this.name = 'AuthenticationError';
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends Error {
    constructor(message = 'Insufficient permissions') {
        super(message);
        this.statusCode = 403;
        this.code = 'AUTHORIZATION_ERROR';
        this.name = 'AuthorizationError';
    }
}
exports.AuthorizationError = AuthorizationError;
class NotFoundError extends Error {
    constructor(message = 'Resource not found') {
        super(message);
        this.statusCode = 404;
        this.code = 'NOT_FOUND';
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
class RateLimitError extends Error {
    constructor(message = 'Rate limit exceeded') {
        super(message);
        this.statusCode = 429;
        this.code = 'RATE_LIMIT_EXCEEDED';
        this.name = 'RateLimitError';
    }
}
exports.RateLimitError = RateLimitError;
class ExternalServiceError extends Error {
    constructor(message, service) {
        super(message);
        this.service = service;
        this.statusCode = 502;
        this.code = 'EXTERNAL_SERVICE_ERROR';
        this.name = 'ExternalServiceError';
    }
}
exports.ExternalServiceError = ExternalServiceError;
class ServiceUnavailableError extends Error {
    constructor(message = 'Service temporarily unavailable') {
        super(message);
        this.statusCode = 503;
        this.code = 'SERVICE_UNAVAILABLE';
        this.name = 'ServiceUnavailableError';
    }
}
exports.ServiceUnavailableError = ServiceUnavailableError;
const errorHandler = (error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }
    const statusCode = error.statusCode || 500;
    const errorCode = error.code || 'INTERNAL_SERVER_ERROR';
    const requestId = req.requestId || 'unknown';
    const logData = {
        requestId,
        method: req.method,
        url: req.url,
        statusCode,
        errorCode,
        message: error.message,
        stack: error.stack,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        userId: req.user?.id,
        details: error.details
    };
    if (statusCode >= 500) {
        logger_1.logger.error('Server error', logData);
    }
    else if (statusCode >= 400) {
        logger_1.logger.warn('Client error', logData);
    }
    const errorResponse = {
        error: error.message,
        code: errorCode,
        requestId,
        timestamp: new Date().toISOString()
    };
    if (error instanceof ValidationError && error.details) {
        errorResponse.details = error.details;
    }
    if (error instanceof RateLimitError) {
        errorResponse.retryAfter = '15 minutes';
    }
    if (error instanceof ExternalServiceError && error.service) {
        errorResponse.service = error.service;
    }
    if (process.env.NODE_ENV === 'development' && statusCode >= 500) {
        errorResponse.stack = error.stack;
    }
    res.status(statusCode).json(errorResponse);
};
exports.errorHandler = errorHandler;
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
const notFoundHandler = (req, _res, next) => {
    const error = new NotFoundError(`Endpoint ${req.method} ${req.path} not found`);
    next(error);
};
exports.notFoundHandler = notFoundHandler;
const setupGlobalErrorHandlers = () => {
    process.on('uncaughtException', (error) => {
        logger_1.logger.error('Uncaught Exception', {
            error: error.message,
            stack: error.stack,
            pid: process.pid
        });
        setTimeout(() => {
            process.exit(1);
        }, 1000);
    });
    process.on('unhandledRejection', (reason, promise) => {
        logger_1.logger.error('Unhandled Rejection', {
            reason: reason instanceof Error ? reason.message : String(reason),
            stack: reason instanceof Error ? reason.stack : undefined,
            promise: promise.toString(),
            pid: process.pid
        });
        setTimeout(() => {
            process.exit(1);
        }, 1000);
    });
    process.on('SIGTERM', () => {
        logger_1.logger.info('SIGTERM received, shutting down gracefully');
        process.exit(0);
    });
    process.on('SIGINT', () => {
        logger_1.logger.info('SIGINT received, shutting down gracefully');
        process.exit(0);
    });
};
exports.setupGlobalErrorHandlers = setupGlobalErrorHandlers;
//# sourceMappingURL=error-handler.js.map

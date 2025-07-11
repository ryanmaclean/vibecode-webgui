import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface APIError extends Error {
    statusCode?: number;
    code?: string;
    details?: any;
}

export class ValidationError extends Error {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    
    constructor(message: string, public details?: any) {
        super(message);
        this.name = 'ValidationError';
    }
}

export class AuthenticationError extends Error {
    statusCode = 401;
    code = 'AUTHENTICATION_ERROR';
    
    constructor(message: string = 'Authentication required') {
        super(message);
        this.name = 'AuthenticationError';
    }
}

export class AuthorizationError extends Error {
    statusCode = 403;
    code = 'AUTHORIZATION_ERROR';
    
    constructor(message: string = 'Insufficient permissions') {
        super(message);
        this.name = 'AuthorizationError';
    }
}

export class NotFoundError extends Error {
    statusCode = 404;
    code = 'NOT_FOUND';
    
    constructor(message: string = 'Resource not found') {
        super(message);
        this.name = 'NotFoundError';
    }
}

export class RateLimitError extends Error {
    statusCode = 429;
    code = 'RATE_LIMIT_EXCEEDED';
    
    constructor(message: string = 'Rate limit exceeded') {
        super(message);
        this.name = 'RateLimitError';
    }
}

export class ExternalServiceError extends Error {
    statusCode = 502;
    code = 'EXTERNAL_SERVICE_ERROR';
    
    constructor(message: string, public service?: string) {
        super(message);
        this.name = 'ExternalServiceError';
    }
}

export class ServiceUnavailableError extends Error {
    statusCode = 503;
    code = 'SERVICE_UNAVAILABLE';
    
    constructor(message: string = 'Service temporarily unavailable') {
        super(message);
        this.name = 'ServiceUnavailableError';
    }
}

export const errorHandler = (
    error: APIError,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    // Don't handle if response already sent
    if (res.headersSent) {
        return next(error);
    }

    const statusCode = error.statusCode || 500;
    const errorCode = error.code || 'INTERNAL_SERVER_ERROR';
    const requestId = (req as any).requestId || 'unknown';

    // Log the error
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
        userId: (req as any).user?.id,
        details: error.details
    };

    if (statusCode >= 500) {
        logger.error('Server error', logData);
    } else if (statusCode >= 400) {
        logger.warn('Client error', logData);
    }

    // Prepare error response
    const errorResponse: any = {
        error: error.message,
        code: errorCode,
        requestId,
        timestamp: new Date().toISOString()
    };

    // Add details for validation errors
    if (error instanceof ValidationError && error.details) {
        errorResponse.details = error.details;
    }

    // Add retry information for rate limit errors
    if (error instanceof RateLimitError) {
        errorResponse.retryAfter = '15 minutes';
    }

    // Add service information for external service errors
    if (error instanceof ExternalServiceError && error.service) {
        errorResponse.service = error.service;
    }

    // Don't expose stack traces in production
    if (process.env.NODE_ENV === 'development' && statusCode >= 500) {
        errorResponse.stack = error.stack;
    }

    // Send error response
    res.status(statusCode).json(errorResponse);
};

export const asyncHandler = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
    const error = new NotFoundError(`Endpoint ${req.method} ${req.path} not found`);
    next(error);
};

// Global error handlers for uncaught exceptions
export const setupGlobalErrorHandlers = (): void => {
    process.on('uncaughtException', (error: Error) => {
        logger.error('Uncaught Exception', {
            error: error.message,
            stack: error.stack,
            pid: process.pid
        });
        
        // Give time for logs to flush
        setTimeout(() => {
            process.exit(1);
        }, 1000);
    });

    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
        logger.error('Unhandled Rejection', {
            reason: reason instanceof Error ? reason.message : String(reason),
            stack: reason instanceof Error ? reason.stack : undefined,
            promise: promise.toString(),
            pid: process.pid
        });
        
        // Give time for logs to flush
        setTimeout(() => {
            process.exit(1);
        }, 1000);
    });

    process.on('SIGTERM', () => {
        logger.info('SIGTERM received, shutting down gracefully');
        process.exit(0);
    });

    process.on('SIGINT', () => {
        logger.info('SIGINT received, shutting down gracefully');
        process.exit(0);
    });
};
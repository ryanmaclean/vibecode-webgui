import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        username: string;
        role: string;
        permissions: string[];
    };
    apiKey?: string;
}

export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
        const authHeader = req.headers.authorization;
        const apiKey = req.headers['x-api-key'] as string;

        // Check for API key authentication
        if (apiKey) {
            if (validateApiKey(apiKey)) {
                req.apiKey = apiKey;
                req.user = {
                    id: 'api-user',
                    username: 'api-user',
                    role: 'api',
                    permissions: ['ai:access']
                };

                logger.debug('API key authentication successful', {
                    apiKey: apiKey.substring(0, 8) + '...'
                });

                return next();
            } else {
                logger.warn('Invalid API key provided', {
                    apiKey: apiKey.substring(0, 8) + '...',
                    ip: req.ip
                });

                res.status(401).json({
                    error: 'Invalid API key',
                    code: 'INVALID_API_KEY',
                    timestamp: new Date().toISOString()
                });
                return;
            }
        }

        // Check for JWT authentication
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);

            try {
                const decoded = jwt.verify(token, config.auth.jwtSecret) as any;
                req.user = {
                    id: decoded.sub || decoded.id,
                    username: decoded.username,
                    role: decoded.role || 'user',
                    permissions: decoded.permissions || ['ai:access']
                };

                logger.debug('JWT authentication successful', {
                    userId: req.user.id,
                    username: req.user.username
                });

                return next();
            } catch (jwtError) {
                logger.warn('Invalid JWT token', {
                    error: jwtError instanceof Error ? jwtError.message : 'Unknown JWT error',
                    ip: req.ip
                });

                res.status(401).json({
                    error: 'Invalid or expired token',
                    code: 'INVALID_TOKEN',
                    timestamp: new Date().toISOString()
                });
                return;
            }
        }

        // No valid authentication provided
        logger.warn('No authentication provided', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path
        });

        res.status(401).json({
            error: 'Authentication required',
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Please provide a valid API key or JWT token',
            timestamp: new Date().toISOString()
        });
        return;
    } catch (error) {
        logger.error('Authentication middleware error', { error });
        res.status(500).json({
            error: 'Internal authentication error',
            code: 'AUTH_ERROR',
            timestamp: new Date().toISOString()
        });
        return;
    }
};

export const requirePermission = (permission: string) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                error: 'Authentication required',
                code: 'AUTHENTICATION_REQUIRED',
                timestamp: new Date().toISOString()
            });
            return;
        }

        if (!req.user.permissions.includes(permission) && !req.user.permissions.includes('*')) {
            logger.warn('Insufficient permissions', {
                userId: req.user.id,
                requiredPermission: permission,
                userPermissions: req.user.permissions
            });

            res.status(403).json({
                error: 'Insufficient permissions',
                code: 'INSUFFICIENT_PERMISSIONS',
                required: permission,
                timestamp: new Date().toISOString()
            });
            return;
        }

        next();
    };
};

export const requireRole = (role: string) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                error: 'Authentication required',
                code: 'AUTHENTICATION_REQUIRED',
                timestamp: new Date().toISOString()
            });
            return;
        }

        if (req.user.role !== role && req.user.role !== 'admin') {
            logger.warn('Insufficient role', {
                userId: req.user.id,
                requiredRole: role,
                userRole: req.user.role
            });

            res.status(403).json({
                error: 'Insufficient role',
                code: 'INSUFFICIENT_ROLE',
                required: role,
                current: req.user.role,
                timestamp: new Date().toISOString()
            });
            return;
        }

        next();
    };
};

function validateApiKey(apiKey: string): boolean {
    if (!apiKey) return false;

    // Check against configured API keys
    if (config.auth.apiKeys.length > 0) {
        return config.auth.apiKeys.includes(apiKey);
    }

    // If no API keys configured, accept any key for development
    if (config.environment === 'development') {
        return apiKey.length >= 32; // Minimum length check
    }

    return false;
}

export const generateApiKey = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'vbai_'; // VibeCode AI prefix

    for (let i = 0; i < 48; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return result;
};

export const generateJWT = (payload: any, expiresIn?: string): string => {
    const exp = expiresIn || config.auth.jwtExpiration;
    return jwt.sign(payload, config.auth.jwtSecret, { expiresIn: exp } as any);
};

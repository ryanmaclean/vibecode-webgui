"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateJWT = exports.generateApiKey = exports.requireRole = exports.requirePermission = exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const environment_1 = require("../config/environment");
const logger_1 = require("../utils/logger");
const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const apiKey = req.headers['x-api-key'];
        if (apiKey) {
            if (validateApiKey(apiKey)) {
                req.apiKey = apiKey;
                req.user = {
                    id: 'api-user',
                    username: 'api-user',
                    role: 'api',
                    permissions: ['ai:access']
                };
                logger_1.logger.debug('API key authentication successful', {
                    apiKey: apiKey.substring(0, 8) + '...'
                });
                return next();
            }
            else {
                logger_1.logger.warn('Invalid API key provided', {
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
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            try {
                const decoded = jsonwebtoken_1.default.verify(token, environment_1.config.auth.jwtSecret);
                req.user = {
                    id: decoded.sub || decoded.id,
                    username: decoded.username,
                    role: decoded.role || 'user',
                    permissions: decoded.permissions || ['ai:access']
                };
                logger_1.logger.debug('JWT authentication successful', {
                    userId: req.user.id,
                    username: req.user.username
                });
                return next();
            }
            catch (jwtError) {
                logger_1.logger.warn('Invalid JWT token', {
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
        logger_1.logger.warn('No authentication provided', {
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
    }
    catch (error) {
        logger_1.logger.error('Authentication middleware error', { error });
        res.status(500).json({
            error: 'Internal authentication error',
            code: 'AUTH_ERROR',
            timestamp: new Date().toISOString()
        });
        return;
    }
};
exports.authMiddleware = authMiddleware;
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                error: 'Authentication required',
                code: 'AUTHENTICATION_REQUIRED',
                timestamp: new Date().toISOString()
            });
            return;
        }
        if (!req.user.permissions.includes(permission) && !req.user.permissions.includes('*')) {
            logger_1.logger.warn('Insufficient permissions', {
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
exports.requirePermission = requirePermission;
const requireRole = (role) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                error: 'Authentication required',
                code: 'AUTHENTICATION_REQUIRED',
                timestamp: new Date().toISOString()
            });
            return;
        }
        if (req.user.role !== role && req.user.role !== 'admin') {
            logger_1.logger.warn('Insufficient role', {
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
exports.requireRole = requireRole;
function validateApiKey(apiKey) {
    if (!apiKey)
        return false;
    if (environment_1.config.auth.apiKeys.length > 0) {
        return environment_1.config.auth.apiKeys.includes(apiKey);
    }
    if (environment_1.config.environment === 'development') {
        return apiKey.length >= 32;
    }
    return false;
}
const generateApiKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'vbai_';
    for (let i = 0; i < 48; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};
exports.generateApiKey = generateApiKey;
const generateJWT = (payload, expiresIn) => {
    const exp = expiresIn || environment_1.config.auth.jwtExpiration;
    return jsonwebtoken_1.default.sign(payload, environment_1.config.auth.jwtSecret, { expiresIn: exp });
};
exports.generateJWT = generateJWT;
//# sourceMappingURL=auth.js.map
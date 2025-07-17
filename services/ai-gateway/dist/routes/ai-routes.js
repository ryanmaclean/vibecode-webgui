"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiRoutes = void 0;
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const ai_controller_1 = require("../controllers/ai-controller");
const auth_1 = require("../middleware/auth");
const error_handler_1 = require("../middleware/error-handler");
const validation_1 = require("../middleware/validation");
const router = (0, express_1.Router)();
exports.aiRoutes = router;
const aiController = new ai_controller_1.AIController();
router.post('/chat/completions', (0, auth_1.requirePermission)('ai:access'), [
    (0, express_validator_1.body)('model').isString().notEmpty().withMessage('Model is required'),
    (0, express_validator_1.body)('messages').isArray({ min: 1 }).withMessage('Messages array is required'),
    (0, express_validator_1.body)('messages.*.role').isIn(['system', 'user', 'assistant']).withMessage('Invalid message role'),
    (0, express_validator_1.body)('messages.*.content').isString().notEmpty().withMessage('Message content is required'),
    (0, express_validator_1.body)('max_tokens').optional().isInt({ min: 1, max: 32000 }).withMessage('Max tokens must be between 1 and 32000'),
    (0, express_validator_1.body)('temperature').optional().isFloat({ min: 0, max: 2 }).withMessage('Temperature must be between 0 and 2'),
    (0, express_validator_1.body)('top_p').optional().isFloat({ min: 0, max: 1 }).withMessage('Top_p must be between 0 and 1'),
    (0, express_validator_1.body)('frequency_penalty').optional().isFloat({ min: -2, max: 2 }).withMessage('Frequency penalty must be between -2 and 2'),
    (0, express_validator_1.body)('presence_penalty').optional().isFloat({ min: -2, max: 2 }).withMessage('Presence penalty must be between -2 and 2'),
    (0, express_validator_1.body)('stream').optional().isBoolean().withMessage('Stream must be a boolean'),
    (0, express_validator_1.body)('stop').optional().isArray().withMessage('Stop must be an array'),
    (0, express_validator_1.body)('user').optional().isString().withMessage('User must be a string')
], validation_1.validationMiddleware, (0, error_handler_1.asyncHandler)(aiController.chatCompletion.bind(aiController)));
router.post('/chat/completions/stream', (0, auth_1.requirePermission)('ai:access'), [
    (0, express_validator_1.body)('model').isString().notEmpty().withMessage('Model is required'),
    (0, express_validator_1.body)('messages').isArray({ min: 1 }).withMessage('Messages array is required'),
    (0, express_validator_1.body)('messages.*.role').isIn(['system', 'user', 'assistant']).withMessage('Invalid message role'),
    (0, express_validator_1.body)('messages.*.content').isString().notEmpty().withMessage('Message content is required'),
    (0, express_validator_1.body)('max_tokens').optional().isInt({ min: 1, max: 32000 }).withMessage('Max tokens must be between 1 and 32000'),
    (0, express_validator_1.body)('temperature').optional().isFloat({ min: 0, max: 2 }).withMessage('Temperature must be between 0 and 2'),
    (0, express_validator_1.body)('top_p').optional().isFloat({ min: 0, max: 1 }).withMessage('Top_p must be between 0 and 1'),
    (0, express_validator_1.body)('user').optional().isString().withMessage('User must be a string')
], validation_1.validationMiddleware, (0, error_handler_1.asyncHandler)(aiController.streamChatCompletion.bind(aiController)));
router.get('/models', (0, auth_1.requirePermission)('ai:access'), [
    (0, express_validator_1.query)('provider').optional().isString().withMessage('Provider must be a string'),
    (0, express_validator_1.query)('price_min').optional().isFloat({ min: 0 }).withMessage('Minimum price must be non-negative'),
    (0, express_validator_1.query)('price_max').optional().isFloat({ min: 0 }).withMessage('Maximum price must be non-negative'),
    (0, express_validator_1.query)('context_min').optional().isInt({ min: 1 }).withMessage('Minimum context length must be positive'),
    (0, express_validator_1.query)('healthy_only').optional().isBoolean().withMessage('Healthy only must be a boolean')
], validation_1.validationMiddleware, (0, error_handler_1.asyncHandler)(aiController.getModels.bind(aiController)));
router.get('/models/:modelId', (0, auth_1.requirePermission)('ai:access'), [
    (0, express_validator_1.param)('modelId').isString().notEmpty().withMessage('Model ID is required')
], validation_1.validationMiddleware, (0, error_handler_1.asyncHandler)(aiController.getModel.bind(aiController)));
router.post('/models/recommend', (0, auth_1.requirePermission)('ai:access'), [
    (0, express_validator_1.body)('task').isIn(['chat', 'code', 'analysis', 'creative', 'general']).withMessage('Invalid task type'),
    (0, express_validator_1.body)('max_cost').optional().isFloat({ min: 0 }).withMessage('Max cost must be non-negative'),
    (0, express_validator_1.body)('min_performance').optional().isFloat({ min: 0, max: 1 }).withMessage('Min performance must be between 0 and 1'),
    (0, express_validator_1.body)('preferred_providers').optional().isArray().withMessage('Preferred providers must be an array'),
    (0, express_validator_1.body)('exclude_models').optional().isArray().withMessage('Exclude models must be an array'),
    (0, express_validator_1.body)('require_features').optional().isArray().withMessage('Required features must be an array'),
    (0, express_validator_1.body)('limit').optional().isInt({ min: 1, max: 10 }).withMessage('Limit must be between 1 and 10')
], validation_1.validationMiddleware, (0, error_handler_1.asyncHandler)(aiController.getModelRecommendations.bind(aiController)));
router.get('/models/:modelId/metrics', (0, auth_1.requirePermission)('ai:access'), [
    (0, express_validator_1.param)('modelId').isString().notEmpty().withMessage('Model ID is required')
], validation_1.validationMiddleware, (0, error_handler_1.asyncHandler)(aiController.getModelMetrics.bind(aiController)));
router.get('/usage', (0, auth_1.requirePermission)('ai:usage'), [
    (0, express_validator_1.query)('start_date').optional().isISO8601().withMessage('Start date must be valid ISO8601 format'),
    (0, express_validator_1.query)('end_date').optional().isISO8601().withMessage('End date must be valid ISO8601 format'),
    (0, express_validator_1.query)('user_id').optional().isString().withMessage('User ID must be a string'),
    (0, express_validator_1.query)('model').optional().isString().withMessage('Model must be a string'),
    (0, express_validator_1.query)('groupby').optional().isIn(['user', 'model', 'date']).withMessage('Invalid groupby value')
], validation_1.validationMiddleware, (0, error_handler_1.asyncHandler)(aiController.getUsageStatistics.bind(aiController)));
router.get('/usage/costs', (0, auth_1.requirePermission)('ai:usage'), [
    (0, express_validator_1.query)('start_date').optional().isISO8601().withMessage('Start date must be valid ISO8601 format'),
    (0, express_validator_1.query)('end_date').optional().isISO8601().withMessage('End date must be valid ISO8601 format'),
    (0, express_validator_1.query)('user_id').optional().isString().withMessage('User ID must be a string'),
    (0, express_validator_1.query)('breakdown').optional().isIn(['user', 'model', 'provider']).withMessage('Invalid breakdown value')
], validation_1.validationMiddleware, (0, error_handler_1.asyncHandler)(aiController.getCostAnalysis.bind(aiController)));
router.post('/validate', [
    (0, express_validator_1.body)('api_key').optional().isString().withMessage('API key must be a string'),
    (0, express_validator_1.body)('jwt_token').optional().isString().withMessage('JWT token must be a string')
], validation_1.validationMiddleware, (0, error_handler_1.asyncHandler)(aiController.validateCredentials.bind(aiController)));
router.get('/status', (0, auth_1.requirePermission)('ai:access'), (0, error_handler_1.asyncHandler)(aiController.getServiceStatus.bind(aiController)));
router.post('/models/refresh', (0, auth_1.requirePermission)('ai:admin'), (0, error_handler_1.asyncHandler)(aiController.refreshModels.bind(aiController)));
router.delete('/cache', (0, auth_1.requirePermission)('ai:admin'), [
    (0, express_validator_1.query)('pattern').optional().isString().withMessage('Pattern must be a string')
], validation_1.validationMiddleware, (0, error_handler_1.asyncHandler)(aiController.clearCache.bind(aiController)));
//# sourceMappingURL=ai-routes.js.map

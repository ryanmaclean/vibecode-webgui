import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { AIController } from '../controllers/ai-controller';
import { requirePermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/error-handler';
import { validationMiddleware } from '../middleware/validation';

const router = Router();
const aiController = new AIController();

// Chat completion endpoint
router.post('/chat/completions',
    requirePermission('ai:access'),
    [
        body('model').isString().notEmpty().withMessage('Model is required'),
        body('messages').isArray({ min: 1 }).withMessage('Messages array is required'),
        body('messages.*.role').isIn(['system', 'user', 'assistant']).withMessage('Invalid message role'),
        body('messages.*.content').isString().notEmpty().withMessage('Message content is required'),
        body('max_tokens').optional().isInt({ min: 1, max: 32000 }).withMessage('Max tokens must be between 1 and 32000'),
        body('temperature').optional().isFloat({ min: 0, max: 2 }).withMessage('Temperature must be between 0 and 2'),
        body('top_p').optional().isFloat({ min: 0, max: 1 }).withMessage('Top_p must be between 0 and 1'),
        body('frequency_penalty').optional().isFloat({ min: -2, max: 2 }).withMessage('Frequency penalty must be between -2 and 2'),
        body('presence_penalty').optional().isFloat({ min: -2, max: 2 }).withMessage('Presence penalty must be between -2 and 2'),
        body('stream').optional().isBoolean().withMessage('Stream must be a boolean'),
        body('stop').optional().isArray().withMessage('Stop must be an array'),
        body('user').optional().isString().withMessage('User must be a string')
    ],
    validationMiddleware,
    asyncHandler(aiController.chatCompletion.bind(aiController))
);

// Streaming chat completion endpoint
router.post('/chat/completions/stream',
    requirePermission('ai:access'),
    [
        body('model').isString().notEmpty().withMessage('Model is required'),
        body('messages').isArray({ min: 1 }).withMessage('Messages array is required'),
        body('messages.*.role').isIn(['system', 'user', 'assistant']).withMessage('Invalid message role'),
        body('messages.*.content').isString().notEmpty().withMessage('Message content is required'),
        body('max_tokens').optional().isInt({ min: 1, max: 32000 }).withMessage('Max tokens must be between 1 and 32000'),
        body('temperature').optional().isFloat({ min: 0, max: 2 }).withMessage('Temperature must be between 0 and 2'),
        body('top_p').optional().isFloat({ min: 0, max: 1 }).withMessage('Top_p must be between 0 and 1'),
        body('user').optional().isString().withMessage('User must be a string')
    ],
    validationMiddleware,
    asyncHandler(aiController.streamChatCompletion.bind(aiController))
);

// Get available models
router.get('/models',
    requirePermission('ai:access'),
    [
        query('provider').optional().isString().withMessage('Provider must be a string'),
        query('price_min').optional().isFloat({ min: 0 }).withMessage('Minimum price must be non-negative'),
        query('price_max').optional().isFloat({ min: 0 }).withMessage('Maximum price must be non-negative'),
        query('context_min').optional().isInt({ min: 1 }).withMessage('Minimum context length must be positive'),
        query('healthy_only').optional().isBoolean().withMessage('Healthy only must be a boolean')
    ],
    validationMiddleware,
    asyncHandler(aiController.getModels.bind(aiController))
);

// Get specific model information
router.get('/models/:modelId',
    requirePermission('ai:access'),
    [
        param('modelId').isString().notEmpty().withMessage('Model ID is required')
    ],
    validationMiddleware,
    asyncHandler(aiController.getModel.bind(aiController))
);

// Get model recommendations
router.post('/models/recommend',
    requirePermission('ai:access'),
    [
        body('task').isIn(['chat', 'code', 'analysis', 'creative', 'general']).withMessage('Invalid task type'),
        body('max_cost').optional().isFloat({ min: 0 }).withMessage('Max cost must be non-negative'),
        body('min_performance').optional().isFloat({ min: 0, max: 1 }).withMessage('Min performance must be between 0 and 1'),
        body('preferred_providers').optional().isArray().withMessage('Preferred providers must be an array'),
        body('exclude_models').optional().isArray().withMessage('Exclude models must be an array'),
        body('require_features').optional().isArray().withMessage('Required features must be an array'),
        body('limit').optional().isInt({ min: 1, max: 10 }).withMessage('Limit must be between 1 and 10')
    ],
    validationMiddleware,
    asyncHandler(aiController.getModelRecommendations.bind(aiController))
);

// Get model performance metrics
router.get('/models/:modelId/metrics',
    requirePermission('ai:access'),
    [
        param('modelId').isString().notEmpty().withMessage('Model ID is required')
    ],
    validationMiddleware,
    asyncHandler(aiController.getModelMetrics.bind(aiController))
);

// Get usage statistics
router.get('/usage',
    requirePermission('ai:usage'),
    [
        query('start_date').optional().isISO8601().withMessage('Start date must be valid ISO8601 format'),
        query('end_date').optional().isISO8601().withMessage('End date must be valid ISO8601 format'),
        query('user_id').optional().isString().withMessage('User ID must be a string'),
        query('model').optional().isString().withMessage('Model must be a string'),
        query('groupby').optional().isIn(['user', 'model', 'date']).withMessage('Invalid groupby value')
    ],
    validationMiddleware,
    asyncHandler(aiController.getUsageStatistics.bind(aiController))
);

// Get cost analysis
router.get('/usage/costs',
    requirePermission('ai:usage'),
    [
        query('start_date').optional().isISO8601().withMessage('Start date must be valid ISO8601 format'),
        query('end_date').optional().isISO8601().withMessage('End date must be valid ISO8601 format'),
        query('user_id').optional().isString().withMessage('User ID must be a string'),
        query('breakdown').optional().isIn(['user', 'model', 'provider']).withMessage('Invalid breakdown value')
    ],
    validationMiddleware,
    asyncHandler(aiController.getCostAnalysis.bind(aiController))
);

// Validate API key endpoint
router.post('/validate',
    [
        body('api_key').optional().isString().withMessage('API key must be a string'),
        body('jwt_token').optional().isString().withMessage('JWT token must be a string')
    ],
    validationMiddleware,
    asyncHandler(aiController.validateCredentials.bind(aiController))
);

// Get service status
router.get('/status',
    requirePermission('ai:access'),
    asyncHandler(aiController.getServiceStatus.bind(aiController))
);

// Refresh models cache
router.post('/models/refresh',
    requirePermission('ai:admin'),
    asyncHandler(aiController.refreshModels.bind(aiController))
);

// Clear cache
router.delete('/cache',
    requirePermission('ai:admin'),
    [
        query('pattern').optional().isString().withMessage('Pattern must be a string')
    ],
    validationMiddleware,
    asyncHandler(aiController.clearCache.bind(aiController))
);

export { router as aiRoutes };

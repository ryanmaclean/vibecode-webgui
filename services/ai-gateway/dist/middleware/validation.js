"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validationMiddleware = void 0;
const express_validator_1 = require("express-validator");
const error_handler_1 = require("./error-handler");
const validationMiddleware = (req, _res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        const validationErrors = errors.array().map(error => ({
            field: error.type === 'field' ? error.path : error.type,
            message: error.msg,
            value: error.type === 'field' ? error.value : undefined
        }));
        throw new error_handler_1.ValidationError('Validation failed', {
            errors: validationErrors,
            count: validationErrors.length
        });
    }
    next();
};
exports.validationMiddleware = validationMiddleware;
//# sourceMappingURL=validation.js.map

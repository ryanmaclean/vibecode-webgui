import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { ValidationError } from './error-handler';

export const validationMiddleware = (
    req: Request,
    _res: Response,
    next: NextFunction
): void => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const validationErrors = errors.array().map(error => {
            if (error.type === 'field') {
                const fieldError = error as { type: 'field'; path: string; value: unknown; msg: string };
                return {
                    field: fieldError.path,
                    message: fieldError.msg,
                    value: fieldError.value
                };
            }
            return {
                field: error.type,
                message: error.msg,
                value: undefined
            };
        });

        throw new ValidationError('Validation failed', {
            errors: validationErrors,
            count: validationErrors.length
        });
    }

    next();
};

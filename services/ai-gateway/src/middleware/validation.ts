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
        const validationErrors = errors.array().map(error => ({
            field: error.type === 'field' ? (error as any).path : error.type,
            message: error.msg,
            value: error.type === 'field' ? (error as any).value : undefined
        }));

        throw new ValidationError('Validation failed', {
            errors: validationErrors,
            count: validationErrors.length
        });
    }

    next();
};

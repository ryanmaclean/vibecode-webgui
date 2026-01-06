// src/errorHandler.ts
import * as vscode from 'vscode';
import { Logger } from './logger';

export class ErrorHandler {
    private logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    /**
     * Wrap async operations with standardized error handling
     */
    async wrapAsync<T>(
        operation: () => Promise<T>,
        context: string,
        options?: {
            showError?: boolean;
            rethrow?: boolean;
            fallback?: T;
        }
    ): Promise<T | undefined> {
        try {
            return await operation();
        } catch (error: any) {
            return this.handleError(error, context, options);
        }
    }

    /**
     * Handle errors with logging and optional user notification
     */
    handleError<T>(
        error: any,
        context: string,
        options?: {
            showError?: boolean;
            rethrow?: boolean;
            fallback?: T;
        }
    ): T | undefined {
        const { showError = true, rethrow = false, fallback } = options || {};

        // Log the error with context
        this.logger.error(`Error in ${context}`, {
            message: error.message,
            stack: error.stack,
            code: error.code,
            name: error.name
        });

        // Categorize error
        const category = this.categorizeError(error);
        const userMessage = this.getUserMessage(error, category, context);

        // Show error to user if requested
        if (showError) {
            switch (category) {
                case 'NETWORK':
                    vscode.window.showErrorMessage(
                        `Network error: ${userMessage}`,
                        'Retry',
                        'Check Settings'
                    ).then(selection => {
                        if (selection === 'Check Settings') {
                            vscode.commands.executeCommand('workbench.action.openSettings', 'workspaceRag');
                        }
                    });
                    break;
                
                case 'AUTH':
                    vscode.window.showErrorMessage(
                        `Authentication error: ${userMessage}`,
                        'Set API Key'
                    ).then(selection => {
                        if (selection === 'Set API Key') {
                            vscode.commands.executeCommand('workspace-rag.setApiKey');
                        }
                    });
                    break;
                
                case 'RATE_LIMIT':
                    vscode.window.showWarningMessage(
                        `Rate limit: ${userMessage}. Please wait a moment.`
                    );
                    break;
                
                case 'DATABASE':
                    vscode.window.showErrorMessage(
                        `Database error: ${userMessage}`,
                        'Check Database'
                    );
                    break;
                
                default:
                    vscode.window.showErrorMessage(userMessage);
            }
        }

        // Rethrow if requested
        if (rethrow) {
            throw error;
        }

        // Return fallback if provided
        if (fallback !== undefined) {
            return fallback;
        }

        return undefined;
    }

    /**
     * Categorize error for appropriate handling
     */
    private categorizeError(error: any): ErrorCategory {
        // Network errors
        if (error.code === 'ENOTFOUND' || 
            error.code === 'ECONNREFUSED' || 
            error.code === 'ETIMEDOUT' ||
            error.message?.includes('fetch failed')) {
            return 'NETWORK';
        }

        // Authentication errors
        if (error.status === 401 || 
            error.status === 403 ||
            error.message?.includes('API key') ||
            error.message?.includes('authentication')) {
            return 'AUTH';
        }

        // Rate limiting
        if (error.status === 429 ||
            error.message?.includes('rate limit')) {
            return 'RATE_LIMIT';
        }

        // Database errors
        if (error.code?.startsWith('PG') ||
            error.message?.includes('database') ||
            error.message?.includes('postgres')) {
            return 'DATABASE';
        }

        // Validation errors
        if (error.message?.includes('validation') ||
            error.message?.includes('invalid')) {
            return 'VALIDATION';
        }

        return 'UNKNOWN';
    }

    /**
     * Get user-friendly error message
     */
    private getUserMessage(error: any, category: ErrorCategory, context: string): string {
        // Sanitize error message (remove sensitive data)
        let message = error.message || 'An unexpected error occurred';
        message = message.replace(/sk-[a-zA-Z0-9]+/g, 'sk-***');
        message = message.replace(/Bearer [a-zA-Z0-9]+/g, 'Bearer ***');

        switch (category) {
            case 'NETWORK':
                return 'Cannot connect to the service. Check your internet connection.';
            
            case 'AUTH':
                return 'Authentication failed. Please check your API key.';
            
            case 'RATE_LIMIT':
                return 'Too many requests. Please wait a moment before trying again.';
            
            case 'DATABASE':
                return 'Database connection failed. Check your PostgreSQL configuration.';
            
            case 'VALIDATION':
                return message;
            
            default:
                return `${context}: ${message}`;
        }
    }

    /**
     * Create retry wrapper with exponential backoff
     */
    async withRetry<T>(
        operation: () => Promise<T>,
        options?: {
            maxRetries?: number;
            baseDelay?: number;
            maxDelay?: number;
            onRetry?: (attempt: number, error: any) => void;
        }
    ): Promise<T> {
        const {
            maxRetries = 3,
            baseDelay = 1000,
            maxDelay = 10000,
            onRetry
        } = options || {};

        let lastError: any;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error: any) {
                lastError = error;

                // Don't retry on non-retryable errors
                if (!this.isRetryable(error)) {
                    throw error;
                }

                // Don't retry on last attempt
                if (attempt === maxRetries - 1) {
                    break;
                }

                // Calculate delay with exponential backoff
                const delay = Math.min(
                    baseDelay * Math.pow(2, attempt),
                    maxDelay
                );

                this.logger.debug(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
                
                if (onRetry) {
                    onRetry(attempt + 1, error);
                }

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw lastError;
    }

    /**
     * Check if error is retryable
     */
    private isRetryable(error: any): boolean {
        // Network errors are retryable
        if (error.code === 'ECONNREFUSED' || 
            error.code === 'ETIMEDOUT') {
            return true;
        }

        // Rate limit errors are retryable
        if (error.status === 429) {
            return true;
        }

        // Server errors are retryable
        if (error.status >= 500) {
            return true;
        }

        return false;
    }
}

type ErrorCategory = 
    | 'NETWORK'
    | 'AUTH'
    | 'RATE_LIMIT'
    | 'DATABASE'
    | 'VALIDATION'
    | 'UNKNOWN';


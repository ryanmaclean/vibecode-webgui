// src/safeguards.ts
import * as vscode from 'vscode';
import { Logger } from './logger';

export class SafeguardManager {
    private logger: Logger;
    private requestCounts: Map<string, number[]> = new Map();
    private readonly rateLimitWindow = 60000; // 1 minute
    private readonly maxRequestsPerWindow = 60;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    /**
     * Check if a request should be rate limited
     */
    checkRateLimit(userId: string): boolean {
        const now = Date.now();
        const requests = this.requestCounts.get(userId) || [];
        
        // Remove old requests outside the window
        const recentRequests = requests.filter(
            timestamp => now - timestamp < this.rateLimitWindow
        );

        if (recentRequests.length >= this.maxRequestsPerWindow) {
            this.logger.warn(`Rate limit exceeded for user: ${userId}`);
            return false;
        }

        recentRequests.push(now);
        this.requestCounts.set(userId, recentRequests);
        return true;
    }

    /**
     * Validate query input
     */
    validateQuery(query: string): { valid: boolean; error?: string } {
        if (!query || query.trim().length === 0) {
            return { valid: false, error: 'Query cannot be empty' };
        }

        if (query.length > 10000) {
            return { valid: false, error: 'Query too long (max 10,000 characters)' };
        }

        // Check for potential injection attempts
        const suspiciousPatterns = [
            /<script/i,
            /javascript:/i,
            /on\w+\s*=/i // event handlers
        ];

        for (const pattern of suspiciousPatterns) {
            if (pattern.test(query)) {
                this.logger.warn(`Suspicious query pattern detected: ${pattern}`);
                return { valid: false, error: 'Query contains invalid characters' };
            }
        }

        return { valid: true };
    }

    /**
     * Validate file path
     */
    validateFilePath(filePath: string, workspaceRoot?: string): boolean {
        // Check for path traversal
        if (filePath.includes('..')) {
            this.logger.warn(`Path traversal attempt detected: ${filePath}`);
            return false;
        }

        // If workspace root provided, ensure file is within workspace
        if (workspaceRoot && !filePath.startsWith(workspaceRoot)) {
            this.logger.warn(`File outside workspace: ${filePath}`);
            return false;
        }

        return true;
    }

    /**
     * Validate database connection config
     */
    validateDatabaseConfig(config: any): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!config.host || typeof config.host !== 'string') {
            errors.push('Invalid or missing database host');
        }

        if (!config.port || typeof config.port !== 'number' || config.port < 1 || config.port > 65535) {
            errors.push('Invalid database port');
        }

        if (!config.user || typeof config.user !== 'string') {
            errors.push('Invalid or missing database user');
        }

        if (!config.database || typeof config.database !== 'string') {
            errors.push('Invalid or missing database name');
        }

        // Warn about insecure defaults
        if (config.password === 'postgres' || config.password === 'password') {
            this.logger.warn('Insecure default password detected');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Sanitize text for safe storage/display
     */
    sanitizeText(text: string): string {
        return text
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/\//g, '&#x2F;');
    }

    /**
     * Validate embedding vector
     */
    validateEmbedding(embedding: number[], expectedDim: number): boolean {
        if (!Array.isArray(embedding)) {
            this.logger.error('Embedding is not an array');
            return false;
        }

        if (embedding.length !== expectedDim) {
            this.logger.error(`Embedding dimension mismatch: expected ${expectedDim}, got ${embedding.length}`);
            return false;
        }

        if (!embedding.every(n => typeof n === 'number' && !isNaN(n) && isFinite(n))) {
            this.logger.error('Embedding contains invalid numbers');
            return false;
        }

        return true;
    }

    /**
     * Check if a file should be indexed
     */
    shouldIndexFile(filePath: string, stats: vscode.FileStat): boolean {
        // Skip files that are too large (>10MB)
        const maxSize = 10 * 1024 * 1024;
        if (stats.size > maxSize) {
            this.logger.debug(`Skipping large file: ${filePath} (${stats.size} bytes)`);
            return false;
        }

        // Skip binary files based on extension
        const binaryExtensions = [
            '.exe', '.dll', '.so', '.dylib', '.bin', '.dat',
            '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico',
            '.mp3', '.mp4', '.avi', '.mov', '.wav',
            '.zip', '.tar', '.gz', '.rar', '.7z',
            '.pdf', '.doc', '.docx', '.xls', '.xlsx'
        ];

        const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
        if (binaryExtensions.includes(ext)) {
            this.logger.debug(`Skipping binary file: ${filePath}`);
            return false;
        }

        return true;
    }

    /**
     * Validate API key format
     */
    validateApiKey(provider: string, apiKey: string): { valid: boolean; error?: string } {
        if (!apiKey || apiKey.trim().length === 0) {
            return { valid: false, error: 'API key cannot be empty' };
        }

        // Provider-specific validation
        switch (provider.toLowerCase()) {
            case 'openai':
                if (!apiKey.startsWith('sk-')) {
                    return { valid: false, error: 'OpenAI API keys should start with "sk-"' };
                }
                break;
            case 'anthropic':
                if (!apiKey.startsWith('sk-ant-')) {
                    return { valid: false, error: 'Anthropic API keys should start with "sk-ant-"' };
                }
                break;
        }

        if (apiKey.length < 20) {
            return { valid: false, error: 'API key seems too short' };
        }

        return { valid: true };
    }

    /**
     * Get safe error message for user display
     */
    getSafeErrorMessage(error: any): string {
        if (typeof error === 'string') {
            return error;
        }

        if (error?.message) {
            // Strip sensitive information
            let message = error.message;
            message = message.replace(/sk-[a-zA-Z0-9]+/g, 'sk-***');
            message = message.replace(/Bearer [a-zA-Z0-9]+/g, 'Bearer ***');
            return message;
        }

        return 'An unexpected error occurred';
    }
}


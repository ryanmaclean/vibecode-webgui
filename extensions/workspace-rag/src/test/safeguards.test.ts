// src/test/safeguards.test.ts
import * as assert from 'assert';
import { SafeguardManager } from '../safeguards';
import { Logger } from '../logger';

suite('SafeguardManager Test Suite', () => {
    let safeguards: SafeguardManager;
    let logger: Logger;

    setup(() => {
        logger = new Logger();
        safeguards = new SafeguardManager(logger);
    });

    suite('Query Validation', () => {
        test('should accept valid queries', () => {
            const result = safeguards.validateQuery('What is the main function?');
            assert.strictEqual(result.valid, true);
        });

        test('should reject empty queries', () => {
            const result = safeguards.validateQuery('');
            assert.strictEqual(result.valid, false);
            assert.ok(result.error);
        });

        test('should reject queries with whitespace only', () => {
            const result = safeguards.validateQuery('   ');
            assert.strictEqual(result.valid, false);
        });

        test('should reject overly long queries', () => {
            const longQuery = 'a'.repeat(10001);
            const result = safeguards.validateQuery(longQuery);
            assert.strictEqual(result.valid, false);
        });

        test('should reject queries with script tags', () => {
            const result = safeguards.validateQuery('<script>alert("xss")</script>');
            assert.strictEqual(result.valid, false);
        });

        test('should reject queries with event handlers', () => {
            const result = safeguards.validateQuery('<div onclick="alert()">test</div>');
            assert.strictEqual(result.valid, false);
        });
    });

    suite('File Path Validation', () => {
        test('should accept valid file paths', () => {
            const result = safeguards.validateFilePath('/workspace/src/file.ts');
            assert.strictEqual(result, true);
        });

        test('should reject path traversal attempts', () => {
            const result = safeguards.validateFilePath('/workspace/../etc/passwd');
            assert.strictEqual(result, false);
        });

        test('should reject files outside workspace', () => {
            const result = safeguards.validateFilePath('/etc/passwd', '/workspace');
            assert.strictEqual(result, false);
        });

        test('should accept files within workspace', () => {
            const result = safeguards.validateFilePath('/workspace/src/file.ts', '/workspace');
            assert.strictEqual(result, true);
        });
    });

    suite('Database Config Validation', () => {
        test('should accept valid config', () => {
            const config = {
                host: 'localhost',
                port: 5432,
                user: 'postgres',
                password: 'secure_password',
                database: 'rag_db'
            };
            const result = safeguards.validateDatabaseConfig(config);
            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.errors.length, 0);
        });

        test('should reject missing host', () => {
            const config = {
                port: 5432,
                user: 'postgres',
                database: 'rag_db'
            };
            const result = safeguards.validateDatabaseConfig(config);
            assert.strictEqual(result.valid, false);
            assert.ok(result.errors.some(e => e.includes('host')));
        });

        test('should reject invalid port', () => {
            const config = {
                host: 'localhost',
                port: 99999,
                user: 'postgres',
                database: 'rag_db'
            };
            const result = safeguards.validateDatabaseConfig(config);
            assert.strictEqual(result.valid, false);
        });
    });

    suite('Text Sanitization', () => {
        test('should sanitize HTML characters', () => {
            const input = '<div>Test & "quotes"</div>';
            const output = safeguards.sanitizeText(input);
            assert.ok(!output.includes('<'));
            assert.ok(!output.includes('>'));
            assert.ok(!output.includes('"'));
        });

        test('should not modify safe text', () => {
            const input = 'This is safe text';
            const output = safeguards.sanitizeText(input);
            assert.ok(output.includes('safe'));
        });
    });

    suite('Embedding Validation', () => {
        test('should accept valid embeddings', () => {
            const embedding = new Array(384).fill(0.5);
            const result = safeguards.validateEmbedding(embedding, 384);
            assert.strictEqual(result, true);
        });

        test('should reject wrong dimension', () => {
            const embedding = new Array(100).fill(0.5);
            const result = safeguards.validateEmbedding(embedding, 384);
            assert.strictEqual(result, false);
        });

        test('should reject non-array', () => {
            const result = safeguards.validateEmbedding({} as any, 384);
            assert.strictEqual(result, false);
        });

        test('should reject NaN values', () => {
            const embedding = new Array(384).fill(0.5);
            embedding[10] = NaN;
            const result = safeguards.validateEmbedding(embedding, 384);
            assert.strictEqual(result, false);
        });

        test('should reject Infinity values', () => {
            const embedding = new Array(384).fill(0.5);
            embedding[10] = Infinity;
            const result = safeguards.validateEmbedding(embedding, 384);
            assert.strictEqual(result, false);
        });
    });

    suite('API Key Validation', () => {
        test('should accept valid OpenAI key', () => {
            const result = safeguards.validateApiKey('openai', 'sk-1234567890abcdefghijklmnopqrstuvwxyz');
            assert.strictEqual(result.valid, true);
        });

        test('should reject OpenAI key without sk- prefix', () => {
            const result = safeguards.validateApiKey('openai', '1234567890abcdefghijklmnopqrstuvwxyz');
            assert.strictEqual(result.valid, false);
        });

        test('should accept valid Anthropic key', () => {
            const result = safeguards.validateApiKey('anthropic', 'sk-ant-1234567890abcdefghijklmnopqrstuvwxyz');
            assert.strictEqual(result.valid, true);
        });

        test('should reject short keys', () => {
            const result = safeguards.validateApiKey('openai', 'sk-short');
            assert.strictEqual(result.valid, false);
        });

        test('should reject empty keys', () => {
            const result = safeguards.validateApiKey('openai', '');
            assert.strictEqual(result.valid, false);
        });
    });

    suite('Rate Limiting', () => {
        test('should allow requests under limit', () => {
            const userId = 'test-user-1';
            for (let i = 0; i < 50; i++) {
                const allowed = safeguards.checkRateLimit(userId);
                assert.strictEqual(allowed, true);
            }
        });

        test('should block requests over limit', () => {
            const userId = 'test-user-2';
            let blocked = false;
            for (let i = 0; i < 70; i++) {
                const allowed = safeguards.checkRateLimit(userId);
                if (!allowed) {
                    blocked = true;
                    break;
                }
            }
            assert.strictEqual(blocked, true);
        });
    });

    suite('Safe Error Messages', () => {
        test('should strip API keys from errors', () => {
            const error = new Error('Failed with key sk-1234567890abcdefg');
            const safe = safeguards.getSafeErrorMessage(error);
            assert.ok(!safe.includes('sk-1234567890'));
            assert.ok(safe.includes('sk-***'));
        });

        test('should strip Bearer tokens', () => {
            const error = new Error('Unauthorized Bearer abc123xyz789');
            const safe = safeguards.getSafeErrorMessage(error);
            assert.ok(!safe.includes('abc123xyz789'));
            assert.ok(safe.includes('Bearer ***'));
        });

        test('should handle string errors', () => {
            const safe = safeguards.getSafeErrorMessage('Simple error');
            assert.strictEqual(safe, 'Simple error');
        });
    });
});


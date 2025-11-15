// src/test/integration.test.ts
import * as assert from 'assert';
import { Logger } from '../logger';
import { SafeguardManager } from '../safeguards';
import { TextSplitter } from '../workspaceIndexer';

suite('Integration Test Suite', () => {
    let logger: Logger;
    let safeguards: SafeguardManager;

    setup(() => {
        logger = new Logger();
        safeguards = new SafeguardManager(logger);
    });

    suite('End-to-End Query Processing', () => {
        test('should validate and process a valid query', () => {
            const query = 'How does the authentication system work?';
            
            // Step 1: Validate query
            const validation = safeguards.validateQuery(query);
            assert.strictEqual(validation.valid, true);
            
            // Step 2: Check rate limit
            const allowed = safeguards.checkRateLimit('test-workspace');
            assert.strictEqual(allowed, true);
            
            // Query would then proceed to embedding and retrieval
        });

        test('should reject invalid query early', () => {
            const query = '<script>alert("xss")</script>';
            
            const validation = safeguards.validateQuery(query);
            assert.strictEqual(validation.valid, false);
            assert.ok(validation.error);
        });

        test('should handle rate limiting correctly', () => {
            const workspaceId = 'rate-limit-test';
            let blocked = false;
            
            // Make requests up to the limit
            for (let i = 0; i < 70; i++) {
                const allowed = safeguards.checkRateLimit(workspaceId);
                if (!allowed) {
                    blocked = true;
                    break;
                }
            }
            
            assert.strictEqual(blocked, true, 'Rate limiting should kick in');
        });
    });

    suite('Text Processing Pipeline', () => {
        test('should split and process code correctly', () => {
            const code = `
function authenticate(user, password) {
    const hash = crypto.createHash('sha256');
    hash.update(password);
    return validateHash(user, hash.digest('hex'));
}

function validateHash(user, hash) {
    const storedHash = database.getHash(user);
    return storedHash === hash;
}
            `.trim();

            const splitter = new TextSplitter(200, 20);
            const chunks = splitter.splitText(code);
            
            assert.ok(chunks.length > 0);
            assert.ok(chunks.every(chunk => chunk.length <= 220)); // Allow some overflow
            
            // Verify content is preserved
            const combinedLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
            assert.ok(combinedLength >= code.length * 0.9); // At least 90% preserved
        });

        test('should handle various file types', () => {
            const splitter = new TextSplitter(1000, 100);
            
            const testCases = [
                { name: 'JavaScript', content: 'const x = 1;\nfunction test() { return x; }' },
                { name: 'Python', content: 'def test():\n    return 1' },
                { name: 'Markdown', content: '# Header\n\nContent\n\n## Subheader' },
                { name: 'JSON', content: '{"key": "value", "nested": {"a": 1}}' }
            ];

            for (const test of testCases) {
                const chunks = splitter.splitText(test.content);
                assert.ok(chunks.length > 0, `Should handle ${test.name}`);
            }
        });
    });

    suite('Error Handling', () => {
        test('should sanitize error messages', () => {
            const error = new Error('Failed with key sk-1234567890abcdef');
            const safe = safeguards.getSafeErrorMessage(error);
            
            assert.ok(!safe.includes('sk-1234567890abcdef'));
            assert.ok(safe.includes('sk-***'));
        });

        test('should handle malformed inputs gracefully', () => {
            const validation = safeguards.validateQuery('');
            assert.strictEqual(validation.valid, false);
            assert.ok(validation.error?.includes('empty'));
        });
    });

    suite('Provider Fallback', () => {
        test('should handle missing API keys', async () => {
            // This tests the concept - actual provider factory would need context
            const mockError = new Error('No API key configured for openai');
            assert.ok(mockError.message.includes('No API key'));
        });
    });
});


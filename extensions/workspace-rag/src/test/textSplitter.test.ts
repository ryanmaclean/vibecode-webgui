// src/test/textSplitter.test.ts
import * as assert from 'assert';
import { TextSplitter } from '../workspaceIndexer';

suite('TextSplitter Test Suite', () => {
    let splitter: TextSplitter;

    setup(() => {
        splitter = new TextSplitter(100, 10);
    });

    test('should return single chunk for small text', () => {
        const text = 'This is a small piece of text.';
        const chunks = splitter.splitText(text);
        assert.strictEqual(chunks.length, 1);
        assert.strictEqual(chunks[0], text);
    });

    test('should split long text into multiple chunks', () => {
        const text = 'a'.repeat(500);
        const chunks = splitter.splitText(text);
        assert.ok(chunks.length > 1);
    });

    test('should respect chunk size limit', () => {
        const text = 'word '.repeat(100);
        const chunks = splitter.splitText(text);
        for (const chunk of chunks) {
            assert.ok(chunk.length <= 110); // Allow some overflow for word boundaries
        }
    });

    test('should handle code with functions', () => {
        const code = `
function test1() {
    return 1;
}

function test2() {
    return 2;
}

function test3() {
    return 3;
}
        `.trim();
        const chunks = splitter.splitText(code);
        assert.ok(chunks.length >= 1);
    });

    test('should handle markdown sections', () => {
        const markdown = `
# Section 1
Content 1

## Subsection 1.1
Content 1.1

# Section 2
Content 2
        `.trim();
        const chunks = splitter.splitText(markdown);
        assert.ok(chunks.length >= 1);
    });

    test('should handle empty input', () => {
        const chunks = splitter.splitText('');
        assert.strictEqual(chunks.length, 1);
        assert.strictEqual(chunks[0], '');
    });

    test('should preserve content integrity', () => {
        const text = 'Important content that should not be lost!';
        const chunks = splitter.splitText(text);
        const rejoined = chunks.join('');
        assert.ok(rejoined.includes('Important content'));
    });
});


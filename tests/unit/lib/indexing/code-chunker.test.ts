/**
 * Unit tests for code-chunker.ts
 * Tests intelligent code splitting and chunking functionality
 */

import { CodeChunker, CodeLanguage, ChunkingConfig } from '@/lib/indexing/code-chunker';
import { TokenCounter } from '@/lib/ai/context/token-counter';

// Mock TokenCounter
jest.mock('@/lib/ai/context/token-counter');

describe('CodeChunker', () => {
  let chunker: CodeChunker;
  let mockTokenCounter: jest.Mocked<TokenCounter>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock TokenCounter
    mockTokenCounter = {
      count: jest.fn(),
      dispose: jest.fn(),
      countBatch: jest.fn(),
      estimate: jest.fn(),
      countMessages: jest.fn(),
      getAvailableContextTokens: jest.fn(),
      fitsInContext: jest.fn(),
      truncateToFit: jest.fn(),
      splitIntoChunks: jest.fn(),
      estimateCost: jest.fn(),
      getCacheStats: jest.fn(),
      clearCache: jest.fn(),
      getModelConfig: jest.fn(),
    } as any;

    // Mock TokenCounter constructor
    (TokenCounter as jest.MockedClass<typeof TokenCounter>).mockImplementation(() => mockTokenCounter);

    chunker = new CodeChunker();
  });

  afterEach(() => {
    chunker.dispose();
  });

  describe('constructor', () => {
    it('should create a chunker with default configuration', () => {
      const chunker = new CodeChunker();
      expect(TokenCounter).toHaveBeenCalledWith();
      expect(chunker).toBeDefined();
    });

    it('should use custom configuration when provided', () => {
      const config: ChunkingConfig = {
        targetTokensPerChunk: 300,
        maxTokensPerChunk: 800,
        minTokensPerChunk: 100,
        overlapLines: 10,
        model: 'gpt-3.5-turbo',
      };

      const customChunker = new CodeChunker(config);
      expect(customChunker).toBeDefined();
      customChunker.dispose();
    });

    it('should use default values for missing config options', () => {
      const config: ChunkingConfig = {
        targetTokensPerChunk: 600,
      };

      const partialChunker = new CodeChunker(config);
      expect(partialChunker).toBeDefined();
      partialChunker.dispose();
    });
  });

  describe('detectLanguage', () => {
    it('should detect TypeScript from .ts extension', () => {
      expect(chunker.detectLanguage('src/app.ts')).toBe(CodeLanguage.TYPESCRIPT);
      expect(chunker.detectLanguage('components/Button.tsx')).toBe(CodeLanguage.TYPESCRIPT);
    });

    it('should detect JavaScript from .js extension', () => {
      expect(chunker.detectLanguage('src/app.js')).toBe(CodeLanguage.JAVASCRIPT);
      expect(chunker.detectLanguage('components/Button.jsx')).toBe(CodeLanguage.JAVASCRIPT);
    });

    it('should detect Python from .py extension', () => {
      expect(chunker.detectLanguage('main.py')).toBe(CodeLanguage.PYTHON);
    });

    it('should detect Go from .go extension', () => {
      expect(chunker.detectLanguage('server.go')).toBe(CodeLanguage.GO);
    });

    it('should detect Rust from .rs extension', () => {
      expect(chunker.detectLanguage('main.rs')).toBe(CodeLanguage.RUST);
    });

    it('should detect Java from .java extension', () => {
      expect(chunker.detectLanguage('Main.java')).toBe(CodeLanguage.JAVA);
    });

    it('should detect C++ from .cpp, .cc, .cxx extensions', () => {
      expect(chunker.detectLanguage('main.cpp')).toBe(CodeLanguage.CPP);
      expect(chunker.detectLanguage('main.cc')).toBe(CodeLanguage.CPP);
      expect(chunker.detectLanguage('main.cxx')).toBe(CodeLanguage.CPP);
      expect(chunker.detectLanguage('header.hpp')).toBe(CodeLanguage.CPP);
    });

    it('should detect C from .c and .h extensions', () => {
      expect(chunker.detectLanguage('main.c')).toBe(CodeLanguage.C);
      expect(chunker.detectLanguage('header.h')).toBe(CodeLanguage.C);
    });

    it('should detect Markdown from .md extension', () => {
      expect(chunker.detectLanguage('README.md')).toBe(CodeLanguage.MARKDOWN);
      expect(chunker.detectLanguage('docs/guide.markdown')).toBe(CodeLanguage.MARKDOWN);
    });

    it('should return UNKNOWN for unrecognized extensions', () => {
      expect(chunker.detectLanguage('file.txt')).toBe(CodeLanguage.UNKNOWN);
      expect(chunker.detectLanguage('config.yaml')).toBe(CodeLanguage.UNKNOWN);
    });

    it('should handle case-insensitive extensions', () => {
      expect(chunker.detectLanguage('Main.TS')).toBe(CodeLanguage.TYPESCRIPT);
      expect(chunker.detectLanguage('Main.PY')).toBe(CodeLanguage.PYTHON);
    });

    it('should handle paths without directory separators', () => {
      expect(chunker.detectLanguage('app.js')).toBe(CodeLanguage.JAVASCRIPT);
    });
  });

  describe('chunkFile', () => {
    it('should return empty array for empty file', () => {
      const chunks = chunker.chunkFile('empty.ts', '');
      expect(chunks).toEqual([]);
    });

    it('should return empty array for whitespace-only file', () => {
      const chunks = chunker.chunkFile('whitespace.ts', '   \n  \n  ');
      expect(chunks).toEqual([]);
    });

    it('should return single chunk for small file', () => {
      mockTokenCounter.count.mockReturnValue({
        count: 100,
        model: 'gpt-4',
        isExact: true,
        durationMs: 1,
        fromCache: false,
      });

      const content = 'const hello = "world";\nconsole.log(hello);';
      const chunks = chunker.chunkFile('small.ts', content);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toMatchObject({
        content,
        startLine: 1,
        endLine: 2,
        tokens: 100,
        language: CodeLanguage.TYPESCRIPT,
        hasImports: false,
      });
    });

    it('should detect and include imports in first chunk', () => {
      mockTokenCounter.count.mockReturnValue({
        count: 100,
        model: 'gpt-4',
        isExact: true,
        durationMs: 1,
        fromCache: false,
      });

      const content = `import React from 'react';
import { useState } from 'react';

const Component = () => {
  return <div>Hello</div>;
};`;

      const chunks = chunker.chunkFile('component.tsx', content);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].hasImports).toBe(true);
    });

    it('should prepend imports to subsequent chunks', () => {
      // First call for full content check
      mockTokenCounter.count
        .mockReturnValueOnce({
          count: 1200, // Large file requiring chunking
          model: 'gpt-4',
          isExact: true,
          durationMs: 1,
          fromCache: false,
        })
        // Subsequent calls for individual chunks
        .mockReturnValue({
          count: 400,
          model: 'gpt-4',
          isExact: true,
          durationMs: 1,
          fromCache: false,
        });

      const content = `import React from 'react';

function Component1() {
  return <div>Component 1</div>;
}

function Component2() {
  return <div>Component 2</div>;
}

function Component3() {
  return <div>Component 3</div>;
}`;

      const chunks = chunker.chunkFile('components.tsx', content);

      expect(chunks.length).toBeGreaterThan(1);

      // First chunk should have hasImports: true
      expect(chunks[0].hasImports).toBe(true);

      // Subsequent chunks should have imports prepended in content
      if (chunks.length > 1) {
        expect(chunks[1].content).toContain('import React');
      }
    });

    it('should split at function boundaries', () => {
      mockTokenCounter.count
        .mockReturnValueOnce({ count: 1500, model: 'gpt-4', isExact: true, durationMs: 1, fromCache: false })
        .mockReturnValue({ count: 400, model: 'gpt-4', isExact: true, durationMs: 1, fromCache: false });

      const content = `function first() {
  console.log('first');
}

function second() {
  console.log('second');
}

function third() {
  console.log('third');
}`;

      const chunks = chunker.chunkFile('functions.js', content);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should split at class boundaries', () => {
      mockTokenCounter.count
        .mockReturnValueOnce({ count: 1500, model: 'gpt-4', isExact: true, durationMs: 1, fromCache: false })
        .mockReturnValue({ count: 400, model: 'gpt-4', isExact: true, durationMs: 1, fromCache: false });

      const content = `class FirstClass {
  method() {}
}

class SecondClass {
  method() {}
}`;

      const chunks = chunker.chunkFile('classes.ts', content);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle Python-specific syntax', () => {
      mockTokenCounter.count.mockReturnValue({
        count: 100,
        model: 'gpt-4',
        isExact: true,
        durationMs: 1,
        fromCache: false,
      });

      const content = `import os
from typing import List

def hello():
    print("Hello")

class MyClass:
    def __init__(self):
        pass`;

      const chunks = chunker.chunkFile('main.py', content);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].language).toBe(CodeLanguage.PYTHON);
      expect(chunks[0].hasImports).toBe(true);
    });

    it('should handle Go-specific syntax', () => {
      mockTokenCounter.count.mockReturnValue({
        count: 100,
        model: 'gpt-4',
        isExact: true,
        durationMs: 1,
        fromCache: false,
      });

      const content = `package main

import "fmt"

func main() {
    fmt.Println("Hello")
}

type MyStruct struct {
    field string
}`;

      const chunks = chunker.chunkFile('main.go', content);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].language).toBe(CodeLanguage.GO);
      expect(chunks[0].hasImports).toBe(true);
    });

    it('should respect maxTokensPerChunk limit', () => {
      const config: ChunkingConfig = {
        targetTokensPerChunk: 500,
        maxTokensPerChunk: 600,
        minTokensPerChunk: 50,
      };
      const customChunker = new CodeChunker(config);

      mockTokenCounter.count
        .mockReturnValueOnce({ count: 2000, model: 'gpt-4', isExact: true, durationMs: 1, fromCache: false })
        .mockReturnValue({ count: 550, model: 'gpt-4', isExact: true, durationMs: 1, fromCache: false });

      const content = 'const x = 1;\n'.repeat(100);
      const chunks = customChunker.chunkFile('large.ts', content);

      chunks.forEach(chunk => {
        expect(chunk.tokens).toBeLessThanOrEqual(600);
      });

      customChunker.dispose();
    });

    it('should filter out chunks below minTokensPerChunk', () => {
      const config: ChunkingConfig = {
        targetTokensPerChunk: 500,
        maxTokensPerChunk: 1000,
        minTokensPerChunk: 100,
      };
      const customChunker = new CodeChunker(config);

      mockTokenCounter.count
        .mockReturnValueOnce({ count: 1500, model: 'gpt-4', isExact: true, durationMs: 1, fromCache: false })
        .mockReturnValueOnce({ count: 500, model: 'gpt-4', isExact: true, durationMs: 1, fromCache: false })
        .mockReturnValueOnce({ count: 40, model: 'gpt-4', isExact: true, durationMs: 1, fromCache: false }) // Below minimum
        .mockReturnValue({ count: 500, model: 'gpt-4', isExact: true, durationMs: 1, fromCache: false });

      const content = `function big() {
  // lots of code
}

// tiny comment

function another() {
  // more code
}`;

      const chunks = customChunker.chunkFile('mixed.ts', content);

      chunks.forEach(chunk => {
        expect(chunk.tokens).toBeGreaterThanOrEqual(100);
      });

      customChunker.dispose();
    });

    it('should use 1-indexed line numbers', () => {
      mockTokenCounter.count.mockReturnValue({
        count: 100,
        model: 'gpt-4',
        isExact: true,
        durationMs: 1,
        fromCache: false,
      });

      const content = 'line 1\nline 2\nline 3';
      const chunks = chunker.chunkFile('lines.txt', content);

      expect(chunks[0].startLine).toBe(1);
      expect(chunks[0].endLine).toBe(3);
    });

    it('should handle files with no natural split points', () => {
      mockTokenCounter.count
        .mockReturnValueOnce({ count: 1500, model: 'gpt-4', isExact: true, durationMs: 1, fromCache: false })
        .mockReturnValue({ count: 400, model: 'gpt-4', isExact: true, durationMs: 1, fromCache: false });

      const content = '// Just comments\n'.repeat(50);
      const chunks = chunker.chunkFile('comments.ts', content);

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('chunkFiles', () => {
    it('should chunk multiple files in batch', () => {
      mockTokenCounter.count.mockReturnValue({
        count: 100,
        model: 'gpt-4',
        isExact: true,
        durationMs: 1,
        fromCache: false,
      });

      const files = [
        { path: 'file1.ts', content: 'const a = 1;' },
        { path: 'file2.js', content: 'const b = 2;' },
        { path: 'file3.py', content: 'c = 3' },
      ];

      const results = chunker.chunkFiles(files);

      expect(results.size).toBe(3);
      expect(results.get('file1.ts')).toHaveLength(1);
      expect(results.get('file2.js')).toHaveLength(1);
      expect(results.get('file3.py')).toHaveLength(1);
    });

    it('should handle empty file array', () => {
      const results = chunker.chunkFiles([]);
      expect(results.size).toBe(0);
    });

    it('should return empty chunks for files with errors', () => {
      // Simulate an error by having TokenCounter throw
      mockTokenCounter.count.mockImplementation(() => {
        throw new Error('Token counting failed');
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const files = [{ path: 'error.ts', content: 'const x = 1;' }];
      const results = chunker.chunkFiles(files);

      expect(results.get('error.ts')).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should process all files even if one fails', () => {
      let callCount = 0;
      mockTokenCounter.count.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('First file error');
        }
        return {
          count: 100,
          model: 'gpt-4',
          isExact: true,
          durationMs: 1,
          fromCache: false,
        };
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const files = [
        { path: 'error.ts', content: 'const a = 1;' },
        { path: 'success.ts', content: 'const b = 2;' },
      ];

      const results = chunker.chunkFiles(files);

      expect(results.size).toBe(2);
      expect(results.get('error.ts')).toEqual([]);
      expect(results.get('success.ts')).toHaveLength(1);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('getChunkingStats', () => {
    it('should return correct statistics for a file', () => {
      mockTokenCounter.count.mockReturnValue({
        count: 1500,
        model: 'gpt-4',
        isExact: true,
        durationMs: 1,
        fromCache: false,
      });

      const content = `import React from 'react';

function Component() {
  return <div>Hello</div>;
}`;

      const stats = chunker.getChunkingStats('component.tsx', content);

      expect(stats).toMatchObject({
        totalLines: 5,
        totalTokens: 1500,
        language: CodeLanguage.TYPESCRIPT,
        estimatedChunks: 3, // 1500 / 500 = 3
        hasImports: true,
      });
    });

    it('should estimate at least 1 chunk for small files', () => {
      mockTokenCounter.count.mockReturnValue({
        count: 50,
        model: 'gpt-4',
        isExact: true,
        durationMs: 1,
        fromCache: false,
      });

      const content = 'const x = 1;';
      const stats = chunker.getChunkingStats('small.ts', content);

      expect(stats.estimatedChunks).toBe(1);
    });

    it('should detect no imports for files without them', () => {
      mockTokenCounter.count.mockReturnValue({
        count: 100,
        model: 'gpt-4',
        isExact: true,
        durationMs: 1,
        fromCache: false,
      });

      const content = 'function test() { return 42; }';
      const stats = chunker.getChunkingStats('test.js', content);

      expect(stats.hasImports).toBe(false);
    });

    it('should handle unknown languages', () => {
      mockTokenCounter.count.mockReturnValue({
        count: 100,
        model: 'gpt-4',
        isExact: true,
        durationMs: 1,
        fromCache: false,
      });

      const content = 'some random text';
      const stats = chunker.getChunkingStats('file.txt', content);

      expect(stats.language).toBe(CodeLanguage.UNKNOWN);
    });
  });

  describe('dispose', () => {
    it('should dispose the token counter', () => {
      chunker.dispose();
      expect(mockTokenCounter.dispose).toHaveBeenCalled();
    });

    it('should be safe to call multiple times', () => {
      chunker.dispose();
      chunker.dispose();
      expect(mockTokenCounter.dispose).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    it('should handle files with only imports', () => {
      mockTokenCounter.count.mockReturnValue({
        count: 50,
        model: 'gpt-4',
        isExact: true,
        durationMs: 1,
        fromCache: false,
      });

      const content = `import React from 'react';
import { useState } from 'react';`;

      const chunks = chunker.chunkFile('imports-only.ts', content);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].hasImports).toBe(true);
    });

    it('should handle files with mixed line endings', () => {
      mockTokenCounter.count.mockReturnValue({
        count: 100,
        model: 'gpt-4',
        isExact: true,
        durationMs: 1,
        fromCache: false,
      });

      const content = 'line 1\nline 2\r\nline 3\rline 4';
      const chunks = chunker.chunkFile('mixed.txt', content);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle very long lines', () => {
      mockTokenCounter.count.mockReturnValue({
        count: 100,
        model: 'gpt-4',
        isExact: true,
        durationMs: 1,
        fromCache: false,
      });

      const content = 'x'.repeat(10000);
      const chunks = chunker.chunkFile('long-line.txt', content);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle Unicode characters', () => {
      mockTokenCounter.count.mockReturnValue({
        count: 100,
        model: 'gpt-4',
        isExact: true,
        durationMs: 1,
        fromCache: false,
      });

      const content = '日本語のコード\nconst emoji = "😀🎉";\nconst unicode = "Ñoño";';
      const chunks = chunker.chunkFile('unicode.js', content);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toContain('😀');
    });

    it('should handle empty lines at start and end', () => {
      mockTokenCounter.count.mockReturnValue({
        count: 100,
        model: 'gpt-4',
        isExact: true,
        durationMs: 1,
        fromCache: false,
      });

      const content = '\n\n\nconst x = 1;\n\n\n';
      const chunks = chunker.chunkFile('empty-lines.ts', content);

      expect(chunks).toHaveLength(1);
    });
  });

  describe('language-specific patterns', () => {
    it('should detect TypeScript async functions', () => {
      mockTokenCounter.count
        .mockReturnValueOnce({ count: 1500, model: 'gpt-4', isExact: true, durationMs: 1, fromCache: false })
        .mockReturnValue({ count: 400, model: 'gpt-4', isExact: true, durationMs: 1, fromCache: false });

      const content = `async function fetchData() {
  return await fetch('/api');
}

const getData = async () => {
  return await fetch('/api');
}`;

      const chunks = chunker.chunkFile('async.ts', content);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should detect Python async functions and classes', () => {
      mockTokenCounter.count
        .mockReturnValueOnce({ count: 1500, model: 'gpt-4', isExact: true, durationMs: 1, fromCache: false })
        .mockReturnValue({ count: 400, model: 'gpt-4', isExact: true, durationMs: 1, fromCache: false });

      const content = `async def fetch_data():
    pass

class MyClass:
    def __init__(self):
        pass`;

      const chunks = chunker.chunkFile('async.py', content);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should detect Rust functions and structs', () => {
      mockTokenCounter.count
        .mockReturnValueOnce({ count: 1500, model: 'gpt-4', isExact: true, durationMs: 1, fromCache: false })
        .mockReturnValue({ count: 400, model: 'gpt-4', isExact: true, durationMs: 1, fromCache: false });

      const content = `pub fn main() {
    println!("Hello");
}

pub struct MyStruct {
    field: String,
}`;

      const chunks = chunker.chunkFile('main.rs', content);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle Java class and method patterns', () => {
      mockTokenCounter.count.mockReturnValue({
        count: 100,
        model: 'gpt-4',
        isExact: true,
        durationMs: 1,
        fromCache: false,
      });

      const content = `import java.util.List;

public class Main {
    public static void main(String[] args) {
        System.out.println("Hello");
    }

    private String getName() {
        return "test";
    }
}`;

      const chunks = chunker.chunkFile('Main.java', content);
      expect(chunks[0].hasImports).toBe(true);
    });

    it('should handle C++ templates and includes', () => {
      mockTokenCounter.count.mockReturnValue({
        count: 100,
        model: 'gpt-4',
        isExact: true,
        durationMs: 1,
        fromCache: false,
      });

      const content = `#include <iostream>
#include <vector>

template <typename T>
class Container {
    T value;
};

int main() {
    return 0;
}`;

      const chunks = chunker.chunkFile('main.cpp', content);
      expect(chunks[0].hasImports).toBe(true);
    });
  });

  describe('overlap behavior', () => {
    it('should apply overlap between chunks', () => {
      const config: ChunkingConfig = {
        targetTokensPerChunk: 500,
        maxTokensPerChunk: 1000,
        overlapLines: 5,
      };
      const customChunker = new CodeChunker(config);

      mockTokenCounter.count
        .mockReturnValueOnce({ count: 2000, model: 'gpt-4', isExact: true, durationMs: 1, fromCache: false })
        .mockReturnValue({ count: 400, model: 'gpt-4', isExact: true, durationMs: 1, fromCache: false });

      const lines = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`);
      const content = lines.join('\n');

      const chunks = customChunker.chunkFile('overlap.ts', content);

      // Chunks should exist
      expect(chunks.length).toBeGreaterThan(0);

      customChunker.dispose();
    });

    it('should not apply overlap to first chunk', () => {
      mockTokenCounter.count
        .mockReturnValueOnce({ count: 1500, model: 'gpt-4', isExact: true, durationMs: 1, fromCache: false })
        .mockReturnValue({ count: 400, model: 'gpt-4', isExact: true, durationMs: 1, fromCache: false });

      const content = `function first() {
  return 1;
}

function second() {
  return 2;
}`;

      const chunks = chunker.chunkFile('no-overlap-first.ts', content);

      if (chunks.length > 0) {
        expect(chunks[0].startLine).toBe(1);
      }
    });
  });
});

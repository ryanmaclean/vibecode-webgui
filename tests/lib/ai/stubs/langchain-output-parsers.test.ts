/**
 * Tests for LangChain Output Parsers stubs
 */
import { StringOutputParser, StructuredOutputParser } from '@/lib/ai/stubs/langchain-output-parsers';

describe('langchain-output-parsers', () => {
  describe('StringOutputParser', () => {
    describe('parse', () => {
      it('should return input string unchanged', async () => {
        const parser = new StringOutputParser();
        const result = await parser.parse('Hello World');
        expect(result).toBe('Hello World');
      });

      it('should handle empty string', async () => {
        const parser = new StringOutputParser();
        const result = await parser.parse('');
        expect(result).toBe('');
      });

      it('should handle multiline strings', async () => {
        const parser = new StringOutputParser();
        const input = 'Line 1\nLine 2\nLine 3';
        const result = await parser.parse(input);
        expect(result).toBe(input);
      });

      it('should handle special characters', async () => {
        const parser = new StringOutputParser();
        const input = '@#$%^&*()_+-=[]{}|;:,.<>?';
        const result = await parser.parse(input);
        expect(result).toBe(input);
      });

      it('should handle unicode characters', async () => {
        const parser = new StringOutputParser();
        const input = '你好世界 🚀 café';
        const result = await parser.parse(input);
        expect(result).toBe(input);
      });

      it('should handle very long strings', async () => {
        const parser = new StringOutputParser();
        const longString = 'A'.repeat(10000);
        const result = await parser.parse(longString);
        expect(result).toBe(longString);
        expect(result.length).toBe(10000);
      });

      it('should handle JSON strings without parsing', async () => {
        const parser = new StringOutputParser();
        const jsonString = '{"key": "value"}';
        const result = await parser.parse(jsonString);
        expect(result).toBe(jsonString);
        expect(typeof result).toBe('string');
      });

      it('should return Promise', () => {
        const parser = new StringOutputParser();
        const result = parser.parse('test');
        expect(result).toBeInstanceOf(Promise);
      });
    });
  });

  describe('StructuredOutputParser', () => {
    describe('constructor', () => {
      it('should create parser with schema', () => {
        const schema = { name: 'string', age: 'number' };
        const parser = new StructuredOutputParser(schema);
        expect(parser).toBeDefined();
      });

      it('should create parser without schema', () => {
        const parser = new StructuredOutputParser();
        expect(parser).toBeDefined();
      });

      it('should create parser with empty schema', () => {
        const parser = new StructuredOutputParser({});
        expect(parser).toBeDefined();
      });
    });

    describe('getFormatInstructions', () => {
      it('should return JSON stringified schema', () => {
        const schema = { name: 'string', age: 'number' };
        const parser = new StructuredOutputParser(schema);
        const instructions = parser.getFormatInstructions();
        expect(instructions).toBe(JSON.stringify(schema));
      });

      it('should return empty object string for default schema', () => {
        const parser = new StructuredOutputParser();
        const instructions = parser.getFormatInstructions();
        expect(instructions).toBe('{}');
      });

      it('should handle complex schema', () => {
        const schema = {
          user: {
            name: 'string',
            age: 'number',
            tags: ['string']
          }
        };
        const parser = new StructuredOutputParser(schema);
        const instructions = parser.getFormatInstructions();
        expect(instructions).toBe(JSON.stringify(schema));
      });

      it('should return string format', () => {
        const parser = new StructuredOutputParser({ test: 'value' });
        const instructions = parser.getFormatInstructions();
        expect(typeof instructions).toBe('string');
      });
    });

    describe('parse', () => {
      it('should parse valid JSON string', async () => {
        const parser = new StructuredOutputParser();
        const input = '{"name": "Alice", "age": 30}';
        const result = await parser.parse(input);
        expect(result).toEqual({ name: 'Alice', age: 30 });
      });

      it('should parse empty object', async () => {
        const parser = new StructuredOutputParser();
        const result = await parser.parse('{}');
        expect(result).toEqual({});
      });

      it('should parse array JSON', async () => {
        const parser = new StructuredOutputParser();
        const input = '[1, 2, 3]';
        const result = await parser.parse(input);
        expect(result).toEqual([1, 2, 3]);
      });

      it('should parse nested objects', async () => {
        const parser = new StructuredOutputParser();
        const input = '{"user": {"name": "Bob", "details": {"age": 25}}}';
        const result = await parser.parse(input);
        expect(result).toEqual({
          user: { name: 'Bob', details: { age: 25 } }
        });
      });

      it('should handle invalid JSON by returning wrapped object', async () => {
        const parser = new StructuredOutputParser();
        const input = 'not valid json';
        const result = await parser.parse(input);
        expect(result).toEqual({ output: input });
      });

      it('should handle empty string as invalid JSON', async () => {
        const parser = new StructuredOutputParser();
        const result = await parser.parse('');
        expect(result).toEqual({ output: '' });
      });

      it('should handle malformed JSON with extra characters', async () => {
        const parser = new StructuredOutputParser();
        const input = '{"name": "test"} extra text';
        const result = await parser.parse(input);
        expect(result).toEqual({ output: input });
      });

      it('should parse JSON with boolean values', async () => {
        const parser = new StructuredOutputParser();
        const input = '{"active": true, "deleted": false}';
        const result = await parser.parse(input);
        expect(result).toEqual({ active: true, deleted: false });
      });

      it('should parse JSON with null values', async () => {
        const parser = new StructuredOutputParser();
        const input = '{"value": null}';
        const result = await parser.parse(input);
        expect(result).toEqual({ value: null });
      });

      it('should parse JSON with number values', async () => {
        const parser = new StructuredOutputParser();
        const input = '{"int": 42, "float": 3.14, "negative": -10}';
        const result = await parser.parse(input);
        expect(result).toEqual({ int: 42, float: 3.14, negative: -10 });
      });

      it('should parse JSON with unicode characters', async () => {
        const parser = new StructuredOutputParser();
        const input = '{"text": "你好🚀"}';
        const result = await parser.parse(input);
        expect(result).toEqual({ text: '你好🚀' });
      });

      it('should parse JSON with escaped characters', async () => {
        const parser = new StructuredOutputParser();
        const input = '{"text": "Line1\\nLine2\\tTabbed"}';
        const result = await parser.parse(input);
        expect(result).toEqual({ text: 'Line1\nLine2\tTabbed' });
      });

      it('should return Promise', () => {
        const parser = new StructuredOutputParser();
        const result = parser.parse('{}');
        expect(result).toBeInstanceOf(Promise);
      });

      it('should work with schema in constructor', async () => {
        const schema = { name: 'string', age: 'number' };
        const parser = new StructuredOutputParser(schema);
        const result = await parser.parse('{"name": "Test", "age": 25}');
        expect(result).toEqual({ name: 'Test', age: 25 });
      });

      it('should handle partial JSON', async () => {
        const parser = new StructuredOutputParser();
        const input = '{"name": "test"';
        const result = await parser.parse(input);
        expect(result).toEqual({ output: input });
      });
    });
  });

  describe('Parser comparison', () => {
    it('should have different parsing behavior', async () => {
      const stringParser = new StringOutputParser();
      const structuredParser = new StructuredOutputParser();

      const jsonInput = '{"key": "value"}';

      const stringResult = await stringParser.parse(jsonInput);
      const structuredResult = await structuredParser.parse(jsonInput);

      expect(typeof stringResult).toBe('string');
      expect(typeof structuredResult).toBe('object');
      expect(stringResult).toBe(jsonInput);
      expect(structuredResult).toEqual({ key: 'value' });
    });
  });
});

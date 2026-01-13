/**
 * Tests for LangChain Prompts stubs
 */
import { PromptTemplate } from '@/lib/ai/stubs/langchain-prompts';

describe('langchain-prompts', () => {
  describe('PromptTemplate constructor', () => {
    it('should create template with string', () => {
      const template = new PromptTemplate({ template: 'Hello {name}' });
      expect(template.template).toBe('Hello {name}');
    });

    it('should create template with empty string', () => {
      const template = new PromptTemplate({ template: '' });
      expect(template.template).toBe('');
    });

    it('should create template with multiple placeholders', () => {
      const template = new PromptTemplate({
        template: 'Hello {name}, you are {age} years old'
      });
      expect(template.template).toContain('{name}');
      expect(template.template).toContain('{age}');
    });
  });

  describe('PromptTemplate.fromTemplate', () => {
    it('should create template from string', () => {
      const template = PromptTemplate.fromTemplate('Hello {name}');
      expect(template).toBeInstanceOf(PromptTemplate);
      expect(template.template).toBe('Hello {name}');
    });

    it('should create template with no placeholders', () => {
      const template = PromptTemplate.fromTemplate('Static text');
      expect(template.template).toBe('Static text');
    });

    it('should create template with complex string', () => {
      const templateStr = 'Name: {name}\nAge: {age}\nCity: {city}';
      const template = PromptTemplate.fromTemplate(templateStr);
      expect(template.template).toBe(templateStr);
    });
  });

  describe('PromptTemplate.format', () => {
    it('should format template with single variable', async () => {
      const template = PromptTemplate.fromTemplate('Hello {name}');
      const result = await template.format({ name: 'Alice' });
      expect(result).toBe('Hello Alice');
    });

    it('should format template with multiple variables', async () => {
      const template = PromptTemplate.fromTemplate('Hello {name}, you are {age} years old');
      const result = await template.format({ name: 'Bob', age: 30 });
      expect(result).toBe('Hello Bob, you are 30 years old');
    });

    it('should format template with no variables', async () => {
      const template = PromptTemplate.fromTemplate('Static text');
      const result = await template.format({});
      expect(result).toBe('Static text');
    });

    it('should handle missing variables by leaving placeholder', async () => {
      const template = PromptTemplate.fromTemplate('Hello {name}');
      const result = await template.format({});
      expect(result).toBe('Hello {name}');
    });

    it('should handle extra variables gracefully', async () => {
      const template = PromptTemplate.fromTemplate('Hello {name}');
      const result = await template.format({ name: 'Alice', extra: 'ignored' });
      expect(result).toBe('Hello Alice');
    });

    it('should convert non-string values to strings', async () => {
      const template = PromptTemplate.fromTemplate('Number: {num}, Bool: {bool}');
      const result = await template.format({ num: 42, bool: true });
      expect(result).toBe('Number: 42, Bool: true');
    });

    it('should handle null and undefined values', async () => {
      const template = PromptTemplate.fromTemplate('Val1: {val1}, Val2: {val2}');
      const result = await template.format({ val1: null, val2: undefined });
      expect(result).toBe('Val1: null, Val2: undefined');
    });

    it('should handle repeated placeholders', async () => {
      const template = PromptTemplate.fromTemplate('Hello {name}! Nice to meet you, {name}!');
      const result = await template.format({ name: 'Charlie' });
      expect(result).toBe('Hello Charlie! Nice to meet you, Charlie!');
    });

    it('should handle object values by converting to string', async () => {
      const template = PromptTemplate.fromTemplate('Object: {obj}');
      const result = await template.format({ obj: { key: 'value' } });
      expect(result).toContain('[object Object]');
    });

    it('should handle array values by converting to string', async () => {
      const template = PromptTemplate.fromTemplate('Array: {arr}');
      const result = await template.format({ arr: [1, 2, 3] });
      expect(result).toBe('Array: 1,2,3');
    });

    it('should handle complex template with mixed content', async () => {
      const template = PromptTemplate.fromTemplate(
        'User: {user}\nQuery: {query}\nContext: {context}\nResponse:'
      );
      const result = await template.format({
        user: 'John',
        query: 'What is AI?',
        context: 'Technical discussion',
      });
      expect(result).toContain('User: John');
      expect(result).toContain('Query: What is AI?');
      expect(result).toContain('Context: Technical discussion');
    });

    it('should handle special characters in values', async () => {
      const template = PromptTemplate.fromTemplate('Special: {special}');
      const result = await template.format({ special: '@#$%^&*()' });
      expect(result).toBe('Special: @#$%^&*()');
    });

    it('should handle unicode in values', async () => {
      const template = PromptTemplate.fromTemplate('Unicode: {text}');
      const result = await template.format({ text: '你好🚀' });
      expect(result).toBe('Unicode: 你好🚀');
    });

    it('should handle newlines in values', async () => {
      const template = PromptTemplate.fromTemplate('Text: {text}');
      const result = await template.format({ text: 'Line1\nLine2\nLine3' });
      expect(result).toBe('Text: Line1\nLine2\nLine3');
    });

    it('should return a Promise', () => {
      const template = PromptTemplate.fromTemplate('Hello {name}');
      const result = template.format({ name: 'Test' });
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('PromptTemplate edge cases', () => {
    it('should handle curly braces in template text', async () => {
      const template = PromptTemplate.fromTemplate('Code: function() { return {value}; }');
      const result = await template.format({ value: '42' });
      expect(result).toBe('Code: function() { return 42; }');
    });

    it('should handle nested placeholders syntax (but treat as separate)', async () => {
      const template = PromptTemplate.fromTemplate('{outer{inner}}');
      const result = await template.format({ 'outer{inner}': 'test' });
      // This tests the regex behavior
      expect(result).toBeDefined();
    });

    it('should handle very long templates', async () => {
      const longTemplate = 'Start ' + '{var} '.repeat(100) + 'End';
      const template = PromptTemplate.fromTemplate(longTemplate);
      const result = await template.format({ var: 'X' });
      expect(result).toContain('Start');
      expect(result).toContain('End');
    });
  });
});

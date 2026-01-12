/**
 * Tests for LangChain prompts stub implementation
 */

import { PromptTemplate } from '@/lib/ai/stubs/langchain-prompts'

describe('PromptTemplate', () => {
  describe('constructor', () => {
    it('should create instance with template', () => {
      const template = 'Hello {name}'
      const prompt = new PromptTemplate({ template })

      expect(prompt).toBeInstanceOf(PromptTemplate)
      expect(prompt.template).toBe(template)
    })

    it('should handle empty template', () => {
      const prompt = new PromptTemplate({ template: '' })

      expect(prompt.template).toBe('')
    })

    it('should handle template with multiple variables', () => {
      const template = '{greeting} {name}, welcome to {place}'
      const prompt = new PromptTemplate({ template })

      expect(prompt.template).toBe(template)
    })
  })

  describe('fromTemplate', () => {
    it('should create instance from template string', () => {
      const template = 'Hello {name}'
      const prompt = PromptTemplate.fromTemplate(template)

      expect(prompt).toBeInstanceOf(PromptTemplate)
      expect(prompt.template).toBe(template)
    })

    it('should create instance with complex template', () => {
      const template = `You are a {role} helping with {task}.
Context: {context}
Question: {question}`
      const prompt = PromptTemplate.fromTemplate(template)

      expect(prompt.template).toBe(template)
    })
  })

  describe('format', () => {
    it('should replace single variable', async () => {
      const prompt = PromptTemplate.fromTemplate('Hello {name}')
      const result = await prompt.format({ name: 'World' })

      expect(result).toBe('Hello World')
    })

    it('should replace multiple variables', async () => {
      const prompt = PromptTemplate.fromTemplate('{greeting} {name}, welcome to {place}')
      const result = await prompt.format({
        greeting: 'Hi',
        name: 'Alice',
        place: 'Wonderland'
      })

      expect(result).toBe('Hi Alice, welcome to Wonderland')
    })

    it('should replace all occurrences of a variable', async () => {
      const prompt = PromptTemplate.fromTemplate('Say {word} three times: {word}, {word}, {word}')
      const result = await prompt.format({ word: 'hello' })

      expect(result).toBe('Say hello three times: hello, hello, hello')
    })

    it('should handle missing variables by leaving placeholder', async () => {
      const prompt = PromptTemplate.fromTemplate('Hello {name}')
      const result = await prompt.format({})

      expect(result).toBe('Hello {name}')
    })

    it('should convert non-string values to strings', async () => {
      const prompt = PromptTemplate.fromTemplate('Number: {num}, Boolean: {bool}, Null: {null}')
      const result = await prompt.format({
        num: 42,
        bool: true,
        null: null
      })

      expect(result).toBe('Number: 42, Boolean: true, Null: null')
    })

    it('should handle objects by converting to string', async () => {
      const prompt = PromptTemplate.fromTemplate('Data: {data}')
      const result = await prompt.format({
        data: { key: 'value' }
      })

      expect(result).toBe('Data: [object Object]')
    })

    it('should handle empty values object', async () => {
      const prompt = PromptTemplate.fromTemplate('Hello {name}')
      const result = await prompt.format({})

      expect(result).toBe('Hello {name}')
    })

    it('should handle multiline templates', async () => {
      const template = `You are a {role}.
Your task is to {task}.

Context:
{context}

Question: {question}`

      const prompt = PromptTemplate.fromTemplate(template)
      const result = await prompt.format({
        role: 'helpful assistant',
        task: 'answer questions',
        context: 'User documentation',
        question: 'How do I deploy?'
      })

      expect(result).toContain('You are a helpful assistant.')
      expect(result).toContain('Your task is to answer questions.')
      expect(result).toContain('Context:\nUser documentation')
      expect(result).toContain('Question: How do I deploy?')
    })

    it('should handle special characters in values', async () => {
      const prompt = PromptTemplate.fromTemplate('Path: {path}')
      const result = await prompt.format({
        path: '/usr/local/bin'
      })

      expect(result).toBe('Path: /usr/local/bin')
    })

    it('should handle variables with similar names', async () => {
      const prompt = PromptTemplate.fromTemplate('{name} and {name2}')
      const result = await prompt.format({
        name: 'Alice',
        name2: 'Bob'
      })

      expect(result).toBe('Alice and Bob')
    })

    it('should not replace partial matches', async () => {
      const prompt = PromptTemplate.fromTemplate('Replace {var} but not {variable}')
      const result = await prompt.format({
        var: 'X'
      })

      expect(result).toBe('Replace X but not {variable}')
    })

    it('should handle nested braces correctly', async () => {
      const prompt = PromptTemplate.fromTemplate('JSON: {json}')
      const result = await prompt.format({
        json: '{"key": "value"}'
      })

      expect(result).toBe('JSON: {"key": "value"}')
    })

    it('should handle arrays by converting to string', async () => {
      const prompt = PromptTemplate.fromTemplate('Items: {items}')
      const result = await prompt.format({
        items: [1, 2, 3]
      })

      expect(result).toBe('Items: 1,2,3')
    })

    it('should handle template with no variables', async () => {
      const prompt = PromptTemplate.fromTemplate('Hello World')
      const result = await prompt.format({ name: 'Alice' })

      expect(result).toBe('Hello World')
    })

    it('should handle extra values not in template', async () => {
      const prompt = PromptTemplate.fromTemplate('Hello {name}')
      const result = await prompt.format({
        name: 'Alice',
        extra: 'ignored',
        another: 'also ignored'
      })

      expect(result).toBe('Hello Alice')
    })
  })

  describe('edge cases', () => {
    it('should handle template with only braces', async () => {
      const prompt = PromptTemplate.fromTemplate('{}')
      const result = await prompt.format({})

      expect(result).toBe('{}')
    })

    it('should handle unclosed braces', async () => {
      const prompt = PromptTemplate.fromTemplate('Hello {name')
      const result = await prompt.format({ name: 'Alice' })

      expect(result).toBe('Hello {name')
    })

    it('should handle unopened braces', async () => {
      const prompt = PromptTemplate.fromTemplate('Hello name}')
      const result = await prompt.format({ name: 'Alice' })

      expect(result).toBe('Hello name}')
    })

    it('should handle consecutive variables', async () => {
      const prompt = PromptTemplate.fromTemplate('{a}{b}{c}')
      const result = await prompt.format({
        a: '1',
        b: '2',
        c: '3'
      })

      expect(result).toBe('123')
    })

    it('should handle very long templates', async () => {
      const longTemplate = 'Start ' + 'x '.repeat(1000) + '{var} ' + 'y '.repeat(1000) + 'End'
      const prompt = PromptTemplate.fromTemplate(longTemplate)
      const result = await prompt.format({ var: 'MIDDLE' })

      expect(result).toContain('Start ')
      expect(result).toContain(' MIDDLE ')
      expect(result).toContain(' End')
    })
  })
})

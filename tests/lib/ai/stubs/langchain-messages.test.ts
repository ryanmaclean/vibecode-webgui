/**
 * Tests for LangChain Messages stubs
 */
import { BaseMessage, HumanMessage, SystemMessage, AIMessage } from '@/lib/ai/stubs/langchain-messages';

describe('langchain-messages', () => {
  describe('BaseMessage', () => {
    it('should create message with content', () => {
      const message = new BaseMessage('Hello');
      expect(message.content).toBe('Hello');
    });

    it('should create message with empty content', () => {
      const message = new BaseMessage('');
      expect(message.content).toBe('');
    });

    it('should create message with multiline content', () => {
      const content = 'Line 1\nLine 2\nLine 3';
      const message = new BaseMessage(content);
      expect(message.content).toBe(content);
    });

    it('should create message with special characters', () => {
      const content = '@#$%^&*()_+-=[]{}|;:,.<>?';
      const message = new BaseMessage(content);
      expect(message.content).toBe(content);
    });

    it('should be instance of BaseMessage', () => {
      const message = new BaseMessage('Test');
      expect(message instanceof BaseMessage).toBe(true);
    });
  });

  describe('HumanMessage', () => {
    it('should create human message with content', () => {
      const message = new HumanMessage('User input');
      expect(message.content).toBe('User input');
    });

    it('should extend BaseMessage', () => {
      const message = new HumanMessage('Test');
      expect(message instanceof BaseMessage).toBe(true);
      expect(message instanceof HumanMessage).toBe(true);
    });

    it('should handle long user input', () => {
      const longContent = 'A'.repeat(1000);
      const message = new HumanMessage(longContent);
      expect(message.content).toBe(longContent);
      expect(message.content.length).toBe(1000);
    });

    it('should handle unicode content', () => {
      const message = new HumanMessage('你好世界 🚀');
      expect(message.content).toBe('你好世界 🚀');
    });
  });

  describe('SystemMessage', () => {
    it('should create system message with content', () => {
      const message = new SystemMessage('System instruction');
      expect(message.content).toBe('System instruction');
    });

    it('should extend BaseMessage', () => {
      const message = new SystemMessage('Test');
      expect(message instanceof BaseMessage).toBe(true);
      expect(message instanceof SystemMessage).toBe(true);
    });

    it('should handle system prompts', () => {
      const prompt = 'You are a helpful assistant. Always be polite.';
      const message = new SystemMessage(prompt);
      expect(message.content).toBe(prompt);
    });

    it('should handle JSON content', () => {
      const jsonContent = JSON.stringify({ role: 'system', instruction: 'test' });
      const message = new SystemMessage(jsonContent);
      expect(message.content).toBe(jsonContent);
    });
  });

  describe('AIMessage', () => {
    it('should create AI message with content', () => {
      const message = new AIMessage('AI response');
      expect(message.content).toBe('AI response');
    });

    it('should extend BaseMessage', () => {
      const message = new AIMessage('Test');
      expect(message instanceof BaseMessage).toBe(true);
      expect(message instanceof AIMessage).toBe(true);
    });

    it('should handle AI generated content', () => {
      const aiContent = 'Based on your input, here is my response...';
      const message = new AIMessage(aiContent);
      expect(message.content).toBe(aiContent);
    });

    it('should handle code snippets in content', () => {
      const codeContent = 'Here is the code:\n```javascript\nconsole.log("test");\n```';
      const message = new AIMessage(codeContent);
      expect(message.content).toBe(codeContent);
    });
  });

  describe('Message type distinction', () => {
    it('should distinguish between message types', () => {
      const human = new HumanMessage('Human');
      const system = new SystemMessage('System');
      const ai = new AIMessage('AI');

      expect(human instanceof HumanMessage).toBe(true);
      expect(human instanceof SystemMessage).toBe(false);
      expect(human instanceof AIMessage).toBe(false);

      expect(system instanceof SystemMessage).toBe(true);
      expect(system instanceof HumanMessage).toBe(false);
      expect(system instanceof AIMessage).toBe(false);

      expect(ai instanceof AIMessage).toBe(true);
      expect(ai instanceof HumanMessage).toBe(false);
      expect(ai instanceof SystemMessage).toBe(false);
    });

    it('should all be instances of BaseMessage', () => {
      const messages = [
        new HumanMessage('Human'),
        new SystemMessage('System'),
        new AIMessage('AI'),
      ];

      messages.forEach(msg => {
        expect(msg instanceof BaseMessage).toBe(true);
      });
    });
  });

  describe('Message array handling', () => {
    it('should work in conversation arrays', () => {
      const conversation = [
        new SystemMessage('You are helpful'),
        new HumanMessage('Hello'),
        new AIMessage('Hi there!'),
        new HumanMessage('How are you?'),
        new AIMessage('I am doing well, thanks!'),
      ];

      expect(conversation).toHaveLength(5);
      expect(conversation[0]).toBeInstanceOf(SystemMessage);
      expect(conversation[1]).toBeInstanceOf(HumanMessage);
      expect(conversation[2]).toBeInstanceOf(AIMessage);
    });

    it('should filter messages by type', () => {
      const messages = [
        new HumanMessage('Test 1'),
        new AIMessage('Response 1'),
        new HumanMessage('Test 2'),
        new AIMessage('Response 2'),
      ];

      const humanMessages = messages.filter(m => m instanceof HumanMessage);
      const aiMessages = messages.filter(m => m instanceof AIMessage);

      expect(humanMessages).toHaveLength(2);
      expect(aiMessages).toHaveLength(2);
    });
  });
});

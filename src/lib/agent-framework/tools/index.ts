// Built-in tools for the agent framework

import { ToolDefinition } from '..';

/**
 * Calculator tool - performs basic arithmetic calculations
 */
export const calculatorTool: ToolDefinition = {
  name: 'calculator',
  description: 'Perform arithmetic calculations',
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'The arithmetic expression to evaluate (e.g., "2 + 2" or "10 * (5 - 3)")',
      },
    },
    required: ['expression'],
  },
  execute: async ({ expression }) => {
    try {
      // Basic validation to prevent code injection
      if (!/^[\d\s+\-*/().,]+$/.test(expression)) {
        throw new Error('Invalid characters in expression');
      }
      
      // Use Function constructor in a safe way (no access to globals)
      const result = new Function(`return (${expression})`)();
      
      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('Invalid calculation result');
      }
      
      return { result };
    } catch (error) {
      return { 
        error: 'Failed to evaluate expression',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * Web search tool - performs a web search
 */
export const webSearchTool: ToolDefinition = {
  name: 'web_search',
  description: 'Search the web for information',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query',
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return',
        default: 5,
      },
    },
    required: ['query'],
  },
  execute: async ({ query, maxResults = 5 }) => {
    // In a real implementation, this would call a search API
    // For now, we'll return a mock response
    return {
      results: [
        {
          title: `Search result for "${query}"`,
          url: 'https://example.com/search?q=' + encodeURIComponent(query),
          snippet: `This is a mock search result for "${query}". In a real implementation, this would return actual search results.`,
        },
      ],
      query,
      resultCount: 1,
    };
  },
};

/**
 * File read tool - reads a file's contents
 */
export const fileReadTool: ToolDefinition = {
  name: 'read_file',
  description: 'Read the contents of a file',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to read',
      },
    },
    required: ['path'],
  },
  execute: async ({ path }) => {
    // In a real implementation, this would read from the filesystem
    // For now, we'll return a mock response
    return {
      path,
      exists: true,
      content: `This is a mock file content for ${path}. In a real implementation, this would read the actual file contents.`,
      size: 100, // Mock size in bytes
    };
  },
};

/**
 * Code execution tool - executes code in a sandbox
 */
export const codeExecutionTool: ToolDefinition = {
  name: 'execute_code',
  description: 'Execute code in a sandboxed environment',
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The code to execute',
      },
      language: {
        type: 'string',
        enum: ['javascript', 'python', 'typescript'],
        description: 'The programming language of the code',
      },
    },
    required: ['code', 'language'],
  },
  execute: async ({ code, language }) => {
    // In a real implementation, this would execute code in a secure sandbox
    // For now, we'll return a mock response
    return {
      success: true,
      output: `Code execution result for ${language} code. In a real implementation, this would show the actual output.`,
      executionTime: 100, // ms
    };
  },
};

/**
 * Get current time tool
 */
export const getCurrentTimeTool: ToolDefinition = {
  name: 'get_current_time',
  description: 'Get the current date and time',
  parameters: {
    type: 'object',
    properties: {
      timezone: {
        type: 'string',
        description: 'IANA timezone (e.g., America/New_York)',
        default: 'UTC',
      },
      format: {
        type: 'string',
        description: 'Date format (e.g., ISO, locale, unix)',
        enum: ['ISO', 'locale', 'unix'],
        default: 'ISO',
      },
    },
    required: [],
  },
  execute: async ({ timezone = 'UTC', format = 'ISO' }) => {
    const now = new Date();
    
    switch (format) {
      case 'ISO':
        return { time: now.toISOString(), timezone };
      case 'locale':
        return { 
          time: now.toLocaleString(undefined, { timeZone: timezone }), 
          timezone 
        };
      case 'unix':
        return { 
          timestamp: Math.floor(now.getTime() / 1000),
          timezone: 'UTC' // Unix timestamps are always UTC
        };
      default:
        return { time: now.toISOString(), timezone };
    }
  },
};

/**
 * Export all built-in tools
 */
export const builtInTools = {
  calculator: calculatorTool,
  webSearch: webSearchTool,
  readFile: fileReadTool,
  executeCode: codeExecutionTool,
  getCurrentTime: getCurrentTimeTool,
};

export type BuiltInToolName = keyof typeof builtInTools;

export default builtInTools;

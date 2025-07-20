// Specialized agent implementations

import { Agent, type AgentOptions } from '..';
import { builtInTools } from '../tools';

export interface CodeAgentOptions extends AgentOptions {
  /** Whether to enable code execution */
  enableCodeExecution?: boolean;
  
  /** Whether to enable file system access */
  enableFileSystem?: boolean;
  
  /** Whether to enable web search */
  enableWebSearch?: boolean;
}

/**
 * A specialized agent for code-related tasks
 */
export class CodeAgent extends Agent {
  constructor(options: CodeAgentOptions = {}) {
    const tools = [];
    
    if (options.enableCodeExecution !== false) {
      tools.push(builtInTools.executeCode);
    }
    
    if (options.enableFileSystem !== false) {
      tools.push(builtInTools.readFile);
    }
    
    if (options.enableWebSearch !== false) {
      tools.push(builtInTools.webSearch);
    }
    
    tools.push(builtInTools.calculator);
    tools.push(builtInTools.getCurrentTime);
    
    super({
      ...options,
      systemPrompt: `You are a helpful coding assistant. You help with programming tasks, 
        code generation, debugging, and explaining concepts. When writing code, 
        include clear comments and follow best practices for the language.`,
      tools,
      model: options.model || 'openrouter/meta-llama/llama-3-70b-instruct',
      temperature: options.temperature ?? 0.2, // Lower temperature for more deterministic code
    });
  }
}

export interface ResearchAgentOptions extends AgentOptions {
  /** Whether to enable web search */
  enableWebSearch?: boolean;
  
  /** Whether to enable file access */
  enableFileAccess?: boolean;
  
  /** Maximum number of search results to include */
  maxSearchResults?: number;
}

/**
 * A specialized agent for research tasks
 */
export class ResearchAgent extends Agent {
  constructor(options: ResearchAgentOptions = {}) {
    const tools = [];
    
    if (options.enableWebSearch !== false) {
      tools.push({
        ...builtInTools.webSearch,
        parameters: {
          ...builtInTools.webSearch.parameters,
          properties: {
            ...builtInTools.webSearch.parameters.properties,
            maxResults: {
              type: 'number',
              description: 'Maximum number of results to return',
              default: options.maxSearchResults || 5,
            },
          },
        },
      });
    }
    
    if (options.enableFileAccess !== false) {
      tools.push(builtInTools.readFile);
    }
    
    tools.push(builtInTools.getCurrentTime);
    
    super({
      ...options,
      systemPrompt: `You are a research assistant. Your role is to gather information, 
        analyze data, and provide well-structured, accurate, and comprehensive answers. 
        Always cite your sources and be clear about the limitations of the information.`,
      tools,
      model: options.model || 'openrouter/anthropic/claude-3-opus',
      temperature: options.temperature ?? 0.7,
    });
  }
}

export interface CreativeAgentOptions extends AgentOptions {
  /** Creativity level (0-1) */
  creativity?: number;
  
  /** Whether to enable web search */
  enableWebSearch?: boolean;
  
  /** Whether to enable image generation */
  enableImageGeneration?: boolean;
}

/**
 * A specialized agent for creative tasks
 */
export class CreativeAgent extends Agent {
  constructor(options: CreativeAgentOptions = {}) {
    const tools = [];
    
    if (options.enableWebSearch !== false) {
      tools.push(builtInTools.webSearch);
    }
    
    // In a real implementation, you would add image generation tools here
    
    super({
      ...options,
      systemPrompt: `You are a creative assistant. You help with brainstorming, 
        storytelling, content creation, and artistic endeavors. Be imaginative, 
        expressive, and engaging in your responses.`,
      tools,
      model: options.model || 'openrouter/anthropic/claude-3-sonnet',
      temperature: options.temperature ?? options.creativity ?? 0.8, // Higher temperature for more creativity
    });
  }
}

export interface DataAnalysisAgentOptions extends AgentOptions {
  /** Whether to enable data visualization */
  enableVisualization?: boolean;
  
  /** Whether to enable file access */
  enableFileAccess?: boolean;
  
  /** Whether to enable code execution for data analysis */
  enableCodeExecution?: boolean;
}

/**
 * A specialized agent for data analysis tasks
 */
export class DataAnalysisAgent extends Agent {
  constructor(options: DataAnalysisAgentOptions = {}) {
    const tools = [];
    
    if (options.enableCodeExecution !== false) {
      tools.push(builtInTools.executeCode);
    }
    
    if (options.enableFileAccess !== false) {
      tools.push(builtInTools.readFile);
    }
    
    tools.push(builtInTools.calculator);
    tools.push(builtInTools.getCurrentTime);
    
    super({
      ...options,
      systemPrompt: `You are a data analysis assistant. You help with data exploration, 
        visualization, statistical analysis, and deriving insights from data. 
        Be precise, methodical, and clear in your explanations.`,
      tools,
      model: options.model || 'openrouter/anthropic/claude-3-opus',
      temperature: options.temperature ?? 0.3, // Lower temperature for more precise analysis
    });
  }
}

/**
 * Create a specialized agent based on the specified type
 */
export function createSpecializedAgent(
  type: 'code' | 'research' | 'creative' | 'data' | 'general' = 'general',
  options: AgentOptions = {}
): Agent {
  switch (type) {
    case 'code':
      return new CodeAgent(options);
    case 'research':
      return new ResearchAgent(options);
    case 'creative':
      return new CreativeAgent(options);
    case 'data':
      return new DataAnalysisAgent(options);
    case 'general':
    default:
      return new Agent(options);
  }
}

export default {
  CodeAgent,
  ResearchAgent,
  CreativeAgent,
  DataAnalysisAgent,
  createSpecializedAgent,
};

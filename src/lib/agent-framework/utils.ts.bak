// Utility functions for working with agents

import { Agent, type AgentMessage, type ToolDefinition } from '.';
import { builtInTools } from './tools';

/**
 * Create a conversation history from a series of messages
 */
export function createConversationHistory(messages: Array<{
  role: 'user' | 'assistant' | 'system';
  content: string;
  name?: string;
}>): AgentMessage[] {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
    name: msg.name,
    timestamp: Date.now(),
  }));
}

/**
 * Format a tool call for the agent
 */
export function formatToolCall(
  toolName: string,
  args: Record<string, any>,
  result: any
): AgentMessage {
  return {
    role: 'tool',
    name: toolName,
    content: typeof result === 'string' ? result : JSON.stringify(result),
    timestamp: Date.now(),
  };
}

/**
 * Get a tool by name from a list of tools
 */
export function getToolByName(
  tools: ToolDefinition[],
  name: string
): ToolDefinition | undefined {
  return tools.find((tool) => tool.name === name);
}

/**
 * Validate tool parameters against the tool's schema
 */
export function validateToolParameters(
  tool: ToolDefinition,
  params: Record<string, any>
): { valid: boolean; errors?: string[] } {
  const { parameters } = tool;
  const errors: string[] = [];
  
  // Check required parameters
  if (parameters.required) {
    for (const param of parameters.required) {
      if (params[param] === undefined || params[param] === null) {
        errors.push(`Missing required parameter: ${param}`);
      }
    }
  }
  
  // Check parameter types
  if (parameters.properties) {
    for (const [param, schema] of Object.entries(parameters.properties)) {
      if (params[param] === undefined) continue;
      
      const value = params[param];
      const paramSchema = schema as any;
      
      // Type checking
      if (paramSchema.type) {
        const type = paramSchema.type.toLowerCase();
        const valueType = Array.isArray(value) ? 'array' : typeof value;
        
        if (type === 'array' && !Array.isArray(value)) {
          errors.push(`Parameter '${param}' must be an array`);
        } else if (type === 'object' && (value === null || typeof value !== 'object' || Array.isArray(value))) {
          errors.push(`Parameter '${param}' must be an object`);
        } else if (type !== 'array' && type !== 'object' && valueType !== type) {
          errors.push(`Parameter '${param}' must be of type '${type}'`);
        }
      }
      
      // Enum validation
      if (paramSchema.enum && !paramSchema.enum.includes(value)) {
        errors.push(
          `Parameter '${param}' must be one of: ${paramSchema.enum.join(', ')}`
        );
      }
      
      // Min/max validation for numbers
      if (typeof value === 'number') {
        if (paramSchema.minimum !== undefined && value < paramSchema.minimum) {
          errors.push(
            `Parameter '${param}' must be at least ${paramSchema.minimum}`
          );
        }
        if (paramSchema.maximum !== undefined && value > paramSchema.maximum) {
          errors.push(
            `Parameter '${param}' must be at most ${paramSchema.maximum}`
          );
        }
      }
      
      // Min/max length for strings and arrays
      if (typeof value === 'string' || Array.isArray(value)) {
        const length = value.length;
        
        if (paramSchema.minLength !== undefined && length < paramSchema.minLength) {
          errors.push(
            `Parameter '${param}' must be at least ${paramSchema.minLength} characters`
          );
        }
        
        if (paramSchema.maxLength !== undefined && length > paramSchema.maxLength) {
          errors.push(
            `Parameter '${param}' must be at most ${paramSchema.maxLength} characters`
          );
        }
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Get a list of available tools with their schemas
 */
export function getAvailableTools(tools: ToolDefinition[]) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}

/**
 * Create a system message with tool definitions
 */
export function createToolSystemMessage(tools: ToolDefinition[]): string {
  const toolDescriptions = tools.map((tool) => {
    const params = tool.parameters.properties
      ? Object.entries(tool.parameters.properties)
          .map(([name, schema]: [string, any]) => {
            const desc = [
              `- ${name}: ${schema.description || 'No description'}`,
              `  Type: ${schema.type}`,
            ];
            
            if (schema.enum) {
              desc.push(`  Options: ${schema.enum.join(', ')}`);
            }
            
            if (schema.default !== undefined) {
              desc.push(`  Default: ${JSON.stringify(schema.default)}`);
            }
            
            return desc.join('\n');
          })
          .join('\n')
      : '  No parameters';
    
    return `## ${tool.name}
${tool.description}

Parameters:
${params}
`;
  });
  
  return `You have access to the following tools. Use them when needed to complete the task.

${toolDescriptions.join('\n')}`;
}

/**
 * Create a function that can be used to call a tool
 */
export function createToolCaller(tools: ToolDefinition[]) {
  return async (toolName: string, params: Record<string, any>) => {
    const tool = getToolByName(tools, toolName);
    
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }
    
    const { valid, errors } = validateToolParameters(tool, params);
    
    if (!valid) {
      throw new Error(`Invalid parameters for tool ${toolName}: ${errors?.join(', ')}`);
    }
    
    try {
      const result = await tool.execute(params);
      return result;
    } catch (error) {
      throw new Error(`Error executing tool ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
}

/**
 * Get the built-in tools with their schemas
 */
export function getBuiltInTools() {
  return getAvailableTools(Object.values(builtInTools));
}

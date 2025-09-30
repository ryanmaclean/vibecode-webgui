/**
 * Tool Registry for Tool-Augmented Generation (TAG)
 * 
 * Central registry for managing AI tools with metadata, lifecycle management,
 * and intelligent routing capabilities.
 */

import { EventEmitter } from 'events';
import { ToolDefinition } from './index';

export interface ToolMetadata {
  /** Tool category (execution, analysis, search, etc.) */
  category: 'execution' | 'analysis' | 'search' | 'security' | 'performance' | 'utility';
  
  /** Tool complexity score (1-10) */
  complexity: number;
  
  /** Expected execution time in milliseconds */
  expectedDuration: number;
  
  /** Resource requirements */
  resources: {
    cpu: 'low' | 'medium' | 'high';
    memory: 'low' | 'medium' | 'high';
    network: boolean;
  };
  
  /** Usage statistics */
  stats: {
    totalCalls: number;
    successRate: number;
    averageDuration: number;
    lastUsed?: Date;
  };
  
  /** Tool dependencies */
  dependencies?: string[];
  
  /** Security level required */
  securityLevel: 'low' | 'medium' | 'high';
}

export interface EnhancedToolDefinition extends ToolDefinition {
  /** Tool metadata */
  metadata: ToolMetadata;
  
  /** Whether the tool is currently enabled */
  enabled: boolean;
  
  /** Rate limiting configuration */
  rateLimit?: {
    maxCalls: number;
    timeWindow: number; // in milliseconds
  };
  
  /** Tool version */
  version: string;
}

export interface ToolExecutionContext {
  /** Agent context */
  agentId: string;
  
  /** Current task context */
  taskContext: {
    type: string;
    priority: 'low' | 'medium' | 'high';
    timeout?: number;
  };
  
  /** Available resources */
  resources: {
    cpu: number; // percentage available
    memory: number; // MB available
    networkAccess: boolean;
  };
}

export interface ToolSelectionCriteria {
  /** Required tool categories */
  categories?: string[];
  
  /** Maximum complexity allowed */
  maxComplexity?: number;
  
  /** Maximum execution time allowed */
  maxDuration?: number;
  
  /** Required security level */
  minSecurityLevel?: 'low' | 'medium' | 'high';
  
  /** Resource constraints */
  resourceConstraints?: {
    cpu?: 'low' | 'medium' | 'high';
    memory?: 'low' | 'medium' | 'high';
    network?: boolean;
  };
}

/**
 * Central tool registry with intelligent selection and management
 */
export class ToolRegistry extends EventEmitter {
  private tools: Map<string, EnhancedToolDefinition> = new Map();
  private rateLimitCache: Map<string, { count: number; resetTime: number }> = new Map();

  constructor() {
    super();
    
    // Clean up rate limit cache every minute
    setInterval(() => {
      const now = Date.now();
      const entries = Array.from(this.rateLimitCache.entries());
      for (const [toolName, limit] of entries) {
        if (now > limit.resetTime) {
          this.rateLimitCache.delete(toolName);
        }
      }
    }, 60000);
  }

  /**
   * Register a tool with the registry
   */
  registerTool(tool: EnhancedToolDefinition): void {
    // Validate tool definition
    this.validateTool(tool);
    
    this.tools.set(tool.name, tool);
    this.emit('toolRegistered', { toolName: tool.name, tool });
  }

  /**
   * Unregister a tool from the registry
   */
  unregisterTool(toolName: string): boolean {
    const removed = this.tools.delete(toolName);
    if (removed) {
      this.emit('toolUnregistered', { toolName });
    }
    return removed;
  }

  /**
   * Get a tool by name
   */
  getTool(toolName: string): EnhancedToolDefinition | undefined {
    return this.tools.get(toolName);
  }

  /**
   * Get all registered tools
   */
  getAllTools(): EnhancedToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category: string): EnhancedToolDefinition[] {
    return Array.from(this.tools.values()).filter(tool => 
      tool.metadata.category === category && tool.enabled
    );
  }

  /**
   * Intelligent tool selection based on criteria
   */
  selectTools(criteria: ToolSelectionCriteria): EnhancedToolDefinition[] {
    const availableTools = Array.from(this.tools.values()).filter(tool => tool.enabled);
    
    return availableTools.filter(tool => {
      // Check category filter
      if (criteria.categories && !criteria.categories.includes(tool.metadata.category)) {
        return false;
      }
      
      // Check complexity constraint
      if (criteria.maxComplexity && tool.metadata.complexity > criteria.maxComplexity) {
        return false;
      }
      
      // Check duration constraint
      if (criteria.maxDuration && tool.metadata.expectedDuration > criteria.maxDuration) {
        return false;
      }
      
      // Check security level
      if (criteria.minSecurityLevel && !this.meetSecurityLevel(tool.metadata.securityLevel, criteria.minSecurityLevel)) {
        return false;
      }
      
      // Check resource constraints
      if (criteria.resourceConstraints) {
        const constraints = criteria.resourceConstraints;
        if (constraints.cpu && !this.meetsResourceLevel(tool.metadata.resources.cpu, constraints.cpu)) {
          return false;
        }
        if (constraints.memory && !this.meetsResourceLevel(tool.metadata.resources.memory, constraints.memory)) {
          return false;
        }
        if (constraints.network !== undefined && tool.metadata.resources.network !== constraints.network) {
          return false;
        }
      }
      
      return true;
    }).sort((a, b) => {
      // Sort by success rate and recency
      const aScore = a.metadata.stats.successRate * (a.metadata.stats.lastUsed ? 1 : 0.5);
      const bScore = b.metadata.stats.successRate * (b.metadata.stats.lastUsed ? 1 : 0.5);
      return bScore - aScore;
    });
  }

  /**
   * Execute a tool with context and rate limiting
   */
  async executeTool(
    toolName: string, 
    parameters: Record<string, any>, 
    context: ToolExecutionContext
  ): Promise<any> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found`);
    }

    if (!tool.enabled) {
      throw new Error(`Tool '${toolName}' is disabled`);
    }

    // Check rate limiting
    if (tool.rateLimit && !this.checkRateLimit(toolName, tool.rateLimit)) {
      throw new Error(`Rate limit exceeded for tool '${toolName}'`);
    }

    const startTime = Date.now();
    
    try {
      this.emit('toolExecutionStart', { toolName, parameters, context });
      
      // Execute the tool
      const result = await tool.execute(parameters);
      
      const duration = Date.now() - startTime;
      
      // Update statistics
      this.updateToolStats(toolName, true, duration);
      
      this.emit('toolExecutionComplete', { toolName, result, duration });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Update statistics for failure
      this.updateToolStats(toolName, false, duration);
      
      this.emit('toolExecutionError', { toolName, error, duration });
      
      throw error;
    }
  }

  /**
   * Get tool usage statistics
   */
  getToolStats(toolName: string): ToolMetadata['stats'] | undefined {
    const tool = this.tools.get(toolName);
    return tool?.metadata.stats;
  }

  /**
   * Get registry statistics
   */
  getRegistryStats(): {
    totalTools: number;
    enabledTools: number;
    toolsByCategory: Record<string, number>;
    averageSuccessRate: number;
  } {
    const tools = Array.from(this.tools.values());
    const enabled = tools.filter(t => t.enabled);
    
    const toolsByCategory = tools.reduce((acc, tool) => {
      acc[tool.metadata.category] = (acc[tool.metadata.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const averageSuccessRate = tools.reduce((sum, tool) => 
      sum + tool.metadata.stats.successRate, 0) / tools.length;
    
    return {
      totalTools: tools.length,
      enabledTools: enabled.length,
      toolsByCategory,
      averageSuccessRate
    };
  }

  private validateTool(tool: EnhancedToolDefinition): void {
    if (!tool.name || typeof tool.name !== 'string') {
      throw new Error('Tool must have a valid name');
    }
    
    if (!tool.description || typeof tool.description !== 'string') {
      throw new Error('Tool must have a valid description');
    }
    
    if (!tool.execute || typeof tool.execute !== 'function') {
      throw new Error('Tool must have a valid execute function');
    }
    
    if (!tool.metadata || typeof tool.metadata !== 'object') {
      throw new Error('Tool must have valid metadata');
    }
  }

  private checkRateLimit(toolName: string, rateLimit: NonNullable<EnhancedToolDefinition['rateLimit']>): boolean {
    const now = Date.now();
    const current = this.rateLimitCache.get(toolName);
    
    if (!current || now > current.resetTime) {
      // Reset or initialize rate limit
      this.rateLimitCache.set(toolName, {
        count: 1,
        resetTime: now + rateLimit.timeWindow
      });
      return true;
    }
    
    if (current.count >= rateLimit.maxCalls) {
      return false;
    }
    
    current.count++;
    return true;
  }

  private updateToolStats(toolName: string, success: boolean, duration: number): void {
    const tool = this.tools.get(toolName);
    if (!tool) return;
    
    const stats = tool.metadata.stats;
    stats.totalCalls++;
    stats.lastUsed = new Date();
    
    // Update success rate (moving average)
    const successCount = stats.successRate * (stats.totalCalls - 1) + (success ? 1 : 0);
    stats.successRate = successCount / stats.totalCalls;
    
    // Update average duration (moving average)
    stats.averageDuration = (stats.averageDuration * (stats.totalCalls - 1) + duration) / stats.totalCalls;
  }

  private meetSecurityLevel(toolLevel: string, requiredLevel: string): boolean {
    const levels = { low: 1, medium: 2, high: 3 };
    return levels[toolLevel as keyof typeof levels] >= levels[requiredLevel as keyof typeof levels];
  }

  private meetsResourceLevel(toolLevel: string, maxLevel: string): boolean {
    const levels = { low: 1, medium: 2, high: 3 };
    return levels[toolLevel as keyof typeof levels] <= levels[maxLevel as keyof typeof levels];
  }
}

// Singleton instance
export const toolRegistry = new ToolRegistry();
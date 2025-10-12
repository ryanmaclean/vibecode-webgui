/**
 * MCP Context7Manager - Core implementation for managing context across seven dimensions
 */

import {
  TemporalContext,
  SpatialContext,
  StateContext,
  SemanticContext,
  UserContext,
  TaskContext,
  EnvironmentalContext,
  Context7InitOptions,
  IContext7Manager,
  Context7StorageProvider,
  Context7AIService
} from './interfaces';
import { logger } from '@/lib/logger';

/**
 * Context7Manager class - Manages all seven dimensions of context
 */
export class Context7Manager implements IContext7Manager {
  private temporalContext: TemporalContext;
  private spatialContext: SpatialContext;
  private stateContext: StateContext;
  private semanticContext: SemanticContext;
  private userContext: UserContext;
  private taskContext: TaskContext;
  private environmentalContext: EnvironmentalContext;
  private storageProvider?: Context7StorageProvider;
  private aiService?: Context7AIService;
  
  /**
   * Creates a new Context7Manager
   * @param initialContext Initial context values (optional)
   * @param storageProvider Storage provider for persistence (optional)
   * @param aiService AI service for context processing (optional)
   */
  constructor(
    initialContext?: Context7InitOptions,
    storageProvider?: Context7StorageProvider,
    aiService?: Context7AIService
  ) {
    // Initialize with defaults and any provided values
    this.temporalContext = {
      timestamp: Date.now(),
      sessionStartTime: Date.now(),
      actionHistory: [],
      frequencyMap: {},
      durations: {},
      ...initialContext?.temporal
    };
    
    this.spatialContext = {
      virtualLocation: {
        currentRoute: '/',
        previousRoute: '',
        navigationStack: ['/'],
        activeView: 'home',
        activeDialogs: []
      },
      ...initialContext?.spatial
    };
    
    this.stateContext = {
      applicationState: {},
      configuration: {},
      featureFlags: {},
      systemStatus: {
        online: true,
        performance: 'high',
        resources: {}
      },
      processState: {},
      ...initialContext?.state
    };
    
    this.semanticContext = {
      entities: new Map(),
      topics: new Map(),
      tags: [],
      taxonomies: {},
      ...initialContext?.semantic
    };
    
    this.userContext = {
      userId: 'anonymous',
      profile: {
        expertise: 'beginner',
        preferences: {}
      },
      authStatus: 'anonymous',
      permissions: [],
      behaviors: {
        preferences: {},
        patterns: {}
      },
      goals: [],
      ...initialContext?.user
    };
    
    this.taskContext = {
      taskStack: [],
      completedTasks: [],
      workflows: {},
      ...initialContext?.task
    };
    
    this.environmentalContext = {
      device: {
        type: 'desktop',
        screenSize: {
          width: 1920,
          height: 1080
        },
        touchEnabled: false
      },
      operatingSystem: {
        name: 'unknown',
        version: 'unknown',
        platform: 'unknown'
      },
      network: {
        type: 'unknown',
        speed: 'medium'
      },
      accessibility: {
        reducedMotion: false,
        highContrast: false,
        screenReader: false,
        fontSize: 16
      },
      ...initialContext?.environmental
    };
    
    this.storageProvider = storageProvider;
    this.aiService = aiService;
  }
  
  /**
   * Get temporal context
   */
  getTemporalContext(): TemporalContext {
    return { ...this.temporalContext };
  }
  
  /**
   * Get spatial context
   */
  getSpatialContext(): SpatialContext {
    return { ...this.spatialContext };
  }
  
  /**
   * Get state context
   */
  getStateContext(): StateContext {
    return { ...this.stateContext };
  }
  
  /**
   * Get semantic context
   */
  getSemanticContext(): SemanticContext {
    return { ...this.semanticContext };
  }
  
  /**
   * Get user context
   */
  getUserContext(): UserContext {
    return { ...this.userContext };
  }
  
  /**
   * Get task context
   */
  getTaskContext(): TaskContext {
    return { ...this.taskContext };
  }
  
  /**
   * Get environmental context
   */
  getEnvironmentalContext(): EnvironmentalContext {
    return { ...this.environmentalContext };
  }
  
  /**
   * Get full context (all dimensions)
   */
  getFullContext(): Context7InitOptions {
    return {
      temporal: this.getTemporalContext(),
      spatial: this.getSpatialContext(),
      state: this.getStateContext(),
      semantic: this.getSemanticContext(),
      user: this.getUserContext(),
      task: this.getTaskContext(),
      environmental: this.getEnvironmentalContext()
    };
  }
  
  /**
   * Update temporal context
   * @param update Partial temporal context update
   */
  updateTemporalContext(update: Partial<TemporalContext>): void {
    this.temporalContext = {
      ...this.temporalContext,
      ...update,
      timestamp: Date.now() // Always update timestamp
    };
  }
  
  /**
   * Update spatial context
   * @param update Partial spatial context update
   */
  updateSpatialContext(update: Partial<SpatialContext>): void {
    this.spatialContext = {
      ...this.spatialContext,
      ...update
    };
  }
  
  /**
   * Update state context
   * @param update Partial state context update
   */
  updateStateContext(update: Partial<StateContext>): void {
    this.stateContext = {
      ...this.stateContext,
      ...update
    };
  }
  
  /**
   * Update semantic context
   * @param update Partial semantic context update
   */
  updateSemanticContext(update: Partial<SemanticContext>): void {
    this.semanticContext = {
      ...this.semanticContext,
      ...update
    };
  }
  
  /**
   * Update user context
   * @param update Partial user context update
   */
  updateUserContext(update: Partial<UserContext>): void {
    this.userContext = {
      ...this.userContext,
      ...update
    };
  }
  
  /**
   * Update task context
   * @param update Partial task context update
   */
  updateTaskContext(update: Partial<TaskContext>): void {
    this.taskContext = {
      ...this.taskContext,
      ...update
    };
  }
  
  /**
   * Update environmental context
   * @param update Partial environmental context update
   */
  updateEnvironmentalContext(update: Partial<EnvironmentalContext>): void {
    this.environmentalContext = {
      ...this.environmentalContext,
      ...update
    };
  }
  
  /**
   * Record a user action
   * @param action Action name
   * @param metadata Additional action metadata
   * @returns The action record
   */
  recordUserAction(action: string, metadata?: any): any {
    const actionRecord = {
      action,
      timestamp: Date.now(),
      metadata
    };
    
    // Add to action history
    this.temporalContext.actionHistory.push(actionRecord);
    
    // Update frequency map
    this.temporalContext.frequencyMap[action] = 
      (this.temporalContext.frequencyMap[action] || 0) + 1;
    
    // Update virtual location if it's a navigation action
    if (action.startsWith('navigate_to_')) {
      const route = action.replace('navigate_to_', '');
      this.updateSpatialContext({
        virtualLocation: {
          ...this.spatialContext.virtualLocation,
          previousRoute: this.spatialContext.virtualLocation.currentRoute,
          currentRoute: route,
          navigationStack: [
            ...this.spatialContext.virtualLocation.navigationStack,
            route
          ]
        }
      });
    }
    
    return actionRecord;
  }
  
  /**
   * Serialize context to string
   * @returns Serialized context
   */
  serialize(): string {
    const context = this.getFullContext();
    return JSON.stringify(context);
  }
  
  /**
   * Deserialize context from string
   * @param serialized Serialized context
   * @returns Success flag
   */
  deserialize(serialized: string): boolean {
    try {
      const parsed = JSON.parse(serialized) as Context7InitOptions;
      
      if (parsed.temporal) this.updateTemporalContext(parsed.temporal);
      if (parsed.spatial) this.updateSpatialContext(parsed.spatial);
      if (parsed.state) this.updateStateContext(parsed.state);
      if (parsed.semantic) this.updateSemanticContext(parsed.semantic);
      if (parsed.user) this.updateUserContext(parsed.user);
      if (parsed.task) this.updateTaskContext(parsed.task);
      if (parsed.environmental) this.updateEnvironmentalContext(parsed.environmental);
      
      return true;
    } catch (error) {
      logger.error('Failed to deserialize context:', error);
      return false;
    }
  }
  
  /**
   * Create Context7Manager from serialized string
   * @param serialized Serialized context
   * @returns New Context7Manager instance
   */
  static deserialize(serialized: string): Context7Manager {
    try {
      const parsed = JSON.parse(serialized) as Context7InitOptions;
      return new Context7Manager(parsed);
    } catch (error) {
      logger.error('Failed to deserialize context:', error);
      return new Context7Manager();
    }
  }
  
  /**
   * Process the current context with the AI service
   * @returns AI-generated response
   */
  async processWithAI(): Promise<any> {
    if (!this.aiService) {
      throw new Error('AI service is not configured');
    }
    
    const context = this.getFullContext();
    return this.aiService.processContext(context);
  }
}

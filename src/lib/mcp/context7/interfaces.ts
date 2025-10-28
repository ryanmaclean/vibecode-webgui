/**
 * MCP Context7 Interfaces
 * Defines the interfaces for the seven dimensions of context and the Context7Manager
 */

/**
 * Temporal context - time-based information and historical patterns
 */
export interface TemporalContext {
  timestamp: number;                  // Current timestamp
  sessionStartTime: number;           // When the current session began
  actionHistory: Array<{              // Record of user actions
    action: string;                   // What action was performed
    timestamp: number;                // When it occurred
    metadata?: any;                   // Additional action-specific data
  }>;
  frequencyMap: Record<string, number>; // Action frequency counts
  durations: Record<string, number>;    // Task/process durations
}

/**
 * Spatial context - location-based information in physical or virtual spaces
 */
export interface SpatialContext {
  physicalLocation?: {               // Physical location (if available)
    coordinates?: {
      latitude: number;
      longitude: number;
    };
    region?: string;                 // Named region
    accuracy?: number;               // Accuracy in meters
  };
  virtualLocation: {                 // Virtual location
    currentRoute: string;            // Current application route/page
    previousRoute: string;           // Previous route
    navigationStack: string[];       // Navigation history
    activeView: string;              // Currently active view component
    activeDialogs: string[];         // Open dialogs/modals
  };
  proximity?: Record<string, number>; // Distances to important locations
}

/**
 * State context - current application state and configuration
 */
export interface StateContext {
  applicationState: Record<string, any>;     // Key-value state store
  configuration: Record<string, any>;        // App configuration
  featureFlags: Record<string, boolean>;     // Enabled/disabled features
  systemStatus: {                            // System status
    online: boolean;                         // Network connectivity
    performance: 'high' | 'medium' | 'low';  // Performance level
    resources: Record<string, number>;       // Resource utilization
  };
  processState: Record<string, string>;      // States of ongoing processes
}

/**
 * Semantic context - meaning, relationships, and conceptual understanding
 */
export interface SemanticContext {
  entities: Map<string, {                   // Named entities
    type: string;                           // Entity type
    attributes: Record<string, any>;        // Entity attributes
    relationships?: Record<string, string[]>; // Related entities
  }>;
  topics: Map<string, number>;              // Active topics with relevance scores
  tags: string[];                           // Semantic tags
  taxonomies: Record<string, string[]>;     // Categorization systems
  knowledgeGraph?: any;                     // Structured knowledge representation
}

/**
 * User context - user-specific information and personalization
 */
export interface UserContext {
  userId: string;                          // Unique user identifier
  profile: {                               // User profile
    name?: string;                         // User name
    email?: string;                        // User email
    role?: string;                         // User role
    expertise: 'beginner' | 'intermediate' | 'advanced'; // Skill level
    preferences: Record<string, any>;      // User preferences
  };
  authStatus: 'anonymous' | 'authenticated' | 'verified'; // Authentication status
  permissions: string[];                   // User permissions
  behaviors: {                             // Observed behavioral patterns
    preferences: Record<string, any>;      // Inferred preferences
    patterns: Record<string, any>;         // Usage patterns
  };
  goals?: string[];                        // Current user goals
}

/**
 * Task context - goals, tasks, and activities
 */
export interface TaskContext {
  currentTask?: {                          // Currently active task
    id: string;                            // Task identifier
    description: string;                   // Task description
    status: 'pending' | 'in_progress' | 'completed' | 'failed'; // Task status
    progress: number;                      // Completion percentage (0-100)
    startTime?: number;                    // When task was started
    deadline?: number;                     // Task deadline
    metadata?: Record<string, any>;        // Additional task data
  };
  taskStack: Array<{                       // Stack of tasks (for nested tasks)
    id: string;
    description: string;
  }>;
  completedTasks: string[];                // Recently completed task IDs
  taskGraph?: Record<string, string[]>;    // Task dependencies
  workflows: Record<string, {              // Defined workflows
    steps: string[];                       // Workflow steps
    currentStep?: string;                  // Current step in workflow
  }>;
}

/**
 * Environmental context - system and technical environment details
 */
export interface EnvironmentalContext {
  device: {                                // Device information
    type: 'desktop' | 'tablet' | 'mobile' | 'other';
    orientation?: 'portrait' | 'landscape';
    screenSize: {
      width: number;
      height: number;
    };
    touchEnabled: boolean;
  };
  browser?: {                              // Browser information (if applicable)
    name: string;
    version: string;
    language: string;
    cookiesEnabled: boolean;
  };
  operatingSystem: {                       // OS information
    name: string;
    version: string;
    platform: string;
  };
  network: {                               // Network conditions
    type?: string;                         // Connection type
    speed?: 'slow' | 'medium' | 'fast';    // Connection speed
    latency?: number;                      // Latency in ms
  };
  accessibility: {                         // Accessibility settings
    reducedMotion: boolean;
    highContrast: boolean;
    screenReader: boolean;
    fontSize: number;
  };
}

/**
 * Context7 initialization options
 */
export interface Context7InitOptions {
  temporal?: Partial<TemporalContext>;
  spatial?: Partial<SpatialContext>;
  state?: Partial<StateContext>;
  semantic?: Partial<SemanticContext>;
  user?: Partial<UserContext>;
  task?: Partial<TaskContext>;
  environmental?: Partial<EnvironmentalContext>;
}

/**
 * Storage provider interface for Context7
 */
export interface Context7StorageProvider {
  save(key: string, data: any): Promise<boolean>;
  load(key: string): Promise<any | null>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<boolean>;
}

/**
 * Context7Manager interface 
 */
export interface IContext7Manager {
  getTemporalContext(): TemporalContext;
  getSpatialContext(): SpatialContext;
  getStateContext(): StateContext;
  getSemanticContext(): SemanticContext;
  getUserContext(): UserContext;
  getTaskContext(): TaskContext;
  getEnvironmentalContext(): EnvironmentalContext;
  getFullContext(): Context7InitOptions;
  
  updateTemporalContext(update: Partial<TemporalContext>): void;
  updateSpatialContext(update: Partial<SpatialContext>): void;
  updateStateContext(update: Partial<StateContext>): void;
  updateSemanticContext(update: Partial<SemanticContext>): void;
  updateUserContext(update: Partial<UserContext>): void;
  updateTaskContext(update: Partial<TaskContext>): void;
  updateEnvironmentalContext(update: Partial<EnvironmentalContext>): void;
  
  recordUserAction(action: string, metadata?: any): any;
  
  serialize(): string;
  deserialize(serialized: string): boolean;
}

/**
 * AI Service interface for Context7
 */
export interface Context7AIService {
  /**
   * Processes the full context with an AI service to get insights or actions.
   * @param context - The full context from the Context7Manager.
   * @returns A promise that resolves to an AI-generated response.
   */
  processContext(context: Context7InitOptions): Promise<any>;
}

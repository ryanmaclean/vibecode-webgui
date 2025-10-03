/**
 * MCP Serena Interfaces
 * Defines the interfaces for Serena components for code-server integration
 */

/**
 * Serena project configuration
 */
export interface SerenaProjectConfig {
  id: string;                        // Unique project identifier
  name: string;                      // Project name
  description?: string;              // Project description
  repositoryUrl?: string;            // Git repository URL
  workspacePath: string;             // Local workspace path
  language: string;                  // Primary programming language
  frameworks: string[];              // Frameworks used
  aiAssistants: string[];            // AI assistants to enable
  tools: SerenaToolConfig[];         // Tools configuration
  memoryConfig: SerenaMemoryConfig;  // Memory configuration
}

/**
 * Serena tool configuration
 */
export interface SerenaToolConfig {
  id: string;                        // Tool identifier
  name: string;                      // Tool name
  type: string;                      // Tool type
  command?: string;                  // Command to execute
  apiEndpoint?: string;              // API endpoint for the tool
  parameters?: Record<string, any>;  // Tool parameters
  enabled: boolean;                  // Whether the tool is enabled
}

/**
 * Serena memory configuration
 */
export interface SerenaMemoryConfig {
  persistenceLevel: 'session' | 'project' | 'global';  // Memory persistence level
  contextRetention: number;                           // Context retention in tokens
  vectorStorage: boolean;                              // Whether to use vector storage
  fileTypes: string[];                                 // File types to include in memory
  excludePatterns: string[];                           // Patterns to exclude
}

/**
 * Serena workspace state
 */
export interface SerenaWorkspaceState {
  projectId: string;                                  // Project identifier
  sessionId: string;                                  // Session identifier
  status: 'initializing' | 'running' | 'stopped';     // Workspace status
  resources: {
    cpu: number;                                      // CPU allocation
    memory: number;                                   // Memory allocation
    storage: number;                                  // Storage allocation
  };
  activeFiles: string[];                              // Currently open files
  runningProcesses: SerenaProcess[];                  // Running processes
  recentCommands: string[];                           // Recently executed commands
}

/**
 * Serena process information
 */
export interface SerenaProcess {
  id: string;                                         // Process identifier
  name: string;                                       // Process name
  command: string;                                    // Command that started the process
  status: 'running' | 'stopped' | 'failed';           // Process status
  startTime: number;                                  // Process start time
  endTime?: number;                                   // Process end time
  exitCode?: number;                                  // Process exit code
  output?: string;                                    // Process output
}

/**
 * Serena memory entry
 */
export interface SerenaMemoryEntry {
  id: string;                                         // Memory entry identifier
  timestamp: number;                                  // Entry timestamp
  type: 'code' | 'command' | 'file' | 'insight';      // Entry type
  content: string;                                    // Entry content
  metadata: Record<string, any>;                      // Additional metadata
  projectId: string;                                  // Associated project
  embedding?: number[];                               // Vector embedding
  tags: string[];                                     // Entry tags
}

/**
 * Serena search result
 */
export interface SerenaSearchResult {
  entry: SerenaMemoryEntry;                           // Memory entry
  score: number;                                      // Search relevance score
  context: string;                                    // Context around the match
}

/**
 * Serena code file
 */
export interface SerenaCodeFile {
  path: string;                                       // File path
  content: string;                                    // File content
  language: string;                                   // Programming language
  lastModified: number;                               // Last modification timestamp
  metadata: Record<string, any>;                      // Additional metadata
}

/**
 * Serena Project Manager interface
 */
export interface ISerenaProjectManager {
  // Project management
  createProject(config: SerenaProjectConfig): Promise<string>;
  getProject(id: string): Promise<SerenaProjectConfig | null>;
  updateProject(id: string, updates: Partial<SerenaProjectConfig>): Promise<boolean>;
  deleteProject(id: string): Promise<boolean>;
  listProjects(): Promise<SerenaProjectConfig[]>;
  
  // Workspace management
  startWorkspace(projectId: string): Promise<SerenaWorkspaceState>;
  stopWorkspace(projectId: string): Promise<boolean>;
  getWorkspaceState(projectId: string): Promise<SerenaWorkspaceState | null>;
  
  // Tool management
  enableTool(projectId: string, toolId: string): Promise<boolean>;
  disableTool(projectId: string, toolId: string): Promise<boolean>;
  configureTool(projectId: string, toolId: string, config: Partial<SerenaToolConfig>): Promise<boolean>;
}

/**
 * Serena Code-Server Client interface
 */
export interface ISerenaCodeServerClient {
  // Server management
  startServer(projectId: string, options?: any): Promise<string>;
  stopServer(projectId: string): Promise<boolean>;
  restartServer(projectId: string): Promise<boolean>;
  getServerStatus(projectId: string): Promise<'running' | 'stopped' | 'error'>;
  
  // File operations
  readFile(projectId: string, path: string): Promise<SerenaCodeFile | null>;
  writeFile(projectId: string, path: string, content: string): Promise<boolean>;
  listFiles(projectId: string, directory: string): Promise<string[]>;
  createDirectory(projectId: string, path: string): Promise<boolean>;
  
  // Process management
  executeCommand(projectId: string, command: string): Promise<SerenaProcess>;
  getProcess(projectId: string, processId: string): Promise<SerenaProcess | null>;
  killProcess(projectId: string, processId: string): Promise<boolean>;
  
  // Terminal operations
  openTerminal(projectId: string): Promise<string>;
  sendToTerminal(projectId: string, terminalId: string, input: string): Promise<boolean>;
}

/**
 * Serena Memory Store interface
 */
export interface ISerenaMemoryStore {
  // Memory management
  addEntry(entry: Omit<SerenaMemoryEntry, 'id' | 'timestamp'>): Promise<string>;
  getEntry(id: string): Promise<SerenaMemoryEntry | null>;
  updateEntry(id: string, updates: Partial<SerenaMemoryEntry>): Promise<boolean>;
  deleteEntry(id: string): Promise<boolean>;
  
  // Search operations
  search(query: string, options?: {
    projectId?: string;
    type?: string;
    limit?: number;
    tags?: string[];
  }): Promise<SerenaSearchResult[]>;
  
  searchSimilar(embedding: number[], options?: {
    projectId?: string;
    type?: string;
    limit?: number;
    tags?: string[];
  }): Promise<SerenaSearchResult[]>;
  
  // Analysis operations
  getProjectInsights(projectId: string): Promise<any>;
  getSessionHistory(projectId: string, sessionId: string): Promise<SerenaMemoryEntry[]>;
  
  // Memory maintenance
  pruneMemory(projectId: string, olderThan?: number): Promise<number>;
  exportMemory(projectId: string): Promise<any>;
  importMemory(projectId: string, data: any): Promise<boolean>;
}

/**
 * Serena Tool interface
 */
export interface ISerenaTool {
  id: string;                           // Tool identifier
  name: string;                         // Tool name
  description: string;                  // Tool description
  
  // Tool execution
  execute(params: any): Promise<any>;
  
  // Tool management
  isEnabled(): boolean;
  enable(): void;
  disable(): void;
  configure(config: any): void;
  
  // Tool metadata
  getMetadata(): any;
}
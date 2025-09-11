/**
 * MCP Serena Project Manager
 * Core implementation for managing Serena projects and workspaces
 */

import {
  SerenaProjectConfig,
  SerenaWorkspaceState,
  SerenaToolConfig,
  ISerenaProjectManager
} from './interfaces';

/**
 * SerenaProjectManager class for managing projects and workspaces
 */
export class SerenaProjectManager implements ISerenaProjectManager {
  private projects: Map<string, SerenaProjectConfig>;
  private workspaces: Map<string, SerenaWorkspaceState>;

  /**
   * Creates a new SerenaProjectManager
   */
  constructor() {
    this.projects = new Map<string, SerenaProjectConfig>();
    this.workspaces = new Map<string, SerenaWorkspaceState>();
  }

  /**
   * Create a new project
   * @param config Project configuration
   * @returns Project ID
   */
  async createProject(config: SerenaProjectConfig): Promise<string> {
    // Use provided ID or generate a new one
    const projectId = config.id || `project-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Set the ID in the config
    const projectConfig: SerenaProjectConfig = {
      ...config,
      id: projectId
    };
    
    // Store the project configuration
    this.projects.set(projectId, projectConfig);
    
    return projectId;
  }

  /**
   * Get a project by ID
   * @param id Project ID
   * @returns Project configuration or null if not found
   */
  async getProject(id: string): Promise<SerenaProjectConfig | null> {
    return this.projects.get(id) || null;
  }

  /**
   * Update a project
   * @param id Project ID
   * @param updates Partial project configuration updates
   * @returns Success flag
   */
  async updateProject(id: string, updates: Partial<SerenaProjectConfig>): Promise<boolean> {
    const project = this.projects.get(id);
    if (!project) {
      return false;
    }
    
    // Update project configuration
    this.projects.set(id, {
      ...project,
      ...updates,
      id // Ensure ID doesn't change
    });
    
    return true;
  }

  /**
   * Delete a project
   * @param id Project ID
   * @returns Success flag
   */
  async deleteProject(id: string): Promise<boolean> {
    // Check if project exists
    if (!this.projects.has(id)) {
      return false;
    }
    
    // Delete project configuration
    this.projects.delete(id);
    
    // Delete workspace if it exists
    this.workspaces.delete(id);
    
    return true;
  }

  /**
   * List all projects
   * @returns Array of project configurations
   */
  async listProjects(): Promise<SerenaProjectConfig[]> {
    return Array.from(this.projects.values());
  }

  /**
   * Start a workspace for a project
   * @param projectId Project ID
   * @returns Workspace state
   */
  async startWorkspace(projectId: string): Promise<SerenaWorkspaceState> {
    // Check if project exists
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    // Generate session ID
    const sessionId = `session-${Date.now()}`;
    
    // Create workspace state
    const workspaceState: SerenaWorkspaceState = {
      projectId,
      sessionId,
      status: 'initializing',
      resources: {
        cpu: 1,
        memory: 512,
        storage: 1024
      },
      activeFiles: [],
      runningProcesses: [],
      recentCommands: []
    };
    
    // Store workspace state
    this.workspaces.set(projectId, workspaceState);
    
    // Simulate workspace initialization
    setTimeout(() => {
      const workspace = this.workspaces.get(projectId);
      if (workspace) {
        workspace.status = 'running';
        this.workspaces.set(projectId, workspace);
      }
    }, 1000);
    
    return workspaceState;
  }

  /**
   * Stop a workspace
   * @param projectId Project ID
   * @returns Success flag
   */
  async stopWorkspace(projectId: string): Promise<boolean> {
    // Check if workspace exists
    const workspace = this.workspaces.get(projectId);
    if (!workspace) {
      return false;
    }
    
    // Update workspace status
    workspace.status = 'stopped';
    this.workspaces.set(projectId, workspace);
    
    return true;
  }

  /**
   * Get workspace state
   * @param projectId Project ID
   * @returns Workspace state or null if not found
   */
  async getWorkspaceState(projectId: string): Promise<SerenaWorkspaceState | null> {
    return this.workspaces.get(projectId) || null;
  }

  /**
   * Enable a tool for a project
   * @param projectId Project ID
   * @param toolId Tool ID
   * @returns Success flag
   */
  async enableTool(projectId: string, toolId: string): Promise<boolean> {
    // Check if project exists
    const project = this.projects.get(projectId);
    if (!project) {
      return false;
    }
    
    // Find tool in project configuration
    const toolIndex = project.tools.findIndex(tool => tool.id === toolId);
    if (toolIndex === -1) {
      return false;
    }
    
    // Enable tool
    project.tools[toolIndex].enabled = true;
    this.projects.set(projectId, project);
    
    return true;
  }

  /**
   * Disable a tool for a project
   * @param projectId Project ID
   * @param toolId Tool ID
   * @returns Success flag
   */
  async disableTool(projectId: string, toolId: string): Promise<boolean> {
    // Check if project exists
    const project = this.projects.get(projectId);
    if (!project) {
      return false;
    }
    
    // Find tool in project configuration
    const toolIndex = project.tools.findIndex(tool => tool.id === toolId);
    if (toolIndex === -1) {
      return false;
    }
    
    // Disable tool
    project.tools[toolIndex].enabled = false;
    this.projects.set(projectId, project);
    
    return true;
  }

  /**
   * Configure a tool for a project
   * @param projectId Project ID
   * @param toolId Tool ID
   * @param config Partial tool configuration updates
   * @returns Success flag
   */
  async configureTool(
    projectId: string, 
    toolId: string, 
    config: Partial<SerenaToolConfig>
  ): Promise<boolean> {
    // Check if project exists
    const project = this.projects.get(projectId);
    if (!project) {
      return false;
    }
    
    // Find tool in project configuration
    const toolIndex = project.tools.findIndex(tool => tool.id === toolId);
    if (toolIndex === -1) {
      return false;
    }
    
    // Update tool configuration
    project.tools[toolIndex] = {
      ...project.tools[toolIndex],
      ...config,
      id: toolId // Ensure ID doesn't change
    };
    
    this.projects.set(projectId, project);
    
    return true;
  }
}
# Tool Integration Strategy

## Overview

VibeCode's tool integration system enables developers to use specialized AI coding tools (Aider, Goose, GitHub Copilot CLI, etc.) within their workspaces with zero configuration overhead. This document outlines integration patterns, routing strategies, and implementation details.

## Integration Architecture

### Three-Layer Model

```
┌─────────────────────────────────────────────────────────────┐
│                   Layer 1: Tool Registry                     │
│  (Capabilities, requirements, performance characteristics)   │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                Layer 2: Intelligent Router                   │
│      (Task classification, tool selection, fallback)         │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              Layer 3: Tool Execution Manager                 │
│   (Pre-configuration, MCP connection, result streaming)      │
└──────────────────────────────────────────────────────────────┘
```

## Supported Tools

### 1. Aider - Precision Code Editor

**Strengths**:
- Surgical refactoring with minimal diff size
- Excellent at following instructions precisely
- Strong test generation capabilities
- Git-aware (auto-commits with semantic messages)

**Weaknesses**:
- Limited architectural reasoning
- Not ideal for exploratory tasks
- Requires clear, specific instructions

**Optimal Use Cases**:
- Function-level refactoring
- Bug fixes with known location
- Test generation for existing code
- Documentation updates

**MCP Configuration**:
```json
{
  "tool": "aider",
  "mcpServer": "workspace://mcp",
  "resources": ["workspace://files/**", "workspace://git/status"],
  "tools": ["edit_file", "git_operation"],
  "apiKey": "$ANTHROPIC_API_KEY",
  "model": "claude-3-5-sonnet-20241022"
}
```

**Installation Command**:
```bash
pip install aider-chat
aider --install-completion
```

### 2. Goose - Complex Reasoning Engine

**Strengths**:
- Deep architectural analysis
- Multi-step problem solving
- Hypothesis testing and validation
- Strong debugging capabilities

**Weaknesses**:
- Slower than Aider for simple tasks
- Higher token usage
- Overkill for straightforward edits

**Optimal Use Cases**:
- Debugging complex issues
- Architectural refactoring
- Performance optimization
- Security vulnerability analysis

**MCP Configuration**:
```json
{
  "tool": "goose",
  "mcpServer": "workspace://mcp",
  "resources": [
    "workspace://files/**",
    "workspace://git/history",
    "workspace://terminal/output"
  ],
  "tools": ["execute_command", "edit_file"],
  "apiKey": "$OPENAI_API_KEY",
  "model": "gpt-4-turbo-preview"
}
```

**Installation Command**:
```bash
pip install goose-ai
goose config --workspace /workspace
```

### 3. GitHub Copilot CLI - Quick Suggestions

**Strengths**:
- Extremely fast (<500ms latency)
- Excellent for common patterns
- Git operation suggestions
- Natural language to command translation

**Weaknesses**:
- Limited context window
- Not suitable for large refactors
- Requires GitHub subscription

**Optimal Use Cases**:
- Git command suggestions
- Quick code completions
- Shell command generation
- Common pattern implementation

**MCP Configuration**:
```json
{
  "tool": "copilot-cli",
  "mcpServer": "workspace://mcp",
  "resources": ["workspace://git/status"],
  "tools": ["execute_command", "git_operation"],
  "auth": "$GITHUB_TOKEN"
}
```

**Installation Command**:
```bash
gh extension install github/gh-copilot
gh copilot config
```

### 4. Claude Code (Native VibeCode)

**Strengths**:
- Full platform integration
- Multi-step workflow orchestration
- TodoWrite task management
- Session persistence

**Weaknesses**:
- Not specialized for specific tasks
- Higher overhead for simple operations

**Optimal Use Cases**:
- Complex multi-file workflows
- Feature implementation (>3 files)
- Project initialization
- Cross-cutting concerns

**Configuration**:
```json
{
  "tool": "claude-code",
  "mcpServer": "workspace://mcp",
  "resources": ["workspace://**"],
  "tools": ["*"],
  "native": true
}
```

## Intelligent Routing System

### Task Classification Engine

```typescript
interface DevelopmentTask {
  type: TaskType;
  scope: TaskScope;
  complexity: number;  // 0-1 scale
  files: string[];
  context: string;
  urgency: 'low' | 'medium' | 'high';
}

enum TaskType {
  REFACTOR = 'refactor',
  DEBUG = 'debug',
  FEATURE = 'feature',
  TEST = 'test',
  DOCS = 'docs',
  OPTIMIZE = 'optimize',
  FIX = 'fix',
  COMPLETION = 'completion'
}

enum TaskScope {
  LINE = 'line',        // Single line edit
  FUNCTION = 'function', // Function-level change
  FILE = 'file',        // Single file modification
  MODULE = 'module',    // Multiple related files
  PROJECT = 'project'   // Cross-cutting changes
}
```

### Routing Decision Matrix

```typescript
class ToolRouter {
  selectTool(task: DevelopmentTask): AITool {
    // Rule 1: Quick completions → Copilot CLI
    if (task.type === TaskType.COMPLETION && task.scope === TaskScope.LINE) {
      return Tools.CopilotCLI;
    }

    // Rule 2: Surgical edits → Aider
    if (
      task.type === TaskType.REFACTOR &&
      task.scope === TaskScope.FUNCTION &&
      task.complexity < 0.5
    ) {
      return Tools.Aider;
    }

    // Rule 3: Complex debugging → Goose
    if (
      task.type === TaskType.DEBUG &&
      task.complexity > 0.7
    ) {
      return Tools.Goose;
    }

    // Rule 4: Test generation → Aider
    if (task.type === TaskType.TEST) {
      return Tools.Aider;
    }

    // Rule 5: Architectural changes → Goose
    if (
      task.scope === TaskScope.PROJECT &&
      task.type === TaskType.REFACTOR
    ) {
      return Tools.Goose;
    }

    // Rule 6: Multi-file workflows → Claude Code
    if (
      task.scope === TaskScope.MODULE &&
      task.files.length > 3
    ) {
      return Tools.ClaudeCode;
    }

    // Rule 7: Git operations → Copilot CLI
    if (task.context.includes('git') || task.context.includes('commit')) {
      return Tools.CopilotCLI;
    }

    // Rule 8: Performance optimization → Goose
    if (task.type === TaskType.OPTIMIZE) {
      return Tools.Goose;
    }

    // Default: Claude Code for maximum capability
    return Tools.ClaudeCode;
  }

  // User can override routing decision
  selectToolWithOverride(
    task: DevelopmentTask,
    userPreference?: AITool
  ): AITool {
    if (userPreference && this.validateToolForTask(userPreference, task)) {
      return userPreference;
    }
    return this.selectTool(task);
  }

  private validateToolForTask(tool: AITool, task: DevelopmentTask): boolean {
    const toolCapabilities = this.toolRegistry.get(tool);

    // Check if tool supports required operations
    if (task.type === TaskType.DEBUG && !toolCapabilities.supportsDebugging) {
      return false;
    }

    // Check if tool can handle scope
    if (task.scope === TaskScope.PROJECT && !toolCapabilities.supportsMultiFile) {
      return false;
    }

    return true;
  }
}
```

### Routing Examples

**Example 1: Simple Refactoring**
```typescript
const task = {
  type: TaskType.REFACTOR,
  scope: TaskScope.FUNCTION,
  complexity: 0.3,
  files: ['src/utils/helpers.ts'],
  context: 'Extract duplicate validation logic into a separate function'
};

// Router selects: Aider
// Rationale: Precise, function-level change with low complexity
```

**Example 2: Complex Debugging**
```typescript
const task = {
  type: TaskType.DEBUG,
  scope: TaskScope.MODULE,
  complexity: 0.9,
  files: ['src/auth/*.ts', 'src/middleware/*.ts'],
  context: 'Users are sometimes logged out randomly. Investigate session management.'
};

// Router selects: Goose
// Rationale: Multi-file debugging requiring hypothesis testing
```

**Example 3: Quick Git Command**
```typescript
const task = {
  type: TaskType.COMPLETION,
  scope: TaskScope.LINE,
  complexity: 0.1,
  files: [],
  context: 'undo last commit but keep changes'
};

// Router selects: Copilot CLI
// Rationale: Fast git command suggestion
```

**Example 4: Feature Implementation**
```typescript
const task = {
  type: TaskType.FEATURE,
  scope: TaskScope.MODULE,
  complexity: 0.7,
  files: ['src/api/users.ts', 'src/models/User.ts', 'tests/api/users.test.ts'],
  context: 'Add user profile picture upload with S3 integration'
};

// Router selects: Claude Code
// Rationale: Multi-file feature requiring orchestration
```

## Pre-Configuration System

### One-Click Installation Flow

```typescript
interface ToolInstallation {
  toolId: string;
  status: 'pending' | 'installing' | 'configured' | 'failed';
  config: ToolConfig;
  error?: string;
}

class ToolInstaller {
  async installTool(workspaceId: string, toolId: string): Promise<ToolInstallation> {
    const workspace = await this.getWorkspace(workspaceId);
    const toolSpec = this.toolRegistry.get(toolId);

    // Step 1: Install dependencies
    await this.executeMCPTool(workspace, 'execute_command', {
      command: toolSpec.installCommand,
      timeout: 60000
    });

    // Step 2: Configure API keys
    await this.injectSecrets(workspace, toolSpec.requiredSecrets);

    // Step 3: Configure MCP connection
    await this.configureMCPClient(workspace, toolSpec.mcpConfig);

    // Step 4: Run validation
    const isValid = await this.validateInstallation(workspace, toolId);

    if (!isValid) {
      throw new Error(`Tool installation validation failed: ${toolId}`);
    }

    return {
      toolId,
      status: 'configured',
      config: toolSpec.mcpConfig
    };
  }

  private async injectSecrets(
    workspace: Workspace,
    secrets: string[]
  ): Promise<void> {
    for (const secretKey of secrets) {
      const secretValue = await this.secretsManager.get(workspace.userId, secretKey);

      if (!secretValue) {
        throw new Error(`Missing required secret: ${secretKey}`);
      }

      // Inject as environment variable in workspace
      await this.executeMCPTool(workspace, 'execute_command', {
        command: `echo "export ${secretKey}=${secretValue}" >> ~/.bashrc`,
        shell: 'bash'
      });
    }
  }

  private async configureMCPClient(
    workspace: Workspace,
    mcpConfig: MCPClientConfig
  ): Promise<void> {
    // Create MCP client configuration file
    const configPath = `${workspace.path}/.mcp/${mcpConfig.tool}.json`;
    const configContent = JSON.stringify(mcpConfig, null, 2);

    await this.executeMCPTool(workspace, 'edit_file', {
      path: configPath,
      changes: [
        {
          operation: 'insert',
          line: 1,
          content: configContent
        }
      ]
    });
  }

  private async validateInstallation(
    workspace: Workspace,
    toolId: string
  ): Promise<boolean> {
    const toolSpec = this.toolRegistry.get(toolId);

    // Run tool-specific validation command
    const result = await this.executeMCPTool(workspace, 'execute_command', {
      command: toolSpec.validationCommand,
      timeout: 10000
    });

    return result.exitCode === 0;
  }
}
```

### UI for Tool Management

```typescript
// React component for tool installation
const ToolManagementPanel: React.FC<{ workspaceId: string }> = ({ workspaceId }) => {
  const [tools, setTools] = useState<ToolInstallation[]>([]);
  const [installing, setInstalling] = useState<string | null>(null);

  const installTool = async (toolId: string) => {
    setInstalling(toolId);
    try {
      const result = await api.installTool(workspaceId, toolId);
      setTools([...tools, result]);
      toast.success(`${toolId} installed successfully`);
    } catch (error) {
      toast.error(`Failed to install ${toolId}: ${error.message}`);
    } finally {
      setInstalling(null);
    }
  };

  return (
    <div className="tool-management">
      <h2>AI Coding Tools</h2>
      <div className="tool-grid">
        {AVAILABLE_TOOLS.map(tool => (
          <ToolCard
            key={tool.id}
            tool={tool}
            isInstalled={tools.some(t => t.toolId === tool.id)}
            isInstalling={installing === tool.id}
            onInstall={() => installTool(tool.id)}
          />
        ))}
      </div>
    </div>
  );
};
```

## Tool Configuration Persistence

### Configuration Storage

```typescript
interface ToolConfig {
  toolId: string;
  version: string;
  mcpConfig: MCPClientConfig;
  preferences: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
  lastUsed: Date;
  usageStats: {
    invocations: number;
    successRate: number;
    avgLatency: number;
  };
}

class ToolConfigManager {
  // Store in workspace metadata
  async saveConfig(workspaceId: string, config: ToolConfig): Promise<void> {
    await this.db.workspaceConfigs.upsert({
      workspaceId,
      toolId: config.toolId,
      config: JSON.stringify(config),
      updatedAt: new Date()
    });

    // Also persist in workspace filesystem for offline access
    await this.writeMCPTool(workspaceId, 'edit_file', {
      path: `.vibecode/tools/${config.toolId}.json`,
      changes: [
        {
          operation: 'replace',
          line: 1,
          content: JSON.stringify(config, null, 2)
        }
      ]
    });
  }

  async loadConfig(workspaceId: string, toolId: string): Promise<ToolConfig> {
    // Try database first
    const dbConfig = await this.db.workspaceConfigs.findOne({
      workspaceId,
      toolId
    });

    if (dbConfig) {
      return JSON.parse(dbConfig.config);
    }

    // Fallback to filesystem
    const fsConfig = await this.readMCPResource(
      workspaceId,
      `workspace://files/.vibecode/tools/${toolId}.json`
    );

    return JSON.parse(fsConfig.text);
  }
}
```

## Usage Documentation Generation

### Auto-Generated Tool Guides

```typescript
class ToolDocumentationGenerator {
  async generateUsageGuide(workspaceId: string, toolId: string): Promise<string> {
    const tool = this.toolRegistry.get(toolId);
    const workspace = await this.getWorkspace(workspaceId);

    // Analyze workspace context
    const fileTree = await this.readMCPResource(
      workspaceId,
      'workspace://files'
    );
    const gitStatus = await this.readMCPResource(
      workspaceId,
      'workspace://git/status'
    );

    // Generate context-aware examples
    const examples = this.generateExamples(tool, {
      fileTree: JSON.parse(fileTree.text),
      gitStatus: JSON.parse(gitStatus.text)
    });

    return `
# ${tool.name} - Usage Guide

## Overview
${tool.description}

## Best Used For
${tool.strengths.map(s => `- ${s}`).join('\n')}

## In This Workspace

### Quick Start
\`\`\`bash
${tool.quickStartCommand}
\`\`\`

### Example Tasks

${examples.map(ex => `
#### ${ex.title}
\`\`\`bash
${ex.command}
\`\`\`
${ex.explanation}
`).join('\n')}

## Configuration

Current settings:
\`\`\`json
${JSON.stringify(tool.config, null, 2)}
\`\`\`

## Keyboard Shortcuts

- \`${tool.shortcuts.invoke}\` - Invoke ${tool.name}
- \`${tool.shortcuts.cancel}\` - Cancel operation
- \`${tool.shortcuts.history}\` - View execution history

## Need Help?

- [Official Documentation](${tool.docsUrl})
- [Community Discord](${tool.communityUrl})
- [Report Issue](${tool.issuesUrl})
    `;
  }

  private generateExamples(tool: ToolSpec, context: WorkspaceContext): Example[] {
    const examples: Example[] = [];

    // Example 1: Based on current files
    if (context.fileTree.some(f => f.path.endsWith('.test.ts'))) {
      examples.push({
        title: 'Generate tests for new feature',
        command: `${tool.command} --test src/features/newFeature.ts`,
        explanation: `Detected existing test files. ${tool.name} will generate tests matching your project's patterns.`
      });
    }

    // Example 2: Based on git status
    if (context.gitStatus.modified.length > 0) {
      examples.push({
        title: 'Refactor modified files',
        command: `${tool.command} ${context.gitStatus.modified.join(' ')}`,
        explanation: `You have ${context.gitStatus.modified.length} modified files. ${tool.name} can refactor them while preserving behavior.`
      });
    }

    return examples;
  }
}
```

## Performance Optimization

### Caching and Pre-warming

```typescript
class ToolExecutionOptimizer {
  // Cache tool responses for identical requests
  private cache = new LRUCache<string, ToolResponse>({
    max: 100,
    ttl: 1000 * 60 * 5 // 5 minutes
  });

  async executeTool(
    workspaceId: string,
    toolId: string,
    args: any
  ): Promise<ToolResponse> {
    const cacheKey = this.getCacheKey(workspaceId, toolId, args);

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && this.isCacheable(toolId, args)) {
      return cached;
    }

    // Execute tool
    const response = await this.toolExecutor.execute(workspaceId, toolId, args);

    // Cache successful responses
    if (response.success && this.isCacheable(toolId, args)) {
      this.cache.set(cacheKey, response);
    }

    return response;
  }

  // Pre-warm tools on workspace startup
  async prewarmTools(workspaceId: string): Promise<void> {
    const installedTools = await this.getInstalledTools(workspaceId);

    await Promise.all(
      installedTools.map(async (toolId) => {
        // Initialize tool connection
        await this.toolExecutor.initialize(workspaceId, toolId);

        // Load model (if applicable)
        await this.toolExecutor.warmupModel(workspaceId, toolId);
      })
    );
  }

  private isCacheable(toolId: string, args: any): boolean {
    // Don't cache write operations
    if (args.operation === 'write' || args.operation === 'edit') {
      return false;
    }

    // Don't cache if explicitly disabled
    if (args.noCache === true) {
      return false;
    }

    return true;
  }
}
```

## Error Handling and Fallbacks

```typescript
class ResilientToolExecutor {
  async executeWithFallback(
    task: DevelopmentTask,
    primaryTool: AITool
  ): Promise<ToolResponse> {
    try {
      return await this.execute(task, primaryTool);
    } catch (error) {
      console.error(`Primary tool ${primaryTool} failed:`, error);

      // Select fallback tool
      const fallbackTool = this.selectFallbackTool(task, primaryTool);

      if (!fallbackTool) {
        throw new Error(`No fallback available for ${primaryTool}`);
      }

      console.log(`Falling back to ${fallbackTool}`);
      return await this.execute(task, fallbackTool);
    }
  }

  private selectFallbackTool(
    task: DevelopmentTask,
    failedTool: AITool
  ): AITool | null {
    // Fallback matrix
    const fallbacks: Record<AITool, AITool[]> = {
      [Tools.Aider]: [Tools.ClaudeCode, Tools.Goose],
      [Tools.Goose]: [Tools.ClaudeCode],
      [Tools.CopilotCLI]: [Tools.Aider, Tools.ClaudeCode],
      [Tools.ClaudeCode]: [Tools.Goose] // Last resort
    };

    const candidates = fallbacks[failedTool] || [];

    // Select first compatible fallback
    for (const candidate of candidates) {
      if (this.toolRouter.validateToolForTask(candidate, task)) {
        return candidate;
      }
    }

    return null;
  }
}
```

## Integration Testing

```typescript
describe('Tool Integration', () => {
  it('should install Aider successfully', async () => {
    const workspaceId = 'test-workspace-123';
    const result = await toolInstaller.installTool(workspaceId, 'aider');

    expect(result.status).toBe('configured');
    expect(result.toolId).toBe('aider');
  });

  it('should route refactoring task to Aider', async () => {
    const task: DevelopmentTask = {
      type: TaskType.REFACTOR,
      scope: TaskScope.FUNCTION,
      complexity: 0.4,
      files: ['src/utils.ts'],
      context: 'Extract validation logic'
    };

    const selectedTool = toolRouter.selectTool(task);
    expect(selectedTool).toBe(Tools.Aider);
  });

  it('should fallback from Aider to Claude Code on failure', async () => {
    const task: DevelopmentTask = {
      type: TaskType.REFACTOR,
      scope: TaskScope.FUNCTION,
      complexity: 0.3,
      files: ['src/utils.ts'],
      context: 'Refactor function'
    };

    // Simulate Aider failure
    jest.spyOn(toolExecutor, 'execute').mockRejectedValueOnce(
      new Error('Aider timeout')
    );

    const result = await resilientExecutor.executeWithFallback(
      task,
      Tools.Aider
    );

    expect(result.tool).toBe(Tools.ClaudeCode);
    expect(result.success).toBe(true);
  });
});
```

## Future Enhancements

### Custom Tool Integration
- SDK for building custom tool adapters
- Community tool marketplace
- Tool performance benchmarking

### Advanced Routing
- Machine learning-based tool selection
- User preference learning
- Context-aware model selection

### Collaboration Features
- Shared tool configurations across team
- Tool usage analytics and recommendations
- Collaborative debugging sessions

## Conclusion

VibeCode's tool integration system transforms the platform from a single AI IDE into an orchestration layer for the entire AI coding ecosystem. By intelligently routing tasks, pre-configuring tools, and providing seamless MCP integration, we enable developers to leverage the best tool for every task without context switching overhead.

This approach positions VibeCode as **infrastructure** rather than just another tool, creating defensible value and network effects through the agent marketplace.

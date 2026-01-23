/**
 * Function Calling Service
 * Handles AI-powered function calling and execution for VibeCode
 */

export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, {
      type: string;
      description: string;
      required?: boolean;
    }>;
    required?: string[];
  };
}

export interface FunctionCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface FunctionExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  executionTime: number;
  functionName: string;
}

export interface FunctionCallingOptions {
  maxRetries?: number;
  timeout?: number;
  enableLogging?: boolean;
  enableMetrics?: boolean;
}

// Function argument types
interface ReadFileArgs {
  path: string;
  encoding?: string;
}

interface WriteFileArgs {
  path: string;
  content?: string;
  encoding?: string;
}

interface RunCommandArgs {
  command: string;
  cwd?: string;
  timeout?: number;
}

interface SearchCodeArgs {
  query: string;
  language?: string;
  filePattern?: string;
  maxResults?: number;
}

interface AnalyzeCodeArgs {
  code: string;
  language: string;
  includeMetrics?: boolean;
}

interface GenerateTestArgs {
  code: string;
  language: string;
  framework?: string;
  coverage?: string;
}

interface DeployProjectArgs {
  projectPath: string;
  platform: string;
  buildCommand?: string;
  environment?: string;
}

interface GetWorkspaceInfoArgs {
  workspaceId?: string;
  includeFiles?: boolean;
  includeCollaborators?: boolean;
}

interface WebSearchArgs {
  query: string;
  maxResults?: number;
}

interface CreateFileArgs {
  filename: string;
  content?: string;
  workspaceId?: string;
}

interface ExecuteCodeArgs {
  code: string;
  language: string;
}

interface ListFilesArgs {
  directory?: string;
}

// Function result types
interface ReadFileResult {
  content: string;
  path: string;
  size: number;
  lastModified: string;
}

interface WriteFileResult {
  success: boolean;
  path: string;
  bytesWritten: number;
}

interface RunCommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
}

interface SearchCodeResult {
  results: Array<{
    file: string;
    line: number;
    content: string;
    relevance: number;
  }>;
  totalMatches: number;
  executionTime: number;
}

interface AnalyzeCodeResult {
  complexity: number;
  linesOfCode: number;
  functions: number;
  classes: number;
  dependencies: string[];
  issues: string[];
  suggestions: string[];
}

interface GenerateTestResult {
  testFile: string;
  content: string;
  framework: string;
  coverage: string;
}

interface DeployProjectResult {
  success: boolean;
  deploymentUrl: string;
  buildTime: number;
  status: string;
}

interface GetWorkspaceInfoResult {
  workspaceId: string;
  files: number;
  lastModified: string;
  collaborators: number;
  status: string;
}

interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  relevance: number;
}

interface CreateFileResult {
  success: boolean;
  path: string;
  content?: string;
  workspaceId?: string;
}

interface ExecuteCodeResult {
  success: boolean;
  output: string;
  exitCode: number;
  language: string;
  executionTime: number;
}

// JSON Schema types
interface JSONSchemaProperty {
  type: string;
  description?: string;
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
}

interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchemaProperty>;
  items?: JSONSchemaProperty;
}

/**
 * Function Calling Service for AI-powered function execution
 */
export class FunctionCallingService {
  private functions: Map<string, FunctionDefinition> = new Map();
  private implementations: Map<string, (args: Record<string, unknown>) => Promise<unknown>> = new Map();
  private executionHistory: Array<{
    call: FunctionCall;
    result: FunctionExecutionResult;
    timestamp: Date;
  }> = [];
  private metrics = {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    averageExecutionTime: 0
  };

  /**
   * Register a function for AI calling
   */
  registerFunction(definition: FunctionDefinition, implementation?: (args: Record<string, unknown>) => Promise<unknown>): void {
    this.functions.set(definition.name, definition);
    if (implementation) {
      this.implementations.set(definition.name, implementation);
    }
  }

  /**
   * Unregister a function
   */
  unregisterFunction(functionName: string): boolean {
    return this.functions.delete(functionName);
  }

  /**
   * Get all registered functions
   */
  getRegisteredFunctions(): FunctionDefinition[] {
    return Array.from(this.functions.values());
  }

  /**
   * Get function definitions (alias for getRegisteredFunctions)
   */
  getFunctionDefinitions(): FunctionDefinition[] {
    return this.getRegisteredFunctions();
  }

  /**
   * Get function definition by name
   */
  getFunctionDefinition(functionName: string): FunctionDefinition | undefined {
    return this.functions.get(functionName);
  }

  /**
   * Execute a function call
   */
  async executeFunction(
    call: FunctionCall,
    options: FunctionCallingOptions = {}
  ): Promise<FunctionExecutionResult> {
    const startTime = Date.now();
    const maxRetries = options.maxRetries || 3;
    const timeout = options.timeout || 30000; // 30 seconds

    let attempts = 0;
    let lastError: string | undefined;

    this.metrics.totalCalls++;

    while (attempts < maxRetries) {
      try {
        const result = await this.executeFunctionAttempt(call, timeout);

        this.metrics.successfulCalls++;
        this.metrics.averageExecutionTime =
          (this.metrics.averageExecutionTime * (this.metrics.successfulCalls - 1) + result.executionTime) /
          this.metrics.successfulCalls;

        // Store execution history
        this.executionHistory.push({
          call,
          result,
          timestamp: new Date()
        });

        // Keep only recent history (last 1000 entries)
        if (this.executionHistory.length > 1000) {
          this.executionHistory = this.executionHistory.slice(-1000);
        }

        if (options.enableLogging) {
          console.log(`Function ${call.name} executed successfully in ${result.executionTime}ms`);
        }

        return result;
      } catch (error) {
        attempts++;
        lastError = error instanceof Error ? error.message : String(error);

        if (options.enableLogging) {
          console.warn(`Function ${call.name} attempt ${attempts} failed:`, lastError);
        }

        // Wait before retry (exponential backoff)
        if (attempts < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 100));
        }
      }
    }

    this.metrics.failedCalls++;

    const failedResult: FunctionExecutionResult = {
      success: false,
      error: lastError || 'Function execution failed after all retries',
      executionTime: Date.now() - startTime,
      functionName: call.name
    };

    // Store failed execution in history
    this.executionHistory.push({
      call,
      result: failedResult,
      timestamp: new Date()
    });

    return failedResult;
  }

  /**
   * Execute a single function attempt with timeout
   */
  private async executeFunctionAttempt(
    call: FunctionCall,
    timeout: number
  ): Promise<FunctionExecutionResult> {
    const startTime = Date.now();

    // Create a promise that rejects after timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Function execution timed out after ${timeout}ms`)), timeout);
    });

    // Create the function execution promise
    const executionPromise = this.performFunctionExecution(call);

    // Race between execution and timeout
    const result = await Promise.race([executionPromise, timeoutPromise]);

    return {
      success: true,
      result,
      executionTime: Date.now() - startTime,
      functionName: call.name
    };
  }

  /**
   * Perform the actual function execution
   */
  private async performFunctionExecution(call: FunctionCall): Promise<unknown> {
    // Check if we have a custom implementation registered
    const implementation = this.implementations.get(call.name);
    if (implementation) {
      return await implementation(call.arguments);
    }

    // Otherwise use built-in implementations
    const args = call.arguments;
    switch (call.name) {
      case 'read_file':
        return this.simulateReadFile(args as unknown as ReadFileArgs);
      case 'write_file':
        return this.simulateWriteFile(args as unknown as WriteFileArgs);
      case 'run_command':
        return this.simulateRunCommand(args as unknown as RunCommandArgs);
      case 'search_code':
        return this.simulateSearchCode(args as unknown as SearchCodeArgs);
      case 'analyze_code':
        return this.simulateAnalyzeCode(args as unknown as AnalyzeCodeArgs);
      case 'generate_test':
        return this.simulateGenerateTest(args as unknown as GenerateTestArgs);
      case 'deploy_project':
        return this.simulateDeployProject(args as unknown as DeployProjectArgs);
      case 'get_workspace_info':
        return this.simulateGetWorkspaceInfo(args as unknown as GetWorkspaceInfoArgs);
      case 'web_search':
        return this.simulateWebSearch(args as unknown as WebSearchArgs);
      case 'create_file':
        return this.simulateCreateFile(args as unknown as CreateFileArgs);
      case 'execute_code':
        return this.simulateExecuteCode(args as unknown as ExecuteCodeArgs);
      case 'list_files':
        return this.simulateListFiles(args as unknown as ListFilesArgs);
      default:
        throw new Error(`Unknown function: ${call.name}`);
    }
  }

  /**
   * Simulate read file function
   */
  private simulateReadFile(args: ReadFileArgs): ReadFileResult {
    return {
      content: '// Simulated file content',
      path: args.path,
      size: 1024,
      lastModified: new Date().toISOString()
    };
  }

  /**
   * Simulate write file function
   */
  private simulateWriteFile(args: WriteFileArgs): WriteFileResult {
    return {
      success: true,
      path: args.path,
      bytesWritten: args.content?.length || 0
    };
  }

  /**
   * Simulate run command function
   */
  private simulateRunCommand(_args: RunCommandArgs): RunCommandResult {
    return {
      success: true,
      stdout: 'Command executed successfully',
      stderr: '',
      exitCode: 0,
      executionTime: 100
    };
  }

  /**
   * Simulate search code function
   */
  private simulateSearchCode(_args: SearchCodeArgs): SearchCodeResult {
    return {
      results: [
        {
          file: 'example.ts',
          line: 42,
          content: 'const result = searchFunction(query);',
          relevance: 0.95
        }
      ],
      totalMatches: 1,
      executionTime: 150
    };
  }

  /**
   * Simulate analyze code function
   */
  private simulateAnalyzeCode(_args: AnalyzeCodeArgs): AnalyzeCodeResult {
    return {
      complexity: 5,
      linesOfCode: 150,
      functions: 3,
      classes: 1,
      dependencies: ['lodash', 'axios'],
      issues: [],
      suggestions: ['Add error handling', 'Consider adding tests']
    };
  }

  /**
   * Simulate generate test function
   */
  private simulateGenerateTest(_args: GenerateTestArgs): GenerateTestResult {
    return {
      testFile: 'example.test.ts',
      content: `describe('Example', () => {
  test('should work', () => {
    expect(true).toBe(true);
  });
});`,
      framework: 'jest',
      coverage: 'unit'
    };
  }

  /**
   * Simulate deploy project function
   */
  private simulateDeployProject(_args: DeployProjectArgs): DeployProjectResult {
    return {
      success: true,
      deploymentUrl: 'https://example.vercel.app',
      buildTime: 45000,
      status: 'deployed'
    };
  }

  /**
   * Simulate get workspace info function
   */
  private simulateGetWorkspaceInfo(args: GetWorkspaceInfoArgs): GetWorkspaceInfoResult {
    return {
      workspaceId: args.workspaceId || 'default',
      files: 25,
      lastModified: new Date().toISOString(),
      collaborators: 2,
      status: 'active'
    };
  }

  /**
   * Simulate web search function
   */
  private async simulateWebSearch(args: WebSearchArgs): Promise<WebSearchResult[]> {
    return [
      {
        title: 'Search Result 1',
        url: 'https://example.com/result1',
        snippet: 'This is a search result for ' + args.query,
        relevance: 0.95
      },
      {
        title: 'Search Result 2',
        url: 'https://example.com/result2',
        snippet: 'Another result for ' + args.query,
        relevance: 0.85
      }
    ].slice(0, args.maxResults || 5);
  }

  /**
   * Simulate create file function
   */
  private simulateCreateFile(args: CreateFileArgs): CreateFileResult {
    if (!args.filename || args.filename === '') {
      throw new Error('Filename is required');
    }
    return {
      success: true,
      path: args.filename,
      content: args.content,
      workspaceId: args.workspaceId
    };
  }

  /**
   * Simulate execute code function
   */
  private simulateExecuteCode(args: ExecuteCodeArgs): ExecuteCodeResult {
    return {
      success: true,
      output: 'Hello World\n',
      exitCode: 0,
      language: args.language,
      executionTime: 50
    };
  }

  /**
   * Simulate list files function
   */
  private simulateListFiles(_args: ListFilesArgs): string[] {
    return [
      'file1.txt',
      'file2.js',
      'integration-test.txt'
    ];
  }

  /**
   * Batch execute multiple function calls
   */
  async batchExecuteFunctions(
    calls: FunctionCall[],
    options: FunctionCallingOptions = {}
  ): Promise<FunctionExecutionResult[]> {
    const promises = calls.map(call => this.executeFunction(call, options));
    return Promise.all(promises);
  }

  /**
   * Get execution metrics
   */
  getMetrics(): {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    successRate: number;
    averageExecutionTime: number;
  } {
    return {
      ...this.metrics,
      successRate: this.metrics.totalCalls > 0
        ? this.metrics.successfulCalls / this.metrics.totalCalls
        : 0
    };
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit: number = 100): Array<{
    call: FunctionCall;
    result: FunctionExecutionResult;
    timestamp: Date;
  }> {
    return this.executionHistory.slice(-limit);
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.executionHistory = [];
  }

  /**
   * Get function calling schema for AI models
   */
  getFunctionCallingSchema(): {
    type: string;
    functions: FunctionDefinition[];
  } {
    return {
      type: 'function_calling',
      functions: this.getRegisteredFunctions()
    };
  }

  /**
   * Validate function call against definition
   */
  validateFunctionCall(call: FunctionCall): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const definition = this.functions.get(call.name);

    if (!definition) {
      errors.push(`Function '${call.name}' is not registered`);
      return { isValid: false, errors };
    }

    // Validate required parameters
    const requiredParams = definition.parameters.required || [];
    for (const param of requiredParams) {
      if (!(param in call.arguments)) {
        errors.push(`Missing required parameter: ${param}`);
      }
    }

    // Validate parameter types (basic validation)
    for (const [paramName, paramDef] of Object.entries(definition.parameters.properties)) {
      if (paramName in call.arguments) {
        const value = call.arguments[paramName];
        const expectedType = paramDef.type;

        // Basic type checking
        if (expectedType === 'string' && typeof value !== 'string') {
          errors.push(`Parameter '${paramName}' should be a string`);
        } else if (expectedType === 'number' && typeof value !== 'number') {
          errors.push(`Parameter '${paramName}' should be a number`);
        } else if (expectedType === 'boolean' && typeof value !== 'boolean') {
          errors.push(`Parameter '${paramName}' should be a boolean`);
        } else if (expectedType === 'array' && !Array.isArray(value)) {
          errors.push(`Parameter '${paramName}' should be an array`);
        } else if (expectedType === 'object' && (typeof value !== 'object' || value === null)) {
          errors.push(`Parameter '${paramName}' should be an object`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Register common VibeCode functions
   */
  registerCommonFunctions(): void {
    const commonFunctions: FunctionDefinition[] = [
      {
        name: 'read_file',
        description: 'Read the contents of a file',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path to read' },
            encoding: { type: 'string', description: 'File encoding (optional)' }
          },
          required: ['path']
        }
      },
      {
        name: 'write_file',
        description: 'Write content to a file',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path to write' },
            content: { type: 'string', description: 'Content to write' },
            encoding: { type: 'string', description: 'File encoding (optional)' }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'run_command',
        description: 'Execute a terminal command',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Command to execute' },
            cwd: { type: 'string', description: 'Working directory (optional)' },
            timeout: { type: 'number', description: 'Command timeout in seconds (optional)' }
          },
          required: ['command']
        }
      },
      {
        name: 'search_code',
        description: 'Search for code patterns in the codebase',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            language: { type: 'string', description: 'Programming language filter (optional)' },
            filePattern: { type: 'string', description: 'File pattern filter (optional)' },
            maxResults: { type: 'number', description: 'Maximum results to return (optional)' }
          },
          required: ['query']
        }
      },
      {
        name: 'analyze_code',
        description: 'Analyze code for complexity, patterns, and issues',
        parameters: {
          type: 'object',
          properties: {
            code: { type: 'string', description: 'Code to analyze' },
            language: { type: 'string', description: 'Programming language' },
            includeMetrics: { type: 'boolean', description: 'Include detailed metrics (optional)' }
          },
          required: ['code', 'language']
        }
      },
      {
        name: 'generate_test',
        description: 'Generate tests for the provided code',
        parameters: {
          type: 'object',
          properties: {
            code: { type: 'string', description: 'Code to generate tests for' },
            language: { type: 'string', description: 'Programming language' },
            framework: { type: 'string', description: 'Testing framework' },
            coverage: { type: 'string', description: 'Test coverage type (unit, integration, e2e)' }
          },
          required: ['code', 'language']
        }
      },
      {
        name: 'deploy_project',
        description: 'Deploy a project to a hosting platform',
        parameters: {
          type: 'object',
          properties: {
            projectPath: { type: 'string', description: 'Path to project directory' },
            platform: { type: 'string', description: 'Deployment platform (vercel, netlify, etc.)' },
            buildCommand: { type: 'string', description: 'Build command (optional)' },
            environment: { type: 'string', description: 'Deployment environment (optional)' }
          },
          required: ['projectPath', 'platform']
        }
      },
      {
        name: 'get_workspace_info',
        description: 'Get information about a workspace',
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID to query' },
            includeFiles: { type: 'boolean', description: 'Include file list (optional)' },
            includeCollaborators: { type: 'boolean', description: 'Include collaborator list (optional)' }
          },
          required: ['workspaceId']
        }
      }
    ];

    commonFunctions.forEach(fn => this.registerFunction(fn));
  }

  /**
   * Create function calling prompt for AI models
   */
  createFunctionCallingPrompt(
    userQuery: string,
    availableFunctions?: string[]
  ): {
    prompt: string;
    schema: JSONSchema;
  } {
    const functionsToInclude = availableFunctions
      ? this.getRegisteredFunctions().filter(fn => availableFunctions.includes(fn.name))
      : this.getRegisteredFunctions();

    const schema: JSONSchema = {
      type: 'object',
      properties: {
        function_calls: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              arguments: { type: 'object' }
            }
          }
        }
      }
    };

    const prompt = `
You have access to the following functions:

${functionsToInclude.map(fn => `
Function: ${fn.name}
Description: ${fn.description}
Parameters: ${JSON.stringify(fn.parameters.properties, null, 2)}
`).join('\n')}

User Query: "${userQuery}"

If you need to use any of these functions to help answer the query, respond with a function call in the following JSON format:
{
  "function_calls": [
    {
      "name": "function_name",
      "arguments": {
        "param1": "value1",
        "param2": "value2"
      }
    }
  ]
}

If you don't need to use any functions, just respond with your answer directly.

Choose the most appropriate function(s) based on the user's request.
`;

    return { prompt, schema };
  }
}

// Export singleton instance for global use
export const functionCallingService = new FunctionCallingService();

// Initialize with common functions
functionCallingService.registerCommonFunctions();

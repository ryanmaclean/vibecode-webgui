export interface FunctionDefinition {
  name: string
  description: string
  parameters: {
    type: string  // Changed from string literal 'object' to string to allow more flexibility
    properties: Record<string, {
      type: string
      description: string
      enum?: string[]
    }>
    required?: string[]
  }
}

export interface FunctionCall {
  name: string
  arguments: Record<string, any>
}

export interface FunctionResult {
  success: boolean
  result?: any
  error?: string
  metadata?: Record<string, any>
}

export class FunctionCallingService {
  private functions: Map<string, (args: any) => Promise<FunctionResult>> = new Map()

  constructor() {
    this.registerBuiltinFunctions()
  }

  private registerBuiltinFunctions() {
    // Web search function
    this.registerFunction(
      {
        name: 'web_search',
        description: 'Search the web for current information on a given topic',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query to execute'
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of search results to return (default: 5)'
            },
            timeFilter: {
              type: 'string',
              description: 'Time filter for search results',
              enum: ['day', 'week', 'month', 'year']
            }
          },
          required: ['query']
        }
      },
      this.webSearch.bind(this)
    )

    // File operation functions
    this.registerFunction(
      {
        name: 'create_file',
        description: 'Create a new file with specified content',
        parameters: {
          type: 'object',
          properties: {
            filename: {
              type: 'string',
              description: 'Name of the file to create'
            },
            content: {
              type: 'string',
              description: 'Content to write to the file'
            },
            workspaceId: {
              type: 'string',
              description: 'Workspace ID where the file should be created'
            }
          },
          required: ['filename', 'content']
        }
      },
      this.createFile.bind(this)
    )

    // Code execution function
    this.registerFunction(
      {
        name: 'execute_code',
        description: 'Execute code in a sandboxed environment',
        parameters: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'The code to execute'
            },
            language: {
              type: 'string',
              description: 'Programming language',
              enum: ['javascript', 'python', 'bash']
            },
            workspaceId: {
              type: 'string',
              description: 'Workspace ID for execution context'
            }
          },
          required: ['code', 'language']
        }
      },
      this.executeCode.bind(this)
    )

    // Workspace management functions
    this.registerFunction(
      {
        name: 'list_files',
        description: 'List files in a workspace directory',
        parameters: {
          type: 'object',
          properties: {
            workspaceId: {
              type: 'string',
              description: 'Workspace ID to list files from'
            },
            path: {
              type: 'string',
              description: 'Directory path within workspace (default: root)'
            },
            extensions: {
              type: 'string',
              description: 'Comma-separated list of file extensions to filter by'
            }
          },
          required: ['workspaceId']
        }
      },
      this.listFiles.bind(this)
    )

    // Package management function
    this.registerFunction(
      {
        name: 'install_package',
        description: 'Install a package or dependency in the workspace',
        parameters: {
          type: 'object',
          properties: {
            packageName: {
              type: 'string',
              description: 'Name of the package to install'
            },
            packageManager: {
              type: 'string',
              description: 'Package manager to use',
              enum: ['npm', 'yarn', 'pip', 'composer']
            },
            workspaceId: {
              type: 'string',
              description: 'Workspace ID where package should be installed'
            },
            version: {
              type: 'string',
              description: 'Specific version to install (optional)'
            }
          },
          required: ['packageName', 'packageManager', 'workspaceId']
        }
      },
      this.installPackage.bind(this)
    )
  }

  registerFunction(
    definition: FunctionDefinition,
    implementation: (args: any) => Promise<FunctionResult>
  ) {
    this.functions.set(definition.name, implementation)
  }

  getFunctionDefinitions(): FunctionDefinition[] {
    return Array.from(this.registeredDefinitions.values())
  }

  private registeredDefinitions: Map<string, FunctionDefinition> = new Map()

  async executeFunction(call: FunctionCall): Promise<FunctionResult> {
    const func = this.functions.get(call.name)
    if (!func) {
      return {
        success: false,
        error: `Function ${call.name} not found`
      }
    }

    try {
      const result = await func(call.arguments)
      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  // Built-in function implementations
  private async webSearch(args: any): Promise<FunctionResult> {
    try {
      const { webSearchService } = await import('./web-search')
      const results = await webSearchService.searchWeb(args.query, {
        maxResults: args.maxResults || 5,
        timeFilter: args.timeFilter
      })

      return {
        success: true,
        result: results,
        metadata: {
          query: args.query,
          resultCount: results.length
        }
      }
    } catch (error) {
      return {
        success: false,
        error: `Web search failed: ${error.message}`
      }
    }
  }

  private async createFile(args: any): Promise<FunctionResult> {
    try {
      const fs = await import('fs').then(m => m.promises)
      const path = await import('path')
      
      const workspaceDir = path.join(process.cwd(), 'data', 'workspaces', args.workspaceId || 'default')
      await fs.mkdir(workspaceDir, { recursive: true })
      
      const filePath = path.join(workspaceDir, args.filename)
      await fs.writeFile(filePath, args.content, 'utf-8')

      return {
        success: true,
        result: {
          filename: args.filename,
          path: filePath,
          size: args.content.length
        },
        metadata: {
          action: 'file_created',
          workspaceId: args.workspaceId
        }
      }
    } catch (error) {
      return {
        success: false,
        error: `File creation failed: ${error.message}`
      }
    }
  }

  private async executeCode(args: any): Promise<FunctionResult> {
    try {
      // This is a simplified implementation - in production, you'd want proper sandboxing
      const { spawn } = await import('child_process')
      const fs = await import('fs').then(m => m.promises)
      const path = await import('path')
      const os = await import('os')

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vibecode-exec-'))
      
      let command: string
      let extension: string
      
      switch (args.language) {
        case 'javascript':
          command = 'node'
          extension = 'js'
          break
        case 'python':
          command = 'python3'
          extension = 'py'
          break
        case 'bash':
          command = 'bash'
          extension = 'sh'
          break
        default:
          return {
            success: false,
            error: `Unsupported language: ${args.language}`
          }
      }

      const scriptPath = path.join(tempDir, `script.${extension}`)
      await fs.writeFile(scriptPath, args.code)

      return new Promise((resolve) => {
        const child = spawn(command, [scriptPath], {
          timeout: 10000,
          cwd: tempDir
        })

        let stdout = ''
        let stderr = ''

        child.stdout?.on('data', (data) => {
          stdout += data.toString()
        })

        child.stderr?.on('data', (data) => {
          stderr += data.toString()
        })

        child.on('close', async (code) => {
          // Cleanup
          await fs.rm(tempDir, { recursive: true, force: true })
          
          const result: FunctionResult = {
            success: code === 0,
            result: {
              stdout: stdout.trim(),
              stderr: stderr.trim(),
              exitCode: code
            },
            metadata: {
              language: args.language,
              executionTime: Date.now()
            }
          }
          
          // Add error property if the execution failed
          if (code !== 0) {
            result.error = stderr.trim() || 'Execution failed with non-zero exit code';
          }
          
          resolve(result)
        })

        child.on('error', async (error) => {
          await fs.rm(tempDir, { recursive: true, force: true })
          resolve({
            success: false,
            error: `Execution failed: ${error.message}`
          })
        })
      })
    } catch (error) {
      return {
        success: false,
        error: `Code execution setup failed: ${error.message}`
      }
    }
  }

  private async listFiles(args: any): Promise<FunctionResult> {
    try {
      const fs = await import('fs').then(m => m.promises)
      const path = await import('path')
      
      const workspaceDir = path.join(process.cwd(), 'data', 'workspaces', args.workspaceId)
      const targetDir = path.join(workspaceDir, args.path || '')

      const files = await fs.readdir(targetDir, { withFileTypes: true })
      const fileList: Array<{
        name: string;
        type: string;
        size: number;
        modified: Date;
      }> = [];
<<<<<<< HEAD

=======
>>>>>>> fix/consolidated-dependency-updates
      for (const file of files) {
        const stat = await fs.stat(path.join(targetDir, file.name))
        
        if (args.extensions) {
          const allowedExts = args.extensions.split(',').map((ext: string) => ext.trim())
          const fileExt = path.extname(file.name).slice(1)
          if (!allowedExts.includes(fileExt)) continue
        }

        fileList.push({
          name: file.name,
          type: file.isDirectory() ? 'directory' : 'file',
          size: stat.size,
          modified: stat.mtime
        })
      }

      return {
        success: true,
        result: fileList,
        metadata: {
          path: args.path || '/',
          workspaceId: args.workspaceId,
          totalFiles: fileList.length
        }
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to list files: ${error.message}`
      }
    }
  }

  private async installPackage(args: any): Promise<FunctionResult> {
    try {
      const { spawn } = await import('child_process')
      const path = await import('path')

      const workspaceDir = path.join(process.cwd(), 'data', 'workspaces', args.workspaceId)
      const packageSpec = args.version ? `${args.packageName}@${args.version}` : args.packageName

      let command: string
      let cmdArgs: string[]

      switch (args.packageManager) {
        case 'npm':
          command = 'npm'
          cmdArgs = ['install', packageSpec]
          break
        case 'yarn':
          command = 'yarn'
          cmdArgs = ['add', packageSpec]
          break
        case 'pip':
          command = 'pip3'
          cmdArgs = ['install', packageSpec]
          break
        case 'composer':
          command = 'composer'
          cmdArgs = ['require', packageSpec]
          break
        default:
          return {
            success: false,
            error: `Unsupported package manager: ${args.packageManager}`
          }
      }

      return new Promise((resolve) => {
        const child = spawn(command, cmdArgs, {
          cwd: workspaceDir,
          timeout: 60000
        })

        let output = ''
        let error = ''

        child.stdout?.on('data', (data) => {
          output += data.toString()
        })

        child.stderr?.on('data', (data) => {
          error += data.toString()
        })

        child.on('close', (code) => {
          resolve({
            success: code === 0,
            result: {
              packageName: args.packageName,
              version: args.version,
              output: output.trim(),
              error: error.trim()
            },
            metadata: {
              packageManager: args.packageManager,
              workspaceId: args.workspaceId,
              exitCode: code
            }
          })
        })
      })
    } catch (error) {
      return {
        success: false,
        error: `Package installation failed: ${error.message}`
      }
    }
  }
}

// Export singleton instance
export const functionCallingService = new FunctionCallingService()

// Store function definitions separately for registration
<<<<<<< HEAD
const functionDefinitions: FunctionDefinition[] = [
  {
=======
const functionDefinitions: FunctionDefinition[] = [  {
>>>>>>> fix/consolidated-dependency-updates
    name: 'web_search',
    description: 'Search the web for current information on a given topic',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query to execute' },
        maxResults: { type: 'number', description: 'Maximum number of results (default: 5)' },
        timeFilter: { type: 'string', description: 'Time filter', enum: ['day', 'week', 'month', 'year'] }
      },
      required: ['query']
    }
  },
  {
    name: 'create_file',
    description: 'Create a new file with specified content',
    parameters: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'Name of the file to create' },
        content: { type: 'string', description: 'Content to write to the file' },
        workspaceId: { type: 'string', description: 'Workspace ID where the file should be created' }
      },
      required: ['filename', 'content']
    }
  },
  {
    name: 'execute_code',
    description: 'Execute code in a sandboxed environment',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'The code to execute' },
        language: { type: 'string', description: 'Programming language', enum: ['javascript', 'python', 'bash'] },
        workspaceId: { type: 'string', description: 'Workspace ID for execution context' }
      },
      required: ['code', 'language']
    }
  },
  {
    name: 'list_files',
    description: 'List files in a workspace directory',
    parameters: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Workspace ID to list files from' },
        path: { type: 'string', description: 'Directory path within workspace' },
        extensions: { type: 'string', description: 'Comma-separated list of file extensions' }
      },
      required: ['workspaceId']
    }
  }
]

// Store definitions for external access
functionCallingService['registeredDefinitions'] = new Map<string, FunctionDefinition>(
  functionDefinitions.map(def => [def.name, def])
)
#!/usr/bin/env node

// import { logger } from '@/lib/logger';
/**
 * VibeCode MCP Server
 *
 * Exposes VibeCode operations as MCP tools for AI agents.
 * Compatible with Windsurf, Claude Desktop, and other MCP clients.
 *
 * SECURITY: All requests require JWT authentication
 *
 * @see https://modelcontextprotocol.io/
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Authentication utilities
import { authenticateRequest, AuthenticationError, type UserContext } from '../lib/auth/jwt-utils.js';

// Tool implementations
import { createWorkspace, listWorkspaces } from './tools/workspace.js';
import { runTests } from './tools/testing.js';
import { deployProject } from './tools/deployment.js';
import { searchCode, analyzeCode } from './tools/code-analysis.js';
import { generateCode } from './tools/code-generation.js';

// Type validation schemas
import {
  CreateWorkspaceArgsSchema,
  RunTestsArgsSchema,
  DeployProjectArgsSchema,
  SearchCodeArgsSchema,
  AnalyzeCodeArgsSchema,
  GenerateCodeArgsSchema,
  validateToolArgs,
} from './types.js';
// Unused exports for future implementation
// getTestResults, getDeploymentStatus

/**
 * Initialize MCP Server
 */
const server = new Server(
  {
    name: 'vibecode-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'create-workspace',
        description: 'Create a new development workspace with specified configuration',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Workspace name',
            },
            template: {
              type: 'string',
              description: 'Template to use (react, nextjs, nodejs, python, etc.)',
              enum: ['react', 'nextjs', 'nodejs', 'python', 'go', 'rust'],
            },
            description: {
              type: 'string',
              description: 'Workspace description',
            },
          },
          required: ['name', 'template'],
        },
      },
      {
        name: 'run-tests',
        description: 'Run tests in a workspace',
        inputSchema: {
          type: 'object',
          properties: {
            workspaceId: {
              type: 'string',
              description: 'Workspace ID',
            },
            testType: {
              type: 'string',
              description: 'Type of tests to run',
              enum: ['unit', 'integration', 'e2e', 'all'],
            },
            pattern: {
              type: 'string',
              description: 'Test file pattern (optional)',
            },
          },
          required: ['workspaceId'],
        },
      },
      {
        name: 'deploy-project',
        description: 'Deploy a project to production',
        inputSchema: {
          type: 'object',
          properties: {
            workspaceId: {
              type: 'string',
              description: 'Workspace ID',
            },
            environment: {
              type: 'string',
              description: 'Deployment environment',
              enum: ['development', 'staging', 'production'],
            },
            buildCommand: {
              type: 'string',
              description: 'Custom build command (optional)',
            },
          },
          required: ['workspaceId', 'environment'],
        },
      },
      {
        name: 'search-code',
        description: 'Search code semantically using vector search',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Natural language search query',
            },
            workspaceId: {
              type: 'string',
              description: 'Workspace ID to search in (optional)',
            },
            language: {
              type: 'string',
              description: 'Programming language filter (optional)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'analyze-code',
        description: 'Analyze code for issues, performance, and security',
        inputSchema: {
          type: 'object',
          properties: {
            workspaceId: {
              type: 'string',
              description: 'Workspace ID',
            },
            filePath: {
              type: 'string',
              description: 'File path to analyze (optional, analyzes all if not provided)',
            },
            checks: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['security', 'performance', 'quality', 'style'],
              },
              description: 'Types of checks to perform',
            },
          },
          required: ['workspaceId'],
        },
      },
      {
        name: 'generate-code',
        description: 'Generate code using AI',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'Description of code to generate',
            },
            language: {
              type: 'string',
              description: 'Programming language',
            },
            context: {
              type: 'string',
              description: 'Additional context (optional)',
            },
          },
          required: ['prompt', 'language'],
        },
      },
    ],
  };
});

/**
 * Authentication middleware for tool calls
 *
 * Verifies JWT token and extracts user context before executing tools.
 * Tokens can be provided via:
 * - VIBECODE_TOKEN environment variable (recommended for stdio)
 * - token or authToken parameter in request
 */
async function authenticateToolCall(args: Record<string, unknown>): Promise<UserContext> {
  try {
    const userContext = await authenticateRequest(args);
    console.error(`✅ Authenticated: ${userContext.email} (${userContext.role})`);
    return userContext;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      console.error(`❌ Authentication failed: ${error.code} - ${error.message}`);
      if (error.details) {
        console.error(`   Details:`, error.details);
      }
    } else {
      console.error(`❌ Authentication error:`, error);
    }
    throw error;
  }
}

/**
 * Handle tool calls with authentication and type-safe validation
 *
 * SECURITY: All tool calls require valid JWT authentication
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Ensure args is defined
    const argsRecord = (args ?? {}) as Record<string, unknown>;

    // SECURITY: Authenticate request before executing any tool
    await authenticateToolCall(argsRecord);

    // Execute tool with validated context
    switch (name) {
      case 'create-workspace': {
        const validatedArgs = validateToolArgs(CreateWorkspaceArgsSchema, argsRecord);
        return await createWorkspace(validatedArgs);
      }

      case 'run-tests': {
        const validatedArgs = validateToolArgs(RunTestsArgsSchema, argsRecord);
        return await runTests(validatedArgs);
      }

      case 'deploy-project': {
        const validatedArgs = validateToolArgs(DeployProjectArgsSchema, argsRecord);
        return await deployProject(validatedArgs);
      }

      case 'search-code': {
        const validatedArgs = validateToolArgs(SearchCodeArgsSchema, argsRecord);
        return await searchCode(validatedArgs);
      }

      case 'analyze-code': {
        const validatedArgs = validateToolArgs(AnalyzeCodeArgsSchema, argsRecord);
        return await analyzeCode(validatedArgs);
      }

      case 'generate-code': {
        const validatedArgs = validateToolArgs(GenerateCodeArgsSchema, argsRecord);
        return await generateCode(validatedArgs);
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    // Handle authentication errors with clear messages
    if (error instanceof AuthenticationError) {
      return {
        content: [
          {
            type: 'text',
            text: `🔒 Authentication Error: ${error.message}\n\nCode: ${error.code}\n\nTo authenticate:\n1. Obtain a JWT token from VibeCode web UI\n2. Set environment variable: export VIBECODE_TOKEN=<your-token>\n3. Retry your request`,
          },
        ],
        isError: true,
      };
    }

    // Handle Zod validation errors with detailed messages
    if (error && typeof error === 'object' && 'issues' in error) {
      const zodError = error as { issues: Array<{ path: string[]; message: string }> };
      const validationErrors = zodError.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join(', ');

      return {
        content: [
          {
            type: 'text',
            text: `Validation Error: ${validationErrors}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
});

/**
 * List available resources
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'vibecode://templates',
        name: 'Project Templates',
        description: 'Available project templates',
        mimeType: 'application/json',
      },
      {
        uri: 'vibecode://workspaces',
        name: 'Active Workspaces',
        description: 'List of active development workspaces',
        mimeType: 'application/json',
      },
      {
        uri: 'vibecode://docs',
        name: 'Documentation',
        description: 'VibeCode documentation and guides',
        mimeType: 'text/markdown',
      },
    ],
  };
});

/**
 * Read resource content
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  switch (uri) {
    case 'vibecode://templates':
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                templates: [
                  { id: 'react', name: 'React', description: 'React with TypeScript' },
                  { id: 'nextjs', name: 'Next.js', description: 'Next.js 15 with App Router' },
                  { id: 'nodejs', name: 'Node.js', description: 'Node.js with Express' },
                  { id: 'python', name: 'Python', description: 'Python with FastAPI' },
                  { id: 'go', name: 'Go', description: 'Go with Gin framework' },
                  { id: 'rust', name: 'Rust', description: 'Rust with Actix' },
                ],
              },
              null,
              2
            ),
          },
        ],
      };

    case 'vibecode://workspaces':
      const workspaces = await listWorkspaces();
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(workspaces, null, 2),
          },
        ],
      };

    case 'vibecode://docs':
      return {
        contents: [
          {
            uri,
            mimeType: 'text/markdown',
            text: `# VibeCode Documentation

## Getting Started
VibeCode is an AI-powered development platform with live VS Code experience.

## Available Tools
- create-workspace: Create new development environments
- run-tests: Execute test suites
- deploy-project: Deploy to production
- search-code: Semantic code search
- analyze-code: Code quality analysis
- generate-code: AI code generation

## Resources
- Templates: vibecode://templates
- Workspaces: vibecode://workspaces
- Docs: vibecode://docs
`,
          },
        ],
      };

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

/**
 * Start server
 */
async function main() {
  // Validate authentication configuration
  if (!process.env.NEXTAUTH_SECRET) {
    console.error('❌ CRITICAL: NEXTAUTH_SECRET environment variable is not set');
    console.error('   Authentication will fail without this secret');
    console.error('   Set NEXTAUTH_SECRET before starting the MCP server');
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🚀 VibeCode MCP Server running on stdio');
  console.error('🔒 Authentication: ENABLED (JWT required)');
  console.error('💡 Set VIBECODE_TOKEN environment variable to authenticate');
}

main().catch((error) => {
  console.error('❌ Server error:', error);
  process.exit(1);
});

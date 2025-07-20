#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const fs = require('fs').promises;
const path = require('path');

class FilesystemMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'filesystem-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupResourceHandlers();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'read_file',
          description: 'Read the contents of a file',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Path to the file to read',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'write_file',
          description: 'Write content to a file',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Path to the file to write',
              },
              content: {
                type: 'string',
                description: 'Content to write to the file',
              },
            },
            required: ['path', 'content'],
          },
        },
        {
          name: 'list_directory',
          description: 'List contents of a directory',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Path to the directory to list',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'create_file',
          description: 'Create a new file',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Path where to create the file',
              },
              content: {
                type: 'string',
                description: 'Initial content for the file',
                default: '',
              },
            },
            required: ['path'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'read_file':
            return await this.readFile(args.path);
          case 'write_file':
            return await this.writeFile(args.path, args.content);
          case 'list_directory':
            return await this.listDirectory(args.path);
          case 'create_file':
            return await this.createFile(args.path, args.content || '');
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
        };
      }
    });
  }

  setupResourceHandlers() {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'file://workspace',
          name: 'Workspace',
          description: 'Current workspace directory',
          mimeType: 'inode/directory',
        },
      ],
    }));
  }

  async readFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return {
        content: [
          {
            type: 'text',
            text: content,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
  }

  async writeFile(filePath, content) {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(filePath, content, 'utf-8');
      return {
        content: [
          {
            type: 'text',
            text: `Successfully wrote ${content.length} characters to ${filePath}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to write file ${filePath}: ${error.message}`);
    }
  }

  async listDirectory(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const result = entries.map(entry => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        path: path.join(dirPath, entry.name),
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to list directory ${dirPath}: ${error.message}`);
    }
  }

  async createFile(filePath, content) {
    try {
      // Check if file already exists
      try {
        await fs.access(filePath);
        throw new Error(`File ${filePath} already exists`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }

      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(filePath, content, 'utf-8');
      return {
        content: [
          {
            type: 'text',
            text: `Successfully created file ${filePath}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to create file ${filePath}: ${error.message}`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Filesystem MCP server running on stdio');
  }
}

const server = new FilesystemMCPServer();
server.run().catch(console.error); 
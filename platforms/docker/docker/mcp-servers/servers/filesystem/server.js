#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  GetResourceRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

/**
 * VibeCode MCP Filesystem Server
 * Provides filesystem access for AI models through MCP
 */
class VibeCodeFilesystemServer extends Server {
  constructor() {
    super({
      name: 'vibecode-filesystem',
      version: '1.0.0',
    });
  }

  /**
   * List available tools
   */
  async listTools() {
    return {
      tools: [
        {
          name: 'read_file',
          description: 'Read a file from the filesystem',
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
          name: 'create_directory',
          description: 'Create a new directory',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Path to the directory to create',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'delete_file',
          description: 'Delete a file or directory',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Path to the file or directory to delete',
              },
            },
            required: ['path'],
          },
        },
      ],
    };
  }

  /**
   * Call a tool
   */
  async callTool(name, arguments_) {
    switch (name) {
      case 'read_file':
        return await this.readFile(arguments_.path);
      case 'write_file':
        return await this.writeFile(arguments_.path, arguments_.content);
      case 'list_directory':
        return await this.listDirectory(arguments_.path);
      case 'create_directory':
        return await this.createDirectory(arguments_.path);
      case 'delete_file':
        return await this.deleteFile(arguments_.path);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  /**
   * Read a file
   */
  async readFile(path) {
    try {
      const fs = require('fs').promises;
      const content = await fs.readFile(path, 'utf8');
      
      return {
        content: [
          {
            type: 'text',
            text: content,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to read file ${path}: ${error.message}`);
    }
  }

  /**
   * Write content to a file
   */
  async writeFile(path, content) {
    try {
      const fs = require('fs').promises;
      await fs.writeFile(path, content, 'utf8');
      
      return {
        content: [
          {
            type: 'text',
            text: `Successfully wrote to ${path}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to write file ${path}: ${error.message}`);
    }
  }

  /**
   * List directory contents
   */
  async listDirectory(path) {
    try {
      const fs = require('fs').promises;
      const items = await fs.readdir(path, { withFileTypes: true });
      
      const contents = items.map(item => ({
        name: item.name,
        type: item.isDirectory() ? 'directory' : 'file',
        path: `${path}/${item.name}`,
      }));
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(contents, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to list directory ${path}: ${error.message}`);
    }
  }

  /**
   * Create a directory
   */
  async createDirectory(path) {
    try {
      const fs = require('fs').promises;
      await fs.mkdir(path, { recursive: true });
      
      return {
        content: [
          {
            type: 'text',
            text: `Successfully created directory ${path}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to create directory ${path}: ${error.message}`);
    }
  }

  /**
   * Delete a file or directory
   */
  async deleteFile(path) {
    try {
      const fs = require('fs').promises;
      const stat = await fs.stat(path);
      
      if (stat.isDirectory()) {
        await fs.rmdir(path, { recursive: true });
      } else {
        await fs.unlink(path);
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `Successfully deleted ${path}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to delete ${path}: ${error.message}`);
    }
  }

  /**
   * List available resources
   */
  async listResources() {
    return {
      resources: [
        {
          uri: 'file:///workspace',
          name: 'Workspace Root',
          description: 'Root directory of the VibeCode workspace',
          mimeType: 'inode/directory',
        },
        {
          uri: 'file:///workspace/src',
          name: 'Source Code',
          description: 'Application source code directory',
          mimeType: 'inode/directory',
        },
        {
          uri: 'file:///workspace/tests',
          name: 'Tests',
          description: 'Test files and configurations',
          mimeType: 'inode/directory',
        },
      ],
    };
  }

  /**
   * Read a resource
   */
  async readResource(uri) {
    try {
      const path = uri.replace('file://', '');
      const fs = require('fs').promises;
      const content = await fs.readFile(path, 'utf8');
      
      return {
        contents: [
          {
            uri,
            mimeType: 'text/plain',
            text: content,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to read resource ${uri}: ${error.message}`);
    }
  }
}

/**
 * Main server setup
 */
async function main() {
  const server = new VibeCodeFilesystemServer();
  const transport = new StdioServerTransport();
  
  console.error('🚀 Starting VibeCode MCP Filesystem Server...');
  
  try {
    await server.connect(transport);
    console.error('✅ VibeCode MCP Filesystem Server connected');
    
    // Keep the server running
    process.on('SIGINT', async () => {
      console.error('🛑 Shutting down VibeCode MCP Filesystem Server...');
      await server.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start VibeCode MCP Filesystem Server:', error);
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { VibeCodeFilesystemServer }; 
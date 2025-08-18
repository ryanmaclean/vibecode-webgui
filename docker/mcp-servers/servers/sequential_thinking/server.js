#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

class SequentialThinkingMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'sequential-thinking-mcp-server',
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
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'think_sequentially',
          description: 'Breaks down a prompt into a sequence of thoughts.',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'The prompt to think about.',
              },
              num_steps: {
                type: 'number',
                description: 'The number of thinking steps to perform.',
                default: 5,
              },
            },
            required: ['prompt'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'think_sequentially':
            return await this.thinkSequentially(args.prompt, args.num_steps || 5);
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

  async thinkSequentially(prompt, num_steps) {
    const thoughts = [];
    for (let i = 1; i <= num_steps; i++) {
      thoughts.push({
        type: 'thought',
        text: `Step ${i}/${num_steps}: Thinking about '${prompt}'.`,
      });
    }

    thoughts.push({
        type: 'text',
        text: `Finished thinking about '${prompt}' in ${num_steps} steps.`,
    });

    return {
      content: thoughts,
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Sequential Thinking MCP server running on stdio');
  }
}

const server = new SequentialThinkingMCPServer();
server.run().catch(console.error);

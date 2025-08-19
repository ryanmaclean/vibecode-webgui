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
    
    // Create more structured thinking steps with different focuses
    const thinkingTemplates = [
      { prefix: "Initial Analysis: ", content: "Understanding the core problem - " },
      { prefix: "Breaking Down: ", content: "Decomposing the problem into parts - " },
      { prefix: "Gathering Context: ", content: "Considering relevant information - " },
      { prefix: "Exploring Solutions: ", content: "Identifying potential approaches - " },
      { prefix: "Evaluating Options: ", content: "Assessing pros and cons - " },
      { prefix: "Developing Strategy: ", content: "Planning implementation steps - " },
      { prefix: "Considering Edge Cases: ", content: "Accounting for exceptions - " },
      { prefix: "Synthesizing: ", content: "Bringing insights together - " },
      { prefix: "Reflecting: ", content: "Reviewing the thinking process - " },
      { prefix: "Concluding: ", content: "Finalizing thoughts on - " }
    ];
    
    for (let i = 1; i <= num_steps; i++) {
      const templateIndex = (i - 1) % thinkingTemplates.length;
      const template = thinkingTemplates[templateIndex];
      
      thoughts.push({
        type: 'thought',
        text: `Step ${i}/${num_steps}: ${template.prefix}${template.content}'${prompt}'.`
      });
    }

    // Add a conclusion with a summary
    thoughts.push({
        type: 'text',
        text: `Completed sequential thinking process for '${prompt}' in ${num_steps} steps. This systematic approach helps break down complex problems into manageable parts, ensuring thorough analysis and consideration of multiple perspectives.`
    });

    return {
      content: thoughts
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

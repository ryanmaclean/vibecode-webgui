# Agent Framework

A flexible, extensible framework for building AI agents with tool use, memory, and specialized capabilities. Built on top of the UnifiedAIClient for seamless integration with multiple AI providers.

## Features

- 🛠️ **Tool Use**: Define and use custom tools with parameter validation
- 🧠 **Memory**: Conversation history and context management
- 🔌 **Provider Agnostic**: Works with any provider supported by UnifiedAIClient
- 🎯 **Specialized Agents**: Pre-built agents for common use cases (Code, Research, Creative, Data)
- 🔄 **Streaming**: Support for streaming responses
- 🧪 **Type Safety**: Fully typed with TypeScript
- 📊 **Observability**: Built-in event system for monitoring agent behavior

## Installation

```bash
npm install @vibecode/agent-framework
# or
yarn add @vibecode/agent-framework
```

## Quick Start

```typescript
import { createAgent } from '@vibecode/agent-framework';

// Create an agent with some tools
const agent = createAgent({
  model: 'openrouter/anthropic/claude-3-sonnet',
  temperature: 0.7,
  tools: [
    {
      name: 'calculator',
      description: 'Perform calculations',
      parameters: {
        type: 'object',
        properties: {
          expression: { type: 'string', description: 'The math expression to evaluate' }
        },
        required: ['expression']
      },
      execute: async ({ expression }) => {
        return { result: eval(expression) };
      }
    }
  ]
});

// Chat with the agent
async function chat() {
  const response = await agent.processMessage('What is 123 * 45?');
  console.log(response.content);
}

chat();
```

## Core Concepts

### Agents

Agents are the main interface for interacting with the AI. They maintain conversation history and can use tools.

```typescript
import { Agent } from '@vibecode/agent-framework';

const agent = new Agent({
  model: 'openrouter/anthropic/claude-3-sonnet',
  systemPrompt: 'You are a helpful assistant.',
  temperature: 0.7,
});
```

### Tools

Tools allow agents to perform actions beyond just generating text.

```typescript
const weatherTool = {
  name: 'get_weather',
  description: 'Get the current weather for a location',
  parameters: {
    type: 'object',
    properties: {
      location: { type: 'string' },
      unit: { 
        type: 'string',
        enum: ['celsius', 'fahrenheit'],
        default: 'celsius'
      }
    },
    required: ['location']
  },
  execute: async ({ location, unit }) => {
    // Call weather API
    return { temperature: 22, unit, condition: 'Sunny' };
  }
};
```

### Specialized Agents

Pre-built agents for common use cases:

```typescript
import { 
  CodeAgent, 
  ResearchAgent, 
  CreativeAgent, 
  DataAnalysisAgent 
} from '@vibecode/agent-framework/agents';

// For coding tasks
const codeAgent = new CodeAgent();

// For research and information gathering
const researchAgent = new ResearchAgent();

// For creative writing and brainstorming
const creativeAgent = new CreativeAgent();

// For data analysis tasks
const dataAgent = new DataAnalysisAgent();
```

### Streaming

Stream responses for a more interactive experience:

```typescript
for await (const chunk of agent.streamResponse('Tell me a story')) {
  process.stdout.write(chunk.content);
}
```

## API Reference

### Agent

#### `new Agent(options: AgentOptions)`

Create a new agent instance.

**Options:**
- `model`: The model to use (default: 'openrouter/anthropic/claude-3-sonnet')
- `temperature`: Sampling temperature (0-2, default: 0.7)
- `maxTokens`: Maximum number of tokens to generate (default: 1000)
- `tools`: Array of tools the agent can use
- `memorySize`: Number of messages to keep in memory (default: 20)
- `systemPrompt`: Initial system prompt
- `client`: Custom UnifiedAIClient instance

#### `agent.processMessage(content: string, options?: Partial<AgentOptions>): Promise<AgentResponse>`

Process a message and generate a response.

#### `agent.streamResponse(content: string, options?: Partial<AgentOptions>): AsyncGenerator<AgentResponse>`

Stream the agent's response to a message.

#### `agent.addToMemory(message: AgentMessage): void`

Add a message to the agent's memory.

#### `agent.clearMemory(): void`

Clear the agent's memory (except system messages).

### Built-in Tools

- `calculator`: Perform arithmetic calculations
- `webSearch`: Search the web for information
- `readFile`: Read the contents of a file
- `executeCode`: Execute code in a sandbox
- `getCurrentTime`: Get the current date and time

## Examples

See the [examples](./examples) directory for more usage examples.

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run linting
npm run lint
```

## License

MIT

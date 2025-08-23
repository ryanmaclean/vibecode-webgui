// Basic usage examples for the Agent Framework

import { createAgent } from '..';
import { builtInTools } from '../tools';
import { 
  CodeAgent, 
  ResearchAgent, 
  CreativeAgent, 
  DataAnalysisAgent,
  createSpecializedAgent,
} from '../agents';

/**
 * Example 1: Basic agent with no tools
 */
async function exampleBasicAgent() {
  // Create a basic agent
  const agent = createAgent({
    model: 'openrouter/anthropic/claude-3-sonnet',
    temperature: 0.7,
  });

  // Process a message
  const response = await agent.processMessage('Hello, how are you?');
  console.log('Basic Agent Response:', response.content);
}

/**
 * Example 2: Agent with built-in tools
 */
async function exampleWithTools() {
  // Create an agent with calculator and time tools
  const agent = createAgent({
    model: 'openrouter/anthropic/claude-3-sonnet',
    tools: [
      builtInTools.calculator,
      builtInTools.getCurrentTime,
    ],
  });

  // The agent can now use the calculator
  const mathResponse = await agent.processMessage(
    'What is 123 * 45? Use the calculator tool.'
  );
  console.log('Math Response:', mathResponse.content);

  // The agent can also get the current time
  const timeResponse = await agent.processMessage(
    'What time is it in New York?'
  );
  console.log('Time Response:', timeResponse.content);
}

/**
 * Example 3: Using a specialized CodeAgent
 */
async function exampleCodeAgent() {
  const agent = new CodeAgent({
    model: 'openrouter/meta-llama/llama-3-70b-instruct',
    temperature: 0.2,
  });

  // The CodeAgent comes with code execution tools
  const response = await agent.processMessage(
    'Write a function that calculates the factorial of a number in JavaScript.'
  );
  console.log('Code Agent Response:', response.content);
}

/**
 * Example 4: Using a ResearchAgent with web search
 */
async function exampleResearchAgent() {
  const agent = new ResearchAgent({
    model: 'openrouter/anthropic/claude-3-opus',
    temperature: 0.7,
    enableWebSearch: true,
  });

  // The ResearchAgent can search the web for information
  const response = await agent.processMessage(
    'What are the latest developments in AI as of 2024?'
  );
  console.log('Research Agent Response:', response.content);
}

/**
 * Example 5: Streaming responses
 */
async function exampleStreaming() {
  const agent = createAgent({
    model: 'openrouter/anthropic/claude-3-sonnet',
  });

  console.log('Streaming response:');
  for await (const chunk of agent.streamResponse(
    'Tell me a short story about a robot learning to paint.'
  )) {
    process.stdout.write(chunk.content);
  }
  console.log('\n');
}

/**
 * Example 6: Creating a custom tool
 */
async function exampleCustomTool() {
  // Define a custom tool
  const weatherTool = {
    name: 'get_weather',
    description: 'Get the current weather for a location',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'The city and state, e.g., San Francisco, CA',
        },
        unit: {
          type: 'string',
          enum: ['celsius', 'fahrenheit'],
          description: 'The unit of temperature',
          default: 'celsius',
        },
      },
      required: ['location'],
    },
    execute: async ({ location, unit = 'celsius' }) => {
      // In a real implementation, this would call a weather API
      return {
        location,
        temperature: unit === 'celsius' ? '22°C' : '72°F',
        condition: 'Sunny',
        humidity: '45%',
        wind: '10 km/h',
      };
    },
  };

  // Create an agent with the custom tool
  const agent = createAgent({
    model: 'openrouter/anthropic/claude-3-sonnet',
    tools: [weatherTool],
  });

  // The agent can now use the weather tool
  const response = await agent.processMessage(
    'What is the weather like in Paris?'
  );
  console.log('Weather Response:', response.content);
}

/**
 * Example 7: Using the factory function to create specialized agents
 */
async function exampleSpecializedAgents() {
  // Create different types of agents
  const codeAgent = createSpecializedAgent('code');
  const researchAgent = createSpecializedAgent('research');
  const creativeAgent = createSpecializedAgent('creative');
  const dataAgent = createSpecializedAgent('data');

  // Use each agent for its specialized task
  const codeResponse = await codeAgent.processMessage(
    'Write a Python function to sort a list of dictionaries by a specific key.'
  );
  console.log('Code Agent:', codeResponse.content.substring(0, 100) + '...');

  const researchResponse = await researchAgent.processMessage(
    'What are the latest developments in quantum computing?'
  );
  console.log('Research Agent:', researchResponse.content.substring(0, 100) + '...');

  const creativeResponse = await creativeAgent.processMessage(
    'Write a haiku about artificial intelligence.'
  );
  console.log('Creative Agent:', creativeResponse.content);

  const dataResponse = await dataAgent.processMessage(
    'Analyze this dataset and tell me the average, min, and max values.'
  );
  console.log('Data Agent:', dataResponse.content.substring(0, 100) + '...');
}

// Run all examples
async function runExamples() {
  console.log('=== Example 1: Basic Agent ===');
  await exampleBasicAgent();
  
  console.log('\n=== Example 2: Agent with Tools ===');
  await exampleWithTools();
  
  console.log('\n=== Example 3: Code Agent ===');
  await exampleCodeAgent();
  
  console.log('\n=== Example 4: Research Agent ===');
  await exampleResearchAgent();
  
  console.log('\n=== Example 5: Streaming ===');
  await exampleStreaming();
  
  console.log('\n=== Example 6: Custom Tool ===');
  await exampleCustomTool();
  
  console.log('\n=== Example 7: Specialized Agents ===');
  await exampleSpecializedAgents();
}

// Run the examples
runExamples().catch(console.error);

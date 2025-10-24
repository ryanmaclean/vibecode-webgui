/**
 * AI Chat Example - TypeScript SDK
 *
 * Demonstrates AI chat functionality:
 * - Sending chat messages
 * - Using context and RAG
 * - Managing conversations
 * - Working with different AI models
 */

import { createVibeCodeClient } from '@vibecode/client';

async function main() {
  const client = createVibeCodeClient({
    baseUrl: process.env.VIBECODE_API_URL || 'http://localhost:3000/api',
    token: process.env.VIBECODE_TOKEN,
  });

  await client.init();

  try {
    // Create a workspace for context
    console.log('Creating workspace for AI context...');
    const workspace = await client.createWorkspace({
      projectId: `ai-demo-${Date.now()}`,
      projectName: 'AI Demo',
      framework: 'react',
      files: {
        'src/components/Button.jsx': `
export default function Button({ children, onClick }) {
  return (
    <button onClick={onClick} className="btn">
      {children}
    </button>
  );
}`,
        'src/components/Counter.jsx': `
import { useState } from 'react';
import Button from './Button';

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <h2>Count: {count}</h2>
      <Button onClick={() => setCount(count + 1)}>
        Increment
      </Button>
    </div>
  );
}`,
      },
    });

    console.log(`Workspace created: ${workspace.id}\n`);

    // Example 1: Simple chat without context
    console.log('Example 1: Simple chat question');
    const response1 = await client.chat({
      message: 'What are React hooks and why are they useful?',
      model: 'anthropic/claude-3.5-sonnet',
      temperature: 0.7,
    });

    console.log('AI Response:');
    console.log(response1.response);
    console.log(`\nTokens used: ${response1.usage?.total_tokens}\n`);

    // Example 2: Chat with workspace context and RAG
    console.log('Example 2: Chat with workspace context');
    const response2 = await client.chat({
      message: 'How can I improve the Counter component in this codebase?',
      workspaceId: workspace.id,
      enableRAG: true,
      model: 'anthropic/claude-3.5-sonnet',
      context: {
        files: ['src/components/Counter.jsx', 'src/components/Button.jsx'],
      },
    });

    console.log('AI Response:');
    console.log(response2.response);
    console.log(`\nTokens used: ${response2.usage?.total_tokens}\n`);

    // Example 3: Multi-turn conversation
    console.log('Example 3: Multi-turn conversation');
    const messages = [
      {
        role: 'user' as const,
        content: 'I want to add a reset button to the counter',
      },
    ];

    const response3 = await client.chat({
      message: 'Show me the code for adding a reset button',
      messages,
      workspaceId: workspace.id,
      enableRAG: true,
      temperature: 0.5, // Lower temperature for more focused code generation
    });

    console.log('AI Response:');
    console.log(response3.response);

    // Example 4: Code generation with specific requirements
    console.log('\n\nExample 4: Specific code generation');
    const response4 = await client.chat({
      message:
        'Create a new component called TodoList that manages a list of tasks with add, delete, and toggle complete functionality. Use TypeScript.',
      model: 'anthropic/claude-3.5-sonnet',
      temperature: 0.3,
      max_tokens: 2000,
      enableTools: true,
    });

    console.log('AI Generated Code:');
    console.log(response4.response);

    // Example 5: Using streaming (if supported)
    console.log('\n\nExample 5: Streaming response');
    const streamResponse = await client.streamChat({
      conversationId: `conv-${Date.now()}`,
      message: 'Explain the useState hook with an example',
      workspaceId: workspace.id,
    });

    console.log('Stream initiated:', streamResponse);

    // Clean up
    console.log('\n\nCleaning up...');
    await client.deleteWorkspace(workspace.id);
    console.log('Workspace deleted');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

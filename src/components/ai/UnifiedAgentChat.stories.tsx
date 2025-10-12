/**
 * Storybook Stories for UnifiedAgentChat
 *
 * Interactive documentation and testing for the unified agent chat component.
 *
 * @module components/ai/UnifiedAgentChat.stories
 */

import { logger } from '@/lib/logger';

import type { Meta, StoryObj } from '@storybook/react'
import { UnifiedAgentChat } from './UnifiedAgentChat'
import type { AgentResponse } from '@/types/agent-api'

const mockAgent: AgentResponse = {
  agent_id: 'aider-abc123',
  agent_type: 'aider',
  status: 'running',
  terminal_id: 'term-1',
  created_at: new Date().toISOString(),
  stream_url: '/api/agents/aider-abc123/events'
}

const mockMessages = [
  {
    id: 'msg-1',
    agentId: 'aider-abc123',
    agentType: 'aider' as const,
    role: 'user' as const,
    content: 'Can you help me fix the authentication bug?',
    timestamp: new Date(Date.now() - 120000)
  },
  {
    id: 'msg-2',
    agentId: 'aider-abc123',
    agentType: 'aider' as const,
    role: 'assistant' as const,
    content: 'I\'d be happy to help you fix the authentication bug. Let me analyze the code...',
    timestamp: new Date(Date.now() - 110000),
    metadata: {
      model: 'claude-3-5-sonnet-20241022',
      tokens: 42,
      responseTime: 350
    }
  },
  {
    id: 'msg-3',
    agentId: 'aider-abc123',
    agentType: 'aider' as const,
    role: 'assistant' as const,
    content: 'I found the issue in your login handler:\n\n```typescript\nfunction handleLogin(credentials: Credentials) {\n  // Missing validation check\n  if (!credentials.email || !credentials.password) {\n    throw new Error(\'Invalid credentials\')\n  }\n  return authenticate(credentials)\n}\n```\n\nThe problem is that the email validation is missing. Let me fix that for you.',
    timestamp: new Date(Date.now() - 100000),
    metadata: {
      responseTime: 520
    }
  },
  {
    id: 'msg-4',
    agentId: 'aider-abc123',
    agentType: 'aider' as const,
    role: 'user' as const,
    content: 'Great! Can you also add some tests?',
    timestamp: new Date(Date.now() - 90000)
  }
]

const meta: Meta<typeof UnifiedAgentChat> = {
  title: 'AI/UnifiedAgentChat',
  component: UnifiedAgentChat,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Single conversation interface for all agents with SSE streaming, message history, code rendering, and @-mention support. Provides real-time agent communication with syntax highlighting and message management.'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    agent: {
      control: 'object',
      description: 'Currently active agent',
      table: {
        type: { summary: 'AgentResponse' }
      }
    },
    enableMentions: {
      control: 'boolean',
      description: 'Enable @-mentions for multi-agent coordination',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' }
      }
    },
    maxMessages: {
      control: 'number',
      description: 'Maximum message history length',
      table: {
        type: { summary: 'number' },
        defaultValue: { summary: '1000' }
      }
    }
  }
}

export default meta
type Story = StoryObj<typeof UnifiedAgentChat>

/**
 * Default state - Empty conversation
 */
export const Default: Story = {
  args: {
    agent: mockAgent,
    onMessageSend: (message: string) => {
      logger.info('Sending message:', message)
      alert(`Message sent: ${message}`)
    },
    onConnectionStateChange: (state) => {
      logger.info('Connection state:', state)
    }
  }
}

/**
 * With message history
 */
export const WithMessages: Story = {
  args: {
    ...Default.args,
    initialMessages: mockMessages
  }
}

/**
 * With code blocks
 */
export const WithCodeBlocks: Story = {
  args: {
    ...Default.args,
    initialMessages: [
      {
        id: 'msg-1',
        agentId: 'aider-abc123',
        agentType: 'aider' as const,
        role: 'user' as const,
        content: 'Show me an example React component',
        timestamp: new Date(Date.now() - 60000)
      },
      {
        id: 'msg-2',
        agentId: 'aider-abc123',
        agentType: 'aider' as const,
        role: 'assistant' as const,
        content: `Here's a simple React component example:

\`\`\`tsx
import React, { useState } from 'react'

interface CounterProps {
  initialValue?: number
}

export function Counter({ initialValue = 0 }: CounterProps) {
  const [count, setCount] = useState(initialValue)

  return (
    <div className="flex flex-col items-center gap-4">
      <h2 className="text-2xl font-bold">Count: {count}</h2>
      <div className="flex gap-2">
        <button
          onClick={() => setCount(count - 1)}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          Decrement
        </button>
        <button
          onClick={() => setCount(count + 1)}
          className="px-4 py-2 bg-green-500 text-white rounded"
        >
          Increment
        </button>
      </div>
    </div>
  )
}
\`\`\`

You can also add TypeScript for better type safety:

\`\`\`typescript
type CounterAction = 'increment' | 'decrement' | 'reset'

function reducer(state: number, action: CounterAction): number {
  switch (action) {
    case 'increment':
      return state + 1
    case 'decrement':
      return state - 1
    case 'reset':
      return 0
    default:
      return state
  }
}
\`\`\``,
        timestamp: new Date(Date.now() - 50000)
      }
    ]
  }
}

/**
 * With @-mentions enabled
 */
export const WithMentions: Story = {
  args: {
    ...Default.args,
    enableMentions: true,
    availableAgents: [
      mockAgent,
      {
        agent_id: 'cline-def456',
        agent_type: 'cline',
        status: 'running',
        terminal_id: 'term-2',
        created_at: new Date().toISOString()
      },
      {
        agent_id: 'goose-ghi789',
        agent_type: 'goose',
        status: 'running',
        terminal_id: 'term-3',
        created_at: new Date().toISOString()
      }
    ]
  },
  parameters: {
    docs: {
      description: {
        story: 'Type @ in the message input to see agent mention suggestions. This enables multi-agent coordination.'
      }
    }
  }
}

/**
 * Streaming message
 */
export const StreamingMessage: Story = {
  args: {
    ...Default.args,
    initialMessages: [
      ...mockMessages,
      {
        id: 'msg-streaming',
        agentId: 'aider-abc123',
        agentType: 'aider' as const,
        role: 'assistant' as const,
        content: 'I\'m analyzing your code and preparing a solution...',
        timestamp: new Date(),
        isStreaming: true
      }
    ]
  }
}

/**
 * Error state
 */
export const WithError: Story = {
  args: {
    ...Default.args,
    initialMessages: [
      {
        id: 'msg-1',
        agentId: 'aider-abc123',
        agentType: 'aider' as const,
        role: 'user' as const,
        content: 'This message failed to send',
        timestamp: new Date(),
        status: 'error' as const
      }
    ]
  }
}

/**
 * Long conversation
 */
export const LongConversation: Story = {
  args: {
    ...Default.args,
    initialMessages: Array.from({ length: 50 }, (_, i) => ({
      id: `msg-${i}`,
      agentId: 'aider-abc123',
      agentType: 'aider' as const,
      role: (i % 2 === 0 ? 'user' : 'assistant') as const,
      content: i % 2 === 0
        ? `User message ${i / 2 + 1}`
        : `Assistant response ${Math.floor(i / 2) + 1}`,
      timestamp: new Date(Date.now() - (50 - i) * 10000)
    }))
  }
}

/**
 * Mobile viewport
 */
export const Mobile: Story = {
  args: {
    ...WithMessages.args
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1'
    }
  }
}

/**
 * Dark mode
 */
export const DarkMode: Story = {
  args: {
    ...WithCodeBlocks.args
  },
  parameters: {
    backgrounds: {
      default: 'dark'
    }
  }
}

/**
 * Disconnected state
 */
export const Disconnected: Story = {
  args: {
    ...Default.args,
    agent: {
      ...mockAgent,
      status: 'stopped'
    }
  }
}

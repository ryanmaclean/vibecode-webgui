/**
 * Storybook Stories for MultiAgentWorkspace
 *
 * Interactive documentation and testing for the multi-agent workspace component.
 *
 * @module components/ai/MultiAgentWorkspace.stories
 */

import type { Meta, StoryObj } from '@storybook/react'
import { MultiAgentWorkspace } from './MultiAgentWorkspace'
import type { AgentResponse } from '@/types/agent-api'
import { logger } from '@/lib/logger';
const mockAgents: AgentResponse[] = [
  {
    agent_id: 'aider-abc123',
    agent_type: 'aider',
    status: 'running',
    terminal_id: 'term-1',
    created_at: new Date().toISOString(),
    stream_url: '/api/agents/aider-abc123/events'
  },
  {
    agent_id: 'cline-def456',
    agent_type: 'cline',
    status: 'running',
    terminal_id: 'term-2',
    created_at: new Date().toISOString(),
    stream_url: '/api/agents/cline-def456/events'
  },
  {
    agent_id: 'goose-ghi789',
    agent_type: 'goose',
    status: 'running',
    terminal_id: 'term-3',
    created_at: new Date().toISOString(),
    stream_url: '/api/agents/goose-ghi789/events'
  }
]

const meta: Meta<typeof MultiAgentWorkspace> = {
  title: 'AI/MultiAgentWorkspace',
  component: MultiAgentWorkspace,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Split-screen layout for parallel agent conversations with drag-to-reorder, context synchronization, and comparative response view. Supports 1-4 simultaneous agents with flexible grid layouts.'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    agents: {
      control: 'object',
      description: 'Active agents to display',
      table: {
        type: { summary: 'AgentResponse[]' }
      }
    },
    enableContextSync: {
      control: 'boolean',
      description: 'Enable context synchronization across agents',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' }
      }
    },
    showMetrics: {
      control: 'boolean',
      description: 'Show comparative metrics view',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' }
      }
    },
    maxAgents: {
      control: 'number',
      description: 'Maximum number of agents to display',
      table: {
        type: { summary: 'number' },
        defaultValue: { summary: '4' }
      }
    }
  }
}

export default meta
type Story = StoryObj<typeof MultiAgentWorkspace>

/**
 * Single agent view
 */
export const SingleAgent: Story = {
  args: {
    agents: [mockAgents[0]],
    onMessageSend: (agentId, message) => {
      logger.info(`Message to ${agentId}:`, message)
      alert(`Sent to ${agentId}: ${message}`)
    }
  }
}

/**
 * Two agents - Split view
 */
export const TwoAgents: Story = {
  args: {
    agents: mockAgents.slice(0, 2),
    onMessageSend: (agentId, message) => {
      logger.info(`Message to ${agentId}:`, message)
    }
  }
}

/**
 * Three agents - Grid view
 */
export const ThreeAgents: Story = {
  args: {
    agents: mockAgents,
    onMessageSend: (agentId, message) => {
      logger.info(`Message to ${agentId}:`, message)
    }
  }
}

/**
 * Four agents - Full grid
 */
export const FourAgents: Story = {
  args: {
    agents: [
      ...mockAgents,
      {
        agent_id: 'opencode-jkl012',
        agent_type: 'aider',
        status: 'running',
        terminal_id: 'term-4',
        created_at: new Date().toISOString(),
        stream_url: '/api/agents/opencode-jkl012/events'
      }
    ],
    onMessageSend: (agentId, message) => {
      logger.info(`Message to ${agentId}:`, message)
    }
  }
}

/**
 * With context synchronization
 */
export const WithContextSync: Story = {
  args: {
    agents: mockAgents.slice(0, 2),
    enableContextSync: true,
    onMessageSend: (agentId, message) => {
      logger.info(`Message to ${agentId}:`, message)
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'When context sync is enabled, messages sent to one agent are automatically shared with all agents in the workspace.'
      }
    }
  }
}

/**
 * With performance metrics
 */
export const WithMetrics: Story = {
  args: {
    agents: mockAgents,
    showMetrics: true,
    onMessageSend: (agentId, message) => {
      logger.info(`Message to ${agentId}:`, message)
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Displays comparative performance metrics including response times, message counts, and token usage across all agents.'
      }
    }
  }
}

/**
 * Fully configured workspace
 */
export const FullyConfigured: Story = {
  args: {
    agents: mockAgents,
    enableContextSync: true,
    showMetrics: true,
    maxAgents: 4,
    onMessageSend: (agentId, message) => {
      logger.info(`Message to ${agentId}:`, message)
    }
  }
}

/**
 * Tablet viewport
 */
export const Tablet: Story = {
  args: {
    agents: mockAgents.slice(0, 2),
    onMessageSend: (agentId, message) => {
      logger.info(`Message to ${agentId}:`, message)
    }
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet'
    }
  }
}

/**
 * Mobile viewport (single column)
 */
export const Mobile: Story = {
  args: {
    agents: mockAgents.slice(0, 2),
    onMessageSend: (agentId, message) => {
      logger.info(`Message to ${agentId}:`, message)
    }
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
    agents: mockAgents,
    showMetrics: true,
    onMessageSend: (agentId, message) => {
      logger.info(`Message to ${agentId}:`, message)
    }
  },
  parameters: {
    backgrounds: {
      default: 'dark'
    }
  }
}

/**
 * Interactive playground
 */
export const Playground: Story = {
  args: {
    agents: mockAgents.slice(0, 2),
    enableContextSync: false,
    showMetrics: false,
    onMessageSend: (agentId, message) => {
      logger.info(`Message to ${agentId}:`, message)
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Try dragging panels to reorder, toggling context sync, and enabling metrics. Use the layout buttons to switch between different grid configurations.'
      }
    }
  }
}

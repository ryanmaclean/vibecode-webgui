/**
 * Storybook Stories for AgentSelectorPanel
 *
 * Interactive documentation and testing for the agent selector component.
 *
 * @module components/ai/AgentSelectorPanel.stories
 */

import type { Meta, StoryObj } from '@storybook/react'
import { AgentSelectorPanel } from './AgentSelectorPanel'
// import { logger } from '@/lib/logger';
const meta: Meta<typeof AgentSelectorPanel> = {
  title: 'AI/AgentSelectorPanel',
  component: AgentSelectorPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Grid layout for selecting AI coding agents with real-time status indicators, capability badges, keyboard shortcuts, and smart recommendations based on task description.'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    taskDescription: {
      control: 'text',
      description: 'Task description for smart agent recommendation',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: 'undefined' }
      }
    },
    activeAgents: {
      control: 'object',
      description: 'Currently active agent IDs',
      table: {
        type: { summary: 'string[]' },
        defaultValue: { summary: '[]' }
      }
    },
    enableKeyboardShortcuts: {
      control: 'boolean',
      description: 'Enable keyboard shortcuts (⌘+1-6)',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' }
      }
    }
  }
}

export default meta
type Story = StoryObj<typeof AgentSelectorPanel>

/**
 * Default state - All agents ready for selection
 */
export const Default: Story = {
  args: {
    onAgentSelect: (agentId: string) => {
      console.info('Selected agent:', agentId)
      alert(`Selected: ${agentId}`)
    },
    onAgentStop: (agentId: string) => {
      console.info('Stopped agent:', agentId)
      alert(`Stopped: ${agentId}`)
    },
    activeAgents: [],
    enableKeyboardShortcuts: true
  }
}

/**
 * With task description - Shows smart recommendation
 */
export const WithTaskDescription: Story = {
  args: {
    ...Default.args,
    taskDescription: 'Fix authentication bug in login flow and add tests'
  }
}

/**
 * Git-related task - Recommends Aider
 */
export const GitTask: Story = {
  args: {
    ...Default.args,
    taskDescription: 'Create a new branch and commit changes to repository'
  }
}

/**
 * Testing task - Recommends Claude Code
 */
export const TestingTask: Story = {
  args: {
    ...Default.args,
    taskDescription: 'Add unit tests and improve test coverage'
  }
}

/**
 * Quick fix task - Recommends Cline
 */
export const QuickFixTask: Story = {
  args: {
    ...Default.args,
    taskDescription: 'Quick bug fix in header component'
  }
}

/**
 * Deployment task - Recommends Goose
 */
export const DeploymentTask: Story = {
  args: {
    ...Default.args,
    taskDescription: 'Deploy application to production and set up CI/CD pipeline'
  }
}

/**
 * With active agents - Shows some agents running
 */
export const WithActiveAgents: Story = {
  args: {
    ...Default.args,
    activeAgents: ['aider', 'cline']
  }
}

/**
 * Without keyboard shortcuts
 */
export const NoKeyboardShortcuts: Story = {
  args: {
    ...Default.args,
    enableKeyboardShortcuts: false
  }
}

/**
 * Mobile viewport
 */
export const Mobile: Story = {
  args: {
    ...Default.args
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1'
    }
  }
}

/**
 * Tablet viewport
 */
export const Tablet: Story = {
  args: {
    ...Default.args
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet'
    }
  }
}

/**
 * Dark mode
 */
export const DarkMode: Story = {
  args: {
    ...Default.args,
    taskDescription: 'Implement dark mode for the application'
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
    ...Default.args
  },
  parameters: {
    docs: {
      description: {
        story: 'Try different task descriptions to see smart recommendations in action. Use keyboard shortcuts ⌘+1-6 to quickly select agents.'
      }
    }
  }
}

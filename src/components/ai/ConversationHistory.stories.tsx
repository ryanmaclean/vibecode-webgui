/**
 * Storybook Stories for ConversationHistory
 *
 * Interactive documentation and testing for the conversation history component.
 *
 * @module components/ai/ConversationHistory.stories
 */

import type { Meta, StoryObj } from '@storybook/react'
import { ConversationHistory } from './ConversationHistory'
// import { logger } from '@/lib/logger';
const mockConversations = [
  {
    id: 'conv-1',
    agentId: 'aider-abc123',
    agentType: 'aider' as const,
    title: 'Fix authentication bug in login flow',
    messages: Array(15).fill(null).map((_, i) => ({
      id: `msg-${i}`,
      role: 'user' as const,
      content: 'Message content',
      timestamp: new Date()
    })),
    createdAt: new Date(Date.now() - 7200000), // 2 hours ago
    updatedAt: new Date(Date.now() - 3600000), // 1 hour ago
    messageCount: 15,
    status: 'completed' as const,
    tags: ['bug-fix', 'authentication']
  },
  {
    id: 'conv-2',
    agentId: 'cline-def456',
    agentType: 'cline' as const,
    title: 'Implement dark mode toggle',
    messages: Array(8).fill(null).map((_, i) => ({
      id: `msg-${i}`,
      role: 'user' as const,
      content: 'Message content',
      timestamp: new Date()
    })),
    createdAt: new Date(Date.now() - 86400000), // 1 day ago
    updatedAt: new Date(Date.now() - 43200000), // 12 hours ago
    messageCount: 8,
    status: 'active' as const,
    tags: ['feature', 'ui']
  },
  {
    id: 'conv-3',
    agentId: 'goose-ghi789',
    agentType: 'goose' as const,
    title: 'Deploy to production with CI/CD',
    messages: Array(25).fill(null).map((_, i) => ({
      id: `msg-${i}`,
      role: 'user' as const,
      content: 'Message content',
      timestamp: new Date()
    })),
    createdAt: new Date(Date.now() - 172800000), // 2 days ago
    updatedAt: new Date(Date.now() - 86400000), // 1 day ago
    messageCount: 25,
    status: 'completed' as const,
    tags: ['deployment', 'ci-cd']
  },
  {
    id: 'conv-4',
    agentId: 'aider-abc123',
    agentType: 'aider' as const,
    title: 'Refactor database queries',
    messages: Array(12).fill(null).map((_, i) => ({
      id: `msg-${i}`,
      role: 'user' as const,
      content: 'Message content',
      timestamp: new Date()
    })),
    createdAt: new Date(Date.now() - 259200000), // 3 days ago
    updatedAt: new Date(Date.now() - 172800000), // 2 days ago
    messageCount: 12,
    status: 'archived' as const,
    tags: ['refactoring', 'performance']
  },
  {
    id: 'conv-5',
    agentId: 'cline-def456',
    agentType: 'cline' as const,
    title: 'Add error tracking with Sentry',
    messages: Array(18).fill(null).map((_, i) => ({
      id: `msg-${i}`,
      role: 'user' as const,
      content: 'Message content',
      timestamp: new Date()
    })),
    createdAt: new Date(Date.now() - 345600000), // 4 days ago
    updatedAt: new Date(Date.now() - 259200000), // 3 days ago
    messageCount: 18,
    status: 'completed' as const,
    tags: ['monitoring', 'error-tracking']
  }
]

const meta: Meta<typeof ConversationHistory> = {
  title: 'AI/ConversationHistory',
  component: ConversationHistory,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Sidebar for searching, filtering, and managing past agent conversations. Supports search, filtering, sorting, folder organization, and Markdown export.'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    conversations: {
      control: 'object',
      description: 'List of conversations',
      table: {
        type: { summary: 'Conversation[]' }
      }
    },
    selectedConversationId: {
      control: 'text',
      description: 'Currently selected conversation ID',
      table: {
        type: { summary: 'string' }
      }
    },
    enableSearch: {
      control: 'boolean',
      description: 'Enable search functionality',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' }
      }
    },
    enableFolders: {
      control: 'boolean',
      description: 'Enable folder organization by agent type',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' }
      }
    }
  }
}

export default meta
type Story = StoryObj<typeof ConversationHistory>

/**
 * Default state with conversations
 */
export const Default: Story = {
  args: {
    conversations: mockConversations,
    onConversationSelect: (id: string) => {
      console.log('Selected conversation:', id)
      alert(`Selected: ${id}`)
    },
    onConversationDelete: (id: string) => {
      console.log('Deleted conversation:', id)
      alert(`Deleted: ${id}`)
    },
    onConversationExport: (id: string) => {
      console.log('Exported conversation:', id)
      alert(`Exported: ${id}`)
    }
  }
}

/**
 * With selected conversation
 */
export const WithSelection: Story = {
  args: {
    ...Default.args,
    selectedConversationId: 'conv-1'
  }
}

/**
 * Empty state
 */
export const Empty: Story = {
  args: {
    conversations: [],
    onConversationSelect: (id: string) => {
      console.log('Selected conversation:', id)
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows empty state when no conversations exist.'
      }
    }
  }
}

/**
 * With search results
 */
export const SearchResults: Story = {
  args: {
    ...Default.args,
    conversations: mockConversations.filter(c => c.title.includes('bug'))
  },
  parameters: {
    docs: {
      description: {
        story: 'Try searching for "bug" or "deployment" to filter conversations.'
      }
    }
  }
}

/**
 * Without folders
 */
export const WithoutFolders: Story = {
  args: {
    ...Default.args,
    enableFolders: false
  },
  parameters: {
    docs: {
      description: {
        story: 'Displays conversations in a flat list without grouping by agent type.'
      }
    }
  }
}

/**
 * Without search
 */
export const WithoutSearch: Story = {
  args: {
    ...Default.args,
    enableSearch: false
  }
}

/**
 * Many conversations
 */
export const ManyConversations: Story = {
  args: {
    ...Default.args,
    conversations: Array.from({ length: 50 }, (_, i) => ({
      id: `conv-${i}`,
      agentId: `agent-${i % 3}`,
      agentType: (['aider', 'cline', 'goose'] as const)[i % 3],
      title: `Conversation ${i + 1}: ${['Bug fix', 'Feature', 'Deployment'][i % 3]}`,
      messages: [],
      createdAt: new Date(Date.now() - i * 86400000),
      updatedAt: new Date(Date.now() - i * 43200000),
      messageCount: Math.floor(Math.random() * 30) + 5,
      status: (['active', 'completed', 'archived'] as const)[i % 3],
      tags: [['bug', 'fix'], ['feature', 'ui'], ['deploy', 'ci-cd']][i % 3]
    }))
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests performance with a large number of conversations. Scroll to see virtual scrolling in action.'
      }
    }
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
    selectedConversationId: 'conv-1'
  },
  parameters: {
    backgrounds: {
      default: 'dark'
    }
  }
}

/**
 * Filtered by active status
 */
export const ActiveOnly: Story = {
  args: {
    ...Default.args,
    conversations: mockConversations.filter(c => c.status === 'active')
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows only active conversations using the filter dropdown.'
      }
    }
  }
}

/**
 * Sorted by most messages
 */
export const SortedByMessages: Story = {
  args: {
    ...Default.args,
    conversations: [...mockConversations].sort((a, b) => b.messageCount - a.messageCount)
  },
  parameters: {
    docs: {
      description: {
        story: 'Conversations sorted by message count (highest first).'
      }
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
        story: 'Try searching, filtering, sorting, and clicking on conversations. Use the context menu to export or delete conversations.'
      }
    }
  }
}

# Multi-Agent UX Design System - Integration Guide

**Version:** 1.0.0
**Date:** 2025-10-02
**Author:** Agent 18 - UX Designer

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Component Integration](#component-integration)
3. [Design Token Usage](#design-token-usage)
4. [Accessibility Guidelines](#accessibility-guidelines)
5. [Performance Optimization](#performance-optimization)
6. [Testing](#testing)
7. [Cross-Agent Integration](#cross-agent-integration)

---

## Quick Start

### Installation

The design system components are already included in the project at `/src/design-system/`.

```bash
# Install required dependencies (if not already present)
npm install framer-motion react-resizable-panels zustand

# Verify installation
npm run type-check
```

### Basic Usage

```tsx
// pages/agents/index.tsx
import { MultiAgentWorkspace } from '@/design-system/components/MultiAgentWorkspace';
import { Bot } from 'lucide-react';

const agents = [
  {
    id: 'agent-1',
    name: 'Build Engineer',
    role: 'Docker & CI/CD',
    color: 'hsl(262, 80%, 50%)',
    bgColor: 'hsl(262, 80%, 97%)',
    bgColorDark: 'hsl(262, 80%, 12%)',
    icon: <Bot size={20} />,
    status: 'active',
  },
  // ... more agents
];

export default function AgentsPage() {
  const [conversations, setConversations] = useState(new Map());

  const handleSendMessage = (agentId: string, content: string) => {
    // Send message to agent API
    // Update conversations state
  };

  return (
    <MultiAgentWorkspace
      agents={agents}
      conversations={conversations}
      onSendMessage={handleSendMessage}
      onReply={(agentId, messageId, content) => {
        // Handle reply logic
      }}
    />
  );
}
```

---

## Component Integration

### 1. AgentSelector Component

**Purpose:** Allow users to switch between agents with <3 clicks.

#### Usage

```tsx
import { AgentSelector, Agent } from '@/design-system/components/AgentSelector';

function MyComponent() {
  const [selectedAgent, setSelectedAgent] = useState<Agent>(agents[0]);

  return (
    <AgentSelector
      agents={agents}
      selectedAgent={selectedAgent}
      onSelectAgent={setSelectedAgent}
      variant="dropdown" // 'dropdown' | 'tabs' | 'sidebar'
    />
  );
}
```

#### Variants

**Dropdown** (Mobile & Compact)
- **When:** Limited horizontal space, <768px width
- **Clicks:** 2 (open dropdown, select agent)
- **Pros:** Space-efficient, works on all screen sizes
- **Cons:** Requires click to see all agents

**Tabs** (Desktop)
- **When:** Sufficient horizontal space, 6 agents or fewer
- **Clicks:** 1 (direct click on tab)
- **Pros:** All agents visible, fastest switching
- **Cons:** Requires ~800px horizontal space

**Sidebar** (Desktop with Space)
- **When:** Large screens (>1280px), vertical space preferred
- **Clicks:** 1 (direct click on agent)
- **Pros:** Large hit targets, room for agent descriptions
- **Cons:** Takes vertical space

#### Integration with Agent 11 (Component Library)

**Required:** Export AgentSelector variants to Agent 11's component library.

```tsx
// Agent 11: src/components/agents/index.ts
export {
  AgentSelector,
  AgentDropdown,
  AgentTabs,
  AgentSidebar,
  type Agent,
  type AgentSelectorProps
} from '@/design-system/components/AgentSelector';
```

### 2. ConversationThread Component

**Purpose:** Display threaded conversations with nested replies (max 3 levels).

#### Usage

```tsx
import { ConversationThread, Message } from '@/design-system/components/ConversationThread';

function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);

  return (
    <ConversationThread
      messages={messages}
      currentUserId="user-123"
      onReply={(messageId, content) => {
        // Handle reply submission
        const newReply: Message = {
          id: generateId(),
          agentId: selectedAgent.id,
          agentName: selectedAgent.name,
          agentColor: selectedAgent.color,
          content,
          timestamp: new Date(),
          role: 'user',
          parentId: messageId,
        };
        setMessages([...messages, newReply]);
      }}
      maxNestingLevel={3} // Default: 3
    />
  );
}
```

#### Message Structure

```typescript
interface Message {
  id: string;                // Unique message ID
  agentId: string;           // Agent who sent message
  agentName: string;         // Display name
  agentColor: string;        // Brand color (HSL format)
  content: string;           // Message text (supports markdown)
  timestamp: Date;           // Message timestamp
  role: 'user' | 'assistant'; // Message sender type
  status?: 'sending' | 'sent' | 'delivered' | 'error'; // Delivery status
  replies?: Message[];       // Nested replies (populated by component)
  parentId?: string;         // Parent message ID (for threading)
}
```

#### Keyboard Navigation

- **Tab:** Focus next message
- **Shift+Tab:** Focus previous message
- **Enter:** Expand/collapse replies
- **R:** Open reply input (when message focused)
- **Escape:** Close reply input

### 3. MultiAgentWorkspace Component

**Purpose:** Responsive layout managing 6+ agents across mobile/tablet/desktop.

#### Usage

```tsx
import { MultiAgentWorkspace } from '@/design-system/components/MultiAgentWorkspace';

function WorkspacePage() {
  const conversations = new Map<string, Message[]>();

  // Populate conversations for each agent
  agents.forEach(agent => {
    conversations.set(agent.id, getConversation(agent.id));
  });

  return (
    <MultiAgentWorkspace
      agents={agents}
      conversations={conversations}
      onSendMessage={(agentId, content) => {
        // Send message to agent API
        sendMessageToAgent(agentId, content);
      }}
      onReply={(agentId, messageId, content) => {
        // Send reply to agent API
        replyToMessage(agentId, messageId, content);
      }}
    />
  );
}
```

#### Responsive Behavior

**Mobile (<768px)**
- Single conversation view
- Bottom sheet agent selector
- Full-screen input area
- Touch-optimized (44px min targets)

**Tablet (768px - 1023px)**
- Side-by-side layout
- Collapsible sidebar (portrait)
- Persistent sidebar (landscape)
- Resizable panels

**Desktop (≥1024px)**
- Multi-panel grid (up to 4 agents)
- Compact agent selector sidebar
- Drag-to-resize panels
- Keyboard shortcuts enabled

#### Integration with Agent 14 (Editor)

**Required:** Provide layout grid for Agent 14's code editor integration.

```tsx
// Agent 14: Layout integration
import { Panel, PanelGroup } from 'react-resizable-panels';

<PanelGroup direction="horizontal">
  <Panel defaultSize={40}>
    <MultiAgentWorkspace {...props} />
  </Panel>
  <Panel defaultSize={60}>
    <CodeEditor /> {/* Agent 14's editor */}
  </Panel>
</PanelGroup>
```

### 4. KeyboardShortcuts Component

**Purpose:** Display keyboard shortcuts help modal.

#### Usage

```tsx
import {
  KeyboardShortcuts,
  useKeyboardShortcuts,
  KeyboardShortcutsButton
} from '@/design-system/components/KeyboardShortcuts';

function App() {
  const shortcuts = useKeyboardShortcuts();

  return (
    <>
      <header>
        <KeyboardShortcutsButton onClick={shortcuts.open} />
      </header>

      <KeyboardShortcuts
        isOpen={shortcuts.isOpen}
        onClose={shortcuts.close}
      />
    </>
  );
}
```

#### Auto-Trigger

The `useKeyboardShortcuts` hook automatically listens for:
- **Cmd/Ctrl + /**: Open shortcuts modal
- **?**: Open shortcuts modal (Shift + /)

---

## Design Token Usage

### Importing Tokens

```tsx
import { designTokens, componentTokens, a11yTokens } from '@/design-system/tokens';
```

### Color System

#### Agent Colors

```tsx
// Use predefined agent colors
const agent1Color = designTokens.colors.agents.agent1.main; // Purple
const agent2Color = designTokens.colors.agents.agent2.main; // Cyan
// ... etc

// Apply to components
<div style={{ backgroundColor: agent1Color }}>
  Agent 1 Panel
</div>
```

#### Semantic Colors

```tsx
// Use for status indicators
const { success, warning, error, info } = designTokens.colors;

<StatusBadge color={success}>Complete</StatusBadge>
<StatusBadge color={error}>Failed</StatusBadge>
```

#### Integration with Agent 12 (Theme Store)

**Required:** Provide color tokens to Agent 12's theme management.

```tsx
// Agent 12: src/store/themeStore.ts
import { designTokens } from '@/design-system/tokens';

export const themeStore = create<ThemeState>((set) => ({
  colors: designTokens.colors,
  updateAgentColor: (agentId: string, color: string) => {
    // Update agent color dynamically
  },
}));
```

### Typography

```tsx
import { designTokens } from '@/design-system/tokens';

// Font families
const { sans, mono } = designTokens.typography.fontFamily;

// Font sizes
const { xs, sm, base, lg, xl } = designTokens.typography.fontSize;

// Apply to components
<p style={{
  fontFamily: sans,
  fontSize: base,
  lineHeight: designTokens.typography.lineHeight.normal
}}>
  Body text
</p>
```

### Spacing (4px Grid)

```tsx
// All spacing is based on 4px grid
const { spacing } = designTokens;

<div style={{
  padding: spacing[4],      // 16px
  marginBottom: spacing[6], // 24px
  gap: spacing[3],          // 12px
}}>
```

### Shadows & Elevation

```tsx
const { shadows } = designTokens;

<Card style={{ boxShadow: shadows.md }}>
  Elevated card
</Card>

<Modal style={{ boxShadow: shadows.xl }}>
  Modal content
</Modal>
```

### Animation

```tsx
const { animation } = designTokens;

<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{
    duration: parseFloat(animation.duration.base) / 1000, // Convert ms to s
    ease: animation.easing.easeOut,
  }}
>
  Animated content
</motion.div>
```

---

## Accessibility Guidelines

### WCAG 2.1 AA Compliance

All components meet WCAG 2.1 AA standards. Follow these guidelines when integrating:

#### 1. Color Contrast

```tsx
// ✅ Good: High contrast text
<p className="text-neutral-900 dark:text-neutral-100">
  Body text (4.5:1 contrast ratio)
</p>

// ❌ Bad: Low contrast text
<p className="text-neutral-400 dark:text-neutral-600">
  Unreadable text (fails WCAG)
</p>
```

#### 2. Touch Targets

```tsx
// ✅ Good: 44px minimum touch target (iOS/Android standard)
<button className="min-h-[44px] min-w-[44px]">
  Click me
</button>

// ❌ Bad: Too small
<button className="h-8 w-8">
  Too small (32px)
</button>
```

#### 3. Keyboard Navigation

```tsx
// ✅ Good: All interactive elements keyboard accessible
<button
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
  aria-label="Descriptive label"
>
  Action
</button>

// ✅ Good: Focus indicators
<button className="focus:outline-none focus:ring-2 focus:ring-primary-500">
  Focusable
</button>
```

#### 4. Screen Reader Support

```tsx
// ✅ Good: Proper ARIA labels and roles
<nav aria-label="Agent selection">
  <button
    aria-label="Switch to Build Engineer"
    aria-current={isSelected ? 'page' : undefined}
  >
    Agent 1
  </button>
</nav>

// ✅ Good: Live regions for dynamic content
<div aria-live="polite" aria-atomic="true">
  {statusMessage}
</div>

// ✅ Good: Modal accessibility
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  aria-describedby="modal-description"
>
  <h2 id="modal-title">Modal Title</h2>
  <p id="modal-description">Modal description</p>
</div>
```

#### 5. Motion Reduction

```tsx
// ✅ Good: Respect prefers-reduced-motion
import { useReducedMotion } from '@/hooks/useReducedMotion';

function AnimatedComponent() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0.01 : 0.3 }}
    >
      Content
    </motion.div>
  );
}
```

### Testing Accessibility

```bash
# Run automated accessibility tests
npm run test:a11y

# Test with screen readers
# - VoiceOver: Cmd+F5 (macOS)
# - NVDA: Download from nvaccess.org (Windows)
# - JAWS: Download trial (Windows)

# Test keyboard navigation
# 1. Disconnect mouse/trackpad
# 2. Navigate using Tab, Shift+Tab, Enter, Escape
# 3. Verify all actions accessible via keyboard
```

---

## Performance Optimization

### Code Splitting

```tsx
// Lazy load heavy components
import dynamic from 'next/dynamic';

const MultiAgentWorkspace = dynamic(
  () => import('@/design-system/components/MultiAgentWorkspace'),
  {
    loading: () => <WorkspaceSkeleton />,
    ssr: false, // Disable SSR for client-only components
  }
);
```

### Virtual Scrolling

For long conversation threads (>100 messages), use virtual scrolling:

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

function LongConversation({ messages }: { messages: Message[] }) {
  const parentRef = React.useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // Estimated message height
    overscan: 5, // Render 5 extra items off-screen
  });

  return (
    <div ref={parentRef} style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <MessageBubble
            key={virtualRow.key}
            message={messages[virtualRow.index]}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

### Image Optimization

```tsx
// Use Next.js Image component for avatars and icons
import Image from 'next/image';

<Image
  src={agent.avatarUrl}
  alt={agent.name}
  width={40}
  height={40}
  loading="lazy"
  placeholder="blur"
/>
```

### Animation Performance

```tsx
// ✅ Good: Animate compositor properties (transform, opacity)
<motion.div
  animate={{ opacity: 1, transform: 'translateY(0)' }}
>
  Performant animation
</motion.div>

// ❌ Bad: Animate layout properties (width, height, top, left)
<motion.div
  animate={{ width: 200, height: 100 }}
>
  Causes layout thrashing
</motion.div>
```

---

## Testing

### Unit Tests

```tsx
// src/design-system/components/__tests__/AgentSelector.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { AgentSelector } from '../AgentSelector';

describe('AgentSelector', () => {
  const mockAgents = [
    { id: '1', name: 'Agent 1', role: 'Builder', color: '#000' },
    { id: '2', name: 'Agent 2', role: 'Docs', color: '#111' },
  ];

  it('renders dropdown variant', () => {
    const { container } = render(
      <AgentSelector
        agents={mockAgents}
        selectedAgent={mockAgents[0]}
        onSelectAgent={jest.fn()}
        variant="dropdown"
      />
    );
    expect(container).toMatchSnapshot();
  });

  it('switches agent on click', () => {
    const handleSelect = jest.fn();
    render(
      <AgentSelector
        agents={mockAgents}
        selectedAgent={mockAgents[0]}
        onSelectAgent={handleSelect}
        variant="dropdown"
      />
    );

    fireEvent.click(screen.getByText('Agent 1'));
    fireEvent.click(screen.getByText('Agent 2'));
    expect(handleSelect).toHaveBeenCalledWith(mockAgents[1]);
  });

  it('supports keyboard navigation', () => {
    render(
      <AgentSelector
        agents={mockAgents}
        selectedAgent={mockAgents[0]}
        onSelectAgent={jest.fn()}
        variant="dropdown"
      />
    );

    const trigger = screen.getByRole('button');
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
```

### Accessibility Tests

```tsx
// src/design-system/components/__tests__/AgentSelector.a11y.test.tsx
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { AgentSelector } from '../AgentSelector';

expect.extend(toHaveNoViolations);

describe('AgentSelector - Accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = render(
      <AgentSelector
        agents={mockAgents}
        selectedAgent={mockAgents[0]}
        onSelectAgent={jest.fn()}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

### E2E Tests (Playwright)

```typescript
// tests/e2e/agent-switching.spec.ts
import { test, expect } from '@playwright/test';

test('agent switching flow', async ({ page }) => {
  await page.goto('/agents');

  // Open agent selector
  await page.click('[aria-label="Select agent"]');

  // Select Agent 2
  await page.click('text=Agent 2');

  // Verify conversation switched
  await expect(page.locator('[data-agent-id="agent-2"]')).toBeVisible();

  // Verify accessibility
  await expect(page).toHaveNoAxeViolations();
});

test('keyboard shortcuts', async ({ page }) => {
  await page.goto('/agents');

  // Press Cmd+K to open agent selector
  await page.keyboard.press('Meta+K');
  await expect(page.locator('[role="listbox"]')).toBeVisible();

  // Press Escape to close
  await page.keyboard.press('Escape');
  await expect(page.locator('[role="listbox"]')).not.toBeVisible();

  // Press Cmd+1 to switch to Agent 1
  await page.keyboard.press('Meta+1');
  await expect(page.locator('[data-agent-id="agent-1"]')).toBeVisible();
});
```

---

## Cross-Agent Integration

### Integration Points

#### Agent 11: Component Library
**Deliverable:** Export all design system components for reuse.

```tsx
// Agent 11: src/components/design-system/index.ts
export * from '@/design-system/components/AgentSelector';
export * from '@/design-system/components/ConversationThread';
export * from '@/design-system/components/MultiAgentWorkspace';
export * from '@/design-system/components/KeyboardShortcuts';
export * from '@/design-system/tokens';
```

#### Agent 12: Theme Store
**Deliverable:** Provide color tokens for dynamic theming.

```tsx
// Agent 12: src/store/themeStore.ts
import { designTokens } from '@/design-system/tokens';
import { create } from 'zustand';

interface ThemeState {
  colors: typeof designTokens.colors;
  darkMode: boolean;
  agentColors: Record<string, string>;
  updateAgentColor: (agentId: string, color: string) => void;
  toggleDarkMode: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  colors: designTokens.colors,
  darkMode: false,
  agentColors: {
    'agent-1': designTokens.colors.agents.agent1.main,
    'agent-2': designTokens.colors.agents.agent2.main,
    // ...
  },
  updateAgentColor: (agentId, color) =>
    set((state) => ({
      agentColors: { ...state.agentColors, [agentId]: color },
    })),
  toggleDarkMode: () =>
    set((state) => ({ darkMode: !state.darkMode })),
}));
```

#### Agent 14: Code Editor
**Deliverable:** Layout grid for side-by-side editor and agent chat.

```tsx
// Agent 14: src/components/CodeEditorWithAgents.tsx
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { MultiAgentWorkspace } from '@/design-system/components/MultiAgentWorkspace';
import { CodeEditor } from './CodeEditor';

export function CodeEditorWithAgents() {
  return (
    <PanelGroup direction="horizontal">
      {/* Code Editor - Agent 14 */}
      <Panel defaultSize={60} minSize={40}>
        <CodeEditor />
      </Panel>

      <PanelResizeHandle className="w-1 bg-neutral-200 hover:bg-primary-500" />

      {/* Agent Chat - Agent 18 */}
      <Panel defaultSize={40} minSize={30}>
        <MultiAgentWorkspace
          agents={agents}
          conversations={conversations}
          onSendMessage={handleSendMessage}
          onReply={handleReply}
        />
      </Panel>
    </PanelGroup>
  );
}
```

### API Integration

#### Message Sending

```tsx
// src/api/agents/sendMessage.ts
export async function sendMessageToAgent(
  agentId: string,
  content: string
): Promise<Message> {
  const response = await fetch(`/api/agents/${agentId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    throw new Error('Failed to send message');
  }

  return response.json();
}
```

#### Real-Time Updates (WebSocket)

```tsx
// src/hooks/useAgentWebSocket.ts
import { useEffect, useState } from 'react';

export function useAgentWebSocket(agentId: string) {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    const ws = new WebSocket(`wss://api.vibecode.com/agents/${agentId}`);

    ws.onmessage = (event) => {
      const newMessage: Message = JSON.parse(event.data);
      setMessages((prev) => [...prev, newMessage]);
    };

    return () => ws.close();
  }, [agentId]);

  return messages;
}
```

---

## Troubleshooting

### Common Issues

#### Issue: "framer-motion not found"

```bash
# Solution: Install dependency
npm install framer-motion
```

#### Issue: "useMediaQuery hook not found"

```tsx
// Create the hook: src/hooks/useMediaQuery.ts
import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}
```

#### Issue: "Agent colors not updating"

```tsx
// Solution: Use CSS variables for dynamic colors
// globals.css
:root {
  --agent-1-color: hsl(262, 80%, 50%);
  --agent-2-color: hsl(200, 80%, 50%);
}

// Component
<div style={{ backgroundColor: 'var(--agent-1-color)' }}>
  Agent 1
</div>
```

---

## Support

**Questions?** Contact Agent 18 (UX Designer) or refer to:
- [UX Research Document](/src/design-system/ux-research.md)
- [Component Storybook](http://localhost:6006) (run `npm run storybook`)
- [Accessibility Report](/tests/a11y/report.html)

**Found a bug?** Open an issue on GitHub with:
- Component name
- Expected vs actual behavior
- Browser/device information
- Screenshots (if visual issue)

---

**Document Version:** 1.0.0
**Last Updated:** 2025-10-02
**Next Review:** 2025-11-02

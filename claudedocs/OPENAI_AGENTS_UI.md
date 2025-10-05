# OpenAI Agents UI Components

Comprehensive React UI component library for OpenAI Agents integration in VibeCode.

## Overview

This document provides a complete reference for the OpenAI Agents UI component suite, built with React, TypeScript, Tailwind CSS, and Zustand state management. All components are accessibility compliant (WCAG 2.1 AA) and optimized for performance.

## Component Architecture

### Technology Stack

- **Framework**: React 19.1.1 with TypeScript 5.8.3
- **Styling**: Tailwind CSS 4.0.0 with CSS variables
- **State Management**: Zustand 4.5.7
- **Icons**: Lucide React 0.525.0
- **UI Primitives**: Radix UI components
- **Accessibility**: WCAG 2.1 AA compliant

### Design Principles

1. **Accessibility First**: Keyboard navigation, screen reader support, ARIA labels
2. **Performance Optimized**: Virtual scrolling, lazy loading, efficient re-renders
3. **Responsive Design**: Mobile-first approach with breakpoint adaptation
4. **Type Safety**: Full TypeScript coverage with strict mode
5. **Composability**: Modular components with clear interfaces

## Components

### 1. AgentConfigPanel

Configuration panel for AI agents with model selection, tool configuration, and advanced settings.

#### Location
`src/components/agents/AgentConfigPanel.tsx`

#### Features
- Model selection with capability indicators (context window, vision, functions)
- Tool configuration: Code Interpreter, File Search, Function Calling
- Temperature and response length controls
- Instruction and system prompt editing
- Real-time validation with error display
- Three-tab interface: General, Tools, Advanced

#### Props
```typescript
interface AgentConfigPanelProps {
  initialConfig?: Partial<AgentConfig>
  onChange?: (config: AgentConfig) => void
  onSave?: (config: AgentConfig) => Promise<void>
  readOnly?: boolean
  className?: string
}
```

#### Usage Example
```typescript
import { AgentConfigPanel } from '@/components/agents'

function ConfigPage() {
  const handleSave = async (config: AgentConfig) => {
    await fetch('/api/agents/config', {
      method: 'POST',
      body: JSON.stringify(config)
    })
  }

  return (
    <AgentConfigPanel
      initialConfig={{ model: 'gpt-4-turbo-preview' }}
      onSave={handleSave}
    />
  )
}
```

#### Accessibility
- Keyboard navigation through tabs and inputs
- ARIA labels for all interactive elements
- Focus management with ring indicators
- Screen reader announcements for validation errors

---

### 2. AgentConversationThread

Thread viewer for agent conversations with message history and role indicators.

#### Location
`src/components/agents/AgentConversationThread.tsx`

#### Features
- Message threading with parent/child relationships
- Role-based styling (user, assistant, system)
- Timestamp and metadata display
- Virtual scrolling for performance with large histories
- Message actions: edit, delete, branch, copy
- Auto-scroll with manual scroll detection

#### Props
```typescript
interface AgentConversationThreadProps {
  threadId: string
  messages: ThreadMessage[]
  enableActions?: boolean
  onEditMessage?: (messageId: string, content: string) => void
  onDeleteMessage?: (messageId: string) => void
  onBranchMessage?: (messageId: string) => void
  className?: string
}
```

#### Usage Example
```typescript
import { AgentConversationThread } from '@/components/agents'

function ChatPage({ threadId }: { threadId: string }) {
  const messages = useThreadMessages(threadId)

  const handleEdit = async (id: string, content: string) => {
    await updateMessage(id, content)
  }

  return (
    <AgentConversationThread
      threadId={threadId}
      messages={messages}
      enableActions
      onEditMessage={handleEdit}
    />
  )
}
```

#### Performance
- Virtual scrolling for 1000+ messages
- Memoized message parsing for code blocks
- Efficient re-render with React.memo
- Lazy loading for older messages

---

### 3. ToolExecutionDisplay

Real-time visualization of agent tool executions with status tracking and I/O display.

#### Location
`src/components/agents/ToolExecutionDisplay.tsx`

#### Features
- Real-time execution status updates (pending, running, completed, failed)
- Tool input/output visualization with JSON formatting
- Execution time and token usage tracking
- Error handling with stack traces
- Collapsible execution details
- Retry support for failed executions

#### Props
```typescript
interface ToolExecutionDisplayProps {
  executions: ToolExecution[]
  onRetry?: (executionId: string) => void
  expandedByDefault?: boolean
  className?: string
}
```

#### Usage Example
```typescript
import { ToolExecutionDisplay } from '@/components/agents'

function ExecutionMonitor() {
  const { executions } = useAgentExecutions()

  return (
    <ToolExecutionDisplay
      executions={executions}
      onRetry={retryExecution}
      expandedByDefault={false}
    />
  )
}
```

---

### 4. AgentFileBrowser

File browser for agent-accessible files with tree view and upload support.

#### Location
`src/components/agents/AgentFileBrowser.tsx`

#### Features
- Tree view with file hierarchy
- File upload with drag-and-drop support
- File type indicators (code, image, document)
- Size and date information
- Access control indicators (locked/unlocked)
- Search and filter functionality
- Download and delete operations

#### Props
```typescript
interface AgentFileBrowserProps {
  files: AgentFile[]
  selectedFiles?: string[]
  onSelectFile?: (fileId: string) => void
  onUploadFile?: (file: File) => Promise<void>
  onDeleteFile?: (fileId: string) => Promise<void>
  onDownloadFile?: (fileId: string) => void
  multiSelect?: boolean
  className?: string
}
```

#### Usage Example
```typescript
import { AgentFileBrowser } from '@/components/agents'

function FilesPanel() {
  const { files, uploadFile } = useAgentFiles()

  return (
    <AgentFileBrowser
      files={files}
      onUploadFile={uploadFile}
      onDownloadFile={downloadFile}
    />
  )
}
```

---

### 5. CodeInterpreterOutput

Display code execution output with syntax highlighting and interactive result visualization.

#### Location
`src/components/agents/CodeInterpreterOutput.tsx`

#### Features
- Syntax-highlighted code display
- Execution output with stdout/stderr separation
- Error stack traces with formatting
- Image and file output visualization
- Execution metrics (time, status, language)
- Copy and download functionality
- Tabbed interface for different output types

#### Props
```typescript
interface CodeInterpreterOutputProps {
  execution: CodeExecution
  showCode?: boolean
  enableDownload?: boolean
  className?: string
}
```

#### Usage Example
```typescript
import { CodeInterpreterOutput } from '@/components/agents'

function CodeExecutionView({ executionId }: { executionId: string }) {
  const execution = useCodeExecution(executionId)

  return (
    <CodeInterpreterOutput
      execution={execution}
      showCode
      enableDownload
    />
  )
}
```

---

### 6. CreateAgentWizard

Step-by-step wizard for creating new AI agents with validation and preview.

#### Location
`src/components/agents/CreateAgentWizard.tsx`

#### Features
- Multi-step wizard flow (Template → Details → Review)
- Template selection with presets (General, Code, Research, Creative)
- Configuration validation at each step
- Preview before creation
- Progress tracking with visual indicators
- Keyboard navigation between steps

#### Props
```typescript
interface CreateAgentWizardProps {
  onCreate?: (data: WizardData) => Promise<void>
  onCancel?: () => void
  templates?: AgentTemplate[]
  className?: string
}
```

#### Usage Example
```typescript
import { CreateAgentWizard } from '@/components/agents'

function CreateAgentPage() {
  const router = useRouter()

  const handleCreate = async (data: WizardData) => {
    const agent = await createAgent(data)
    router.push(`/agents/${agent.id}`)
  }

  return (
    <CreateAgentWizard
      onCreate={handleCreate}
      onCancel={() => router.back()}
    />
  )
}
```

---

### 7. AgentMarketplace

Marketplace for discovering and installing pre-built agents.

#### Location
`src/components/agents/AgentMarketplace.tsx`

#### Features
- Agent discovery with search and filter
- Category organization (Productivity, Development, Creative, Research)
- Rating and review system
- Installation workflow with progress tracking
- Agent previews
- Featured agents section
- Sort options (Featured, Popular, Recent, Rating)

#### Props
```typescript
interface AgentMarketplaceProps {
  agents: MarketplaceAgent[]
  onInstall?: (agentId: string) => Promise<void>
  onPreview?: (agent: MarketplaceAgent) => void
  className?: string
}
```

#### Usage Example
```typescript
import { AgentMarketplace } from '@/components/agents'

function MarketplacePage() {
  const { agents } = useMarketplaceAgents()

  const handleInstall = async (agentId: string) => {
    await installAgent(agentId)
    showToast('Agent installed successfully')
  }

  return (
    <AgentMarketplace
      agents={agents}
      onInstall={handleInstall}
      onPreview={showPreviewModal}
    />
  )
}
```

---

### 8. AgentMonitoringDashboard

Real-time monitoring dashboard for agent performance and health metrics.

#### Location
`src/components/agents/AgentMonitoringDashboard.tsx`

#### Features
- Real-time metrics visualization
- Resource usage tracking (CPU, memory, tokens)
- Agent health status (healthy, warning, error, offline)
- Performance analytics (response time, request count)
- Error rate monitoring
- Cost tracking (input/output tokens, total cost)
- Auto-refresh with configurable interval
- Filterable views (All, Healthy, Issues)

#### Props
```typescript
interface AgentMonitoringDashboardProps {
  agentMetrics: AgentMetrics[]
  systemMetrics: SystemMetrics
  onRefresh?: () => Promise<void>
  refreshInterval?: number
  className?: string
}
```

#### Usage Example
```typescript
import { AgentMonitoringDashboard } from '@/components/agents'

function MonitoringPage() {
  const { agentMetrics, systemMetrics, refresh } = useAgentMetrics()

  return (
    <AgentMonitoringDashboard
      agentMetrics={agentMetrics}
      systemMetrics={systemMetrics}
      onRefresh={refresh}
      refreshInterval={30000}
    />
  )
}
```

---

## State Management Integration

### Zustand Store Integration

All components integrate seamlessly with the existing Zustand stores:

```typescript
// Example: Using agentStore with components
import { useAgentStore } from '@/stores/agentStore'
import { AgentMonitoringDashboard } from '@/components/agents'

function Dashboard() {
  const sessions = useAgentStore(state => Array.from(state.sessions.values()))

  const agentMetrics = sessions.map(session => ({
    agentId: session.agent_id,
    agentName: session.agent_type,
    status: mapStatusToHealth(session.status),
    uptime: session.uptime_seconds,
    // ... map other fields
  }))

  return <AgentMonitoringDashboard agentMetrics={agentMetrics} />
}
```

### Available Stores

1. **agentStore** (`src/stores/agentStore.ts`)
   - Session management
   - Agent status tracking
   - SSE event handling

2. **conversationStore** (`src/stores/conversationStore.ts`)
   - Conversation threads
   - Message history
   - Thread management

3. **uiStore** (`src/stores/uiStore.ts`)
   - UI state
   - Modal management
   - User preferences

---

## Accessibility Features

### WCAG 2.1 AA Compliance

All components meet or exceed WCAG 2.1 AA standards:

1. **Keyboard Navigation**
   - Tab order follows logical flow
   - Focus indicators on all interactive elements
   - Escape key closes modals and dropdowns

2. **Screen Reader Support**
   - ARIA labels on all inputs and buttons
   - ARIA live regions for dynamic content
   - Semantic HTML structure

3. **Visual Accessibility**
   - Minimum 4.5:1 contrast ratio for text
   - Focus indicators with 2px ring
   - No information conveyed by color alone

4. **Motion & Animation**
   - Respects prefers-reduced-motion
   - Optional animations can be disabled
   - No auto-playing content

### Testing Tools

- **Automated**: jest-axe for unit tests
- **Manual**: Playwright with @axe-core/playwright
- **Browser**: Chrome DevTools Lighthouse

---

## Performance Optimization

### Core Web Vitals Targets

- **LCP (Largest Contentful Paint)**: < 2.5s
- **FID (First Input Delay)**: < 100ms
- **CLS (Cumulative Layout Shift)**: < 0.1

### Optimization Techniques

1. **Code Splitting**
   ```typescript
   const AgentMarketplace = lazy(() => import('./AgentMarketplace'))
   ```

2. **Virtual Scrolling**
   - Used in AgentConversationThread for large message lists
   - Used in AgentFileBrowser for large file trees

3. **Memoization**
   ```typescript
   const filteredAgents = useMemo(() => {
     return agents.filter(/* filter logic */)
   }, [agents, filters])
   ```

4. **Debounced Search**
   ```typescript
   const debouncedSearch = useMemo(
     () => debounce((query: string) => setSearchQuery(query), 300),
     []
   )
   ```

---

## Responsive Design

### Breakpoints

Following Tailwind CSS default breakpoints:

```css
sm: 640px   /* Small devices */
md: 768px   /* Medium devices */
lg: 1024px  /* Large devices */
xl: 1280px  /* Extra large devices */
2xl: 1536px /* 2X large devices */
```

### Mobile-First Approach

All components are designed mobile-first with progressive enhancement:

```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Cards render 1 column on mobile, 2 on tablet, 3 on desktop */}
</div>
```

---

## Testing

### Unit Tests

```typescript
// Example test for AgentConfigPanel
import { render, screen, fireEvent } from '@testing-library/react'
import { AgentConfigPanel } from './AgentConfigPanel'

describe('AgentConfigPanel', () => {
  it('validates minimum name length', async () => {
    const { getByLabelText } = render(<AgentConfigPanel />)

    const nameInput = getByLabelText('Agent Name')
    fireEvent.change(nameInput, { target: { value: 'AB' } })

    expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument()
  })
})
```

### Accessibility Tests

```typescript
import { axe, toHaveNoViolations } from 'jest-axe'
expect.extend(toHaveNoViolations)

it('has no accessibility violations', async () => {
  const { container } = render(<AgentConfigPanel />)
  const results = await axe(container)
  expect(results).toHaveNoViolations()
})
```

### E2E Tests

```typescript
// Playwright test
test('creates new agent through wizard', async ({ page }) => {
  await page.goto('/agents/create')

  // Select template
  await page.click('text=Code Assistant')
  await page.click('text=Next')

  // Enter details
  await page.fill('input[name="name"]', 'My Code Agent')
  await page.fill('textarea[name="instructions"]', 'Help with coding')
  await page.click('text=Next')

  // Create agent
  await page.click('text=Create Agent')
  await expect(page).toHaveURL(/\/agents\/[a-z0-9-]+/)
})
```

---

## Integration Examples

### Complete Agent Management Page

```typescript
import {
  AgentConfigPanel,
  AgentConversationThread,
  AgentMonitoringDashboard
} from '@/components/agents'
import { useAgentStore } from '@/stores/agentStore'

export default function AgentPage({ agentId }: { agentId: string }) {
  const agent = useAgentStore(state => state.getAgent(agentId))
  const [activeTab, setActiveTab] = useState('chat')

  if (!agent) return <NotFound />

  return (
    <div className="container mx-auto p-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="monitor">Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="chat">
          <AgentConversationThread
            threadId={agent.terminal_id}
            messages={conversationMessages}
          />
        </TabsContent>

        <TabsContent value="config">
          <AgentConfigPanel
            initialConfig={agent.config}
            onSave={updateAgentConfig}
          />
        </TabsContent>

        <TabsContent value="monitor">
          <AgentMonitoringDashboard
            agentMetrics={[agentMetrics]}
            systemMetrics={systemMetrics}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

---

## Customization

### Theming

Components use CSS variables for theming (defined in `tailwind.config.js`):

```css
:root {
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --accent: 210 40% 96.1%;
  /* ... other variables */
}
```

### Custom Styling

```typescript
<AgentConfigPanel
  className="shadow-xl rounded-2xl"
  // All components accept className prop
/>
```

---

## Best Practices

### Component Usage

1. **Always provide aria-label for icon-only buttons**
   ```typescript
   <Button aria-label="Delete agent">
     <Trash2 className="h-4 w-4" aria-hidden="true" />
   </Button>
   ```

2. **Handle loading and error states**
   ```typescript
   {isLoading ? <Skeleton /> : <AgentCard agent={agent} />}
   ```

3. **Validate user input**
   ```typescript
   const errors = validateAgentConfig(config)
   if (errors.length > 0) {
     setValidationErrors(errors)
     return
   }
   ```

4. **Provide feedback for actions**
   ```typescript
   await onSave(config)
   toast.success('Configuration saved')
   ```

### Performance

1. **Memoize expensive computations**
2. **Use React.memo for pure components**
3. **Implement virtual scrolling for large lists**
4. **Lazy load heavy components**

---

## Troubleshooting

### Common Issues

1. **Components not rendering**
   - Check if required UI components (Button, Card, etc.) are installed
   - Verify Tailwind CSS is configured correctly

2. **Type errors**
   - Ensure TypeScript version is 5.8.3+
   - Check that all type exports are imported

3. **Accessibility violations**
   - Run jest-axe tests
   - Use Chrome DevTools Lighthouse
   - Test with screen reader

4. **Performance issues**
   - Profile with React DevTools Profiler
   - Check for unnecessary re-renders
   - Implement virtual scrolling for large lists

---

## API Reference

### Type Definitions

All component props and types are exported from the index file:

```typescript
import type {
  AgentConfig,
  ThreadMessage,
  ToolExecution,
  // ... other types
} from '@/components/agents'
```

### Utility Functions

```typescript
// Format file size
formatFileSize(bytes: number): string

// Format uptime
formatUptime(seconds: number): string

// Get file icon
getFileIcon(file: AgentFile): LucideIcon

// Validate agent ID
isValidAgentId(id: string): boolean
```

---

## Migration Guide

### From Existing Components

If migrating from existing agent components:

1. **Import new components**
   ```typescript
   import { AgentConfigPanel } from '@/components/agents'
   ```

2. **Update props to match new interface**
   ```typescript
   // Old
   <AgentConfig agent={agent} onUpdate={update} />

   // New
   <AgentConfigPanel initialConfig={agent.config} onSave={update} />
   ```

3. **Update state management**
   ```typescript
   // Use Zustand stores instead of local state
   const agent = useAgentStore(state => state.getAgent(id))
   ```

---

## Contributing

### Adding New Components

1. Create component file in `src/components/agents/`
2. Follow existing naming conventions
3. Include JSDoc comments
4. Add to index.ts exports
5. Update this documentation
6. Add unit and accessibility tests

### Code Style

- Use TypeScript strict mode
- Follow existing component patterns
- Use Prettier for formatting
- Prefix unused variables with underscore
- Use semantic HTML elements

---

## Future Enhancements

### Planned Features

1. **Agent Templates System**
   - More preset templates
   - Custom template creation
   - Template sharing

2. **Advanced Monitoring**
   - Real-time metrics graphs
   - Historical performance data
   - Anomaly detection

3. **Collaboration Features**
   - Multi-user agent sessions
   - Shared conversations
   - Team management

4. **Enhanced File Browser**
   - Syntax highlighting preview
   - File editing capabilities
   - Git integration

---

## Support

For questions or issues:

1. Check this documentation
2. Review component source code
3. Check existing tests for usage examples
4. Open issue in project repository

---

## Changelog

### Version 1.0.0 (2025-10-02)

- Initial release
- 8 core components
- Full TypeScript support
- WCAG 2.1 AA compliance
- Zustand integration
- Comprehensive documentation

---

## License

MIT License - See project root LICENSE file for details.

---

**Document Version**: 1.0.0
**Last Updated**: 2025-10-02
**Components Version**: 1.0.0

---
title: MCP Serena
description: Integrated development environment with AI assistance for code-server integration
---

# MCP Serena

## Overview and Purpose

MCP Serena is a comprehensive framework for integrating code-server instances with AI-assisted development capabilities. It provides a structured approach to managing cloud-based development environments, enabling collaborative coding with intelligent assistance.

The Serena MCP (Master Control Program) component enables developers to:

- Create and manage cloud-based development environments
- Leverage AI for code analysis, refactoring, and generation
- Maintain context awareness throughout development sessions
- Collaborate on code in real-time with team members
- Integrate with other VibeCode platform services
- Deploy and scale development environments in Kubernetes

By providing a seamless integration between code-server (a web-based VS Code environment) and AI services, MCP Serena creates a powerful development experience that combines the familiarity of VS Code with the intelligence of AI assistants.

## Architecture and Components

MCP Serena consists of several key components that work together to provide a comprehensive development environment:

### 1. Serena Project Manager

The Project Manager handles project configuration, initialization, and management. It uses a `project.yml` file to define project-specific settings:

```yaml
# language of the project
language: typescript

# whether to use the project's gitignore file to ignore files
ignore_all_files_in_gitignore: true

# list of additional paths to ignore
ignored_paths: []

# whether the project is in read-only mode
read_only: false

# list of tool names to exclude
excluded_tools: []

# initial prompt for the project
initial_prompt: ""

project_name: "vibecode-webgui"
```

The Project Manager provides functionality for:
- Project initialization and configuration
- File and directory management
- Project-specific settings and preferences
- Integration with version control

### 2. Serena Tool System

The Tool System provides a collection of tools for interacting with code and performing development tasks. These tools include:

- **Code Analysis Tools**: For understanding code structure and semantics
- **Editing Tools**: For modifying code with AI assistance
- **Search Tools**: For finding code patterns and symbols
- **Execution Tools**: For running code and tests
- **Collaboration Tools**: For working with team members

Each tool is designed to be used by both human developers and AI assistants, creating a consistent interface for interaction.

### 3. Serena Memory Store

The Memory Store provides persistent storage for context and knowledge across development sessions. It allows:

- Storing important project information for future reference
- Maintaining context between different sessions
- Sharing knowledge between team members
- Building a project-specific knowledge base over time

```typescript
// Example of memory store usage
import { SerenaMemoryStore } from './serena-memory';

// Store important information
await SerenaMemoryStore.write('project-structure', {
  entryPoints: ['src/index.ts'],
  mainComponents: ['App', 'Dashboard', 'CodeEditor'],
  testingFramework: 'Jest',
});

// Retrieve information in a later session
const projectStructure = await SerenaMemoryStore.read('project-structure');
console.log('Main components:', projectStructure.mainComponents);
```

### 4. Code-Server Client

The Code-Server Client manages the lifecycle of code-server instances, providing an API for creating, accessing, and managing development environments:

```typescript
import { CodeServerClient } from '../lib/code-server-client';

// Create a new code-server session
const session = await codeServerClient.createSession(workspaceId, userId);

// Get an existing session or create a new one
const session = await codeServerClient.getOrCreateSession(workspaceId, userId);

// List active sessions
const { sessions } = await codeServerClient.listSessions(workspaceId);

// Delete a session
await codeServerClient.deleteSession(sessionId);
```

### 5. Kubernetes Integration

MCP Serena integrates with Kubernetes for deploying and scaling code-server instances. This integration includes:

- **Deployment Templates**: YAML configurations for deploying code-server
- **Service Definitions**: For exposing code-server to users
- **Ingress Rules**: For handling external access
- **Resource Management**: For controlling CPU, memory, and storage

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vibecode-code-server
  namespace: vibecode-platform
spec:
  replicas: 1
  selector:
    matchLabels:
      app: vibecode-code-server
  template:
    metadata:
      labels:
        app: vibecode-code-server
    spec:
      containers:
      - name: code-server
        image: vibecode/code-server:latest
        ports:
        - containerPort: 8080
        volumeMounts:
        - name: workspace
          mountPath: /home/coder/workspace
```

## Integration with Code-Server

MCP Serena integrates with code-server to provide a complete web-based development environment. This integration includes:

### 1. Customized Code-Server Configuration

MCP Serena provides custom configuration for code-server instances, including:

- **Extensions**: Pre-installed VS Code extensions for development
- **Settings**: Optimized settings for AI-assisted development
- **Themes**: Custom themes for a consistent experience
- **Keybindings**: Configurable keybindings for different preferences

### 2. Authentication and Authorization

Serena integrates with the VibeCode authentication system to provide secure access to code-server instances:

```typescript
private async fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const session = await getSession();
  const headers = new Headers(options.headers);
  
  // Use the session token if available in the session
  const token = session?.user?.email;
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  headers.set('Content-Type', 'application/json');
  
  const response = await fetch(`${this.baseUrl}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch');
  }

  return response.json();
}
```

### 3. Workspace Management

Serena provides tools for managing workspaces, including:

- **Workspace Creation**: Creating new development workspaces
- **Workspace Configuration**: Configuring workspaces for specific projects
- **Workspace Sharing**: Sharing workspaces with team members
- **Workspace Persistence**: Ensuring workspaces persist across sessions

### 4. File Synchronization

Serena ensures files are synchronized between the local and remote environments:

- **Real-time Sync**: Changes are synchronized in real-time
- **Conflict Resolution**: Conflicts are detected and resolved
- **Version Control Integration**: Integration with Git for tracking changes
- **Backup and Recovery**: Automatic backup of workspace state

## Configuration and Setup

### Setting Up MCP Serena

To set up MCP Serena for a new project:

1. Create a `.serena` directory in your project root:

```bash
mkdir -p .serena
```

2. Create a `project.yml` file in the `.serena` directory:

```yaml
language: typescript
ignore_all_files_in_gitignore: true
ignored_paths: []
read_only: false
excluded_tools: []
initial_prompt: "This is a TypeScript project using Next.js and React."
project_name: "my-project"
```

3. Configure code-server integration in your environment:

```typescript
// src/config/serena.ts
export const serenaConfig = {
  codeServer: {
    baseUrl: process.env.CODE_SERVER_URL || 'https://code.example.com',
    defaultTimeout: 30000,
    resources: {
      cpu: '1',
      memory: '2Gi',
      storage: '10Gi',
    },
  },
  ai: {
    model: 'claude-3-opus-20240229',
    contextWindow: 200000,
    temperature: 0.7,
  },
};
```

4. Set up Kubernetes deployment files:

```yaml
# k8s/serena-code-server.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: serena-code-server
spec:
  replicas: 1
  selector:
    matchLabels:
      app: serena-code-server
  template:
    metadata:
      labels:
        app: serena-code-server
    spec:
      containers:
      - name: code-server
        image: serena/code-server:latest
        env:
        - name: SERENA_PROJECT
          value: "my-project"
        - name: SERENA_AI_ENDPOINT
          valueFrom:
            secretKeyRef:
              name: serena-secrets
              key: ai-endpoint
```

### Environment Variables

MCP Serena uses several environment variables for configuration:

| Variable | Description | Default |
|----------|-------------|---------|
| `SERENA_PROJECT` | The current project name | - |
| `SERENA_AI_ENDPOINT` | Endpoint for AI services | `https://ai.vibecode.example.com` |
| `SERENA_CODE_SERVER_URL` | Base URL for code-server | `https://code.vibecode.example.com` |
| `SERENA_MEMORY_STORE` | Storage backend for memory | `redis` |
| `SERENA_LOG_LEVEL` | Logging level | `info` |

## Usage Examples and Workflows

### Example 1: Setting Up a New Project

```typescript
import { SerenaProjectManager } from '../lib/serena';

// Initialize a new project
const project = await SerenaProjectManager.initialize({
  name: 'my-typescript-project',
  language: 'typescript',
  description: 'A TypeScript project with React and Next.js',
});

// Create a code-server session for the project
const session = await codeServerClient.createSession(project.id, currentUser.id);

// Open the project in the browser
window.open(session.url, '_blank');
```

### Example 2: AI-Assisted Code Analysis

```typescript
import { SerenaCodeAnalyzer } from '../lib/serena';

// Analyze a file with AI assistance
const analysis = await SerenaCodeAnalyzer.analyzeFile({
  filePath: 'src/components/Dashboard.tsx',
  options: {
    checkComplexity: true,
    suggestImprovements: true,
    identifyPatterns: true,
  },
});

console.log('Code complexity:', analysis.complexity);
console.log('Suggested improvements:', analysis.improvements);
console.log('Identified patterns:', analysis.patterns);
```

### Example 3: Collaborative Development

```typescript
import { SerenaCollaboration } from '../lib/serena';

// Create a collaborative session
const collaborationSession = await SerenaCollaboration.createSession({
  projectId: 'my-project',
  participants: ['user1@example.com', 'user2@example.com'],
  permissions: {
    'user1@example.com': 'admin',
    'user2@example.com': 'editor',
  },
});

// Share the session with participants
await SerenaCollaboration.sendInvitations(collaborationSession.id);

// Monitor activity in the session
SerenaCollaboration.onActivityUpdate(collaborationSession.id, (activity) => {
  console.log(`${activity.user} ${activity.action} at ${activity.timestamp}`);
});
```

### Example 4: AI-Assisted Refactoring

```typescript
import { SerenaRefactoring } from '../lib/serena';

// Refactor a component with AI assistance
const refactoringResult = await SerenaRefactoring.refactorComponent({
  filePath: 'src/components/UserProfile.tsx',
  options: {
    extractComponents: true,
    improvePerformance: true,
    updateStandardsCompliance: true,
  },
});

console.log('Refactoring changes:', refactoringResult.changes);
console.log('Performance improvements:', refactoringResult.performanceImprovements);
```

### Example 5: Code Generation

```typescript
import { SerenaCodeGenerator } from '../lib/serena';

// Generate a new component with AI assistance
const generatedCode = await SerenaCodeGenerator.generateComponent({
  name: 'DataVisualization',
  description: 'A component that visualizes time-series data with interactive charts',
  props: [
    { name: 'data', type: 'TimeSeriesData[]', required: true },
    { name: 'title', type: 'string', required: false },
    { name: 'showLegend', type: 'boolean', required: false, default: true },
  ],
  styleFramework: 'styled-components',
});

// Write the generated code to a file
await SerenaCodeGenerator.writeToFile(
  'src/components/DataVisualization.tsx',
  generatedCode
);
```

## Integration with Context7 and Sequential Thinking

### Integration with Context7

MCP Serena integrates with Context7 to maintain rich contextual information during development sessions:

```typescript
import { Context7Manager } from '../lib/context7';
import { SerenaSession } from '../lib/serena';

// Create a Serena session with Context7 integration
const session = new SerenaSession({
  projectId: 'my-project',
  contextManager: new Context7Manager({
    temporal: {
      sessionStartTime: Date.now(),
      actionHistory: [],
    },
    spatial: {
      currentLocation: 'src/components/Dashboard.tsx',
      navigationPath: ['src', 'components', 'Dashboard.tsx'],
    },
    state: {
      applicationState: {
        currentBranch: 'feature/dashboard-redesign',
        uncommittedChanges: true,
      },
    },
    user: {
      userId: 'developer@example.com',
      profile: {
        expertise: 'intermediate',
        theme: 'dark',
      },
    },
  }),
});

// Use context in Serena operations
await session.executeOperation('analyzeCode', {
  filePath: 'src/components/Dashboard.tsx',
  // Context7 automatically provides:
  // - User expertise level
  // - Recent file navigation history
  // - Current application state
  // - Previous interactions
});
```

### Integration with Sequential Thinking

MCP Serena integrates with Sequential Thinking to structure complex development tasks:

```typescript
import { SequentialThinkingProcess } from '../lib/sequential-thinking';
import { SerenaTask } from '../lib/serena';

// Create a Serena task with Sequential Thinking
const task = new SerenaTask({
  name: 'Implement user authentication',
  description: 'Add user authentication to the application',
  thinkingProcess: new SequentialThinkingProcess(),
});

// Define the sequential steps
task.thinkingProcess.addThought(
  'Analyze the current codebase to understand the existing structure and dependencies',
  1,
  7
);

task.thinkingProcess.addThought(
  'Design the authentication system with considerations for security and user experience',
  2,
  7
);

task.thinkingProcess.addThought(
  'Implement the authentication API endpoints for login, registration, and logout',
  3,
  7
);

task.thinkingProcess.addThought(
  'Create the frontend components for the authentication forms',
  4,
  7
);

task.thinkingProcess.addThought(
  'Implement state management for authentication status',
  5,
  7
);

task.thinkingProcess.addThought(
  'Add protected routes and access control',
  6,
  7
);

task.thinkingProcess.addThought(
  'Test the authentication system and fix any issues',
  7,
  7
);

// Execute the task
await task.execute();
```

### Combined Integration Example

The true power of MCP Serena comes when combining Context7 and Sequential Thinking:

```typescript
import { Context7Manager } from '../lib/context7';
import { SequentialThinkingProcess } from '../lib/sequential-thinking';
import { SerenaProject } from '../lib/serena';

// Create a Serena project with integrated context and thinking
const project = new SerenaProject({
  name: 'e-commerce-platform',
  contextManager: new Context7Manager(),
  thinkingProcess: new SequentialThinkingProcess(),
});

// Start a complex development task
await project.startTask({
  name: 'Implement shopping cart feature',
  description: 'Add a fully featured shopping cart with persistence, item management, and checkout integration',
  async execute() {
    // Step 1: Analyze existing codebase
    this.thinkingProcess.addThought(
      'Analyze the existing codebase to understand structure and integration points',
      1,
      5
    );
    
    const codebaseAnalysis = await project.analyzeCodebase({
      focusAreas: ['product catalog', 'user session', 'state management'],
    });
    
    this.contextManager.updateStateContext({
      applicationState: {
        ...this.contextManager.getStateContext().applicationState,
        codebaseAnalysis,
      },
    });
    
    // Step 2: Design the shopping cart model
    this.thinkingProcess.addThought(
      'Design the shopping cart data model and persistence strategy',
      2,
      5
    );
    
    const cartModel = await project.generateModel({
      name: 'ShoppingCart',
      properties: [
        { name: 'id', type: 'string', required: true },
        { name: 'userId', type: 'string', required: true },
        { name: 'items', type: 'CartItem[]', required: true },
        { name: 'createdAt', type: 'Date', required: true },
        { name: 'updatedAt', type: 'Date', required: true },
      ],
      relations: [
        { name: 'user', type: 'User', relation: 'belongsTo' },
        { name: 'items', type: 'CartItem', relation: 'hasMany' },
      ],
    });
    
    this.contextManager.updateSemanticContext({
      entities: new Map([
        ...Array.from(this.contextManager.getSemanticContext().entities.entries()),
        ['ShoppingCart', { type: 'model', attributes: { properties: cartModel.properties } }],
      ]),
    });
    
    // Step 3: Implement backend services
    this.thinkingProcess.addThought(
      'Implement backend services for cart management',
      3,
      5
    );
    
    await project.generateService({
      name: 'ShoppingCartService',
      methods: [
        { name: 'getCart', params: [{ name: 'userId', type: 'string' }], returnType: 'ShoppingCart' },
        { name: 'addItem', params: [{ name: 'userId', type: 'string' }, { name: 'productId', type: 'string' }, { name: 'quantity', type: 'number' }], returnType: 'ShoppingCart' },
        { name: 'removeItem', params: [{ name: 'userId', type: 'string' }, { name: 'itemId', type: 'string' }], returnType: 'ShoppingCart' },
        { name: 'updateQuantity', params: [{ name: 'userId', type: 'string' }, { name: 'itemId', type: 'string' }, { name: 'quantity', type: 'number' }], returnType: 'ShoppingCart' },
        { name: 'clearCart', params: [{ name: 'userId', type: 'string' }], returnType: 'void' },
      ],
    });
    
    this.contextManager.recordUserAction('implemented_cart_service');
    
    // Step 4: Implement frontend components
    this.thinkingProcess.addThought(
      'Implement frontend components for cart interaction',
      4,
      5
    );
    
    await project.generateComponent({
      name: 'ShoppingCart',
      props: [
        { name: 'isOpen', type: 'boolean', required: true },
        { name: 'onClose', type: 'function', required: true },
      ],
      state: [
        { name: 'items', type: 'CartItem[]', initialValue: '[]' },
        { name: 'isLoading', type: 'boolean', initialValue: 'false' },
        { name: 'error', type: 'string | null', initialValue: 'null' },
      ],
      hooks: [
        { name: 'useShoppingCart', params: [] },
        { name: 'useUser', params: [] },
      ],
    });
    
    this.contextManager.recordUserAction('implemented_cart_component');
    
    // Step 5: Integrate with checkout
    this.thinkingProcess.addThought(
      'Integrate shopping cart with checkout flow',
      5,
      5
    );
    
    await project.modifyComponent({
      name: 'CheckoutFlow',
      changes: [
        { type: 'import', import: 'useShoppingCart', from: '../hooks/useShoppingCart' },
        { type: 'addHook', hook: 'const { items, total } = useShoppingCart();' },
        { type: 'addSection', section: 'cart-summary', content: `
          <div className="cart-summary">
            <h3>Order Summary</h3>
            {items.map(item => (
              <div key={item.id} className="cart-item-summary">
                <span>{item.product.name}</span>
                <span>{item.quantity} x ${item.product.price}</span>
                <span>${item.quantity * item.product.price}</span>
              </div>
            ))}
            <div className="cart-total">
              <strong>Total:</strong> ${total}
            </div>
          </div>
        `},
      ],
    });
    
    this.contextManager.recordUserAction('integrated_cart_with_checkout');
    
    // Update context with completion
    this.contextManager.updateTaskContext({
      completedTasks: [...this.contextManager.getTaskContext().completedTasks, 'implement-shopping-cart'],
    });
  },
});
```

## Deployment and Scaling

### Kubernetes Deployment

MCP Serena can be deployed to Kubernetes for scalability and high availability:

```yaml
# k8s/serena-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: serena-platform
  namespace: vibecode-platform
spec:
  replicas: 3
  selector:
    matchLabels:
      app: serena-platform
  template:
    metadata:
      labels:
        app: serena-platform
    spec:
      containers:
      - name: serena-api
        image: vibecode/serena-api:latest
        ports:
        - containerPort: 3000
        env:
        - name: SERENA_AI_ENDPOINT
          valueFrom:
            secretKeyRef:
              name: serena-secrets
              key: ai-endpoint
        - name: SERENA_MEMORY_STORE
          value: "redis"
        - name: REDIS_HOST
          value: "redis-master.vibecode-platform.svc.cluster.local"
        resources:
          requests:
            cpu: "500m"
            memory: "1Gi"
          limits:
            cpu: "2"
            memory: "4Gi"
```

### Dynamic Scaling

MCP Serena supports dynamic scaling of code-server instances based on demand:

```yaml
# k8s/serena-hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: serena-code-server-hpa
  namespace: vibecode-platform
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: serena-code-server
  minReplicas: 1
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### Cloud Provider Integration

MCP Serena integrates with major cloud providers for seamless deployment:

- **AWS**: Integration with EKS, ECR, and other AWS services
- **Azure**: Integration with AKS, Container Registry, and other Azure services
- **Google Cloud**: Integration with GKE, Container Registry, and other GCP services

```typescript
// Example of AWS integration
import { SerenaCloud } from '../lib/serena';
import { AWS } from '../lib/cloud-providers';

// Deploy Serena to AWS
await SerenaCloud.deploy({
  provider: AWS,
  region: 'us-west-2',
  cluster: 'vibecode-cluster',
  options: {
    autoScaling: true,
    loadBalancer: true,
    monitoring: true,
  },
});
```

## Advanced Features and Customization

### Custom Tools Integration

MCP Serena supports integration with custom tools:

```typescript
import { SerenaToolRegistry } from '../lib/serena';

// Register a custom tool
SerenaToolRegistry.register({
  name: 'code-quality-analyzer',
  description: 'Analyzes code quality using custom metrics',
  execute: async (filePath, options) => {
    // Implementation of the tool
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const analysis = analyzeCodeQuality(fileContent, options);
    return analysis;
  },
});

// Use the custom tool
const quality = await SerenaToolRegistry.execute('code-quality-analyzer', {
  filePath: 'src/components/Dashboard.tsx',
  metrics: ['complexity', 'maintainability', 'duplication'],
});
```

### Language Server Integration

MCP Serena integrates with language servers for enhanced code intelligence:

```typescript
import { SerenaLanguageServer } from '../lib/serena';

// Configure a language server
await SerenaLanguageServer.configure({
  language: 'typescript',
  serverPath: '/usr/local/bin/typescript-language-server',
  args: ['--stdio'],
  features: {
    completion: true,
    definition: true,
    references: true,
    diagnostics: true,
  },
});

// Use the language server for code intelligence
const references = await SerenaLanguageServer.findReferences({
  filePath: 'src/components/Dashboard.tsx',
  position: { line: 42, character: 15 },
});
```

### Custom Templates

MCP Serena supports custom templates for code generation:

```typescript
import { SerenaTemplateManager } from '../lib/serena';

// Register a custom template
await SerenaTemplateManager.register({
  name: 'react-component',
  description: 'Template for React components',
  template: `
import React, { {{#if hasState}}useState{{/if}} } from 'react';
{{#if hasProps}}
interface {{name}}Props {
  {{#each props}}
  {{name}}{{#unless required}}?{{/unless}}: {{type}};
  {{/each}}
}
{{/if}}

export const {{name}} = ({{#if hasProps}}props: {{name}}Props{{else}}{}{{/if}}) => {
  {{#if hasState}}
  {{#each state}}
  const [{{name}}, set{{capitalName}}] = useState<{{type}}>({{initialValue}});
  {{/each}}
  {{/if}}
  
  return (
    <div>
      {{defaultContent}}
    </div>
  );
};
`,
});

// Use the template
const component = await SerenaTemplateManager.generate('react-component', {
  name: 'UserProfile',
  hasProps: true,
  props: [
    { name: 'user', type: 'User', required: true },
    { name: 'showDetails', type: 'boolean', required: false },
  ],
  hasState: true,
  state: [
    { name: 'isExpanded', type: 'boolean', initialValue: 'false', capitalName: 'IsExpanded' },
  ],
  defaultContent: '<h2>{props.user.name}</h2>',
});
```

### AI Model Customization

MCP Serena allows customization of AI models for different tasks:

```typescript
import { SerenaAI } from '../lib/serena';

// Configure AI models
await SerenaAI.configureModels({
  default: 'claude-3-opus-20240229',
  codeGeneration: 'claude-3-opus-20240229',
  codeAnalysis: 'claude-3-sonnet-20240229',
  documentation: 'claude-3-haiku-20240307',
  chat: 'claude-3-sonnet-20240229',
});

// Use a specific model for a task
const analysis = await SerenaAI.analyzeCode({
  code: 'const foo = () => { console.log("Hello"); }',
  model: 'codeAnalysis', // Uses the configured model for code analysis
  options: {
    detailed: true,
    suggestImprovements: true,
  },
});
```

## Conclusion

MCP Serena provides a comprehensive framework for integrating code-server with AI-assisted development capabilities. By combining the power of cloud-based development environments with advanced AI services, it creates a seamless and productive development experience.

The integration with other MCP components like Context7 and Sequential Thinking enhances its capabilities, allowing for context-aware, structured development workflows. With its flexible deployment options and customization features, MCP Serena can be adapted to fit a wide range of development needs and environments.

By leveraging MCP Serena, developers can focus on creating high-quality code while the AI handles routine tasks, provides intelligent suggestions, and maintains context throughout the development process.
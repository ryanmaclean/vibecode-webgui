import { MultimodalAgent, MultimodalInput, AgentContext, AgentMessage } from '../lib/multimodal-agent'

export interface SampleScenario {
  id: string
  title: string
  description: string
  category: 'voice' | 'vision' | 'collaboration' | 'automation' | 'analysis'
  complexity: 'beginner' | 'intermediate' | 'advanced'
  inputs: MultimodalInput
  expectedOutputs: string[]
  estimatedTime: number // seconds
}

export interface SampleResult {
  sample: SampleScenario
  result: AgentMessage
  performance: {
    duration: number
    estimatedTime: number
    efficiency: number
  }
}

export class MultimodalSampleGenerator {
  private agent: MultimodalAgent
  private samples: SampleScenario[]

  constructor(agent: MultimodalAgent) {
    this.agent = agent
    this.samples = this.buildSamples()
  }

  getAllSamples(): SampleScenario[] {
    return this.samples
  }

  async runSample(sampleId: string): Promise<SampleResult> {
    const sample = this.samples.find((s) => s.id === sampleId)
    if (!sample) {
      throw new Error(`Sample ${sampleId} not found`)
    }

    console.log(`🚀 Running sample: ${sample.title}`)
    console.log(`⏱️ Estimated time: ${sample.estimatedTime}s`)

    const startTime = Date.now()
    try {
      const result = await this.agent.processMultimodalInput(sample.inputs)
      const duration = Date.now() - startTime

      console.log(`✅ Sample completed in ${duration}ms`)
      console.log(`📊 Confidence: ${result.metadata.confidence}`)
      console.log(`💰 Cost: $${result.metadata.cost.toFixed(4)}`)

      return {
        sample,
        result,
        performance: {
          duration,
          estimatedTime: sample.estimatedTime * 1000,
          efficiency: (sample.estimatedTime * 1000) / Math.max(duration, 1),
        },
      }
    } catch (error) {
      console.log(`❌ Sample failed: ${(error as Error).message}`)
      throw error
    }
  }

  private createSampleContext(
    _contextType: string
  ): AgentContext {
    return {
      workspaceId: `workspace_${Date.now()}`,
      userId: 'sample_user',
      sessionId: `session_${Date.now()}`,
      previousMessages: [],
      userPreferences: {
        codeStyle: 'typescript',
        framework: 'react',
        uiLibrary: 'shadcn',
        voiceSettings: {
          enabled: true,
          autoplay: false,
          speed: 1.0,
          voice: 'en-US-Standard-A',
        },
        assistantPersonality: 'encouraging',
      },
      projectMetadata: {
        name: 'Sample Project',
        description: 'A sample project for demonstrating multimodal AI capabilities',
        type: 'web-app',
        technologies: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS'],
        complexity: 'intermediate',
        estimatedTime: 60,
        targetAudience: 'developers',
        features: ['responsive design', 'accessibility', 'dark mode'],
      },
    }
  }

  private getSampleClassComponent(): string {
    return `import React, { Component } from 'react';

interface User {
  id: number;
  name: string;
  email: string;
}

interface State {
  users: User[];
  loading: boolean;
  error: string | null;
}

class UserDashboard extends Component<{}, State> {
  state: State = {
    users: [],
    loading: true,
    error: null,
  };

  componentDidMount() {
    this.fetchUsers();
  }

  async fetchUsers() {
    try {
      const response = await fetch('/api/users');
      const users = await response.json();
      this.setState({ users, loading: false });
    } catch (error) {
      this.setState({ error: 'Failed to fetch users', loading: false });
    }
  }

  render() {
    const { users, loading, error } = this.state;

    if (loading) return <div>Loading...</div>;
    if (error) return <div>{error}</div>;

    return (
      <div>
        <h1>User Dashboard</h1>
        <ul>
          {users.map(user => (
            <li key={user.id}>{user.name} - {user.email}</li>
          ))}
        </ul>
      </div>
    );
  }
}

export default UserDashboard;`
  }

  private getSampleAuthCode(): string {
    return `import jwt from 'jsonwebtoken';

const users = [];

async function login(email, password) {
  const user = users.find(u => u.email === email);
  if (!user) throw new Error('User not found');

  // Security issue: plain text password comparison
  if (user.password === password) {
    const token = jwt.sign({ userId: user.id }, 'secret', { expiresIn: '1h' });
    return { token, user: { id: user.id, email: email } };
  }

  throw new Error('Invalid password');
}

export { login };`
  }

  private getSampleButtonComponent(): string {
    return `import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };`
  }

  private getSampleTodoComponent(): string {
    return `import React, { useState, useEffect } from 'react';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

export function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('todos');
    if (saved) setTodos(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos));
  }, [todos]);

  const addTodo = () => {
    if (!input.trim()) return;
    setTodos([...todos, { id: Date.now(), text: input, completed: false }]);
    setInput('');
  };

  const toggleTodo = (id: number) => {
    setTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTodo = (id: number) => {
    setTodos(todos.filter(t => t.id !== id));
  };

  return (
    <div>
      <input value={input} onChange={e => setInput(e.target.value)} />
      <button onClick={addTodo}>Add</button>
      <ul>
        {todos.map(todo => (
          <li key={todo.id}>
            <span
              style={{ textDecoration: todo.completed ? 'line-through' : 'none' }}
              onClick={() => toggleTodo(todo.id)}
            >
              {todo.text}
            </span>
            <button onClick={() => deleteTodo(todo.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}`
  }

  private getSampleDashboardComponent(): string {
    return `import React, { useState, useEffect } from 'react';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

function expensiveCalculation() {
  let sum = 0;
  for (let i = 0; i < 1000000; i++) {
    sum += Math.sqrt(i);
  }
  return sum;
}

export function Dashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState('');
  const [count, setCount] = useState(0);

  // Missing dependency array items
  useEffect(() => {
    fetch('/api/users')
      .then(r => r.json())
      .then(data => setUsers(data));
  }, []);

  // Expensive uncached calculation on every render
  const total = expensiveCalculation();

  return (
    <div>
      <input value={filter} onChange={e => setFilter(e.target.value)} />
      <p>Total: {total}</p>
      <ul>
        {users.map(user => (
          <li key={user.id}>{user.name} - {user.email}</li>
        ))}
      </ul>
    </div>
  );
}`
  }

  private getSampleContactFormComponent(): string {
    return `import React, { useState } from 'react';

export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Submit logic
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <input
          placeholder="Your name"
          value={name}
          onChange={e => setName(e.target.value)}
        />
      </div>
      <div>
        <input
          placeholder="Your email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
      </div>
      <div>
        <textarea
          placeholder="Your message"
          value={message}
          onChange={e => setMessage(e.target.value)}
        />
      </div>
      <button type="submit">Send</button>
      <a href="#">Click here</a>
      <a href="#">Learn more</a>
    </form>
  );
}`
  }

  private getSamplePackageJsonWithVulnerabilities(): string {
    return JSON.stringify(
      {
        name: 'vulnerable-app',
        version: '1.0.0',
        dependencies: {
          express: '4.15.0',
          lodash: '4.17.4',
          jsonwebtoken: '7.4.3',
          mongoose: '5.0.0',
          'node-fetch': '2.0.0',
        },
        devDependencies: {
          jest: '26.0.0',
          typescript: '4.0.0',
        },
      },
      null,
      2
    )
  }

  private buildSamples(): SampleScenario[] {
    return [
      // Voice samples
      {
        id: 'voice-react-component',
        title: 'Voice-Driven React Component Creation',
        description: 'Create a React component from voice instructions',
        category: 'voice',
        complexity: 'beginner',
        inputs: {
          text: 'Create a user profile card component with avatar, name, and bio',
          voice: { enabled: true, language: 'en-US' },
          context: this.createSampleContext('voice-interaction'),
        },
        expectedOutputs: ['React component', 'TypeScript interface', 'CSS styles'],
        estimatedTime: 30,
      },
      {
        id: 'voice-api-endpoint',
        title: 'Voice-Driven API Endpoint',
        description: 'Create a REST API endpoint from voice instructions',
        category: 'voice',
        complexity: 'intermediate',
        inputs: {
          text: 'Create a REST API endpoint for user authentication with JWT tokens',
          voice: { enabled: true, language: 'en-US' },
          context: this.createSampleContext('voice-interaction'),
        },
        expectedOutputs: ['API route handler', 'Authentication middleware', 'Token utilities'],
        estimatedTime: 45,
      },
      {
        id: 'voice-database-schema',
        title: 'Voice-Driven Database Schema',
        description: 'Design a database schema from voice instructions',
        category: 'voice',
        complexity: 'intermediate',
        inputs: {
          text: 'Design a database schema for an e-commerce application',
          voice: { enabled: true, language: 'en-US' },
          context: this.createSampleContext('voice-interaction'),
        },
        expectedOutputs: ['SQL schema', 'Migration file', 'Type definitions'],
        estimatedTime: 40,
      },

      // Vision samples
      {
        id: 'design-to-react',
        title: 'Design Mockup to React Component',
        description: 'Convert a design mockup image into a React component',
        category: 'vision',
        complexity: 'intermediate',
        inputs: {
          text: 'Convert this design mockup into a responsive React component with Tailwind CSS',
          images: ['data:image/png;base64,mockdesign'],
          context: this.createSampleContext('design-analysis'),
        },
        expectedOutputs: ['React component with responsive styling', 'Tailwind CSS classes'],
        estimatedTime: 60,
      },
      {
        id: 'ui-screenshot-analysis',
        title: 'UI Screenshot Analysis',
        description: 'Analyze a UI screenshot and suggest improvements',
        category: 'vision',
        complexity: 'advanced',
        inputs: {
          text: 'Analyze this UI screenshot and suggest accessibility and design improvements',
          images: ['data:image/png;base64,mockscreenshot'],
          context: this.createSampleContext('design-analysis'),
        },
        expectedOutputs: ['React component improvements', 'CSS styling suggestions'],
        estimatedTime: 45,
      },

      // Collaboration samples
      {
        id: 'pair-programming-session',
        title: 'AI Pair Programming Session',
        description: 'Collaborate on refactoring a class component to hooks',
        category: 'collaboration',
        complexity: 'intermediate',
        inputs: {
          text: 'Refactor this class component to use React hooks',
          files: [
            {
              path: 'src/components/UserDashboard.tsx',
              content: this.getSampleClassComponent(),
              type: 'code' as const,
              language: 'typescript',
              size: 800,
              lastModified: new Date(),
            },
          ],
          context: this.createSampleContext('codebase-analysis'),
        },
        expectedOutputs: ['Refactored hooks component', 'Migration guide'],
        estimatedTime: 50,
      },
      {
        id: 'code-review-session',
        title: 'Automated Code Review',
        description: 'Review code for security issues and best practices',
        category: 'collaboration',
        complexity: 'advanced',
        inputs: {
          text: 'Review this authentication code for security vulnerabilities',
          files: [
            {
              path: 'src/auth/login.ts',
              content: this.getSampleAuthCode(),
              type: 'code' as const,
              language: 'typescript',
              size: 500,
              lastModified: new Date(),
            },
          ],
          context: this.createSampleContext('codebase-analysis'),
        },
        expectedOutputs: ['Security audit report', 'Remediation suggestions'],
        estimatedTime: 40,
      },

      // Automation samples
      {
        id: 'ci-cd-pipeline',
        title: 'CI/CD Pipeline Generator',
        description: 'Generate a complete CI/CD pipeline configuration',
        category: 'automation',
        complexity: 'advanced',
        inputs: {
          text: 'Generate a GitHub Actions CI/CD pipeline for a Next.js app with Docker deployment',
          files: [
            {
              path: 'package.json',
              content: this.getSamplePackageJsonWithVulnerabilities(),
              type: 'config' as const,
              language: 'json',
              size: 300,
              lastModified: new Date(),
            },
          ],
          context: this.createSampleContext('codebase-analysis'),
        },
        expectedOutputs: ['GitHub Actions workflow', 'Dockerfile', 'Deployment scripts'],
        estimatedTime: 90,
      },
      {
        id: 'test-generation',
        title: 'Automated Test Generation',
        description: 'Generate comprehensive tests for a component',
        category: 'automation',
        complexity: 'intermediate',
        inputs: {
          text: 'Generate comprehensive tests for this Todo component',
          files: [
            {
              path: 'src/components/TodoApp.tsx',
              content: this.getSampleTodoComponent(),
              type: 'code' as const,
              language: 'typescript',
              size: 600,
              lastModified: new Date(),
            },
          ],
          context: this.createSampleContext('codebase-analysis'),
        },
        expectedOutputs: ['Jest test suite', 'Coverage configuration'],
        estimatedTime: 70,
      },

      // Analysis samples
      {
        id: 'performance-audit',
        title: 'Performance Audit Report',
        description: 'Analyze component for performance issues',
        category: 'analysis',
        complexity: 'advanced',
        inputs: {
          text: 'Perform a performance audit on this dashboard component',
          files: [
            {
              path: 'src/components/Dashboard.tsx',
              content: this.getSampleDashboardComponent(),
              type: 'code' as const,
              language: 'typescript',
              size: 700,
              lastModified: new Date(),
            },
          ],
          context: this.createSampleContext('codebase-analysis'),
        },
        expectedOutputs: ['Performance audit report', 'Optimization suggestions'],
        estimatedTime: 55,
      },
      {
        id: 'accessibility-audit',
        title: 'Accessibility Audit Report',
        description: 'Analyze form for accessibility issues',
        category: 'analysis',
        complexity: 'intermediate',
        inputs: {
          text: 'Perform an accessibility analysis on this contact form',
          files: [
            {
              path: 'src/components/ContactForm.tsx',
              content: this.getSampleContactFormComponent(),
              type: 'code' as const,
              language: 'typescript',
              size: 500,
              lastModified: new Date(),
            },
          ],
          context: this.createSampleContext('codebase-analysis'),
        },
        expectedOutputs: ['Accessibility analysis report', 'WCAG compliance suggestions'],
        estimatedTime: 45,
      },
      {
        id: 'dependency-audit',
        title: 'Dependency Security Audit',
        description: 'Audit project dependencies for vulnerabilities',
        category: 'analysis',
        complexity: 'beginner',
        inputs: {
          text: 'Audit this package.json for security vulnerabilities and outdated dependencies',
          files: [
            {
              path: 'package.json',
              content: this.getSamplePackageJsonWithVulnerabilities(),
              type: 'config' as const,
              language: 'json',
              size: 300,
              lastModified: new Date(),
            },
          ],
          context: this.createSampleContext('codebase-analysis'),
        },
        expectedOutputs: ['Security audit report', 'Upgrade recommendations'],
        estimatedTime: 30,
      },
    ]
  }
}

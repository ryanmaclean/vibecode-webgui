/**
 * VibeCode Multimodal Agent Samples
 * 
 * Comprehensive collection of sample interactions demonstrating:
 * - Voice-to-Code workflows
 * - Image-to-UI generation  
 * - Multi-file project analysis
 * - Real-time collaborative coding
 * - Agentic task automation
 */

import { MultimodalAgent, MultimodalInput, AgentContext, UserPreferences, ProjectMetadata } from '../lib/multimodal-agent';

export interface SampleScenario {
  id: string;
  title: string;
  description: string;
  category: 'voice' | 'vision' | 'collaboration' | 'automation' | 'analysis';
  complexity: 'beginner' | 'intermediate' | 'advanced';
  inputs: MultimodalInput;
  expectedOutputs: string[];
  estimatedTime: number; // seconds
  demoScript?: string;
}

export class MultimodalSampleGenerator {
  private agent: MultimodalAgent;

  constructor(agent: MultimodalAgent) {
    this.agent = agent;
  }

  /**
   * Get all available sample scenarios
   */
  getAllSamples(): SampleScenario[] {
    return [
      ...this.getVoiceSamples(),
      ...this.getVisionSamples(),
      ...this.getCollaborationSamples(),
      ...this.getAutomationSamples(),
      ...this.getAnalysisSamples()
    ];
  }

  /**
   * Voice-to-Code Samples
   */
  private getVoiceSamples(): SampleScenario[] {
    return [
      {
        id: 'voice-react-component',
        title: 'Voice-Driven React Component Creation',
        description: 'Create a complete React component by describing it verbally',
        category: 'voice',
        complexity: 'beginner',
        estimatedTime: 30,
        inputs: {
          text: "I want to create a user profile card component that shows a profile picture, name, email, and a follow button. Make it responsive and use Tailwind CSS.",
          voice: {
            enabled: true,
            language: 'en-US'
          },
          context: this.createSampleContext('react-component-creation')
        },
        expectedOutputs: [
          'React TypeScript component',
          'Tailwind CSS styling',
          'Props interface definition',
          'Usage examples',
          'Responsive design implementation'
        ],
        demoScript: `
🎤 "Hey VibeCode, I need a user profile card component. It should have a circular profile picture at the top, then the user's name in large text, their email below that, and a blue follow button at the bottom. Make it responsive and use Tailwind CSS styling. The card should have a subtle shadow and rounded corners."

Expected AI Response:
✅ React component with TypeScript
✅ Tailwind CSS classes for styling  
✅ Responsive breakpoints
✅ Accessibility attributes
✅ Hover/focus states
✅ Voice feedback explaining the code
        `
      },
      {
        id: 'voice-api-endpoint',
        title: 'Voice-Driven API Development',
        description: 'Create RESTful API endpoints through voice commands',
        category: 'voice',
        complexity: 'intermediate',
        estimatedTime: 45,
        inputs: {
          text: "Create a REST API for a todo application. I need endpoints to create, read, update, and delete todos. Use Express.js with TypeScript and include input validation.",
          voice: {
            enabled: true,
            language: 'en-US'
          },
          context: this.createSampleContext('api-development')
        },
        expectedOutputs: [
          'Express.js server setup',
          'CRUD endpoint definitions',
          'TypeScript interfaces',
          'Input validation middleware',
          'Error handling',
          'API documentation'
        ],
        demoScript: `
🎤 "Create a todo API with Express and TypeScript. I need GET /todos to list all todos, POST /todos to create a new todo with title and description, PUT /todos/:id to update a todo, and DELETE /todos/:id to remove a todo. Add validation to ensure title is required and not empty."
        `
      },
      {
        id: 'voice-database-schema',
        title: 'Voice-Driven Database Design',
        description: 'Design database schemas and migrations through voice',
        category: 'voice',
        complexity: 'advanced',
        estimatedTime: 60,
        inputs: {
          text: "Design a database schema for an e-commerce platform. Include users, products, categories, orders, and order items. Create the Prisma schema and initial migrations.",
          voice: {
            enabled: true,
            language: 'en-US'
          },
          context: this.createSampleContext('database-design')
        },
        expectedOutputs: [
          'Prisma schema definition',
          'Database migrations',
          'Relationship mappings',
          'Index optimizations',
          'Seed data scripts'
        ]
      }
    ];
  }

  /**
   * Vision-to-UI Samples
   */
  private getVisionSamples(): SampleScenario[] {
    return [
      {
        id: 'design-to-react',
        title: 'Design Mockup to React Component',
        description: 'Convert UI design images into functional React components',
        category: 'vision',
        complexity: 'intermediate',
        estimatedTime: 90,
        inputs: {
          text: "Convert this design mockup into a responsive React component with Tailwind CSS",
          images: [
            // Would be actual design images in real usage
            'data:image/placeholder-dashboard-design',
            'data:image/placeholder-mobile-design'
          ],
          context: this.createSampleContext('design-implementation')
        },
        expectedOutputs: [
          'Pixel-perfect React component',
          'Responsive Tailwind CSS',
          'Interactive elements',
          'Accessibility features',
          'Mobile optimizations'
        ],
        demoScript: `
📸 Upload dashboard design mockup
🎯 AI analyzes layout, colors, typography, spacing
✅ Generates React component with exact styling
✅ Implements responsive breakpoints
✅ Adds hover states and animations
✅ Includes accessibility attributes
        `
      },
      {
        id: 'wireframe-to-app',
        title: 'Wireframe to Full Application',
        description: 'Generate complete applications from wireframe sketches',
        category: 'vision',
        complexity: 'advanced',
        estimatedTime: 180,
        inputs: {
          text: "Create a complete todo application based on these wireframes. Include routing, state management, and API integration.",
          images: [
            'data:image/todo-app-wireframes',
            'data:image/todo-mobile-wireframes'
          ],
          context: this.createSampleContext('full-app-generation')
        },
        expectedOutputs: [
          'Complete React application',
          'React Router setup',
          'State management (Zustand/Redux)',
          'API integration layer',
          'Component library',
          'Testing setup'
        ]
      },
      {
        id: 'sketch-to-component',
        title: 'Hand Sketch to Component',
        description: 'Convert hand-drawn sketches into working UI components',
        category: 'vision',
        complexity: 'beginner',
        estimatedTime: 45,
        inputs: {
          text: "Convert this hand-drawn component sketch into a React component",
          images: ['data:image/hand-drawn-login-form'],
          context: this.createSampleContext('sketch-conversion')
        },
        expectedOutputs: [
          'Interpreted component structure',
          'Form validation logic',
          'Styling implementation',
          'Interactive behaviors'
        ]
      }
    ];
  }

  /**
   * Collaborative Coding Samples
   */
  private getCollaborationSamples(): SampleScenario[] {
    return [
      {
        id: 'pair-programming-session',
        title: 'AI Pair Programming Assistant',
        description: 'Real-time coding assistance and collaboration',
        category: 'collaboration',
        complexity: 'intermediate',
        estimatedTime: 120,
        inputs: {
          text: "Help me refactor this React component to use hooks instead of class components",
          files: [
            {
              path: 'src/components/UserDashboard.tsx',
              content: this.getSampleClassComponent(),
              type: 'code',
              language: 'typescript',
              size: 2048,
              lastModified: new Date()
            }
          ],
          context: this.createSampleContext('refactoring-session')
        },
        expectedOutputs: [
          'Refactored functional component',
          'Hook implementations',
          'State migration guide',
          'Testing updates',
          'Performance improvements'
        ],
        demoScript: `
👥 Collaborative Refactoring Session
🔄 AI analyzes existing class component
📝 Suggests hook-based refactoring
💡 Explains state management changes
🧪 Updates tests accordingly
⚡ Identifies performance optimizations
        `
      },
      {
        id: 'code-review-assistant',
        title: 'Intelligent Code Review',
        description: 'Automated code review with improvement suggestions',
        category: 'collaboration',
        complexity: 'advanced',
        estimatedTime: 60,
        inputs: {
          text: "Review this pull request and provide detailed feedback on code quality, security, and performance",
          files: [
            {
              path: 'src/api/auth.ts',
              content: this.getSampleAuthCode(),
              type: 'code',
              language: 'typescript',
              size: 1536,
              lastModified: new Date()
            }
          ],
          context: this.createSampleContext('code-review')
        },
        expectedOutputs: [
          'Security vulnerability analysis',
          'Performance optimization suggestions',
          'Code quality improvements',
          'Best practice recommendations',
          'Testing coverage analysis'
        ]
      },
      {
        id: 'documentation-generation',
        title: 'Automatic Documentation Generation',
        description: 'Generate comprehensive documentation from code',
        category: 'collaboration',
        complexity: 'beginner',
        estimatedTime: 30,
        inputs: {
          text: "Generate complete documentation for this component library",
          files: [
            {
              path: 'src/components/Button.tsx',
              content: this.getSampleButtonComponent(),
              type: 'code',
              language: 'typescript',
              size: 1024,
              lastModified: new Date()
            }
          ],
          context: this.createSampleContext('documentation')
        },
        expectedOutputs: [
          'API documentation',
          'Usage examples',
          'Props documentation',
          'Storybook stories',
          'README files'
        ]
      }
    ];
  }

  /**
   * Automation Samples
   */
  private getAutomationSamples(): SampleScenario[] {
    return [
      {
        id: 'automated-testing-suite',
        title: 'Automated Test Generation',
        description: 'Generate comprehensive test suites for existing code',
        category: 'automation',
        complexity: 'advanced',
        estimatedTime: 90,
        inputs: {
          text: "Generate a complete test suite for this React application including unit, integration, and E2E tests",
          files: [
            {
              path: 'src/components/TodoList.tsx',
              content: this.getSampleTodoComponent(),
              type: 'code',
              language: 'typescript',
              size: 2048,
              lastModified: new Date()
            }
          ],
          context: this.createSampleContext('test-automation')
        },
        expectedOutputs: [
          'Jest unit tests',
          'React Testing Library tests',
          'Playwright E2E tests',
          'Test utilities',
          'CI/CD configuration'
        ],
        demoScript: `
🤖 Automated Testing Generation
📋 Analyzes component functionality
🧪 Generates unit tests for all functions
🔄 Creates integration tests for user flows
🌐 Adds E2E tests for critical paths
⚙️ Sets up CI/CD pipeline configuration
        `
      },
      {
        id: 'deployment-automation',
        title: 'Automated Deployment Pipeline',
        description: 'Create deployment configurations and CI/CD pipelines',
        category: 'automation',
        complexity: 'advanced',
        estimatedTime: 120,
        inputs: {
          text: "Set up a complete deployment pipeline for this Next.js application with Docker, Kubernetes, and monitoring",
          files: [
            {
              path: 'package.json',
              content: this.getSamplePackageJson(),
              type: 'config',
              language: 'json',
              size: 512,
              lastModified: new Date()
            }
          ],
          context: this.createSampleContext('deployment-automation')
        },
        expectedOutputs: [
          'Dockerfile configuration',
          'Kubernetes manifests',
          'GitHub Actions workflow',
          'Monitoring setup',
          'Environment configurations'
        ]
      },
      {
        id: 'performance-optimization',
        title: 'Automated Performance Optimization',
        description: 'Analyze and optimize application performance automatically',
        category: 'automation',
        complexity: 'advanced',
        estimatedTime: 75,
        inputs: {
          text: "Analyze this application for performance bottlenecks and automatically implement optimizations",
          files: [
            {
              path: 'src/pages/Dashboard.tsx',
              content: this.getSampleDashboardComponent(),
              type: 'code',
              language: 'typescript',
              size: 3072,
              lastModified: new Date()
            }
          ],
          context: this.createSampleContext('performance-optimization')
        },
        expectedOutputs: [
          'Performance analysis report',
          'Optimization implementations',
          'Bundle size improvements',
          'Lazy loading setup',
          'Caching strategies'
        ]
      }
    ];
  }

  /**
   * Analysis Samples
   */
  private getAnalysisSamples(): SampleScenario[] {
    return [
      {
        id: 'codebase-architecture-analysis',
        title: 'Comprehensive Codebase Analysis',
        description: 'Analyze entire codebases for architecture and improvement opportunities',
        category: 'analysis',
        complexity: 'advanced',
        estimatedTime: 150,
        inputs: {
          text: "Analyze this entire codebase and provide recommendations for architecture improvements, refactoring opportunities, and modernization",
          files: [
            {
              path: 'src/App.tsx',
              content: this.getSampleAppComponent(),
              type: 'code',
              language: 'typescript',
              size: 1024,
              lastModified: new Date()
            },
            // Would include multiple files in real usage
          ],
          context: this.createSampleContext('architecture-analysis')
        },
        expectedOutputs: [
          'Architecture analysis report',
          'Refactoring recommendations',
          'Modernization roadmap',
          'Security assessment',
          'Performance audit'
        ],
        demoScript: `
🔍 Comprehensive Codebase Analysis
📊 Analyzes project structure and patterns
🏗️ Identifies architectural improvements
🔄 Suggests refactoring opportunities
🚀 Recommends modernization steps
📈 Provides implementation roadmap
        `
      },
      {
        id: 'dependency-security-audit',
        title: 'Security and Dependency Audit',
        description: 'Comprehensive security analysis and dependency management',
        category: 'analysis',
        complexity: 'intermediate',
        estimatedTime: 45,
        inputs: {
          text: "Perform a complete security audit of dependencies and code, identify vulnerabilities, and suggest fixes",
          files: [
            {
              path: 'package.json',
              content: this.getSamplePackageJsonWithVulnerabilities(),
              type: 'config',
              language: 'json',
              size: 768,
              lastModified: new Date()
            }
          ],
          context: this.createSampleContext('security-audit')
        },
        expectedOutputs: [
          'Security vulnerability report',
          'Dependency upgrade recommendations',
          'Code security improvements',
          'Compliance checklist',
          'Fix implementation guide'
        ]
      },
      {
        id: 'accessibility-analysis',
        title: 'Accessibility Compliance Analysis',
        description: 'Comprehensive accessibility audit and improvements',
        category: 'analysis',
        complexity: 'intermediate',
        estimatedTime: 60,
        inputs: {
          text: "Analyze this application for accessibility compliance and generate improvements to meet WCAG 2.1 AA standards",
          files: [
            {
              path: 'src/components/ContactForm.tsx',
              content: this.getSampleContactFormComponent(),
              type: 'code',
              language: 'typescript',
              size: 1536,
              lastModified: new Date()
            }
          ],
          context: this.createSampleContext('accessibility-analysis')
        },
        expectedOutputs: [
          'Accessibility audit report',
          'WCAG compliance improvements',
          'Screen reader optimizations',
          'Keyboard navigation enhancements',
          'Color contrast fixes'
        ]
      }
    ];
  }

  /**
   * Run a specific sample scenario
   */
  async runSample(sampleId: string): Promise<any> {
    const sample = this.getAllSamples().find(s => s.id === sampleId);
    
    if (!sample) {
      throw new Error(`Sample ${sampleId} not found`);
    }

    console.log(`🚀 Running sample: ${sample.title}`);
    console.log(`📝 Description: ${sample.description}`);
    console.log(`⏱️ Estimated time: ${sample.estimatedTime}s`);

    const startTime = Date.now();
    
    try {
      const result = await this.agent.processMultimodalInput(sample.inputs);
      
      const duration = Date.now() - startTime;
      
      console.log(`✅ Sample completed in ${duration}ms`);
      console.log(`📊 Confidence: ${result.metadata.confidence}`);
      console.log(`💰 Cost: $${result.metadata.cost.toFixed(4)}`);
      
      return {
        sample,
        result,
        performance: {
          duration,
          estimatedTime: sample.estimatedTime * 1000,
          efficiency: (sample.estimatedTime * 1000) / duration
        }
      };
      
    } catch (error) {
      console.error(`❌ Sample failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create sample context for testing
   */
  private createSampleContext(type: string): AgentContext {
    return {
      workspaceId: `workspace_${type}`,
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
          voice: 'en-US-Standard-A'
        },
        assistantPersonality: 'encouraging'
      },
      projectMetadata: {
        name: `Sample ${type} Project`,
        description: `Sample project for testing ${type} functionality`,
        type: 'web-app',
        technologies: ['React', 'TypeScript', 'Tailwind CSS'],
        complexity: 'intermediate',
        estimatedTime: 60,
        targetAudience: 'developers',
        features: ['responsive design', 'accessibility', 'performance optimized']
      }
    };
  }

  // Sample code templates for testing
  private getSampleClassComponent(): string {
    return `
import React, { Component } from 'react';

interface UserDashboardState {
  users: User[];
  loading: boolean;
  error: string | null;
}

class UserDashboard extends Component<{}, UserDashboardState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      users: [],
      loading: true,
      error: null
    };
  }

  componentDidMount() {
    this.fetchUsers();
  }

  fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      const users = await response.json();
      this.setState({ users, loading: false });
    } catch (error) {
      this.setState({ error: error.message, loading: false });
    }
  };

  render() {
    const { users, loading, error } = this.state;
    
    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;
    
    return (
      <div className="user-dashboard">
        {users.map(user => (
          <div key={user.id} className="user-card">
            <h3>{user.name}</h3>
            <p>{user.email}</p>
          </div>
        ))}
      </div>
    );
  }
}

export default UserDashboard;
    `;
  }

  private getSampleAuthCode(): string {
    return `
export async function authenticateUser(email: string, password: string) {
  // Potential security issues for review
  const user = await db.user.findFirst({
    where: { email: email } // Should use parameterized queries
  });
  
  if (user && user.password === password) { // Plain text comparison!
    const token = jwt.sign({ userId: user.id }, 'secret'); // Hardcoded secret!
    return { success: true, token };
  }
  
  return { success: false };
}
    `;
  }

  private getSampleButtonComponent(): string {
    return `
import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "underline-offset-4 hover:underline text-primary",
      },
      size: {
        default: "h-10 py-2 px-4",
        sm: "h-9 px-3 rounded-md",
        lg: "h-11 px-8 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

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
Button.displayName = "Button";

export { Button, buttonVariants };
    `;
  }

  private getSampleTodoComponent(): string {
    return `
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: Date;
}

export function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  useEffect(() => {
    loadTodos();
  }, []);

  const loadTodos = async () => {
    try {
      const response = await fetch('/api/todos');
      const todosData = await response.json();
      setTodos(todosData);
    } catch (error) {
      console.error('Failed to load todos:', error);
    }
  };

  const addTodo = async () => {
    if (!newTodo.trim()) return;

    const todo: Todo = {
      id: crypto.randomUUID(),
      text: newTodo,
      completed: false,
      createdAt: new Date()
    };

    try {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(todo)
      });

      if (response.ok) {
        setTodos([...todos, todo]);
        setNewTodo('');
      }
    } catch (error) {
      console.error('Failed to add todo:', error);
    }
  };

  const toggleTodo = async (id: string) => {
    const updatedTodos = todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    );
    setTodos(updatedTodos);

    try {
      const todo = updatedTodos.find(t => t.id === id);
      await fetch(\`/api/todos/\${id}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(todo)
      });
    } catch (error) {
      console.error('Failed to update todo:', error);
    }
  };

  const deleteTodo = async (id: string) => {
    setTodos(todos.filter(todo => todo.id !== id));

    try {
      await fetch(\`/api/todos/\${id}\`, { method: 'DELETE' });
    } catch (error) {
      console.error('Failed to delete todo:', error);
    }
  };

  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return true;
  });

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Todo List</h1>
      
      <div className="flex gap-2 mb-4">
        <Input
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          placeholder="Add new todo..."
          onKeyPress={(e) => e.key === 'Enter' && addTodo()}
        />
        <Button onClick={addTodo}>Add</Button>
      </div>

      <div className="flex gap-2 mb-4">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          All
        </Button>
        <Button
          variant={filter === 'active' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('active')}
        >
          Active
        </Button>
        <Button
          variant={filter === 'completed' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('completed')}
        >
          Completed
        </Button>
      </div>

      <div className="space-y-2">
        {filteredTodos.map(todo => (
          <div key={todo.id} className="flex items-center gap-2 p-2 border rounded">
            <Checkbox
              checked={todo.completed}
              onCheckedChange={() => toggleTodo(todo.id)}
            />
            <span className={todo.completed ? 'line-through text-gray-500' : ''}>
              {todo.text}
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteTodo(todo.id)}
              className="ml-auto"
            >
              Delete
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-4 text-sm text-gray-500">
        {todos.filter(t => !t.completed).length} active, {todos.length} total
      </div>
    </div>
  );
}
    `;
  }

  private getSamplePackageJson(): string {
    return JSON.stringify({
      "name": "vibecode-sample-app",
      "version": "1.0.0",
      "scripts": {
        "dev": "next dev",
        "build": "next build",
        "start": "next start",
        "test": "jest"
      },
      "dependencies": {
        "next": "^14.0.0",
        "react": "^18.0.0",
        "react-dom": "^18.0.0"
      },
      "devDependencies": {
        "@types/react": "^18.0.0",
        "typescript": "^5.0.0"
      }
    }, null, 2);
  }

  private getSampleDashboardComponent(): string {
    return `
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// This component has several performance issues for analysis
export function Dashboard() {
  const [data, setData] = useState(null);
  const [users, setUsers] = useState([]);
  const [analytics, setAnalytics] = useState([]);

  // Inefficient: Multiple API calls on every render
  useEffect(() => {
    fetchData();
    fetchUsers();
    fetchAnalytics();
  });

  const fetchData = async () => {
    // No loading states or error handling
    const response = await fetch('/api/dashboard');
    const result = await response.json();
    setData(result);
  };

  const fetchUsers = async () => {
    const response = await fetch('/api/users');
    const result = await response.json();
    setUsers(result);
  };

  const fetchAnalytics = async () => {
    const response = await fetch('/api/analytics');
    const result = await response.json();
    setAnalytics(result);
  };

  // Inefficient: No memoization
  const expensiveCalculation = () => {
    return analytics.reduce((acc, item) => {
      return acc + item.value * Math.random(); // Unnecessary randomization
    }, 0);
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            {users.length} {/* No loading state */}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            {expensiveCalculation()} {/* Recalculated every render */}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            {data ? 'Active' : 'Loading...'}
          </CardContent>
        </Card>
      </div>

      {/* Inefficient: Large list without virtualization */}
      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-4">All Users</h2>
        {users.map(user => (
          <div key={user.id} className="p-4 border mb-2">
            <h3>{user.name}</h3>
            <p>{user.email}</p>
            <p>{user.lastActive}</p>
            {/* No image optimization */}
            <img src={user.avatar} alt={user.name} className="w-12 h-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
    `;
  }

  private getSampleAppComponent(): string {
    return `
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { TodoList } from './components/TodoList';
import { UserDashboard } from './components/UserDashboard';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="bg-blue-600 text-white p-4">
          <h1>VibeCode Sample App</h1>
        </header>
        
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/todos" element={<TodoList />} />
            <Route path="/users" element={<UserDashboard />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
    `;
  }

  private getSamplePackageJsonWithVulnerabilities(): string {
    return JSON.stringify({
      "name": "vulnerable-app",
      "version": "1.0.0",
      "dependencies": {
        "express": "4.15.0", // Old version with vulnerabilities
        "lodash": "4.17.4", // Known prototype pollution issues
        "axios": "0.18.0", // Old version
        "jsonwebtoken": "7.4.3", // Potential security issues
        "bcrypt": "2.0.0" // Old version
      }
    }, null, 2);
  }

  private getSampleContactFormComponent(): string {
    return `
import React, { useState } from 'react';

// Component with accessibility issues for analysis
export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // Form submission logic
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h1>Contact Us</h1> {/* Missing proper heading hierarchy */}
      
      <form onSubmit={handleSubmit}>
        {/* Missing labels and ARIA attributes */}
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-2 border mb-4"
        />
        
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 border mb-4"
        />
        
        <textarea
          placeholder="Message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full p-2 border mb-4"
          rows="4"
        />
        
        {/* Missing keyboard navigation and focus states */}
        <button
          type="submit"
          className="bg-blue-500 text-white p-2 rounded"
          style={{ backgroundColor: '#0066cc', color: '#ffffff' }} // Poor contrast
        >
          Submit
        </button>
      </form>
      
      {/* Missing error handling and status messages */}
      <div className="mt-4">
        <a href="#" className="text-blue-500">Learn more</a> {/* Missing descriptive link text */}
      </div>
    </div>
  );
}
    `;
  }
}

export default MultimodalSampleGenerator; 
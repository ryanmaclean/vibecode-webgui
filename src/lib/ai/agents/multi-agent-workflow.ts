// Minimal agent client interface used by this orchestrator
export interface AgentClient {
  invoke(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): Promise<{ content: string }>;
}

// LangChain imports are intentionally omitted to avoid hard build-time dependency issues.
// We provide a lightweight interface and defer model wiring to higher-level services.
import { z } from 'zod';

// Agent role definitions
export interface AgentRole {
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  temperature?: number;
}

// Workflow step definition
export interface WorkflowStep {
  id: string;
  agentRole: string;
  input: string;
  dependencies?: string[];
  outputSchema?: z.ZodSchema<any>;
}

// Workflow result
export interface WorkflowResult {
  stepId: string;
  agentRole: string;
  input: string;
  output: any;
  metadata: {
    model: string;
    tokensUsed?: number;
    duration: number;
    timestamp: string;
  };
}

// Multi-agent workflow orchestrator
export class MultiAgentWorkflow {
  private agents: Map<string, AgentClient> = new Map();
  private agentRoles: Map<string, AgentRole> = new Map();
  private results: Map<string, WorkflowResult> = new Map();

  constructor() {
    this.initializeDefaultAgents();
  }

  private initializeDefaultAgents() {
    // Software Architect Agent
    this.addAgentRole({
      name: 'architect',
      description: 'Software architect specializing in system design and architecture',
      systemPrompt: `You are a senior software architect with 15+ years of experience.
Your role is to:
1. Analyze requirements and design scalable system architectures
2. Choose appropriate technologies and patterns
3. Consider performance, security, and maintainability
4. Provide clear architectural diagrams and documentation
5. Make decisions that balance technical debt with delivery speed

Always provide structured, actionable architectural guidance.`,
      model: 'gpt-4',
      temperature: 0.1
    });

    // Frontend Developer Agent
    this.addAgentRole({
      name: 'frontend-developer',
      description: 'Frontend developer specializing in React, TypeScript, and modern web technologies',
      systemPrompt: `You are a senior frontend developer with expertise in:
- React 18+ with TypeScript
- Modern CSS (Tailwind CSS, CSS-in-JS)
- State management (Redux Toolkit, Zustand, React Query)
- Performance optimization and accessibility
- Component design patterns and best practices

Your role is to:
1. Implement clean, maintainable React components
2. Ensure responsive design and accessibility compliance
3. Optimize for performance and user experience
4. Write comprehensive tests
5. Follow modern React patterns and conventions`,
      model: 'gpt-4',
      temperature: 0.2
    });

    // Backend Developer Agent
    this.addAgentRole({
      name: 'backend-developer',
      description: 'Backend developer specializing in Node.js, databases, and API design',
      systemPrompt: `You are a senior backend developer with expertise in:
- Node.js and TypeScript
- RESTful and GraphQL API design
- Database design (PostgreSQL, MongoDB)
- Authentication and authorization
- Performance optimization and security
- Testing and deployment

Your role is to:
1. Design robust, scalable APIs
2. Implement proper error handling and validation
3. Ensure security best practices
4. Write comprehensive tests
5. Consider performance and scalability`,
      model: 'gpt-4',
      temperature: 0.2
    });

    // Code Reviewer Agent
    this.addAgentRole({
      name: 'code-reviewer',
      description: 'Senior code reviewer focusing on quality, security, and best practices',
      systemPrompt: `You are a senior code reviewer with expertise in:
- Code quality and maintainability
- Security vulnerabilities and best practices
- Performance optimization
- Testing strategies
- Documentation standards

Your role is to:
1. Identify potential bugs and security issues
2. Suggest performance improvements
3. Ensure code follows best practices
4. Verify proper error handling
5. Check for comprehensive testing
6. Provide constructive, actionable feedback`,
      model: 'gpt-4',
      temperature: 0.1
    });

    // DevOps Engineer Agent
    this.addAgentRole({
      name: 'devops-engineer',
      description: 'DevOps engineer specializing in deployment, monitoring, and infrastructure',
      systemPrompt: `You are a senior DevOps engineer with expertise in:
- Docker and containerization
- Kubernetes orchestration
- CI/CD pipelines
- Monitoring and observability
- Infrastructure as code
- Security and compliance

Your role is to:
1. Design deployment strategies
2. Implement monitoring and alerting
3. Ensure security best practices
4. Optimize resource utilization
5. Provide disaster recovery plans`,
      model: 'gpt-4',
      temperature: 0.1
    });
  }

  addAgentRole(role: AgentRole): void {
    this.agentRoles.set(role.name, role);
    
    // Register a placeholder agent that throws until a real provider wires in
    const placeholder: AgentClient = {
      async invoke(_messages) {
        throw new Error(`Agent provider for role "${role.name}" is not configured`);
      }
    };
    this.agents.set(role.name, placeholder);
  }

  async executeWorkflow(steps: WorkflowStep[]): Promise<WorkflowResult[]> {
    const results: WorkflowResult[] = [];
    
    // Execute steps in dependency order
    for (const step of steps) {
      try {
        const startTime = Date.now();
        
        // Get the agent for this step
        const agent = this.agents.get(step.agentRole);
        if (!agent) {
          throw new Error(`Agent role '${step.agentRole}' not found`);
        }

        // Get the agent role configuration
        const role = this.agentRoles.get(step.agentRole);
        if (!role) {
          throw new Error(`Agent role configuration for '${step.agentRole}' not found`);
        }

        // Prepare the input with context from previous steps
        const contextualInput = this.buildContextualInput(step, results);
        
        // Execute the step
        const output = await this.executeStep(agent, role, contextualInput, step.outputSchema);
        
        const duration = Date.now() - startTime;
        
        const result: WorkflowResult = {
          stepId: step.id,
          agentRole: step.agentRole,
          input: contextualInput,
          output,
          metadata: {
            model: role.model,
            duration,
            timestamp: new Date().toISOString()
          }
        };
        
        results.push(result);
        this.results.set(step.id, result);
        
      } catch (error) {
        console.error(`Error executing step ${step.id}:`, error);
        throw error;
      }
    }
    
    return results;
  }

  private buildContextualInput(step: WorkflowStep, previousResults: WorkflowResult[]): string {
    let input = step.input;
    
    // Add context from dependent steps
    if (step.dependencies) {
      for (const depId of step.dependencies) {
        const depResult = previousResults.find(r => r.stepId === depId);
        if (depResult) {
          input += `\n\nContext from ${depResult.agentRole}:\n${JSON.stringify(depResult.output, null, 2)}`;
        }
      }
    }
    
    return input;
  }

  private async executeStep(
    agent: AgentClient,
    role: AgentRole,
    input: string,
    outputSchema?: z.ZodSchema<any>
  ): Promise<any> {
    const messages = [
      { role: 'system' as const, content: role.systemPrompt },
      { role: 'user' as const, content: input }
    ];

    const response = await agent.invoke(messages);
    const content = response?.content ?? '';

    if (outputSchema) {
<<<<<<< HEAD
<<<<<<< HEAD
      // Attempt to parse JSON when a schema is provided
      try {
        const parsed = JSON.parse(content);
        return outputSchema.parse(parsed);
      } catch {
        // Fallback to raw content if not valid JSON
        return content;
      }
=======
=======
>>>>>>> merge-conflict-cleanup
      // Use structured output for schema-defined responses
      const parser = StructuredOutputParser.fromZodSchema(outputSchema);
      const formatInstructions = parser.getFormatInstructions();
      
      messages.push(new SystemMessage(`\n\n${formatInstructions}`));
      
      // @ts-expect-error - Type incompatibility with LangChain's RunnableSequence for agent type
      const chain = RunnableSequence.from([
<<<<<<< HEAD
        // @ts-expect-error - Type incompatibility with LangChain's RunnableSequence
=======
        // @ts-ignore
      const chain = RunnableSequence.from([
>>>>>>> merge-conflict-cleanup
        agent,
        parser
      ]);
      
      // @ts-expect-error - Type incompatibility with LangChain message format
      return await chain.invoke(messages);
    } else {
      // Use simple text output
<<<<<<< HEAD
      // @ts-expect-error - Type incompatibility with LangChain message format
      const response = await agent.invoke(messages);
      return response.content;
>>>>>>> fix/consolidated-dependency-updates
=======
      // @ts-ignore - Type incompatibility with LangChain message format
      return await chain.invoke(messages);
    } else {
      // Use simple text output
      const response = await agent.invoke(messages);
      return response.content;
=======
      // Attempt to parse JSON when a schema is provided
      try {
        const parsed = JSON.parse(content);
        return outputSchema.parse(parsed);
      } catch {
        // Fallback to raw content if not valid JSON
        return content;
      }
>>>>>>> main
>>>>>>> merge-conflict-cleanup
    }
    return content;
  }

  // Predefined workflow templates
  static createCodeGenerationWorkflow(requirements: string): WorkflowStep[] {
    return [
      {
        id: 'architecture',
        agentRole: 'architect',
        input: `Design the system architecture for the following requirements:\n\n${requirements}\n\nProvide a clear architectural overview with technology choices and key design decisions.`,
        dependencies: []
      },
      {
        id: 'frontend-design',
        agentRole: 'frontend-developer',
        input: `Based on the architecture, design the frontend components and user interface for:\n\n${requirements}\n\nFocus on React components, state management, and user experience.`,
        dependencies: ['architecture']
      },
      {
        id: 'backend-design',
        agentRole: 'backend-developer',
        input: `Based on the architecture, design the backend API and database structure for:\n\n${requirements}\n\nFocus on API endpoints, data models, and business logic.`,
        dependencies: ['architecture']
      },
      {
        id: 'frontend-implementation',
        agentRole: 'frontend-developer',
        input: `Implement the frontend components based on the design. Provide complete, production-ready React components with TypeScript, proper error handling, and accessibility features.`,
        dependencies: ['frontend-design', 'backend-design']
      },
      {
        id: 'backend-implementation',
        agentRole: 'backend-developer',
        input: `Implement the backend API based on the design. Provide complete, production-ready Node.js/TypeScript code with proper error handling, validation, and testing.`,
        dependencies: ['backend-design']
      },
      {
        id: 'code-review',
        agentRole: 'code-reviewer',
        input: `Review the complete codebase for quality, security, and best practices. Provide detailed feedback and suggestions for improvement.`,
        dependencies: ['frontend-implementation', 'backend-implementation']
      },
      {
        id: 'deployment',
        agentRole: 'devops-engineer',
        input: `Create deployment configuration for the application. Provide Docker configurations, Kubernetes manifests, and CI/CD pipeline setup.`,
        dependencies: ['code-review']
      }
    ];
  }

  static createCodeReviewWorkflow(code: string, language: string): WorkflowStep[] {
    return [
      {
        id: 'security-review',
        agentRole: 'code-reviewer',
        input: `Review the following ${language} code for security vulnerabilities and best practices:\n\n${code}\n\nFocus on security issues, input validation, and secure coding practices.`,
        dependencies: []
      },
      {
        id: 'performance-review',
        agentRole: 'code-reviewer',
        input: `Review the following ${language} code for performance optimizations:\n\n${code}\n\nFocus on algorithmic efficiency, memory usage, and performance bottlenecks.`,
        dependencies: []
      },
      {
        id: 'quality-review',
        agentRole: 'code-reviewer',
        input: `Review the following ${language} code for overall quality and maintainability:\n\n${code}\n\nFocus on code structure, readability, testing, and documentation.`,
        dependencies: []
      },
      {
        id: 'comprehensive-review',
        agentRole: 'code-reviewer',
        input: `Provide a comprehensive code review summary combining all previous reviews. Prioritize issues and provide actionable recommendations.`,
        dependencies: ['security-review', 'performance-review', 'quality-review']
      }
    ];
  }

  // Get workflow results
  getResult(stepId: string): WorkflowResult | undefined {
    return this.results.get(stepId);
  }

  getAllResults(): WorkflowResult[] {
    return Array.from(this.results.values());
  }

  // Clear workflow results
  clearResults(): void {
    this.results.clear();
  }
}

// Export the class and types
export default MultiAgentWorkflow;

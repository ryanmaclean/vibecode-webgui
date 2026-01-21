---
title: MASTRA INTEGRATION GUIDE
description: MASTRA INTEGRATION GUIDE documentation
---

# 🎯 Mastra Integration Guide for VibeCode

**Goal**: Integrate [Mastra](https://github.com/mastra-ai/mastra) as both an AI agent library AND template source  
**License**: MIT ✅ (15.1k+ stars, production-ready)  
**Benefits**: 50+ AI agent templates + TypeScript-first framework + Multi-LLM support

## 🚀 **Phase 1: Template Library Integration (Immediate)**

### **1.1 Add Mastra Dependencies**

```bash
# Add core Mastra packages
npm install @mastra/core @mastra/cli
npm install @mastra/rag @mastra/workflows 
npm install @mastra/observability

# TypeScript and Next.js support
npm install --save-dev @types/node
```

### **1.2 Import Mastra Templates into VibeCode**

```typescript
// src/lib/templates/mastra-templates.ts
export const MASTRA_TEMPLATES = {
  // AI Agents
  "AI Customer Support Agent": {
    path: "mastra/examples/customer-support",
    description: "Multi-channel customer support with sentiment analysis",
    tags: ["ai", "customer-service", "chat"],
    complexity: "intermediate"
  },
  
  "Code Review Assistant": {
    path: "mastra/examples/code-review", 
    description: "Automated code review with best practices suggestions",
    tags: ["ai", "code-review", "development"],
    complexity: "advanced"
  },
  
  "Documentation Generator": {
    path: "mastra/examples/docs-generator",
    description: "Auto-generate documentation from code and comments", 
    tags: ["ai", "documentation", "automation"],
    complexity: "intermediate"
  },
  
  // RAG & Search
  "RAG Document Search": {
    path: "mastra/examples/rag-search",
    description: "Semantic document search with retrieval-augmented generation",
    tags: ["ai", "rag", "search", "vectors"],
    complexity: "advanced"
  },
  
  "Knowledge Base Chatbot": {
    path: "mastra/examples/knowledge-bot",
    description: "Company knowledge base with intelligent Q&A",
    tags: ["ai", "chatbot", "knowledge-base"],
    complexity: "intermediate"
  },
  
  // Workflows
  "Content Creation Pipeline": {
    path: "mastra/examples/content-workflow",
    description: "Multi-step content creation with review and approval",
    tags: ["ai", "content", "workflow"],
    complexity: "advanced"
  },
  
  "Data Analysis Agent": {
    path: "mastra/examples/data-analysis",
    description: "Automated data analysis with visualization generation",
    tags: ["ai", "data", "analytics", "charts"],
    complexity: "advanced"
  },
  
  // Voice & Multi-modal
  "Voice Assistant": {
    path: "mastra/examples/voice-agent",
    description: "Voice-controlled AI assistant with speech-to-text",
    tags: ["ai", "voice", "speech", "assistant"],
    complexity: "advanced"
  },
  
  "Image Analysis Agent": {
    path: "mastra/examples/image-analysis",
    description: "Multi-modal image analysis with text generation",
    tags: ["ai", "computer-vision", "multi-modal"],
    complexity: "advanced"
  },
  
  // Integration Examples
  "Slack Bot with AI": {
    path: "mastra/examples/slack-bot",
    description: "Intelligent Slack bot with team integration",
    tags: ["ai", "slack", "bot", "integration"],
    complexity: "intermediate"
  }
};
```

### **1.3 Enhanced Project Generation with Mastra Templates**

```typescript
// src/lib/ai/mastra-project-generator.ts
import { Mastra } from '@mastra/core';
import { MASTRA_TEMPLATES } from '../templates/mastra-templates';

interface MastraProjectRequest {
  prompt: string;
  userPreferences: {
    complexity: 'beginner' | 'intermediate' | 'advanced';
    frameworks: string[];
    features: string[];
  };
}

export class MastraProjectGenerator {
  private mastra: Mastra;
  
  constructor() {
    this.mastra = new Mastra({
      providers: {
        openai: { apiKey: process.env.OPENAI_API_KEY },
        anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
        // Use LiteLLM proxy for unified access
        litellm: { baseUrl: process.env.LITELLM_PROXY_URL }
      }
    });
  }
  
  async generateProject(request: MastraProjectRequest): Promise<ProjectStructure> {
    // Step 1: Match prompt to best Mastra template
    const template = await this.findBestTemplate(request.prompt);
    
    // Step 2: Use Mastra agent to customize template
    const customization = await this.customizeTemplate(template, request);
    
    // Step 3: Generate complete project structure
    return await this.scaffoldProject(template, customization);
  }
  
  private async findBestTemplate(prompt: string): Promise<string> {
    const templateMatcher = this.mastra.agent({
      name: 'template-matcher',
      instructions: `
        Match user prompts to the best Mastra template from this list:
        ${Object.entries(MASTRA_TEMPLATES).map(([name, info]) => 
          `${name}: ${info.description}`
        ).join('\n')}
        
        Return only the template name that best matches the user's intent.
      `
    });
    
    const result = await templateMatcher.run(prompt);
    return result.text;
  }
  
  private async customizeTemplate(templateName: string, request: MastraProjectRequest) {
    const customizer = this.mastra.agent({
      name: 'template-customizer',
      instructions: `
        Customize the ${templateName} template based on user preferences:
        - Complexity: ${request.userPreferences.complexity}
        - Frameworks: ${request.userPreferences.frameworks.join(', ')}
        - Features: ${request.userPreferences.features.join(', ')}
        
        Generate specific modifications needed for this template.
      `
    });
    
    return await customizer.run(request.prompt);
  }
}
```

## 🔧 **Phase 2: Mastra Framework Integration (Next Sprint)**

### **2.1 Replace Custom AI Client with Mastra**

```typescript
// src/lib/ai/mastra-enhanced-client.ts
import { Mastra, Agent } from '@mastra/core';
import { RagEngine } from '@mastra/rag';
import { WorkflowEngine } from '@mastra/workflows';

export class MastraEnhancedClient {
  private mastra: Mastra;
  private rag: RagEngine;
  private workflows: WorkflowEngine;
  
  constructor() {
    this.mastra = new Mastra({
      // Multi-provider support through LiteLLM
      providers: {
        litellm: {
          baseUrl: process.env.LITELLM_PROXY_URL,
          apiKey: process.env.LITELLM_API_KEY
        }
      },
      
      // Vector storage for RAG
      vectorStore: {
        provider: 'lancedb', // When we migrate from pgvector
        config: { path: './vectors' }
      },
      
      // Observability
      observability: {
        provider: 'langfuse',
        config: {
          publicKey: process.env.LANGFUSE_PUBLIC_KEY,
          secretKey: process.env.LANGFUSE_SECRET_KEY
        }
      }
    });
    
    this.rag = new RagEngine(this.mastra);
    this.workflows = new WorkflowEngine(this.mastra);
  }
  
  // Create specialized agents for VibeCode
  createCodeReviewAgent(): Agent {
    return this.mastra.agent({
      name: 'code-reviewer',
      instructions: `
        You are an expert code reviewer for VibeCode projects.
        Analyze code for:
        - Best practices and patterns
        - Security vulnerabilities  
        - Performance optimizations
        - Accessibility compliance
        - Type safety improvements
        
        Provide specific, actionable feedback.
      `,
      tools: [
        this.createCodeAnalysisTool(),
        this.createSecurityScanTool()
      ]
    });
  }
  
  createProjectGeneratorAgent(): Agent {
    return this.mastra.agent({
      name: 'project-generator',
      instructions: `
        Generate complete, production-ready project structures.
        Include:
        - Proper folder structure
        - Configuration files
        - Documentation
        - Tests
        - Deployment setup
        
        Follow VibeCode best practices and accessibility standards.
      `,
      tools: [
        this.createFileGeneratorTool(),
        this.createDependencyResolverTool()
      ]
    });
  }
  
  // RAG-powered code assistance
  async getContextualHelp(query: string, codeContext: string): Promise<string> {
    const context = await this.rag.query(query, {
      filters: { type: 'code', language: 'typescript' }
    });
    
    const assistant = this.mastra.agent({
      name: 'contextual-helper',
      instructions: `
        Help the user with their coding question using the provided context.
        Context: ${context}
        Code: ${codeContext}
      `
    });
    
    const result = await assistant.run(query);
    return result.text;
  }
}
```

### **2.2 Workflow-Based AI Operations**

```typescript
// src/lib/ai/mastra-workflows.ts
import { Workflow } from '@mastra/workflows';

export const AI_PROJECT_GENERATION_WORKFLOW = new Workflow({
  name: 'ai-project-generation',
  steps: [
    {
      name: 'analyze-requirements',
      agent: 'requirement-analyzer',
      inputs: ['userPrompt', 'preferences'],
      outputs: ['requirements', 'complexity']
    },
    {
      name: 'select-template', 
      agent: 'template-selector',
      inputs: ['requirements'],
      outputs: ['templateName', 'customizations']
    },
    {
      name: 'generate-structure',
      agent: 'structure-generator', 
      inputs: ['templateName', 'customizations'],
      outputs: ['projectStructure', 'files']
    },
    {
      name: 'create-workspace',
      agent: 'workspace-creator',
      inputs: ['projectStructure', 'files'],
      outputs: ['workspaceUrl', 'sessionId']
    },
    {
      name: 'seed-files',
      agent: 'file-seeder',
      inputs: ['workspaceUrl', 'files'],
      outputs: ['success', 'errors']
    }
  ],
  
  // Fault tolerance and retries
  errorHandling: {
    retries: 3,
    fallbacks: ['cloud-api', 'simplified-generation']
  }
});

export const CODE_REVIEW_WORKFLOW = new Workflow({
  name: 'ai-code-review',
  steps: [
    {
      name: 'parse-code',
      agent: 'code-parser',
      inputs: ['codeFiles'],
      outputs: ['ast', 'dependencies', 'structure']
    },
    {
      name: 'security-scan',
      agent: 'security-scanner',
      inputs: ['ast'],
      outputs: ['vulnerabilities', 'suggestions']
    },
    {
      name: 'best-practices-check',
      agent: 'practices-checker', 
      inputs: ['ast', 'structure'],
      outputs: ['recommendations', 'score']
    },
    {
      name: 'accessibility-audit',
      agent: 'accessibility-auditor',
      inputs: ['codeFiles'],
      outputs: ['accessibilityIssues', 'fixes']
    },
    {
      name: 'compile-report',
      agent: 'report-compiler',
      inputs: ['vulnerabilities', 'recommendations', 'accessibilityIssues'],
      outputs: ['reviewReport', 'priority']
    }
  ]
});
```

## 📊 **Phase 3: Advanced Integration (Following Sprint)**

### **3.1 Multi-Modal AI with Mastra**

```typescript
// src/lib/ai/mastra-multimodal.ts
import { MultiModalAgent } from '@mastra/core';

export class MastraMultiModalService {
  private imageAnalyzer: MultiModalAgent;
  private voiceAgent: MultiModalAgent;
  
  constructor(mastra: Mastra) {
    this.imageAnalyzer = mastra.multiModalAgent({
      name: 'image-to-code',
      capabilities: ['vision', 'code-generation'],
      instructions: `
        Analyze UI mockups, wireframes, and design images.
        Generate corresponding React/TypeScript code with:
        - Proper component structure
        - Tailwind CSS styling
        - Accessibility attributes
        - Responsive design
      `
    });
    
    this.voiceAgent = mastra.multiModalAgent({
      name: 'voice-coding-assistant',
      capabilities: ['speech-to-text', 'code-generation'],
      instructions: `
        Convert voice commands into code actions:
        - "Create a button component" → Generate button
        - "Add error handling" → Add try-catch blocks
        - "Make it accessible" → Add ARIA attributes
      `
    });
  }
  
  async generateCodeFromImage(imageUrl: string): Promise<string> {
    const result = await this.imageAnalyzer.run({
      image: imageUrl,
      prompt: "Generate React component code for this design"
    });
    
    return result.code;
  }
  
  async processVoiceCommand(audioFile: Buffer): Promise<string> {
    const result = await this.voiceAgent.run({
      audio: audioFile,
      prompt: "Execute this voice command in the code editor"
    });
    
    return result.action;
  }
}
```

### **3.2 Mastra Observability Integration**

```typescript
// src/lib/ai/mastra-observability.ts
import { ObservabilityClient } from '@mastra/observability';

export class MastraObservabilityService {
  private observability: ObservabilityClient;
  
  constructor() {
    this.observability = new ObservabilityClient({
      provider: 'langfuse',
      config: {
        publicKey: process.env.LANGFUSE_PUBLIC_KEY,
        secretKey: process.env.LANGFUSE_SECRET_KEY
      }
    });
  }
  
  async trackAIOperation(operation: string, metadata: any) {
    await this.observability.trace({
      name: operation,
      userId: metadata.userId,
      sessionId: metadata.sessionId,
      input: metadata.input,
      output: metadata.output,
      latency: metadata.latency,
      cost: metadata.cost,
      model: metadata.model
    });
  }
  
  async generateUsageReport(userId: string, timeRange: string) {
    return await this.observability.getUsageReport({
      userId,
      timeRange,
      metrics: ['cost', 'latency', 'accuracy', 'user_satisfaction']
    });
  }
}
```

## 🎯 **Implementation Roadmap**

### **Week 1: Template Integration**
- [ ] Add Mastra dependencies to package.json
- [ ] Create template mapping for 50+ Mastra examples  
- [ ] Update project generation to use Mastra templates
- [ ] Test template-based project creation

### **Week 2: Core Framework Integration**
- [ ] Replace enhanced-model-client with MastraEnhancedClient
- [ ] Implement specialized agents (code review, project generation)
- [ ] Add RAG-powered contextual assistance
- [ ] Configure multi-provider support through LiteLLM

### **Week 3: Workflow Implementation**
- [ ] Deploy Mastra workflow engine
- [ ] Implement AI project generation workflow
- [ ] Add code review workflow with fault tolerance
- [ ] Configure workflow observability

### **Week 4: Advanced Features**
- [ ] Add multi-modal capabilities (image-to-code, voice commands)
- [ ] Integrate Langfuse observability
- [ ] Set up usage tracking and cost monitoring
- [ ] Performance testing and optimization

## 🔗 **Key Benefits for VibeCode**

### **Immediate Value**
- **50+ Production Templates**: Ready-to-deploy AI agent examples
- **TypeScript Integration**: Perfect match for VibeCode's stack
- **Multi-LLM Support**: Works with all our AI providers

### **Long-term Value**  
- **Framework Standardization**: Replace custom AI code with battle-tested framework
- **Observability**: Built-in monitoring and cost tracking
- **Scalability**: Workflow engine handles complex AI operations
- **Community**: 15.1k+ stars, active development, MIT license

### **Developer Experience**
- **Type Safety**: Full TypeScript support with proper types
- **Documentation**: Comprehensive docs and examples
- **Testing**: Built-in testing utilities for AI workflows
- **Debugging**: Advanced debugging tools for agent behavior

## 📚 **Resources**

- **Mastra Documentation**: https://docs.mastra.ai/
- **GitHub Repository**: https://github.com/mastra-ai/mastra
- **Example Templates**: https://github.com/mastra-ai/mastra/tree/main/examples
- **TypeScript Integration**: https://docs.mastra.ai/typescript
- **Workflow Engine**: https://docs.mastra.ai/workflows
- **Observability Guide**: https://docs.mastra.ai/observability

**Next Steps**: Start with template integration for immediate value, then progressively replace custom AI infrastructure with Mastra's battle-tested framework. 
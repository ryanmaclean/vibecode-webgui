/**
 * AI Project Generator Service
 * Core functionality for Lovable.ai clone - generates projects from natural language prompts
 */

import OpenAI from 'openai'
import { z } from 'zod'

// Project template schema
const ProjectTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  framework: z.enum(['react', 'nextjs', 'vue', 'angular', 'svelte', 'node', 'python', 'go']),
  features: z.array(z.string()),
  dependencies: z.array(z.string()),
  structure: z.record(z.string()), // file path -> content
  dockerfile: z.string().optional(),
  readme: z.string()
})

const ProjectGenerationRequestSchema = z.object({
  prompt: z.string().min(10, 'Prompt must be at least 10 characters'),
  framework: z.string().optional(),
  features: z.array(z.string()).optional(),
  complexity: z.enum(['simple', 'moderate', 'complex']).default('moderate')
})

export type ProjectTemplate = z.infer<typeof ProjectTemplateSchema>
export type ProjectGenerationRequest = z.infer<typeof ProjectGenerationRequestSchema>

export class AIProjectGenerator {
  private openai: OpenAI
  private templates: Map<string, ProjectTemplate> = new Map()

  constructor(apiKey?: string) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required for AI project generation')
    }
    
    this.openai = new OpenAI({
      apiKey,
      timeout: 60000 // 60 second timeout for project generation
    })

    this.initializeTemplates()
  }

  /**
   * Generate a complete project from natural language prompt
   */
  async generateProject(request: ProjectGenerationRequest): Promise<ProjectTemplate> {
    const validatedRequest = ProjectGenerationRequestSchema.parse(request)
    
    logger.info(`🤖 Generating project from prompt: "${validatedRequest.prompt}"`)

    try {
      // Step 1: Analyze prompt and determine project type
      const projectAnalysis = await this.analyzePrompt(validatedRequest.prompt)
      
      // Step 2: Select and customize base template
      const baseTemplate = await this.selectTemplate(projectAnalysis)
      
      // Step 3: Generate project structure and files
      const generatedProject = await this.generateProjectStructure(
        baseTemplate,
        validatedRequest,
        projectAnalysis
      )
      
      // Step 4: Validate and return complete project
      return ProjectTemplateSchema.parse(generatedProject)
      
    } catch (error) {
      logger.error('❌ AI project generation failed:', error)
      throw new Error(`Project generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Analyze natural language prompt to understand project requirements
   */
  private async analyzePrompt(prompt: string) {
    const analysisPrompt = `
Analyze this project request and extract structured information:

User Request: "${prompt}"

Please analyze and return a JSON object with:
{
  "projectType": "web-app" | "api" | "cli" | "mobile" | "desktop" | "library",
  "framework": "react" | "nextjs" | "vue" | "angular" | "svelte" | "node" | "python" | "go" | null,
  "features": ["auth", "database", "api", "ui", "testing", "deployment", etc.],
  "complexity": "simple" | "moderate" | "complex",
  "domain": "ecommerce" | "social" | "productivity" | "analytics" | "cms" | "other",
  "description": "Clear description of what the user wants to build"
}

Focus on understanding the core functionality and technical requirements.
`

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: 'You are an expert software architect analyzing project requirements.' },
        { role: 'user', content: analysisPrompt }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    })

    const analysisText = response.choices[0]?.message?.content
    if (!analysisText) {
      throw new Error('Failed to analyze project prompt')
    }

    try {
      return JSON.parse(analysisText)
    } catch (error) {
      logger.error('Failed to parse project analysis:', analysisText)
      throw new Error('Invalid project analysis response')
    }
  }

  /**
   * Select the best base template for the project
   */
  private async selectTemplate(analysis: any): Promise<ProjectTemplate> {
    const { framework, projectType, complexity } = analysis

    // Template selection logic
    let templateId = 'basic-react'
    
    if (framework === 'nextjs' || (projectType === 'web-app' && complexity !== 'simple')) {
      templateId = 'nextjs-fullstack'
    } else if (framework === 'node' || projectType === 'api') {
      templateId = 'node-api'
    } else if (framework === 'python') {
      templateId = 'python-fastapi'
    } else if (framework === 'react') {
      templateId = 'react-spa'
    }

    const template = this.templates.get(templateId)
    if (!template) {
      throw new Error(`Template ${templateId} not found`)
    }

    return template
  }

  /**
   * Generate complete project structure with AI assistance
   */
  private async generateProjectStructure(
    baseTemplate: ProjectTemplate,
    request: ProjectGenerationRequest,
    analysis: any
  ): Promise<ProjectTemplate> {
    const structurePrompt = `
Generate a complete project structure for this request:

Original Prompt: "${request.prompt}"
Project Analysis: ${JSON.stringify(analysis, null, 2)}
Base Template: ${baseTemplate.name}

Create a comprehensive project with:
1. Complete file structure with actual code content
2. Package.json with appropriate dependencies
3. Configuration files (tsconfig, eslint, etc.)
4. Component/module files with working implementations
5. README with setup instructions
6. Dockerfile for containerization

Return a JSON object with this structure:
{
  "id": "unique-project-id",
  "name": "Project Name",
  "description": "Detailed project description",
  "framework": "framework-name",
  "features": ["list", "of", "features"],
  "dependencies": ["list", "of", "npm/pip", "packages"],
  "structure": {
    "package.json": "file content",
    "src/index.ts": "file content",
    "src/components/App.tsx": "file content",
    // ... all project files with actual content
  },
  "dockerfile": "Dockerfile content",
  "readme": "Complete README.md content"
}

Make sure all code is production-ready and follows best practices.
`

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { 
          role: 'system', 
          content: 'You are an expert full-stack developer creating production-ready project templates.' 
        },
        { role: 'user', content: structurePrompt }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
      max_tokens: 4096
    })

    const projectText = response.choices[0]?.message?.content
    if (!projectText) {
      throw new Error('Failed to generate project structure')
    }

    try {
      const generatedProject = JSON.parse(projectText)
      
      // Merge with base template and add generated content
      return {
        ...baseTemplate,
        ...generatedProject,
        id: `generated-${Date.now()}`,
        structure: {
          ...baseTemplate.structure,
          ...generatedProject.structure
        }
      }
    } catch (error) {
      logger.error('Failed to parse generated project:', projectText)
      throw new Error('Invalid project generation response')
    }
  }

  /**
   * Initialize base project templates
   */
  private initializeTemplates() {
    // React SPA Template
    this.templates.set('react-spa', {
      id: 'react-spa',
      name: 'React Single Page Application',
      description: 'Modern React SPA with TypeScript, Vite, and best practices',
      framework: 'react',
      features: ['typescript', 'vite', 'tailwind', 'testing'],
      dependencies: ['react', 'react-dom', 'typescript', 'vite', 'tailwindcss', 'vitest'],
      structure: {
        'package.json': JSON.stringify({
          name: 'react-spa-project',
          version: '1.0.0',
          type: 'module',
          scripts: {
            dev: 'vite',
            build: 'tsc && vite build',
            preview: 'vite preview',
            test: 'vitest'
          }
        }, null, 2),
        'src/main.tsx': `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { logger } from '@/lib/logger';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)`
      },
      readme: '# React SPA Project\n\nGenerated with VibeCode AI Project Generator'
    })

    // Next.js Fullstack Template
    this.templates.set('nextjs-fullstack', {
      id: 'nextjs-fullstack',
      name: 'Next.js Fullstack Application',
      description: 'Full-stack Next.js app with API routes, database, and authentication',
      framework: 'nextjs',
      features: ['typescript', 'api-routes', 'prisma', 'nextauth', 'tailwind'],
      dependencies: ['next', 'react', 'react-dom', 'typescript', 'prisma', 'next-auth', 'tailwindcss'],
      structure: {
        'package.json': JSON.stringify({
          name: 'nextjs-fullstack-project',
          version: '1.0.0',
          scripts: {
            dev: 'next dev',
            build: 'next build',
            start: 'next start',
            lint: 'next lint'
          }
        }, null, 2),
        'src/app/page.tsx': `export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          Welcome to Your Next.js App
        </h1>
        <p className="text-xl text-gray-600">
          Generated with VibeCode AI Project Generator
        </p>
      </div>
    </div>
  )
}`
      },
      readme: '# Next.js Fullstack Project\n\nGenerated with VibeCode AI Project Generator'
    })

    // Node.js API Template
    this.templates.set('node-api', {
      id: 'node-api',
      name: 'Node.js REST API',
      description: 'RESTful API with Express, TypeScript, and database integration',
      framework: 'node',
      features: ['typescript', 'express', 'prisma', 'validation', 'testing'],
      dependencies: ['express', 'typescript', 'prisma', 'zod', 'jest', '@types/express'],
      structure: {
        'package.json': JSON.stringify({
          name: 'node-api-project',
          version: '1.0.0',
          scripts: {
            dev: 'ts-node src/server.ts',
            build: 'tsc',
            start: 'node dist/server.js',
            test: 'jest'
          }
        }, null, 2),
        'src/server.ts': `import express from 'express'
import { z } from 'zod'

const app = express()
const port = process.env.PORT || 3000

app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(port, () => {
  logger.info(\`🚀 Server running on port \${port}\`)
})`
      },
      readme: '# Node.js API Project\n\nGenerated with VibeCode AI Project Generator'
    })

    logger.info(`📚 Initialized ${this.templates.size} project templates`)
  }

  /**
   * Get available project templates
   */
  getAvailableTemplates(): ProjectTemplate[] {
    return Array.from(this.templates.values())
  }

  /**
   * Get template by ID
   */
  getTemplate(id: string): ProjectTemplate | undefined {
    return this.templates.get(id)
  }
}

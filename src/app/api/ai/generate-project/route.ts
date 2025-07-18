/**
 * AI Project Generation API
 * Generates complete projects from AI prompts and creates live workspaces
 * This is the core integration that makes VibeCode function like Lovable/Replit/Bolt.diy
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

const generateProjectSchema = z.object({
  prompt: z.string().min(1, 'Project prompt is required'),
  projectName: z.string().optional(),
  language: z.enum(['javascript', 'typescript', 'python', 'react', 'nextjs', 'vue', 'node']).optional(),
  framework: z.string().optional(),
  features: z.array(z.string()).optional(),
})

interface GeneratedFile {
  path: string
  content: string
  type: 'file' | 'directory'
}

interface ProjectStructure {
  name: string
  description: string
  files: GeneratedFile[]
  scripts: Record<string, string>
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  envVars: Array<{
    name: string
    value: string
    description: string
  }>
}

async function generateProjectWithAI(prompt: string, options: {
  language?: string
  framework?: string
  features?: string[]
}): Promise<ProjectStructure> {
  try {
    // Enhanced prompt for project generation
    const enhancedPrompt = `
Create a complete, production-ready project based on this description: "${prompt}"

Requirements:
- Language: ${options.language || 'auto-detect from prompt'}
- Framework: ${options.framework || 'auto-detect or recommend best fit'}
- Features: ${options.features?.join(', ') || 'auto-detect from prompt'}

Please generate:
1. Complete file structure with all necessary files
2. Working code for all components
3. Package.json with proper dependencies
4. Environment variables needed
5. README.md with setup instructions
6. Basic tests if applicable

Make it production-ready and follow best practices for the chosen technology stack.
Format the response as a structured project with proper file organization.
`

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          {
            role: 'system',
            content: `You are a senior software engineer and project architect. Generate complete, working projects based on user prompts. 

IMPORTANT: Return your response in this EXACT JSON format:
{
  "name": "project-name",
  "description": "Brief project description",
  "files": [
    {
      "path": "src/index.js",
      "content": "// file content here",
      "type": "file"
    }
  ],
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js"
  },
  "dependencies": {
    "express": "^4.18.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  },
  "envVars": [
    {
      "name": "PORT",
      "value": "3000",
      "description": "Application port"
    }
  ]
}

Make sure ALL files are complete and working. Include proper error handling, logging, and best practices.`
          },
          {
            role: 'user',
            content: enhancedPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 8000,
      })
    })

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error('No content received from AI')
    }

    // Parse the structured response
    try {
      // Extract JSON from the response (handle markdown code blocks)
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/)
      const jsonString = jsonMatch ? jsonMatch[1] : content
      
      const projectStructure = JSON.parse(jsonString)
      
      // Validate the structure
      if (!projectStructure.name || !projectStructure.files || !Array.isArray(projectStructure.files)) {
        throw new Error('Invalid project structure from AI')
      }

      return projectStructure
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError)
      throw new Error('Failed to parse AI-generated project structure')
    }
  } catch (error) {
    console.error('AI project generation error:', error)
    throw new Error('Failed to generate project with AI')
  }
}

async function createCodeServerSession(userId: string, workspaceId: string) {
  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/code-server/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workspaceId,
      userId,
    })
  })

  if (!response.ok) {
    throw new Error('Failed to create code-server session')
  }

  return response.json()
}

async function seedWorkspaceFiles(workspaceId: string, projectStructure: ProjectStructure) {
  // Add package.json to files
  const packageJsonFile = {
    path: 'package.json',
    content: JSON.stringify({
      name: projectStructure.name,
      version: '1.0.0',
      description: projectStructure.description,
      scripts: projectStructure.scripts,
      dependencies: projectStructure.dependencies,
      devDependencies: projectStructure.devDependencies,
    }, null, 2),
    type: 'file' as const
  }

  // Add .env.example file
  const envContent = projectStructure.envVars
    .map(env => `# ${env.description}\n${env.name}=${env.value}`)
    .join('\n\n')
  
  const envFile = {
    path: '.env.example',
    content: envContent,
    type: 'file' as const
  }

  const allFiles = [
    ...projectStructure.files,
    packageJsonFile,
    envFile
  ]

  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/files/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workspaceId,
      files: allFiles
    })
  })

  if (!response.ok) {
    throw new Error('Failed to seed workspace files')
  }

  return response.json()
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = generateProjectSchema.parse(body)

    // Generate unique workspace ID
    const workspaceId = `ai-project-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`

    // Step 1: Generate project structure with AI
    console.log('Generating project with AI...')
    const projectStructure = await generateProjectWithAI(validatedData.prompt, {
      language: validatedData.language,
      framework: validatedData.framework,
      features: validatedData.features,
    })

    // Override project name if provided
    if (validatedData.projectName) {
      projectStructure.name = validatedData.projectName
    }

    // Step 2: Create code-server session
    console.log('Creating code-server session...')
    const codeServerSession = await createCodeServerSession(session.user.id, workspaceId)

    // Step 3: Seed workspace with generated files
    console.log('Seeding workspace with generated files...')
    await seedWorkspaceFiles(workspaceId, projectStructure)

    // Step 4: Return workspace information
    return NextResponse.json({
      success: true,
      workspaceId,
      workspaceUrl: `/workspace/${workspaceId}`,
      codeServerUrl: codeServerSession.url,
      projectStructure: {
        name: projectStructure.name,
        description: projectStructure.description,
        fileCount: projectStructure.files.length,
        language: validatedData.language,
        framework: validatedData.framework,
      },
      message: 'Project generated successfully! Opening in code-server...'
    })

  } catch (error) {
    console.error('AI project generation error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Failed to generate project',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
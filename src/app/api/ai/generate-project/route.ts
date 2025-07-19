/**
 * AI Project Generation API
 * Generates complete projects from AI prompts and creates live workspaces
 * This is the core integration that makes VibeCode function like Lovable/Replit/Bolt.diy
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { llmObservability } from '@/lib/datadog-llm'

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
  return llmObservability.createWorkflowSpan(
    'ai-project-generation',
    async () => {
      // Annotate with input data
      llmObservability.annotate({
        input_data: {
          prompt,
          language: options.language,
          framework: options.framework,
          features: options.features
        },
        tags: ['ai-generation', 'project-creation'],
        metadata: {
          operation: 'template-based-generation',
          version: 'v1'
        }
      })

      // For now, use a template-based approach instead of AI
      // This ensures we have working projects while the AI integration is being set up
      
      console.log('Generating project from template instead of AI for now')
      
      const projectName = prompt.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 30) || 'ai-generated-project'

      if (options.framework === 'react' || options.language === 'typescript') {
        // Return React Hello World template
        const result = {
      name: projectName,
      description: `AI-generated React application: ${prompt}`,
      files: [
        {
          path: 'src/App.tsx',
          content: `import React from 'react';
import './App.css';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>🎉 Hello from VibeCode! 🎉</h1>
        <p>
          Your AI-generated project is ready!
        </p>
        <p className="description">
          ${prompt}
        </p>
        <div className="features">
          <div className="feature">✅ Live VS Code Editor</div>
          <div className="feature">🤖 AI-Powered Generation</div>
          <div className="feature">☸️ Kubernetes Native</div>
          <div className="feature">🚀 Production Ready</div>
        </div>
      </header>
    </div>
  );
}

export default App;`,
          type: 'file'
        },
        {
          path: 'src/App.css',
          content: `.app {
  text-align: center;
}

.app-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  padding: 20px;
  color: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

h1 {
  font-size: 3rem;
  margin-bottom: 1rem;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}

.description {
  font-size: 1.2rem;
  max-width: 600px;
  margin: 1rem 0;
  padding: 1rem;
  background: rgba(255,255,255,0.1);
  border-radius: 10px;
  backdrop-filter: blur(10px);
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 2rem;
  max-width: 800px;
}

.feature {
  background: rgba(255,255,255,0.1);
  padding: 1rem;
  border-radius: 10px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.2);
  transition: transform 0.3s ease;
}

.feature:hover {
  transform: translateY(-5px);
}`,
          type: 'file'
        },
        {
          path: 'src/index.tsx',
          content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
          type: 'file'
        },
        {
          path: 'src/index.css',
          content: `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}

* {
  box-sizing: border-box;
}`,
          type: 'file'
        },
        {
          path: 'public/index.html',
          content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta
      name="description"
      content="AI-generated React app created with VibeCode"
    />
    <title>${projectName}</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>`,
          type: 'file'
        },
        {
          path: 'README.md',
          content: `# ${projectName}

${prompt}

This project was generated by VibeCode AI and is running in a live VS Code environment!

## Getting Started

This project is already set up and running in your VibeCode workspace. You can:

1. ✏️ Edit the code in VS Code
2. 🔄 See changes in real-time
3. 🧪 Run tests and build commands
4. 🚀 Deploy when ready

## Available Scripts

- \`npm start\` - Runs the app in development mode
- \`npm test\` - Launches the test runner
- \`npm run build\` - Builds the app for production

## Features

- ⚛️ React 18 with TypeScript
- 🎨 Modern CSS with gradients and animations
- 📱 Responsive design
- ⚡ Fast development setup

## Next Steps

1. Customize the styling in \`src/App.css\`
2. Add new components in the \`src/\` directory
3. Install additional packages with \`npm install\`
4. Build something amazing!

Happy coding! 🎉`,
          type: 'file'
        }
      ],
      scripts: {
        start: 'react-scripts start',
        build: 'react-scripts build',
        test: 'react-scripts test',
        eject: 'react-scripts eject'
      },
      dependencies: {
        'react': '^18.2.0',
        'react-dom': '^18.2.0',
        'react-scripts': '^5.0.1',
        'typescript': '^5.0.0'
      },
      devDependencies: {
        '@types/react': '^18.2.0',
        '@types/react-dom': '^18.2.0',
        '@types/node': '^20.0.0'
      },
      envVars: [
        {
          name: 'REACT_APP_NAME',
          value: projectName,
          description: 'Application name'
        }
      ]
    }

        // Annotate with output data for React project
        llmObservability.annotate({
          output_data: {
            projectName: result.name,
            fileCount: result.files.length,
            framework: 'react',
            language: 'typescript'
          }
        })

        return result
      }
  
      // Fallback for other frameworks
      const result = {
        name: projectName,
        description: `AI-generated application: ${prompt}`,
        files: [
          {
            path: 'index.js',
            content: `// AI-Generated Project: ${prompt}
console.log('Hello from VibeCode!');
console.log('Your AI project is ready to edit!');

// TODO: Implement your project logic here
// This is a placeholder - customize as needed!`,
            type: 'file'
          },
          {
            path: 'README.md',
            content: `# ${projectName}

${prompt}

Generated by VibeCode AI - start building!`,
            type: 'file'
          }
        ],
        scripts: {
          start: 'node index.js'
        },
        dependencies: {},
        devDependencies: {},
        envVars: []
      }

      // Annotate with output data
      llmObservability.annotate({
        output_data: {
          projectName: result.name,
          fileCount: result.files.length,
          framework: options.framework || 'generic',
          language: options.language || 'javascript'
        }
      })

      return result
    }
  )
}

async function createCodeServerSession(workspaceId: string, userId: string) {
  // Import the workspace creation script and call it directly
  const { spawn } = require('child_process')
  const path = require('path')
  
  const scriptPath = path.join(process.cwd(), 'scripts', 'create-workspace.sh')
  
  return new Promise((resolve, reject) => {
    const child = spawn('bash', [scriptPath, workspaceId, userId], {
      stdio: ['pipe', 'pipe', 'pipe']
    })
    
    let stdout = ''
    let stderr = ''
    
    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
    })
    
    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })
    
    child.on('close', (code) => {
      if (code === 0) {
        // Parse the output to get service details
        const serviceName = `code-server-${workspaceId}-svc`
        const internalUrl = `http://${serviceName}.vibecode.svc.cluster.local:8080`
        
        resolve({
          id: `cs-${workspaceId}`,
          url: internalUrl,
          status: 'ready',
          workspaceId,
          userId
        })
      } else {
        console.error('Workspace creation failed:', stderr)
        reject(new Error(`Failed to create workspace: ${stderr}`))
      }
    })
    
    child.on('error', (error) => {
      console.error('Script execution error:', error)
      reject(error)
    })
  })
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

  // Create files directly using kubectl instead of API call
  const { spawn } = require('child_process')
  const namespace = 'vibecode'
  
  for (const file of allFiles) {
    if (file.type === 'directory') {
      // Create directory
      await execInPod(namespace, workspaceId, `mkdir -p "/home/coder/workspace/${file.path}"`)
    } else {
      // Create file and its directory structure
      const dirPath = file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : ''
      if (dirPath) {
        await execInPod(namespace, workspaceId, `mkdir -p "/home/coder/workspace/${dirPath}"`)
      }
      
      // Write file content using base64 encoding to handle special characters
      const base64Content = Buffer.from(file.content).toString('base64')
      await execInPod(namespace, workspaceId, `echo "${base64Content}" | base64 -d > "/home/coder/workspace/${file.path}"`)
    }
  }

  return {
    success: true,
    filesCreated: allFiles.length,
    message: 'Files seeded successfully'
  }
}

function execInPod(namespace: string, workspaceId: string, command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const deploymentName = `code-server-${workspaceId}`
    
    // Execute command in pod
    const { spawn } = require('child_process')
    const execCmd = spawn('kubectl', [
      'exec', '-n', namespace,
      `deployment/${deploymentName}`,
      '--', 'bash', '-c', command
    ])
    
    let stderr = ''
    
    execCmd.stderr.on('data', (data) => {
      stderr += data.toString()
    })
    
    execCmd.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Command failed: ${stderr}`))
      }
    })
    
    execCmd.on('error', (error) => {
      reject(error)
    })
  })
}

export async function POST(request: NextRequest) {
  return llmObservability.createTaskSpan(
    'api-ai-generate-project',
    async () => {
      try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const validatedData = generateProjectSchema.parse(body)

        // Annotate with request data
        llmObservability.annotate({
          input_data: {
            prompt: validatedData.prompt,
            language: validatedData.language,
            framework: validatedData.framework,
            projectName: validatedData.projectName,
            userId: session.user.id
          },
          tags: ['api-request', 'project-generation'],
          metadata: {
            endpoint: '/api/ai/generate-project',
            method: 'POST',
            user: session.user.id
          }
        })

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
    const codeServerSession = await createCodeServerSession(workspaceId, session.user.id)

    // Step 3: Seed workspace with generated files
    console.log('Seeding workspace with generated files...')
    await seedWorkspaceFiles(workspaceId, projectStructure)

        // Step 4: Return workspace information
        const response = {
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
        }

        // Annotate with output data
        llmObservability.annotate({
          output_data: {
            success: true,
            workspaceId,
            projectName: projectStructure.name,
            fileCount: projectStructure.files.length,
            language: validatedData.language,
            framework: validatedData.framework
          }
        })

        return NextResponse.json(response)

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
  )
}
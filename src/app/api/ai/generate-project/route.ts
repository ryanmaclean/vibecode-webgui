/**
 * AI Project Generation API Route
 * Core API endpoint for Lovable.ai clone functionality
 */

import { NextRequest, NextResponse } from 'next/server'
import { AIProjectGenerator } from '@/lib/services/ai-project-generator'
import { z } from 'zod'

const ProjectGenerationRequestSchema = z.object({
  prompt: z.string().min(10, 'Prompt must be at least 10 characters'),
  framework: z.string().optional(),
  features: z.array(z.string()).optional(),
  complexity: z.enum(['simple', 'moderate', 'complex']).default('moderate'),
  userId: z.string().optional()
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

interface GenerateProjectOptions {
  language?: string;
  framework?: string;
  features?: string[];
  onProgress?: (progress: number, message: string) => void;
}

export async function generateProjectWithAI(
  prompt: string, 
  options: GenerateProjectOptions = {}
): Promise<ProjectStructure> {
  return llmObservability.createWorkflowSpan(
    'ai-project-generation',
    async (span: Span | undefined) => {
      const systemPrompt = `
<system>
As an expert cloud-native software architect and senior full-stack developer, your role is to help users create production-ready applications on the VibeCode platform. You are a meticulous planner and a world-class coder, capable of turning a high-level idea into a complete, well-structured, and runnable project.

**Core Directives:**
1.  **Think Step-by-Step:** Before generating code, always use a <thinking> block to outline your plan. Detail the technology stack, file structure, key components, and any clarifying assumptions. This plan is for internal review and will not be shown to the user.
2.  **Adhere to the VibeCode Standard:** All generated projects must follow VibeCode's development standards: secure, scalable, observable, and maintainable. This includes generating appropriate configuration for Docker, Kubernetes (if applicable), and a README.md with setup instructions.
3.  **Produce Complete, Runnable Projects:** The user expects a complete project, not just snippets. Ensure all necessary files, dependencies (\[package.json\](cci:7://file:///Users/ryan.maclean/vibecode-webgui/package.json:0:0-0:0), \`requirements.txt\`, etc.), and boilerplate are included.
4.  **Strictly Adhere to JSON Output:** Your final output MUST be a single JSON object. Do not include any text or explanation outside of the JSON structure. The JSON object must conform to the following structure, including a 'files' array where each object has a 'path' and 'content'.

**Final Output JSON Structure:**
{
  "name": "project-name",
  "description": "A brief description of the project.",
  "files": [
    {
      "path": "package.json",
      "content": "{\\"name\\": \\"my-react-app\\", \\"version\\": \\"0.1.0\\", ...}"
    },
    {
      "path": "src/App.js",
      "content": "import React from 'react'; ..."
    }
  ],
  "scripts": { "start": "node index.js" },
  "dependencies": { "express": "4.17.1" },
  "devDependencies": { "nodemon": "2.0.7" },
  "envVars": [ { "name": "PORT", "value": "3000", "description": "The port to run the server on." } ]
}
</system>
`;

      const userMessage = `
Generate a new project based on the following prompt.
- **Prompt:** ${prompt}
- **Language:** ${options.language || 'Not specified'}
- **Framework:** ${options.framework || 'Not specified'}
- **Features:** ${options.features?.join(', ') || 'None'}
`;

      span?.setTag('llm.request.model', 'claude-3.5-sonnet');
      span?.setTag('llm.request.provider', 'openrouter');
      llmObservability.annotate({
        input_data: {
          prompt,
          language: options.language,
          framework: options.framework,
          features: options.features
        },
        tags: ['ai-generation', 'project-creation'],
      });

      try {
        // Report starting generation
        options.onProgress?.(0, 'Starting project generation...');
        
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`
          },
          body: JSON.stringify({
            model: "anthropic/claude-3.5-sonnet",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage }
            ],
            response_format: { type: "json_object" },
            stream: false
          })
        });

        if (!response.ok) {
          const errorBody = await response.text();
          console.error('OpenRouter API Error:', response.status, errorBody);
          span?.setTag('error', true);
          span?.setTag('error.message', `OpenRouter API failed with status ${response.status}`);
          span?.setTag('error.stack', errorBody);
          throw new Error(`OpenRouter API failed: ${response.status} ${response.statusText}`);
        }

        options.onProgress?.(25, 'Generating project structure...');
        
        const data: { choices: { message: { content: string } }[] } = await response.json();
        const content = data.choices[0].message.content;
        
        options.onProgress?.(50, 'Processing generated files...');
        
        const parsedContent: {
          name?: string;
          description?: string;
          files: { path: string; content: string }[];
          scripts?: Record<string, string>;
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
          envVars?: Array<{ name: string; value: string; description: string; }>;
        } = JSON.parse(content);

        llmObservability.annotate({
          output_data: {
            fileCount: parsedContent.files?.length || 0,
            projectName: parsedContent.name || 'Unknown'
          }
        });

        if (!parsedContent.files || !Array.isArray(parsedContent.files)) {
            throw new Error("AI response is missing 'files' array.");
        }

        const generatedFiles: GeneratedFile[] = parsedContent.files.map(file => {
            if (typeof file.path !== 'string' || typeof file.content !== 'string') {
                throw new Error('Invalid file structure in AI response.');
            }
            return {
                ...file,
                type: 'file'
            };
        });

        const result = {
          name: parsedContent.name || 'ai-generated-project',
          description: parsedContent.description || `AI-generated project for: ${prompt}`,
          files: generatedFiles,
          scripts: parsedContent.scripts || {},
          dependencies: parsedContent.dependencies || {},
          devDependencies: parsedContent.devDependencies || {},
          envVars: parsedContent.envVars || [],
        };
        
        options.onProgress?.(75, 'Finalizing project structure...');
        return result;

      } catch (error: unknown) {
        console.error('Error during AI project generation:', error);
        span?.setTag('error', true);
        if (error instanceof Error) {
            span?.setTag('error.message', error.message);
            span?.setTag('error.stack', error.stack);
        } else {
            span?.setTag('error.message', 'An unknown error occurred during AI project generation.');
        }
        throw error;
      }
    }
  );
}

async function seedWorkspaceFiles(workspaceId: string, projectStructure: ProjectStructure): Promise<void> {
  const namespace = 'default';
  const baseDir = path.join('/tmp/workspaces', workspaceId);

  await mkdir(baseDir, { recursive: true });

  for (const file of projectStructure.files) {
    const filePath = path.join(baseDir, file.path);
    const dirName = path.dirname(filePath);

    if (file.type === 'directory') {
      await mkdir(filePath, { recursive: true });
    } else {
      await mkdir(dirName, { recursive: true });
      await writeFile(filePath, file.content, 'utf-8');
    }
  }

  const podName = await getPodName(namespace, `app.kubernetes.io/instance=code-server-${workspaceId}`);
  if (!podName) {
    throw new Error('Could not find running pod for workspace.');
  }

  await execKubectlCp(baseDir, `${namespace}/${podName}:/home/coder/project`);
}

async function getPodName(namespace: string, labelSelector: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const kubectl = spawn('kubectl', ['get', 'pods', '-n', namespace, '-l', labelSelector, '-o', 'jsonpath={.items[0].metadata.name}']);
    let podName = '';
    let errorOutput = '';

    kubectl.stdout.on('data', (data) => { podName += data.toString(); });
    kubectl.stderr.on('data', (data) => { errorOutput += data.toString(); });

    kubectl.on('close', (code: number) => {
      if (code === 0 && podName.trim()) {
        resolve(podName.trim());
      } else if (errorOutput) {
        reject(new Error(`Failed to get pod name: ${errorOutput}`));
      } else {
        resolve(null);
      }
    });

    kubectl.on('error', (err) => reject(err));
  });
}

async function execKubectlCp(source: string, destination: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const kubectl = spawn('kubectl', ['cp', source, destination]);
    let stderr = '';
    kubectl.stderr.on('data', (data) => { stderr += data.toString(); });
    kubectl.on('close', (code: number) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`kubectl cp failed: ${stderr}`));
      }
    });
    kubectl.on('error', (err) => reject(err));
  });
}

async function execInPod(namespace: string, workspaceId: string, command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const deploymentName = `code-server-${workspaceId}`;
    const execCmd = spawn('kubectl', ['exec', '-n', namespace, `deployment/${deploymentName}`, '--', 'bash', '-c', command]);
    let stderr = '';
    execCmd.stderr.on('data', (data) => { stderr += data.toString(); });
    execCmd.on('close', (code: number) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed: ${stderr}`));
      }
    });
    execCmd.on('error', (error) => reject(error));
  });
}

// Placeholder for the real implementation
async function createCodeServerSession(workspaceId: string, userId: string): Promise<{ url: string }> {
  console.log(`Creating code-server session for workspace ${workspaceId} and user ${userId}`);
  // In a real implementation, this would call the code-server management service
  return Promise.resolve({ url: `https://code.vibecode.com/w/${workspaceId}` });
}

// Helper function to create a streaming response
interface ProgressData {
  [key: string]: unknown;
  message: string;
  progress?: number;
}

// Polyfill TransformStream for Node.js environments
if (typeof TransformStream === 'undefined') {
  const { TransformStream } = require('stream/web');
  global.TransformStream = TransformStream;
}

function createStreamingResponse() {
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  
  const sendProgress = (status: string, data: ProgressData) => {
    writer.write(JSON.stringify({ status, ...data }) + '\n');
  };

  return {
    stream: stream.readable,
    sendProgress,
    close: () => {
      try {
        writer.close();
      } catch (error) {
        // WritableStream already closed or in invalid state
        console.warn('WritableStream close error (expected in tests):', error.message);
      }
    },
  };
}

export async function POST(request: NextRequest) {
  // Create a streaming response
  const { stream, sendProgress, close } = createStreamingResponse();
  
  // Start processing in the background
  (async () => {
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        sendProgress('error', { 
          message: 'Unauthorized: Please sign in to generate projects',
          error: 'Unauthorized',
          progress: 0
        });
        try {
          return close();
        } catch (error) {
          console.warn('WritableStream close error (expected in tests):', error.message);
        }
        return; // Stop processing
      }
      const userId = session.user.id;

    // Parse and validate request
    const body = await request.json()
    const validatedRequest = ProjectGenerationRequestSchema.parse(body)

    console.log(`📝 Generating project for prompt: "${validatedRequest.prompt}"`)

      // Override project name if provided
      if (validatedData.projectName) {
        projectStructure.name = validatedData.projectName;
      }

      // Step 2: Seed workspace with generated files
      sendProgress('seeding', { 
        message: 'Creating workspace files...',
        progress: 80
      });
      
      await seedWorkspaceFiles(workspaceId, projectStructure);

      // Step 3: Install dependencies (stream output)
      sendProgress('installing', { 
        message: 'Installing dependencies...',
        progress: 85
      });
      
      await execInPod('default', workspaceId, 'npm install');

      // Step 4: Create a code-server session
      sendProgress('finalizing', { 
        message: 'Preparing your development environment...',
        progress: 95
      });
      
      const codeServerSession = await createCodeServerSession(workspaceId, userId);

      // Calculate generation time
      const generationTime = Date.now() - startTime;
      
      // Send completion event
      sendProgress('completed', {
        message: 'Project generated successfully!',
        progress: 100,
        workspaceId,
        projectName: projectStructure.name,
        generationTime,
        codeServerUrl: codeServerSession.url,
        projectStructure: {
          name: projectStructure.name,
          description: projectStructure.description,
          fileCount: projectStructure.files.length,
          language: validatedData.language,
          framework: validatedData.framework,
        }
      });
      
      // Log successful generation
      llmObservability.annotate({
        input_data: {
          prompt: validatedData.prompt,
          language: validatedData.language,
          framework: validatedData.framework,
          projectName: validatedData.projectName,
          userId
        },
        output_data: {
          success: true,
          workspaceId,
          projectName: projectStructure.name,
          fileCount: projectStructure.files.length,
          generationTime,
          language: validatedData.language,
          framework: validatedData.framework
        },
        tags: ['api-request', 'project-generation', 'success'],
        metadata: {
          endpoint: '/api/ai/generate-project',
          method: 'POST',
          user: userId,
          generationTime: `${generationTime}ms`
        }
      });
      
    } catch (error) {
      console.error('AI project generation error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorDetails = error instanceof z.ZodError ? error.errors : undefined;
      
      sendProgress('error', {
        error: 'Failed to generate project',
        message: errorMessage,
        details: errorDetails,
        recoveryOptions: [
          { label: 'Try Again', action: 'retry' },
          { label: 'Modify Prompt', action: 'modify' },
          { label: 'Contact Support', action: 'support' }
        ]
      });
      
      // Log the error
      llmObservability.annotate({
        input_data: { error: true },
        output_data: { error: errorMessage },
        metadata: {
          endpoint: '/api/ai/generate-project',
          method: 'POST',
          error_type: error?.constructor?.name || 'UnknownError',
          error_details: errorDetails
        },
        tags: ['api-request', 'project-generation', 'error']
      });
      
    } finally {
      // Close the stream
      try {
        close();
      } catch (error) {
        console.warn('WritableStream close error (expected in tests):', error.message);
      }
    }

    // Initialize AI project generator
    const generator = new AIProjectGenerator(openaiApiKey)

    // Generate project
    const startTime = Date.now()
    const generatedProject = await generator.generateProject(validatedRequest)
    const generationTime = Date.now() - startTime

    console.log(`✅ Project generated successfully in ${generationTime}ms`)
    console.log(`📊 Generated project: ${generatedProject.name} (${generatedProject.framework})`)
    console.log(`📁 Files generated: ${Object.keys(generatedProject.structure).length}`)

    // Return generated project
    return NextResponse.json({
      success: true,
      project: generatedProject,
      metadata: {
        generationTime,
        filesGenerated: Object.keys(generatedProject.structure).length,
        framework: generatedProject.framework,
        features: generatedProject.features
      }
    })

  } catch (error) {
    console.error('❌ Project generation failed:', error)

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request format',
          details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        },
        { status: 400 }
      )
    }

    // Handle AI service errors
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'AI service authentication failed' },
          { status: 401 }
        )
      }

      if (error.message.includes('rate limit') || error.message.includes('quota')) {
        return NextResponse.json(
          { error: 'AI service rate limit exceeded. Please try again later.' },
          { status: 429 }
        )
      }

      if (error.message.includes('timeout')) {
        return NextResponse.json(
          { error: 'Project generation timed out. Please try a simpler prompt.' },
          { status: 408 }
        )
      }
    }

    // Generic error response
    return NextResponse.json(
      { 
        error: 'Project generation failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY || process.env.AZURE_OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json({
        available: false,
        reason: 'No AI API key configured'
      })
    }

    // Initialize generator to get available templates
    const generator = new AIProjectGenerator(openaiApiKey)
    const templates = generator.getAvailableTemplates()

    return NextResponse.json({
      available: true,
      service: 'AI Project Generator',
      templates: templates.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        framework: t.framework,
        features: t.features
      })),
      supportedFrameworks: ['react', 'nextjs', 'vue', 'angular', 'svelte', 'node', 'python', 'go'],
      complexityLevels: ['simple', 'moderate', 'complex']
    })
  } catch (error) {
    console.error('❌ Failed to get project generation info:', error)
    return NextResponse.json({
      available: false,
      reason: 'Service initialization failed'
    })
  }
}
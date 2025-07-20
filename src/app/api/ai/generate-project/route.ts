/**
 * AI Project Generation API
 * Generates complete projects from AI prompts and creates live workspaces
 * This is the core integration that makes VibeCode function like Lovable/Replit/Bolt.diy
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';
import { llmObservability } from '@/lib/datadog-llm';

import { Span } from 'dd-trace';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

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
  language?: string;
  framework?: string;
  features?: string[];
}): Promise<ProjectStructure> {
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

        const data: { choices: { message: { content: string } }[] } = await response.json();
        const content = data.choices[0].message.content;
        
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

        return {
          name: parsedContent.name || 'ai-generated-project',
          description: parsedContent.description || `AI-generated project for: ${prompt}`,
          files: generatedFiles,
          scripts: parsedContent.scripts || {},
          dependencies: parsedContent.dependencies || {},
          devDependencies: parsedContent.devDependencies || {},
          envVars: parsedContent.envVars || [],
        };

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

export async function POST(request: NextRequest) {
  return llmObservability.createTaskSpan(
    'api-ai-generate-project',
    async (span?: Span) => {
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

        // Step 2: Seed workspace with generated files
        console.log('Seeding workspace with generated files...')
        await seedWorkspaceFiles(workspaceId, projectStructure)

        // Step 3: Run npm install in the pod
        await execInPod('default', workspaceId, 'npm install');

        // Step 4: Create a code-server session
        const codeServerSession: { url: string } = await createCodeServerSession(workspaceId, session.user.id);
        span?.setTag('code_server.session.url', codeServerSession.url);

        // Step 5: Return workspace information
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
            details: error instanceof Error ? error.message : 'Unknown error',
          },
          { status: 500 }
        )
      }
    }
  )
}
/**
 * AI Project Generation API
 * Generates complete projects from AI prompts and creates live workspaces
 * This is the core integration that makes VibeCode function like Lovable/Replit/Bolt.diy
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { llmObservability } from '@/lib/datadog-llm';
import { z } from 'zod';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import {
  generateProjectWithAI,
  generateProjectSchema,
  type ProjectStructure,
  type GeneratedFile
} from '@/lib/ai/project-generator';

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

      const body = await request.json();
      const validatedData = generateProjectSchema.parse(body);
      
      // Generate unique workspace ID
      const workspaceId = `ai-project-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      
      // Send initial progress
      sendProgress('initializing', { 
        message: 'Starting project generation...',
        workspaceId,
        timestamp: new Date().toISOString()
      });

      // Track timing for performance metrics
      const startTime = Date.now();
      
      // Step 1: Generate project structure with AI
      sendProgress('generating', { 
        message: 'Generating project structure...',
        progress: 20
      });
      
      const projectStructure = await generateProjectWithAI(validatedData.prompt, {
        language: validatedData.language,
        framework: validatedData.framework,
        features: validatedData.features,
        onProgress: (progress: number, message: string) => {
          sendProgress('generating', { 
            message,
            progress: 20 + Math.floor(progress * 0.6) // 20-80% for generation
          });
        }
      });

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
      const errorDetails = error instanceof z.ZodError ? error.issues : undefined;
      
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
  })();
  
  // Return the streaming response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
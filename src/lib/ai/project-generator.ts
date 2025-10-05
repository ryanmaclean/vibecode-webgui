/**
 * AI Project Generation Utilities
 * Core functions for generating complete projects from AI prompts
 */

import { z } from 'zod';
import { llmObservability } from '@/lib/datadog-llm';
import type { Span } from 'dd-trace';

export const generateProjectSchema = z.object({
  prompt: z.string().min(1, 'Project prompt is required'),
  projectName: z.string().optional(),
  language: z.enum(['javascript', 'typescript', 'python', 'react', 'nextjs', 'vue', 'node']).optional(),
  framework: z.string().optional(),
  features: z.array(z.string()).optional(),
})

export interface GeneratedFile {
  path: string
  content: string
  type: 'file' | 'directory'
}

export interface ProjectStructure {
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

export interface GenerateProjectOptions {
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
3.  **Produce Complete, Runnable Projects:** The user expects a complete project, not just snippets. Ensure all necessary files, dependencies (package.json, requirements.txt, etc.), and boilerplate are included.
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
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { z } from '@/lib/zod-compat';
import { createAPIRateLimit } from '@/lib/rate-limiting';
// import { logger } from '@/lib/logger';

const apiRateLimit = createAPIRateLimit(20) // 20 requests per minute - expensive operations

// Validation schema for security
const gradioRunSchema = z.object({
  code: z.string().min(1).max(1_000_000), // 1MB code limit
  port: z.number().int().min(3000).max(9999).optional(),
  share: z.boolean().optional()
});

// A simple in-memory store to keep track of running Gradio processes
const runningProcesses: Map<string, any> = new Map();

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = await apiRateLimit(request)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          'Retry-After': rateLimitResult.retryAfter?.toString() ?? '60',
        },
      }
    )
  }

  try {
    // Validate request body
    let validatedData;
    try {
      const body = await request.json();
      validatedData = gradioRunSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.warn('Gradio run validation failed', { errors: error.issues });
        return NextResponse.json(
          {
            error: 'Invalid request parameters',
            details: error.issues.map(e => ({
              field: e.path.join('.'),
              message: e.message
            }))
          },
          { status: 400 }
        );
      }
      throw error;
    }

    const { code } = validatedData;

    // Create a unique directory for this execution to isolate files
    const execId = crypto.randomUUID();
    const tempDir = path.join('/tmp', 'gradio-runs', execId);
    await fs.mkdir(tempDir, { recursive: true });

    // Write the user's code and a basic requirements file
    await fs.writeFile(path.join(tempDir, 'app.py'), code);
    await fs.writeFile(path.join(tempDir, 'requirements.txt'), 'gradio');

    // Install dependencies using pip
    const pipInstall = spawn('pip', ['install', '-r', 'requirements.txt'], { cwd: tempDir });

    await new Promise((resolve, reject) => {
      pipInstall.on('close', (code) => {
        if (code === 0) {
          // Debug log removed
          resolve(true);
        } else {
          reject(new Error('Failed to install dependencies. Check server logs.'));
        }
      });
      pipInstall.stderr.on('data', (data) => {
        // Server error logged
      });
    });

    // Run the Gradio app as a child process
    const gradioApp = spawn('python3', ['app.py'], { cwd: tempDir, detached: true });
    runningProcesses.set(execId, gradioApp); // Track the process

    // Wait for the Gradio URL to be printed to stdout
    const url = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Gradio app took too long to start.'));
      }, 30000); // 30-second timeout

      gradioApp.stdout.on('data', (data: Buffer) => {
        const output = data.toString();
        // Debug log removed
        const urlMatch = output.match(/Running on local URL: *(http:\/\/[^ ]+)/);
        if (urlMatch && urlMatch[1]) {
          clearTimeout(timeout);
          resolve(urlMatch[1]);
        }
      });

      gradioApp.stderr.on('data', (data: Buffer) => {
        const errorOutput = data.toString();
        // Server error logged
        clearTimeout(timeout);
        reject(new Error(`Gradio app failed: ${errorOutput.split('\n')[0]}`));
      });

      gradioApp.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    // Debug log removed
    return NextResponse.json({ url, execId });

  } catch (error) {
    // Server error logged
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: 'Failed to run Gradio app.', details: errorMessage }, { status: 500 });
  }
}

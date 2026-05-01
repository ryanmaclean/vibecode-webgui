import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { z } from '@/lib/zod-compat';
import { createAPIRateLimit } from '@/lib/rate-limiting';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic'
// import { logger } from '@/lib/logger';

const apiRateLimit = createAPIRateLimit(5) // 5 requests per minute - code execution is high-risk

// Validation schema for security
const gradioRunSchema = z.object({
  code: z.string().min(1).max(50_000), // 50KB code limit (tightened from 1MB)
  port: z.number().int().min(7860).max(7960).optional(), // Restrict to standard Gradio port range
  share: z.boolean().optional()
});

/**
 * C2 FIX: Dangerous Python patterns blocklist.
 * Blocks code that attempts OS access, arbitrary code execution, file I/O,
 * network access, process spawning, or module/attribute manipulation.
 */
const DANGEROUS_PYTHON_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  // OS and system access
  { pattern: /\bimport\s+os\b/, description: 'os module import' },
  { pattern: /\bfrom\s+os\b/, description: 'os module import' },
  { pattern: /\bimport\s+sys\b/, description: 'sys module import' },
  { pattern: /\bfrom\s+sys\b/, description: 'sys module import' },
  { pattern: /\bimport\s+subprocess\b/, description: 'subprocess module import' },
  { pattern: /\bfrom\s+subprocess\b/, description: 'subprocess module import' },
  { pattern: /\bimport\s+shutil\b/, description: 'shutil module import' },
  { pattern: /\bfrom\s+shutil\b/, description: 'shutil module import' },
  { pattern: /\bimport\s+signal\b/, description: 'signal module import' },
  { pattern: /\bfrom\s+signal\b/, description: 'signal module import' },
  { pattern: /\bimport\s+ctypes\b/, description: 'ctypes module import' },
  { pattern: /\bfrom\s+ctypes\b/, description: 'ctypes module import' },

  // Code execution primitives
  { pattern: /\bexec\s*\(/, description: 'exec() call' },
  { pattern: /\beval\s*\(/, description: 'eval() call' },
  { pattern: /\bcompile\s*\(/, description: 'compile() call' },
  { pattern: /\b__import__\s*\(/, description: '__import__() call' },
  { pattern: /\bimportlib\b/, description: 'importlib usage' },

  // File system access
  { pattern: /\bopen\s*\(/, description: 'open() call - use Gradio file components instead' },
  { pattern: /\bimport\s+pathlib\b/, description: 'pathlib module import' },
  { pattern: /\bfrom\s+pathlib\b/, description: 'pathlib module import' },
  { pattern: /\bimport\s+glob\b/, description: 'glob module import' },
  { pattern: /\bfrom\s+glob\b/, description: 'glob module import' },
  { pattern: /\bimport\s+shlex\b/, description: 'shlex module import' },
  { pattern: /\bfrom\s+shlex\b/, description: 'shlex module import' },
  { pattern: /\bimport\s+tempfile\b/, description: 'tempfile module import' },
  { pattern: /\bfrom\s+tempfile\b/, description: 'tempfile module import' },

  // Network access
  { pattern: /\bimport\s+socket\b/, description: 'socket module import' },
  { pattern: /\bfrom\s+socket\b/, description: 'socket module import' },
  { pattern: /\bimport\s+http\b/, description: 'http module import' },
  { pattern: /\bfrom\s+http\b/, description: 'http module import' },
  { pattern: /\bimport\s+urllib\b/, description: 'urllib module import' },
  { pattern: /\bfrom\s+urllib\b/, description: 'urllib module import' },
  { pattern: /\bimport\s+requests\b/, description: 'requests module import' },
  { pattern: /\bfrom\s+requests\b/, description: 'requests module import' },
  { pattern: /\bimport\s+aiohttp\b/, description: 'aiohttp module import' },
  { pattern: /\bfrom\s+aiohttp\b/, description: 'aiohttp module import' },
  { pattern: /\bimport\s+httpx\b/, description: 'httpx module import' },
  { pattern: /\bfrom\s+httpx\b/, description: 'httpx module import' },

  // Dangerous dunder/attribute manipulation (sandbox escape vectors)
  { pattern: /__subclasses__/, description: '__subclasses__ access' },
  { pattern: /__globals__/, description: '__globals__ access' },
  { pattern: /__builtins__/, description: '__builtins__ access' },
  { pattern: /__class__/, description: '__class__ access for sandbox escape' },
  { pattern: /\bgetattr\s*\(/, description: 'getattr() call' },
  { pattern: /\bsetattr\s*\(/, description: 'setattr() call' },
  { pattern: /\bdelattr\s*\(/, description: 'delattr() call' },

  // Process/threading
  { pattern: /\bimport\s+multiprocessing\b/, description: 'multiprocessing module import' },
  { pattern: /\bfrom\s+multiprocessing\b/, description: 'multiprocessing module import' },
  { pattern: /\bimport\s+threading\b/, description: 'threading module import' },
  { pattern: /\bfrom\s+threading\b/, description: 'threading module import' },

  // Pickle/deserialization (RCE vector)
  { pattern: /\bimport\s+pickle\b/, description: 'pickle module import (deserialization RCE)' },
  { pattern: /\bfrom\s+pickle\b/, description: 'pickle module import (deserialization RCE)' },
  { pattern: /\bimport\s+shelve\b/, description: 'shelve module import' },
  { pattern: /\bfrom\s+shelve\b/, description: 'shelve module import' },
  { pattern: /\bimport\s+marshal\b/, description: 'marshal module import' },
  { pattern: /\bfrom\s+marshal\b/, description: 'marshal module import' },
];

/**
 * C2 FIX: Validates that submitted code is a legitimate Gradio application
 * and does not contain dangerous patterns.
 *
 * Enforces:
 * 1. Code must import gradio (allowlist requirement)
 * 2. Code must use Gradio UI components (allowlist requirement)
 * 3. Code must not contain any dangerous Python patterns (blocklist)
 */
function validateGradioCode(code: string): { valid: boolean; error?: string } {
  // Requirement: code must import the gradio module
  const hasGradioImport = /\bimport\s+gradio\b/.test(code) || /\bfrom\s+gradio\b/.test(code);
  if (!hasGradioImport) {
    return { valid: false, error: 'Code must import the gradio module. Only Gradio applications are permitted.' };
  }

  // Requirement: code must use Gradio UI components
  const hasGradioUsage = /\b(gr\.|gradio\.)(Interface|Blocks|TabbedInterface|ChatInterface|Row|Column|Tab)\b/.test(code);
  if (!hasGradioUsage) {
    return { valid: false, error: 'Code must use Gradio components (e.g., gr.Interface, gr.Blocks). Only Gradio applications are permitted.' };
  }

  // Check against dangerous pattern blocklist
  for (const { pattern, description } of DANGEROUS_PYTHON_PATTERNS) {
    if (pattern.test(code)) {
      return { valid: false, error: `Blocked: code contains forbidden pattern (${description}). Only safe Gradio operations are allowed.` };
    }
  }

  return { valid: true };
}

// A simple in-memory store to keep track of running Gradio processes
const runningProcesses: Map<string, any> = new Map();

// H6: Limit concurrent Gradio processes to prevent resource exhaustion (DoS)
const MAX_CONCURRENT_GRADIO_PROCESSES = 5;

export async function POST(request: NextRequest) {
  // C2 FIX: Authentication check - require a valid session for code execution
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json(
      { error: 'Authentication required. You must be signed in to run Gradio applications.' },
      { status: 401 }
    );
  }

  // Rate limiting (strict: 5 requests per minute for code execution)
  const rateLimitResult = await apiRateLimit(request)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Code execution is rate-limited for security.' },
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

  // H6: Enforce concurrent Gradio process limit to prevent unbounded resource creation
  if (runningProcesses.size >= MAX_CONCURRENT_GRADIO_PROCESSES) {
    return NextResponse.json(
      { error: 'Too many concurrent Gradio processes. Please try again later.' },
      { status: 503, headers: { 'Retry-After': '30' } }
    );
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

    // C2 FIX: Validate code against dangerous pattern blocklist and Gradio allowlist
    const codeValidation = validateGradioCode(code);
    if (!codeValidation.valid) {
      console.warn('Gradio code validation blocked submission', {
        userId: (session.user as any)?.id || session.user?.email,
        error: codeValidation.error,
      });
      return NextResponse.json(
        { error: codeValidation.error },
        { status: 400 }
      );
    }

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

    // H6: Clean up process from tracking map when it exits
    gradioApp.on('exit', () => {
      runningProcesses.delete(execId);
    });
    gradioApp.on('error', () => {
      runningProcesses.delete(execId);
    });

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

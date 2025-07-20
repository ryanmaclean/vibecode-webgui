import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

// A simple in-memory store to keep track of running Gradio processes
const runningProcesses: Map<string, any> = new Map();

export async function POST(request: Request) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json({ error: 'No code provided' }, { status: 400 });
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
          console.log(`Dependencies installed for run ${execId}`);
          resolve(true);
        } else {
          reject(new Error('Failed to install dependencies. Check server logs.'));
        }
      });
      pipInstall.stderr.on('data', (data) => console.error(`pip stderr: ${data}`));
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
        console.log(`Gradio stdout for ${execId}: ${output}`);
        const urlMatch = output.match(/Running on local URL: *(http:\/\/[^ ]+)/);
        if (urlMatch && urlMatch[1]) {
          clearTimeout(timeout);
          resolve(urlMatch[1]);
        }
      });

      gradioApp.stderr.on('data', (data: Buffer) => {
        const errorOutput = data.toString();
        console.error(`Gradio stderr for ${execId}: ${errorOutput}`);
        clearTimeout(timeout);
        reject(new Error(`Gradio app failed: ${errorOutput.split('\n')[0]}`));
      });

      gradioApp.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    console.log(`Gradio app for ${execId} started at ${url}`);
    return NextResponse.json({ url, execId });

  } catch (error) {
    console.error('[Gradio Run Error]', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: 'Failed to run Gradio app.', details: errorMessage }, { status: 500 });
  }
}

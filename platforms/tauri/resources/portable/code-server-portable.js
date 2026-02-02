#!/usr/bin/env node

/**
 * VibeCode Portable Code Server
 * A standalone executable that runs code-server without external dependencies
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Get the directory where this executable is located
const exeDir = path.dirname(process.execPath);
const codeServerDir = path.join(exeDir, 'code-server');

// Check if we have bundled code-server
let codeServerPath;
if (fs.existsSync(path.join(codeServerDir, 'out', 'node', 'entry.js'))) {
    codeServerPath = path.join(codeServerDir, 'out', 'node', 'entry.js');
} else {
    console.error('Error: Bundled code-server not found');
    process.exit(1);
}

// Default arguments for code-server
const defaultArgs = [
    '--bind-addr', '0.0.0.0:8080',
    '--auth', 'none',
    '--disable-telemetry',
    '--disable-update-check',
    '--disable-workspace-trust',
    '--disable-getting-started-override',
    '--user-data-dir', path.join(exeDir, 'user-data'),
    '--extensions-dir', path.join(exeDir, 'extensions')
];

// Merge with command line arguments
const args = [...defaultArgs, ...process.argv.slice(2)];

// Set working directory to current directory
const cwd = process.cwd();

console.log('Starting VibeCode Portable Code Server...');
console.log('Code-server path:', codeServerPath);
console.log('Working directory:', cwd);
console.log('Arguments:', args.join(' '));

// Set Datadog tracing environment variables
const env = {
    ...process.env,
    DD_TRACE_ENABLED: 'true',
    DD_TRACE_AGENT_URL: 'http://localhost:8126',
    DD_DOGSTATSD_URL: 'localhost:8125',
    DD_SERVICE: 'vibecode-portable-codeserver',
    DD_ENV: 'development',
    DD_VERSION: '1.0.0',
    DD_TRACE_SAMPLE_RATE: '1.0',
    DD_TRACE_ANALYTICS_ENABLED: 'true',
    DD_TRACE_DEBUG: 'true',
    DD_TRACE_STARTUP_LOGS: 'true',
    DD_RUNTIME_METRICS_ENABLED: 'true',
    DD_LOGS_ENABLED: 'true',
    DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL: 'true'
};

// Spawn code-server
const child = spawn(process.execPath, [codeServerPath, ...args], {
    cwd: cwd,
    stdio: 'inherit',
    env: env
});

child.on('error', (err) => {
    console.error('Failed to start code-server:', err);
    process.exit(1);
});

child.on('exit', (code) => {
    console.log(`Code-server exited with code ${code}`);
    process.exit(code);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down code-server...');
    child.kill('SIGINT');
});

process.on('SIGTERM', () => {
    console.log('\nShutting down code-server...');
    child.kill('SIGTERM');
});
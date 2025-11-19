const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

let mainWindow;
let vscodeServerProcess;
let serverPort = 8080; // Changed to 8080 for real code-server
let serverReady = false;

// Logging helper
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

// Check if server is responding
function checkServerReady(port, maxAttempts = 30) {
  return new Promise((resolve) => {
    let attempts = 0;

    const check = () => {
      attempts++;

      const req = http.get(`http://127.0.0.1:${port}`, (res) => {
        if (res.statusCode === 200 || res.statusCode === 302) {
          log(`VS Code Server is ready on port ${port}`, 'success');
          serverReady = true;
          resolve(true);
        } else {
          scheduleNextCheck();
        }
      });

      req.on('error', () => {
        if (attempts >= maxAttempts) {
          log(`VS Code Server failed to start after ${maxAttempts} attempts`, 'error');
          resolve(false);
        } else {
          scheduleNextCheck();
        }
      });

      req.setTimeout(1000);
      req.on('timeout', () => {
        req.destroy();
        scheduleNextCheck();
      });
    };

    const scheduleNextCheck = () => {
      if (attempts < maxAttempts) {
        setTimeout(check, 1000);
      } else {
        resolve(false);
      }
    };

    check();
  });
}

// Start VS Code Server
async function startVSCodeServer() {
  return new Promise((resolve, reject) => {
    // Try to find VS Code Server binary
    // Priority: 1. Bundled, 2. System code-server, 3. Mock mode

    const possiblePaths = [
      '/opt/homebrew/bin/code-server', // Real code-server (PRIORITY)
      '/usr/local/bin/code-server',
      path.join(process.resourcesPath, 'vscode-server', 'bin', 'code-server'),
      path.join(__dirname, 'vscode-server', 'bin', 'code-server'),
      path.join(__dirname, 'vscode-server', 'bin', 'openvscode-server'),
      path.join(__dirname, 'mock-vscode-server.js') // Mock server last
    ];

    let serverBinary = null;
    const fs = require('fs');

    for (const binPath of possiblePaths) {
      if (fs.existsSync(binPath)) {
        serverBinary = binPath;
        log(`Found VS Code Server at: ${binPath}`);
        break;
      }
    }

    if (!serverBinary) {
      log('VS Code Server binary not found. Running in mock mode.', 'error');
      log('To use a real VS Code Server, install code-server or place it in vscode-server/bin/');

      // Resolve with mock mode
      serverReady = false;
      resolve({ mock: true });
      return;
    }

    // Launch VS Code Server
    log(`Starting VS Code Server on port ${serverPort}...`);

    // Determine if this is a Node.js script or binary
    const isNodeScript = serverBinary.endsWith('.js');

    let args;
    if (isNodeScript) {
      // For Node.js scripts (like mock server)
      args = [serverBinary];
    } else {
      // For binary executables (code-server, openvscode-server)
      args = [
        '--port', serverPort.toString(),
        '--host', '127.0.0.1',
        '--without-connection-token',
        '--disable-telemetry',
        '--disable-update-check'
      ];
    }

    vscodeServerProcess = spawn(isNodeScript ? 'node' : serverBinary, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: serverPort.toString(),
        HOST: '127.0.0.1',
        VSCODE_AGENT_FOLDER: path.join(app.getPath('userData'), 'vscode-server')
      }
    });

    vscodeServerProcess.stdout.on('data', (data) => {
      const output = data.toString();
      log(`[VSCode] ${output.trim()}`);

      // Check if server is ready
      if (output.includes('Web UI available at') || output.includes('HTTP server listening')) {
        serverReady = true;
      }
    });

    vscodeServerProcess.stderr.on('data', (data) => {
      const output = data.toString();
      log(`[VSCode] ${output.trim()}`, 'error');
    });

    vscodeServerProcess.on('error', (err) => {
      log(`Failed to start VS Code Server: ${err.message}`, 'error');
      reject(err);
    });

    vscodeServerProcess.on('exit', (code) => {
      log(`VS Code Server exited with code ${code}`);
      serverReady = false;
    });

    // Wait for server to be ready
    setTimeout(async () => {
      const ready = await checkServerReady(serverPort);
      resolve({ ready, port: serverPort });
    }, 2000);
  });
}

// Create main window
async function createWindow() {
  const startTime = Date.now();
  log('Creating main window...');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'VibeCode - Electron Prototype',
    backgroundColor: '#1e1e1e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      allowRunningInsecureContent: false
    },
    show: false // Don't show until ready
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    const loadTime = Date.now() - startTime;
    log(`Window ready in ${loadTime}ms`, 'success');
  });

  // Load the initial page
  mainWindow.loadFile('index.html');

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Start VS Code Server
  try {
    const serverInfo = await startVSCodeServer();

    if (serverInfo.mock) {
      // Running in mock mode - just show the splash page
      log('Running in mock mode - VS Code Server not available');
    } else if (serverInfo.ready) {
      // Server is ready - notify renderer
      mainWindow.webContents.send('server-ready', {
        port: serverPort,
        url: `http://127.0.0.1:${serverPort}`
      });
    } else {
      log('VS Code Server failed to start properly', 'error');
    }
  } catch (err) {
    log(`Error starting VS Code Server: ${err.message}`, 'error');
  }
}

// App lifecycle
app.whenReady().then(() => {
  log('Electron app ready');
  createWindow();
});

app.on('window-all-closed', () => {
  log('All windows closed');

  // Stop VS Code Server
  if (vscodeServerProcess) {
    log('Stopping VS Code Server...');
    vscodeServerProcess.kill('SIGTERM');

    // Force kill after 5 seconds
    setTimeout(() => {
      if (vscodeServerProcess && !vscodeServerProcess.killed) {
        vscodeServerProcess.kill('SIGKILL');
      }
    }, 5000);
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  log('App quitting...');

  if (vscodeServerProcess) {
    vscodeServerProcess.kill('SIGTERM');
  }
});

// IPC Handlers
ipcMain.handle('get-server-status', () => {
  return {
    ready: serverReady,
    port: serverPort,
    url: serverReady ? `http://127.0.0.1:${serverPort}` : null
  };
});

ipcMain.handle('load-vscode', () => {
  if (serverReady && mainWindow) {
    mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);
    return { success: true };
  }
  return { success: false, error: 'Server not ready' };
});

// Performance monitoring
if (process.env.NODE_ENV === 'development') {
  const perfMarks = {};

  app.on('ready', () => {
    perfMarks.ready = Date.now();
  });

  setTimeout(() => {
    const metrics = app.getAppMetrics();
    log(`App Metrics: ${JSON.stringify(metrics, null, 2)}`);
  }, 5000);
}

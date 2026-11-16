// Enhanced Electron main process with Rust backend integration
const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

let mainWindow;
let rustBackend;
let codeServer;

// Rust backend HTTP server (runs alongside Tauri)
const RUST_BACKEND_PORT = 3030;
const RUST_BACKEND_URL = `http://localhost:${RUST_BACKEND_PORT}`;

// Start Rust backend service
function startRustBackend() {
    console.log('🚀 Starting Rust backend service...');
    
    // On macOS, try to use the Tauri app as a service
    // On other platforms, start the Rust binary directly
    const isMac = process.platform === 'darwin';
    
    if (isMac) {
        // Use Tauri app in service mode
        const tauriAppPath = path.join(__dirname, '..', 'src-tauri', 'target', 'release', 'vibecode');
        
        rustBackend = spawn(tauriAppPath, ['--service'], {
            stdio: 'inherit',
            env: {
                ...process.env,
                VIBECODE_SERVICE_MODE: '1',
                VIBECODE_SERVICE_PORT: RUST_BACKEND_PORT.toString(),
            }
        });
    } else {
        // Start standalone Rust backend
        const backendPath = path.join(__dirname, '..', 'target', 'release', 'vibecode-backend');
        
        rustBackend = spawn(backendPath, [], {
            stdio: 'inherit',
            env: {
                ...process.env,
                PORT: RUST_BACKEND_PORT.toString(),
            }
        });
    }
    
    rustBackend.on('error', (err) => {
        console.error('❌ Failed to start Rust backend:', err);
    });
    
    rustBackend.on('exit', (code) => {
        console.log(`Rust backend exited with code ${code}`);
    });
    
    // Wait for backend to be ready
    waitForBackend();
}

// Wait for Rust backend to be ready
async function waitForBackend(retries = 30) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(`${RUST_BACKEND_URL}/health`);
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Rust backend ready:', data);
                return true;
            }
        } catch (err) {
            // Backend not ready yet
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    console.warn('⚠️  Rust backend not ready after 15 seconds');
    return false;
}

// Start code-server
function startCodeServer() {
    console.log('🚀 Starting code-server...');
    
    // Kill any existing code-server processes
    const { execSync } = require('child_process');
    try {
        if (process.platform === 'darwin') {
            execSync('lsof -ti:8080 | xargs kill -9', { stdio: 'ignore' });
        } else {
            execSync('netstat -ano | findstr :8080', { stdio: 'ignore' });
        }
    } catch (e) {
        // Ignore if no processes found
    }
    
    // Start code-server with Electron-optimized settings
    codeServer = spawn('code-server', [
        '--bind-addr', '127.0.0.1:8080',
        '--auth', 'none',
        '--disable-telemetry',
        '--disable-update-check',
        '--disable-workspace-trust',
        '--disable-getting-started-override',
        '--user-data-dir', path.join(app.getPath('userData'), 'code-server'),
        '--extensions-dir', path.join(app.getPath('userData'), 'code-server', 'extensions'),
        '.'
    ], {
        stdio: 'pipe',
        cwd: path.join(__dirname, '..'),
        env: {
            ...process.env,
            // Use Tailscale IP if available (via Rust backend)
            CODE_SERVER_BIND_ADDR: '127.0.0.1:8080',
        }
    });
    
    codeServer.stdout.on('data', (data) => {
        console.log(`[code-server] ${data}`);
    });
    
    codeServer.stderr.on('data', (data) => {
        console.error(`[code-server] ${data}`);
    });
    
    codeServer.on('close', (code) => {
        console.log(`code-server process exited with code ${code}`);
    });
}

// Create Electron window
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            webSecurity: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, '..', 'src-tauri', 'icons', 'icon.png'),
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
        show: false // Don't show until ready
    });
    
    // Load code-server
    mainWindow.loadURL('http://localhost:8080');
    
    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        
        if (process.platform === 'darwin') {
            app.dock.show();
        }
    });
    
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    
    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        require('electron').shell.openExternal(url);
        return { action: 'deny' };
    });
    
    // Create application menu
    createMenu();
}

// IPC handlers for Rust backend
ipcMain.handle('backend-call', async (event, { endpoint, method = 'GET', body = null }) => {
    try {
        const url = `${RUST_BACKEND_URL}${endpoint}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };
        
        if (body) {
            options.body = JSON.stringify(body);
        }
        
        const response = await fetch(url, options);
        const data = await response.json();
        
        return {
            ok: response.ok,
            status: response.status,
            data: data
        };
    } catch (err) {
        return {
            ok: false,
            error: err.message
        };
    }
});

// Convenience IPC handlers
ipcMain.handle('ml-is-available', async () => {
    const result = await ipcMain.emit('backend-call', null, {
        endpoint: '/api/ml/available',
        method: 'GET'
    });
    return result;
});

ipcMain.handle('docker-status', async () => {
    const result = await ipcMain.emit('backend-call', null, {
        endpoint: '/api/docker/status',
        method: 'GET'
    });
    return result;
});

ipcMain.handle('ai-chat', async (event, request) => {
    const result = await ipcMain.emit('backend-call', null, {
        endpoint: '/api/ai/chat',
        method: 'POST',
        body: request
    });
    return result;
});

// Create application menu
function createMenu() {
    const { Menu } = require('electron');
    
    const template = [
        {
            label: 'VibeCode',
            submenu: [
                { role: 'about', label: 'About VibeCode' },
                { type: 'separator' },
                { role: 'services', label: 'Services' },
                { type: 'separator' },
                { role: 'hide', label: 'Hide VibeCode' },
                { role: 'hideOthers', label: 'Hide Others' },
                { role: 'unhide', label: 'Show All' },
                { type: 'separator' },
                { role: 'quit', label: 'Quit VibeCode' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo', label: 'Undo' },
                { role: 'redo', label: 'Redo' },
                { type: 'separator' },
                { role: 'cut', label: 'Cut' },
                { role: 'copy', label: 'Copy' },
                { role: 'paste', label: 'Paste' },
                { role: 'selectAll', label: 'Select All' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload', label: 'Reload' },
                { role: 'forceReload', label: 'Force Reload' },
                { role: 'toggleDevTools', label: 'Toggle Developer Tools' },
                { type: 'separator' },
                { role: 'resetZoom', label: 'Actual Size' },
                { role: 'zoomIn', label: 'Zoom In' },
                { role: 'zoomOut', label: 'Zoom Out' },
                { type: 'separator' },
                { role: 'togglefullscreen', label: 'Toggle Full Screen' }
            ]
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize', label: 'Minimize' },
                { role: 'close', label: 'Close' }
            ]
        }
    ];
    
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// App lifecycle
app.whenReady().then(() => {
    // Start backend services
    startRustBackend();
    startCodeServer();
    
    // Wait for services to be ready before creating window
    setTimeout(() => {
        createWindow();
    }, 3000);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('before-quit', () => {
    console.log('🛑 Shutting down...');
    
    if (codeServer) {
        codeServer.kill();
    }
    
    if (rustBackend) {
        rustBackend.kill();
    }
});

// Handle fetch (Node.js 18+)
if (typeof fetch === 'undefined') {
    global.fetch = require('node-fetch');
}

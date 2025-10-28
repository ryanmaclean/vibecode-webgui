const { app, BrowserWindow, Menu, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

// Keep a global reference of the window object
let mainWindow;
let codeServerProcess;

// Enable live reload for development
if (process.env.NODE_ENV === 'development') {
  require('electron-reload')(__dirname, {
    electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
    hardResetMethod: 'exit'
  });
}

function createWindow() {
  // Create the browser window
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
    titleBarStyle: 'hiddenInset',
    show: false // Don't show until ready
  });

  // Start code-server
  startCodeServer();

  // Load the code-server interface
  mainWindow.loadURL('http://localhost:8080');

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Focus on the window
    if (process.platform === 'darwin') {
      app.dock.show();
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Create application menu
  createMenu();
}

function startCodeServer() {
  console.log('🚀 Starting code-server for Electron...');
  
  // Kill any existing code-server processes
  const { execSync } = require('child_process');
  try {
    execSync('lsof -ti:8080 | xargs kill -9', { stdio: 'ignore' });
  } catch (e) {
    // Ignore if no processes found
  }

  // Start code-server with Electron-optimized settings
  codeServerProcess = spawn('code-server', [
    '--bind-addr', '0.0.0.0:8080',
    '--auth', 'none',
    '--disable-telemetry',
    '--disable-update-check',
    '--disable-workspace-trust',
    '--disable-getting-started-override',
    '--user-data-dir', path.join(process.env.HOME, '.config/code-server-electron/user-data'),
    '--extensions-dir', path.join(process.env.HOME, '.config/code-server-electron/extensions'),
    '--enable-proposed-api', 'ms-vscode.vscode-typescript-next',
    '.'
  ], {
    stdio: 'pipe',
    cwd: path.join(__dirname, '..')
  });

  codeServerProcess.stdout.on('data', (data) => {
    console.log(`code-server: ${data}`);
  });

  codeServerProcess.stderr.on('data', (data) => {
    console.error(`code-server error: ${data}`);
  });

  codeServerProcess.on('close', (code) => {
    console.log(`code-server process exited with code ${code}`);
  });

  // Wait for code-server to start
  setTimeout(() => {
    console.log('✅ Code-server should be ready');
  }, 5000);
}

function createMenu() {
  const template = [
    {
      label: 'VibeCode Electron',
      submenu: [
        {
          label: 'About VibeCode Electron',
          role: 'about'
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Learn More',
          click: () => {
            shell.openExternal('https://github.com/ryanmaclean/vibecode-webgui');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App event handlers
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // Kill code-server process
  if (codeServerProcess) {
    codeServerProcess.kill();
  }
  
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
  // Ensure code-server is killed
  if (codeServerProcess) {
    codeServerProcess.kill();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});

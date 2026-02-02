const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    kiosk: true,  // Kiosk mode for maximum performance
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: false,  // Disable for speed
      nodeIntegration: true,     // Enable for speed
      webSecurity: false,        // Disable for speed
      enableRemoteModule: true,  // Enable for speed
      experimentalFeatures: true // Enable experimental features
    },
    title: "VibeCode Optimized",
    show: false,  // Don't show until ready
    frame: false  // No window frame
  });

  // Load code-server with optimizations
  mainWindow.loadURL('http://localhost:8080', {
    userAgent: 'VibeCode-Optimized/1.0.0'  // Custom user agent
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Optimize for performance
  mainWindow.webContents.on('did-finish-load', () => {
    // Disable unnecessary features
    mainWindow.webContents.executeJavaScript(`
      // Disable animations for speed
      document.documentElement.style.setProperty('--animation-duration', '0ms');
      document.documentElement.style.setProperty('--transition-duration', '0ms');
      
      // Disable unnecessary features
      if (window.chrome && window.chrome.runtime) {
        window.chrome.runtime.onConnect = null;
      }
    `);
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Performance optimizations
app.commandLine.appendSwitch('--disable-web-security');
app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor');
app.commandLine.appendSwitch('--disable-background-timer-throttling');
app.commandLine.appendSwitch('--disable-renderer-backgrounding');
app.commandLine.appendSwitch('--disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('--disable-ipc-flooding-protection');
app.commandLine.appendSwitch('--max_old_space_size', '4096');

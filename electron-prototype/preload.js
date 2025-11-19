const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Get VS Code Server status
  getServerStatus: () => ipcRenderer.invoke('get-server-status'),

  // Load VS Code Server in the window
  loadVSCode: () => ipcRenderer.invoke('load-vscode'),

  // Listen for server ready event
  onServerReady: (callback) => {
    ipcRenderer.on('server-ready', (event, data) => callback(data));
  },

  // Platform information
  platform: process.platform,
  arch: process.arch,
  version: process.versions.electron,

  // Performance API
  performance: {
    now: () => performance.now(),
    mark: (name) => performance.mark(name),
    measure: (name, startMark, endMark) => {
      try {
        return performance.measure(name, startMark, endMark);
      } catch (err) {
        console.error('Performance measurement failed:', err);
        return null;
      }
    },
    getEntriesByType: (type) => performance.getEntriesByType(type)
  }
});

// Log preload script loaded
console.log('Preload script loaded');
console.log('Platform:', process.platform);
console.log('Architecture:', process.arch);
console.log('Electron version:', process.versions.electron);
console.log('Chrome version:', process.versions.chrome);
console.log('Node version:', process.versions.node);

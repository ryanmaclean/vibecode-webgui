const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Add any APIs you want to expose to the renderer process
  platform: process.platform,
  versions: process.versions,
  
  // Example: Expose a method to get app info
  getAppInfo: () => {
    return {
      name: 'VibeCode Electron',
      version: '1.0.0',
      platform: process.platform,
      arch: process.arch
    };
  }
});

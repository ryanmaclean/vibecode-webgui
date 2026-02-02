// Preload script - Bridge between Electron and Rust backend
const { contextBridge, ipcRenderer } = require('electron');

// Expose VibeCode API to renderer process
contextBridge.exposeInMainWorld('vibecode', {
    // Backend API
    async callBackend(endpoint, method = 'GET', body = null) {
        return await ipcRenderer.invoke('backend-call', { endpoint, method, body });
    },
    
    // ML Commands
    async mlIsAvailable() {
        const result = await ipcRenderer.invoke('ml-is-available');
        return result;
    },
    
    async mlGetDeviceInfo() {
        const result = await this.callBackend('/api/ml/device-info', 'GET');
        return result.data;
    },
    
    async mlGenerateEmbedding(text) {
        const result = await this.callBackend('/api/ml/embedding', 'POST', { text });
        return result.data;
    },
    
    // Docker Commands
    async dockerStatus() {
        const result = await ipcRenderer.invoke('docker-status');
        return result;
    },
    
    async dockerStart() {
        const result = await this.callBackend('/api/docker/start', 'POST');
        return result.data;
    },
    
    async dockerStop() {
        const result = await this.callBackend('/api/docker/stop', 'POST');
        return result.data;
    },
    
    // AI Commands
    async aiChat(messages, model = 'gpt-4', provider = 'openai') {
        const result = await ipcRenderer.invoke('ai-chat', {
            messages,
            model,
            provider
        });
        return result;
    },
    
    async aiComplete(code, cursor, language) {
        const result = await this.callBackend('/api/ai/complete', 'POST', {
            code,
            cursor,
            language
        });
        return result.data;
    },
    
    // Tailscale Commands
    async tailscaleStatus() {
        const result = await this.callBackend('/api/tailscale/status', 'GET');
        return result.data;
    },
    
    async tailscaleGetIP() {
        const result = await this.callBackend('/api/tailscale/ip', 'GET');
        return result.data;
    },
    
    // VM Commands
    async vmStart() {
        const result = await this.callBackend('/api/vm/start', 'POST');
        return result.data;
    },
    
    async vmStatus() {
        const result = await this.callBackend('/api/vm/status', 'GET');
        return result.data;
    }
});

// Log that preload script loaded
console.log('✅ VibeCode preload script loaded');

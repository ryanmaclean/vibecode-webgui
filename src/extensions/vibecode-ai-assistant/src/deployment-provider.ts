import * as vscode from 'vscode';
import axios from 'axios';
// import { logger } from '@/lib/logger';
interface DeploymentProvider {
    id: string;
    name: string;
    icon: string;
    supported: boolean;
    configured: boolean;
}

interface Deployment {
    id: string;
    name: string;
    provider: string;
    status: 'deploying' | 'success' | 'error' | 'pending';
    url?: string;
    createdAt: string;
    lastDeployment?: string;
}

export class DeploymentWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'vibeCodeDeployment';

    private _view?: vscode.WebviewView;
    private deployments: Deployment[] = [];

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private baseUrl: string = 'http://localhost:3000'
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(
            async (data: { type: string; provider?: string; url?: string; deploymentId?: string }) => {
                switch (data.type) {
                    case 'deploy':
                        if (data.provider) {
                            await this.deployProject(data.provider);
                        }
                        break;
                    case 'refresh':
                        await this.refreshDeployments();
                        break;
                    case 'openDeployment':
                        if (data.url) {
                            vscode.env.openExternal(vscode.Uri.parse(data.url));
                        }
                        break;
                    case 'setupProvider':
                        if (data.provider) {
                            await this.setupProvider(data.provider);
                        }
                        break;
                    case 'viewLogs':
                        if (data.deploymentId) {
                            await this.viewDeploymentLogs(data.deploymentId);
                        }
                        break;
                }
            }
        );

        // Load initial data
        this.refreshDeployments();
    }

    private async deployProject(providerId: string): Promise<void> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder open');
                return;
            }

            // Show deployment configuration
            const projectName = await vscode.window.showInputBox({
                prompt: 'Enter project name for deployment',
                value: workspaceFolder.name,
                validateInput: (value: string) => {
                    if (!value || value.trim().length === 0) {
                        return 'Project name is required';
                    }
                    return null;
                }
            });

            if (!projectName) return;

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Deploying to ${providerId}...`,
                cancellable: false
            }, async (progress: vscode.Progress<{ message?: string; increment?: number }>) => {
                progress.report({ increment: 10, message: 'Preparing deployment...' });

                const response = await axios.post(`${this.baseUrl}/api/deployment/deploy`, {
                    provider: providerId,
                    projectName: projectName.trim(),
                    projectPath: workspaceFolder.uri.fsPath,
                    autoDetectFramework: true
                });

                progress.report({ increment: 50, message: 'Deploying...' });

                const { deploymentId } = response.data;
                
                // Poll for deployment status
                let attempts = 0;
                const maxAttempts = 30; // 5 minutes
                
                while (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
                    
                    try {
                        const statusResponse = await axios.get(`${this.baseUrl}/api/deployment/status/${deploymentId}`);
                        const status = statusResponse.data.status;
                        
                        if (status === 'success') {
                            progress.report({ increment: 40, message: 'Deployment complete!' });
                            break;
                        } else if (status === 'error') {
                            throw new Error(statusResponse.data.error || 'Deployment failed');
                        }
                        
                        progress.report({ 
                            increment: Math.min(5, 40 - attempts * 1.5), 
                            message: `Deploying... (${attempts * 10}s)` 
                        });
                    } catch (error) {
                        console.error('Status check failed:', error);
                    }
                    
                    attempts++;
                }
            });

            await this.refreshDeployments();
            vscode.window.showInformationMessage(`Successfully deployed to ${providerId}!`);

        } catch (error) {
            console.error('Deployment failed:', error);
            vscode.window.showErrorMessage(
                `Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    private async refreshDeployments(): Promise<void> {
        try {
            const response = await axios.get(`${this.baseUrl}/api/deployment/list`);
            this.deployments = response.data;
            
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'deploymentsUpdated',
                    deployments: this.deployments
                });
            }
        } catch (error) {
            console.error('Failed to refresh deployments:', error);
        }
    }

    private async setupProvider(providerId: string): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'providerSetup',
            `Setup ${providerId}`,
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = this._getProviderSetupHtml(providerId);
        
        panel.webview.onDidReceiveMessage(async (message: { type: string; config?: any }) => {
            if (message.type === 'saveConfig') {
                try {
                    await axios.post(`${this.baseUrl}/api/deployment/configure`, {
                        provider: providerId,
                        config: message.config
                    });

                    vscode.window.showInformationMessage(`${providerId} configured successfully!`);
                    panel.dispose();
                    this.refreshDeployments();
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to configure ${providerId}`);
                }
            }
        });
    }

    private async viewDeploymentLogs(deploymentId: string): Promise<void> {
        try {
            const response = await axios.get(`${this.baseUrl}/api/deployment/logs/${deploymentId}`);
            const logs = response.data.logs;

            const document = await vscode.workspace.openTextDocument({
                content: logs,
                language: 'log'
            });
            
            await vscode.window.showTextDocument(document);
        } catch (error) {
            vscode.window.showErrorMessage('Failed to fetch deployment logs');
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Cloud Deployment</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                        margin: 0;
                        padding: 15px;
                        font-size: 13px;
                    }
                    .section {
                        margin-bottom: 20px;
                    }
                    .section-title {
                        font-weight: bold;
                        margin-bottom: 10px;
                        font-size: 14px;
                    }
                    .provider-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 10px;
                        margin-bottom: 15px;
                    }
                    .provider-card {
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 6px;
                        padding: 12px;
                        cursor: pointer;
                        transition: background-color 0.2s;
                    }
                    .provider-card:hover {
                        background-color: var(--vscode-list-hoverBackground);
                    }
                    .provider-card.configured {
                        border-color: var(--vscode-charts-green);
                    }
                    .provider-card.disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }
                    .provider-header {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        margin-bottom: 5px;
                    }
                    .provider-icon {
                        width: 16px;
                        height: 16px;
                    }
                    .provider-name {
                        font-weight: 500;
                    }
                    .provider-status {
                        font-size: 11px;
                        opacity: 0.8;
                    }
                    .deployment-list {
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 6px;
                        overflow: hidden;
                    }
                    .deployment-item {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 10px;
                        border-bottom: 1px solid var(--vscode-panel-border);
                    }
                    .deployment-item:last-child {
                        border-bottom: none;
                    }
                    .deployment-info {
                        flex: 1;
                    }
                    .deployment-name {
                        font-weight: 500;
                        margin-bottom: 2px;
                    }
                    .deployment-meta {
                        font-size: 11px;
                        opacity: 0.8;
                    }
                    .deployment-status {
                        padding: 2px 6px;
                        border-radius: 3px;
                        font-size: 10px;
                        font-weight: 500;
                    }
                    .status-success {
                        background-color: var(--vscode-charts-green);
                        color: white;
                    }
                    .status-deploying {
                        background-color: var(--vscode-charts-yellow);
                        color: black;
                    }
                    .status-error {
                        background-color: var(--vscode-charts-red);
                        color: white;
                    }
                    .status-pending {
                        background-color: var(--vscode-charts-blue);
                        color: white;
                    }
                    .actions {
                        display: flex;
                        gap: 5px;
                    }
                    button {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 6px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                    }
                    button:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                    .secondary {
                        background-color: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                    }
                    .small-btn {
                        padding: 3px 8px;
                        font-size: 10px;
                    }
                    .empty-state {
                        text-align: center;
                        padding: 20px;
                        opacity: 0.6;
                    }
                </style>
            </head>
            <body>
                <div class="section">
                    <div class="section-title">Deploy to Cloud</div>
                    <div class="provider-grid" id="providerGrid">
                        <!-- Providers will be populated here -->
                    </div>
                    <button onclick="refreshData()" class="secondary">Refresh</button>
                </div>

                <div class="section">
                    <div class="section-title">Recent Deployments</div>
                    <div class="deployment-list" id="deploymentList">
                        <div class="empty-state">No deployments yet</div>
                    </div>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();
                    
                    const providers = [
                        { id: 'vercel', name: 'Vercel', icon: '▲' },
                        { id: 'netlify', name: 'Netlify', icon: '🌐' },
                        { id: 'railway', name: 'Railway', icon: '🚂' },
                        { id: 'aws', name: 'AWS', icon: '☁️' }
                    ];
                    
                    function deployTo(providerId) {
                        vscode.postMessage({ type: 'deploy', provider: providerId });
                    }
                    
                    function setupProvider(providerId) {
                        vscode.postMessage({ type: 'setupProvider', provider: providerId });
                    }
                    
                    function openDeployment(url) {
                        vscode.postMessage({ type: 'openDeployment', url });
                    }
                    
                    function viewLogs(deploymentId) {
                        vscode.postMessage({ type: 'viewLogs', deploymentId });
                    }
                    
                    function refreshData() {
                        vscode.postMessage({ type: 'refresh' });
                    }
                    
                    function renderProviders() {
                        const grid = document.getElementById('providerGrid');
                        grid.innerHTML = providers.map(provider => \`
                            <div class="provider-card" onclick="deployTo('\${provider.id}')">
                                <div class="provider-header">
                                    <span class="provider-icon">\${provider.icon}</span>
                                    <span class="provider-name">\${provider.name}</span>
                                </div>
                                <div class="provider-status">Click to deploy</div>
                            </div>
                        \`).join('');
                    }
                    
                    function renderDeployments(deployments) {
                        const list = document.getElementById('deploymentList');
                        
                        if (!deployments || deployments.length === 0) {
                            list.innerHTML = '<div class="empty-state">No deployments yet</div>';
                            return;
                        }
                        
                        list.innerHTML = deployments.map(deployment => \`
                            <div class="deployment-item">
                                <div class="deployment-info">
                                    <div class="deployment-name">\${deployment.name}</div>
                                    <div class="deployment-meta">\${deployment.provider} • \${new Date(deployment.createdAt).toLocaleDateString()}</div>
                                </div>
                                <div class="actions">
                                    <span class="deployment-status status-\${deployment.status}">\${deployment.status.toUpperCase()}</span>
                                    \${deployment.url ? \`<button class="small-btn" onclick="openDeployment('\${deployment.url}')">Open</button>\` : ''}
                                    <button class="small-btn secondary" onclick="viewLogs('\${deployment.id}')">Logs</button>
                                </div>
                            </div>
                        \`).join('');
                    }
                    
                    // Handle messages from extension
                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.type) {
                            case 'deploymentsUpdated':
                                renderDeployments(message.deployments);
                                break;
                        }
                    });
                    
                    // Initial render
                    renderProviders();
                </script>
            </body>
            </html>
        `;
    }

    private _getProviderSetupHtml(providerId: string): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Setup ${providerId}</title>
                <style>
                    body { 
                        font-family: var(--vscode-font-family); 
                        padding: 20px; 
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                    }
                    .form-group { margin-bottom: 15px; }
                    label { display: block; margin-bottom: 5px; font-weight: 500; }
                    input { 
                        width: 100%; 
                        padding: 8px; 
                        border: 1px solid var(--vscode-input-border);
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                    }
                    button { 
                        background: var(--vscode-button-background); 
                        color: var(--vscode-button-foreground);
                        border: none; 
                        padding: 10px 20px; 
                        cursor: pointer; 
                        margin-right: 10px;
                    }
                </style>
            </head>
            <body>
                <h2>Configure ${providerId}</h2>
                <form id="configForm">
                    <div class="form-group">
                        <label for="apiKey">API Key:</label>
                        <input type="password" id="apiKey" name="apiKey" required>
                    </div>
                    <div class="form-group">
                        <label for="region">Region (optional):</label>
                        <input type="text" id="region" name="region">
                    </div>
                    <button type="submit">Save Configuration</button>
                    <button type="button" onclick="window.close()">Cancel</button>
                </form>
                
                <script>
                    const vscode = acquireVsCodeApi();
                    
                    document.getElementById('configForm').addEventListener('submit', (e) => {
                        e.preventDefault();
                        const formData = new FormData(e.target);
                        const config = Object.fromEntries(formData);
                        vscode.postMessage({ type: 'saveConfig', config });
                    });
                </script>
            </body>
            </html>
        `;
    }
}
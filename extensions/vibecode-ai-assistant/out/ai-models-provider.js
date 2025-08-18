"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIModelsProvider = exports.AIModelsTreeItem = void 0;
const vscode = __importStar(require("vscode"));
const axios_1 = __importDefault(require("axios"));
class AIModelsTreeItem extends vscode.TreeItem {
    constructor(label, collapsibleState, model, usage, contextValue) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.model = model;
        this.usage = usage;
        this.contextValue = contextValue;
        if (model) {
            this.tooltip = `${model.name}\nProvider: ${model.provider}\nContext: ${model.context_length.toLocaleString()} tokens\nCost: $${model.cost_per_token.toFixed(6)}/token\nCapabilities: ${model.capabilities.join(', ')}`;
            this.contextValue = model.available ? 'available-model' : 'unavailable-model';
            this.iconPath = new vscode.ThemeIcon(model.available ? 'check-all' : 'error', model.available ? undefined : new vscode.ThemeColor('errorForeground'));
        }
        if (usage) {
            this.description = `${usage.requests_count} requests • $${usage.total_cost.toFixed(4)} • ${usage.avg_response_time}ms avg`;
        }
    }
}
exports.AIModelsTreeItem = AIModelsTreeItem;
class AIModelsProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this._apiBaseUrl = 'http://localhost:3000';
        this._models = [];
        this._usage = {};
        this._config = null;
        this._loadModels();
        this._loadUsage();
        this._loadOrchestrationConfig();
    }
    refresh() {
        this._loadModels();
        this._loadUsage();
        this._loadOrchestrationConfig();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!element) {
            return Promise.resolve(this._getRootItems());
        }
        switch (element.contextValue) {
            case 'models-section':
                return Promise.resolve(this._getModelItems());
            case 'usage-section':
                return Promise.resolve(this._getUsageItems());
            case 'orchestration-section':
                return Promise.resolve(this._getOrchestrationItems());
            default:
                return Promise.resolve([]);
        }
    }
    _getRootItems() {
        return [
            new AIModelsTreeItem('🤖 Available Models', vscode.TreeItemCollapsibleState.Expanded, undefined, undefined, 'models-section'),
            new AIModelsTreeItem('📊 Usage Statistics', vscode.TreeItemCollapsibleState.Collapsed, undefined, undefined, 'usage-section'),
            new AIModelsTreeItem('⚙️ Orchestration Config', vscode.TreeItemCollapsibleState.Collapsed, undefined, undefined, 'orchestration-section')
        ];
    }
    _getModelItems() {
        return this._models.map(model => {
            const usage = this._usage[model.id];
            return new AIModelsTreeItem(model.name, vscode.TreeItemCollapsibleState.None, model, usage);
        });
    }
    _getUsageItems() {
        const usageItems = [];
        // Sort by usage
        const sortedUsage = Object.values(this._usage).sort((a, b) => b.total_cost - a.total_cost);
        for (const usage of sortedUsage.slice(0, 10)) { // Top 10
            const model = this._models.find(m => m.id === usage.model_id);
            if (model) {
                const item = new AIModelsTreeItem(model.name, vscode.TreeItemCollapsibleState.None, undefined, usage, 'usage-item');
                usageItems.push(item);
            }
        }
        return usageItems;
    }
    _getOrchestrationItems() {
        const items = [];
        if (this._config) {
            items.push(new AIModelsTreeItem(`Load Balancing: ${this._config.load_balancing.replace('_', ' ')}`, vscode.TreeItemCollapsibleState.None, undefined, undefined, 'config-item'));
            items.push(new AIModelsTreeItem(`Failover: ${this._config.failover_enabled ? 'Enabled' : 'Disabled'}`, vscode.TreeItemCollapsibleState.None, undefined, undefined, 'config-item'));
            items.push(new AIModelsTreeItem(`Max Retries: ${this._config.max_retries}`, vscode.TreeItemCollapsibleState.None, undefined, undefined, 'config-item'));
            items.push(new AIModelsTreeItem(`Timeout: ${this._config.timeout_ms}ms`, vscode.TreeItemCollapsibleState.None, undefined, undefined, 'config-item'));
        }
        else {
            items.push(new AIModelsTreeItem('Configuration not loaded', vscode.TreeItemCollapsibleState.None, undefined, undefined, 'error-item'));
        }
        return items;
    }
    async _loadModels() {
        try {
            const response = await axios_1.default.get(`${this._apiBaseUrl}/api/ai/models`);
            this._models = response.data.models || [];
            this._onDidChangeTreeData.fire();
        }
        catch (error) {
            console.error('Failed to load AI models:', error);
            this._models = this._getFallbackModels();
            this._onDidChangeTreeData.fire();
        }
    }
    async _loadUsage() {
        try {
            const response = await axios_1.default.get(`${this._apiBaseUrl}/api/ai/usage`);
            this._usage = response.data.usage || {};
            this._onDidChangeTreeData.fire();
        }
        catch (error) {
            console.error('Failed to load usage statistics:', error);
        }
    }
    async _loadOrchestrationConfig() {
        try {
            const response = await axios_1.default.get(`${this._apiBaseUrl}/api/ai/orchestration/config`);
            this._config = response.data.config || null;
            this._onDidChangeTreeData.fire();
        }
        catch (error) {
            console.error('Failed to load orchestration config:', error);
            this._config = this._getDefaultOrchestrationConfig();
            this._onDidChangeTreeData.fire();
        }
    }
    _getFallbackModels() {
        return [
            {
                id: 'anthropic/claude-3-sonnet-20240229',
                name: 'Claude 3 Sonnet',
                provider: 'Anthropic',
                context_length: 200000,
                cost_per_token: 0.000015,
                available: true,
                capabilities: ['text', 'code', 'reasoning', 'analysis'],
                description: 'Balanced performance for coding and reasoning tasks'
            },
            {
                id: 'openai/gpt-4-turbo-preview',
                name: 'GPT-4 Turbo',
                provider: 'OpenAI',
                context_length: 128000,
                cost_per_token: 0.00001,
                available: true,
                capabilities: ['text', 'code', 'vision', 'functions'],
                description: 'Latest GPT-4 model with vision capabilities'
            },
            {
                id: 'google/gemini-pro',
                name: 'Gemini Pro',
                provider: 'Google',
                context_length: 30720,
                cost_per_token: 0.000025,
                available: true,
                capabilities: ['text', 'code', 'reasoning'],
                description: 'Google\'s advanced AI model'
            }
        ];
    }
    _getDefaultOrchestrationConfig() {
        return {
            load_balancing: 'performance_based',
            failover_enabled: true,
            max_retries: 3,
            timeout_ms: 30000,
            preferred_models: ['anthropic/claude-3-sonnet-20240229'],
            fallback_models: ['openai/gpt-4-turbo-preview', 'google/gemini-pro']
        };
    }
    // Command handlers
    async testModel(model) {
        try {
            const response = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Testing ${model.name}...`,
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0 });
                const startTime = Date.now();
                const testResponse = await axios_1.default.post(`${this._apiBaseUrl}/api/ai/test`, {
                    model_id: model.id,
                    prompt: 'Hello! Please respond with a simple greeting.'
                });
                const responseTime = Date.now() - startTime;
                progress.report({ increment: 100 });
                return { ...testResponse.data, responseTime };
            });
            vscode.window.showInformationMessage(`✅ ${model.name} test successful!\nResponse time: ${response.responseTime}ms\nResponse: "${response.content?.substring(0, 100)}${response.content?.length > 100 ? '...' : ''}"`);
        }
        catch (error) {
            console.error('Model test failed:', error);
            vscode.window.showErrorMessage(`❌ ${model.name} test failed: ${error.response?.data?.error || error.message}`);
        }
    }
    async configureModel(model) {
        const config = vscode.workspace.getConfiguration('vibecode');
        const action = await vscode.window.showQuickPick([
            { label: '$(settings) Set as Default Model', value: 'default' },
            { label: '$(star-add) Add to Preferred Models', value: 'prefer' },
            { label: '$(shield) Add to Fallback Models', value: 'fallback' },
            { label: '$(gear) Advanced Configuration', value: 'advanced' }
        ], {
            placeHolder: `Configure ${model.name}`
        });
        if (!action) {
            return;
        }
        try {
            switch (action.value) {
                case 'default':
                    await config.update('defaultModel', model.id, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage(`Set ${model.name} as default model`);
                    break;
                case 'prefer':
                    await this._updateOrchestrationConfig('preferred_models', model.id, 'add');
                    vscode.window.showInformationMessage(`Added ${model.name} to preferred models`);
                    break;
                case 'fallback':
                    await this._updateOrchestrationConfig('fallback_models', model.id, 'add');
                    vscode.window.showInformationMessage(`Added ${model.name} to fallback models`);
                    break;
                case 'advanced':
                    await this._showAdvancedConfiguration();
                    break;
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to configure model: ${error.message}`);
        }
    }
    async showUsageDetails(usage) {
        const model = this._models.find(m => m.id === usage.model_id);
        if (!model) {
            return;
        }
        const details = `
Model: ${model.name}
Provider: ${model.provider}

Usage Statistics:
• Total Requests: ${usage.requests_count.toLocaleString()}
• Total Tokens: ${usage.total_tokens.toLocaleString()}
• Total Cost: $${usage.total_cost.toFixed(4)}
• Average Response Time: ${usage.avg_response_time}ms
• Last Used: ${new Date(usage.last_used).toLocaleString()}
• Cost per Request: $${(usage.total_cost / usage.requests_count).toFixed(6)}
• Tokens per Request: ${Math.round(usage.total_tokens / usage.requests_count)}
        `.trim();
        const panel = vscode.window.createWebviewPanel('modelUsage', `${model.name} Usage Details`, vscode.ViewColumn.One, { enableScripts: false });
        panel.webview.html = `
            <html>
            <head>
                <style>
                    body { 
                        font-family: var(--vscode-font-family);
                        padding: 20px;
                        line-height: 1.5;
                    }
                    pre {
                        background-color: var(--vscode-textCodeBlock-background);
                        padding: 16px;
                        border-radius: 4px;
                        white-space: pre-wrap;
                    }
                </style>
            </head>
            <body>
                <h2>📊 Usage Details</h2>
                <pre>${details}</pre>
            </body>
            </html>
        `;
    }
    async configureOrchestration() {
        await this._showAdvancedConfiguration();
    }
    async _updateOrchestrationConfig(property, value, action) {
        try {
            const payload = { property, value, action };
            await axios_1.default.put(`${this._apiBaseUrl}/api/ai/orchestration/config`, payload);
            this._loadOrchestrationConfig(); // Refresh
        }
        catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to update configuration');
        }
    }
    async _showAdvancedConfiguration() {
        const panel = vscode.window.createWebviewPanel('orchestrationConfig', 'AI Orchestration Configuration', vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: []
        });
        panel.webview.html = this._getConfigurationWebviewContent();
        panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'updateConfig':
                    try {
                        await axios_1.default.put(`${this._apiBaseUrl}/api/ai/orchestration/config`, {
                            config: message.config
                        });
                        this._config = message.config;
                        this._onDidChangeTreeData.fire();
                        vscode.window.showInformationMessage('Orchestration configuration updated successfully!');
                    }
                    catch (error) {
                        vscode.window.showErrorMessage(`Failed to update configuration: ${error.response?.data?.error || error.message}`);
                    }
                    break;
                case 'resetConfig':
                    this._config = this._getDefaultOrchestrationConfig();
                    await this._updateOrchestrationConfig('load_balancing', this._config.load_balancing, 'set');
                    vscode.window.showInformationMessage('Configuration reset to defaults');
                    break;
            }
        });
    }
    _getConfigurationWebviewContent() {
        const config = this._config || this._getDefaultOrchestrationConfig();
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>AI Orchestration Configuration</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    padding: 20px;
                    margin: 0;
                }
                
                .form-group {
                    margin-bottom: 20px;
                }
                
                label {
                    display: block;
                    font-weight: 600;
                    margin-bottom: 8px;
                    color: var(--vscode-foreground);
                }
                
                select, input {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid var(--vscode-input-border);
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border-radius: 4px;
                    font-size: 13px;
                    box-sizing: border-box;
                }
                
                button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 10px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 13px;
                    margin-right: 8px;
                }
                
                button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                
                button.secondary {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }
                
                .description {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 4px;
                }
                
                .checkbox-group {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                input[type="checkbox"] {
                    width: auto;
                }
            </style>
        </head>
        <body>
            <h2>⚙️ AI Orchestration Configuration</h2>
            
            <div class="form-group">
                <label for="loadBalancing">Load Balancing Strategy</label>
                <select id="loadBalancing">
                    <option value="round_robin" ${config.load_balancing === 'round_robin' ? 'selected' : ''}>Round Robin</option>
                    <option value="least_cost" ${config.load_balancing === 'least_cost' ? 'selected' : ''}>Least Cost</option>
                    <option value="performance_based" ${config.load_balancing === 'performance_based' ? 'selected' : ''}>Performance Based</option>
                    <option value="manual" ${config.load_balancing === 'manual' ? 'selected' : ''}>Manual</option>
                </select>
                <div class="description">How requests are distributed across available models</div>
            </div>
            
            <div class="form-group">
                <div class="checkbox-group">
                    <input type="checkbox" id="failoverEnabled" ${config.failover_enabled ? 'checked' : ''}>
                    <label for="failoverEnabled">Enable Failover</label>
                </div>
                <div class="description">Automatically switch to backup models on failure</div>
            </div>
            
            <div class="form-group">
                <label for="maxRetries">Maximum Retries</label>
                <input type="number" id="maxRetries" value="${config.max_retries}" min="0" max="10">
                <div class="description">Number of retry attempts before giving up</div>
            </div>
            
            <div class="form-group">
                <label for="timeout">Request Timeout (ms)</label>
                <input type="number" id="timeout" value="${config.timeout_ms}" min="1000" max="120000" step="1000">
                <div class="description">Maximum time to wait for a response</div>
            </div>
            
            <div class="form-group">
                <button onclick="saveConfiguration()">Save Configuration</button>
                <button class="secondary" onclick="resetConfiguration()">Reset to Defaults</button>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                
                function saveConfiguration() {
                    const config = {
                        load_balancing: document.getElementById('loadBalancing').value,
                        failover_enabled: document.getElementById('failoverEnabled').checked,
                        max_retries: parseInt(document.getElementById('maxRetries').value),
                        timeout_ms: parseInt(document.getElementById('timeout').value),
                        preferred_models: ${JSON.stringify(config.preferred_models)},
                        fallback_models: ${JSON.stringify(config.fallback_models)}
                    };
                    
                    vscode.postMessage({
                        command: 'updateConfig',
                        config: config
                    });
                }
                
                function resetConfiguration() {
                    if (confirm('Are you sure you want to reset all configuration to defaults?')) {
                        vscode.postMessage({
                            command: 'resetConfig'
                        });
                    }
                }
            </script>
        </body>
        </html>`;
    }
}
exports.AIModelsProvider = AIModelsProvider;
//# sourceMappingURL=ai-models-provider.js.map
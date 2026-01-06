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
exports.TemplatesProvider = void 0;
const vscode = __importStar(require("vscode"));
const axios_1 = __importDefault(require("axios"));
class TemplatesProvider {
    constructor(baseUrl = 'http://localhost:3000') {
        this.baseUrl = baseUrl;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.templates = [];
        this.loading = false;
        this.refresh();
    }
    refresh() {
        this.loading = true;
        this._onDidChangeTreeData.fire();
        this.loadTemplates();
    }
    getTreeItem(element) {
        if ('templates' in element) {
            // This is a category
            const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.Expanded);
            item.iconPath = new vscode.ThemeIcon('folder');
            item.contextValue = 'category';
            return item;
        }
        else {
            // This is a template
            const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.None);
            item.description = element.description;
            item.tooltip = new vscode.MarkdownString(`**${element.name}**\n\n` +
                `${element.description}\n\n` +
                `**Author:** ${element.author}\n` +
                `**Rating:** ${'⭐'.repeat(Math.floor(element.rating))} (${element.rating})\n` +
                `**Downloads:** ${element.downloads.toLocaleString()}\n` +
                `**Tags:** ${element.tags.join(', ')}`);
            // Set icon based on category or use default
            if (element.icon) {
                item.iconPath = new vscode.ThemeIcon(element.icon);
            }
            else {
                switch (element.category) {
                    case 'AI/ML':
                        item.iconPath = new vscode.ThemeIcon('circuit-board');
                        break;
                    case 'Web Development':
                        item.iconPath = new vscode.ThemeIcon('globe');
                        break;
                    case 'Mobile':
                        item.iconPath = new vscode.ThemeIcon('device-mobile');
                        break;
                    case 'Enterprise':
                        item.iconPath = new vscode.ThemeIcon('building');
                        break;
                    default:
                        item.iconPath = new vscode.ThemeIcon('file-code');
                }
            }
            // Add featured badge
            if (element.featured) {
                item.iconPath = new vscode.ThemeIcon('star-full');
            }
            item.contextValue = 'template';
            item.command = {
                command: 'vibecode.templates.preview',
                title: 'Preview Template',
                arguments: [element]
            };
            return item;
        }
    }
    getChildren(element) {
        if (this.loading) {
            return Promise.resolve([]);
        }
        if (!element) {
            // Return categories
            return Promise.resolve(this.templates);
        }
        if ('templates' in element) {
            // Return templates in this category
            return Promise.resolve(element.templates);
        }
        return Promise.resolve([]);
    }
    async loadTemplates() {
        try {
            const response = await axios_1.default.get(`${this.baseUrl}/api/templates`);
            const templates = response.data;
            // Group templates by category
            const categorized = new Map();
            templates.forEach(template => {
                if (!categorized.has(template.category)) {
                    categorized.set(template.category, []);
                }
                categorized.get(template.category).push(template);
            });
            // Convert to category objects and sort
            this.templates = Array.from(categorized.entries())
                .map(([name, templates]) => ({
                name,
                templates: templates.sort((a, b) => {
                    // Featured templates first, then by rating
                    if (a.featured && !b.featured)
                        return -1;
                    if (!a.featured && b.featured)
                        return 1;
                    return b.rating - a.rating;
                })
            }))
                .sort((a, b) => a.name.localeCompare(b.name));
            this.loading = false;
            this._onDidChangeTreeData.fire();
        }
        catch (error) {
            console.error('Failed to load templates:', error);
            this.loading = false;
            this._onDidChangeTreeData.fire();
            vscode.window.showErrorMessage('Failed to load templates from marketplace. Please check your connection and try again.', 'Retry').then(selection => {
                if (selection === 'Retry') {
                    this.refresh();
                }
            });
        }
    }
    async createProjectFromTemplate(template) {
        try {
            // Show input box for project name
            const projectName = await vscode.window.showInputBox({
                prompt: `Enter name for your new ${template.name} project`,
                value: template.name.toLowerCase().replace(/\s+/g, '-'),
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return 'Project name is required';
                    }
                    if (!/^[a-zA-Z0-9-_]+$/.test(value.trim())) {
                        return 'Project name can only contain letters, numbers, hyphens, and underscores';
                    }
                    return null;
                }
            });
            if (!projectName) {
                return;
            }
            // Show folder picker for project location
            const folderUri = await vscode.window.showOpenDialog({
                canSelectFolders: true,
                canSelectFiles: false,
                canSelectMany: false,
                openLabel: 'Select Project Location'
            });
            if (!folderUri || folderUri.length === 0) {
                return;
            }
            // Show progress while creating project
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Creating ${template.name} project...`,
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 10, message: 'Initializing project...' });
                const response = await axios_1.default.post(`${this.baseUrl}/api/ai/generate-project`, {
                    templateId: template.id,
                    projectName: projectName.trim(),
                    targetPath: folderUri[0].fsPath
                });
                progress.report({ increment: 50, message: 'Generating files...' });
                // Poll for completion if needed
                const { workspaceId } = response.data;
                if (workspaceId) {
                    progress.report({ increment: 30, message: 'Finalizing project...' });
                    // Open the new project
                    const projectPath = vscode.Uri.file(`${folderUri[0].fsPath}/${projectName.trim()}`);
                    await vscode.commands.executeCommand('vscode.openFolder', projectPath, true);
                }
            });
            vscode.window.showInformationMessage(`Successfully created ${template.name} project!`, 'Open Project', 'View in Explorer').then(selection => {
                if (selection === 'Open Project') {
                    const projectPath = vscode.Uri.file(`${folderUri[0].fsPath}/${projectName.trim()}`);
                    vscode.commands.executeCommand('vscode.openFolder', projectPath, true);
                }
                else if (selection === 'View in Explorer') {
                    const projectPath = vscode.Uri.file(`${folderUri[0].fsPath}/${projectName.trim()}`);
                    vscode.commands.executeCommand('revealFileInOS', projectPath);
                }
            });
        }
        catch (error) {
            console.error('Failed to create project from template:', error);
            vscode.window.showErrorMessage(`Failed to create project from template: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async previewTemplate(template) {
        // Create a webview to show template details
        const panel = vscode.window.createWebviewPanel('templatePreview', `Preview: ${template.name}`, vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true
        });
        panel.webview.html = this.getTemplatePreviewHtml(template);
        // Handle messages from webview
        panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'createProject':
                    panel.dispose();
                    await this.createProjectFromTemplate(template);
                    break;
                case 'viewInMarketplace':
                    vscode.env.openExternal(vscode.Uri.parse(`${this.baseUrl}/marketplace?template=${template.id}`));
                    break;
            }
        });
    }
    getTemplatePreviewHtml(template) {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Template Preview</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                        margin: 0;
                        padding: 20px;
                        line-height: 1.6;
                    }
                    .header {
                        display: flex;
                        align-items: center;
                        gap: 15px;
                        margin-bottom: 20px;
                        padding-bottom: 15px;
                        border-bottom: 1px solid var(--vscode-panel-border);
                    }
                    .title {
                        font-size: 24px;
                        font-weight: bold;
                        margin: 0;
                    }
                    .meta {
                        display: flex;
                        gap: 20px;
                        margin-bottom: 20px;
                    }
                    .meta-item {
                        display: flex;
                        align-items: center;
                        gap: 5px;
                    }
                    .description {
                        margin-bottom: 20px;
                        font-size: 16px;
                    }
                    .tags {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 8px;
                        margin-bottom: 20px;
                    }
                    .tag {
                        background-color: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 12px;
                    }
                    .actions {
                        display: flex;
                        gap: 10px;
                        margin-top: 30px;
                    }
                    button {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 10px 20px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                    }
                    button:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                    .secondary {
                        background-color: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                    }
                    .secondary:hover {
                        background-color: var(--vscode-button-secondaryHoverBackground);
                    }
                    .featured-badge {
                        background-color: var(--vscode-statusBarItem-warningBackground);
                        color: var(--vscode-statusBarItem-warningForeground);
                        padding: 2px 6px;
                        border-radius: 3px;
                        font-size: 11px;
                        font-weight: bold;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1 class="title">${template.name}</h1>
                    ${template.featured ? '<span class="featured-badge">FEATURED</span>' : ''}
                </div>
                
                <div class="meta">
                    <div class="meta-item">
                        <span>⭐</span>
                        <span>${template.rating} / 5</span>
                    </div>
                    <div class="meta-item">
                        <span>📥</span>
                        <span>${template.downloads.toLocaleString()} downloads</span>
                    </div>
                    <div class="meta-item">
                        <span>👤</span>
                        <span>${template.author}</span>
                    </div>
                    <div class="meta-item">
                        <span>📁</span>
                        <span>${template.category}</span>
                    </div>
                </div>

                <div class="description">
                    ${template.description}
                </div>

                <div class="tags">
                    ${template.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>

                <div class="actions">
                    <button onclick="createProject()">Create Project</button>
                    <button class="secondary" onclick="viewInMarketplace()">View in Marketplace</button>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();
                    
                    function createProject() {
                        vscode.postMessage({ command: 'createProject' });
                    }
                    
                    function viewInMarketplace() {
                        vscode.postMessage({ command: 'viewInMarketplace' });
                    }
                </script>
            </body>
            </html>
        `;
    }
}
exports.TemplatesProvider = TemplatesProvider;
//# sourceMappingURL=templates-provider.js.map
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
exports.GitHubProvider = void 0;
const vscode = __importStar(require("vscode"));
const axios_1 = __importDefault(require("axios"));
class GitHubProvider {
    constructor(baseUrl = 'http://localhost:3000') {
        this.baseUrl = baseUrl;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.repos = [];
        this.workflows = new Map();
        this.authenticated = false;
        this.checkAuthentication();
    }
    refresh() {
        this.checkAuthentication();
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        if ('type' in element && element.type === 'category') {
            const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Expanded);
            item.iconPath = new vscode.ThemeIcon('folder');
            return item;
        }
        if ('fullName' in element) {
            // This is a repository
            const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.Collapsed);
            item.description = element.private ? '🔒 Private' : '🌐 Public';
            item.tooltip = `${element.fullName}\nDefault branch: ${element.defaultBranch}`;
            item.iconPath = new vscode.ThemeIcon('repo');
            item.contextValue = 'githubRepo';
            item.command = {
                command: 'vibecode.github.openRepo',
                title: 'Open Repository',
                arguments: [element]
            };
            return item;
        }
        if ('status' in element) {
            // This is a workflow
            const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.None);
            if (element.lastRun) {
                const statusIcon = element.lastRun.status === 'success' ? '✅' :
                    element.lastRun.status === 'failure' ? '❌' : '🔄';
                item.description = `${statusIcon} ${element.lastRun.status}`;
                item.tooltip = `Last run: ${new Date(element.lastRun.createdAt).toLocaleString()}`;
            }
            item.iconPath = new vscode.ThemeIcon('play');
            item.contextValue = 'githubWorkflow';
            return item;
        }
        return new vscode.TreeItem('Unknown item');
    }
    getChildren(element) {
        if (!this.authenticated) {
            return Promise.resolve([]);
        }
        if (!element) {
            // Root level - show categories
            return Promise.resolve([
                { type: 'category', label: 'Repositories', children: [] },
                { type: 'category', label: 'Actions', children: [] }
            ]);
        }
        if ('type' in element && element.type === 'category') {
            if (element.label === 'Repositories') {
                return Promise.resolve(this.repos);
            }
            if (element.label === 'Actions') {
                // Show workflows from all repos
                const allWorkflows = [];
                this.workflows.forEach(workflows => allWorkflows.push(...workflows));
                return Promise.resolve(allWorkflows);
            }
        }
        if ('fullName' in element) {
            // Show workflows for this repository
            const repoWorkflows = this.workflows.get(element.id) || [];
            return Promise.resolve(repoWorkflows);
        }
        return Promise.resolve([]);
    }
    async checkAuthentication() {
        try {
            const response = await axios_1.default.get(`${this.baseUrl}/api/github/auth-status`);
            this.authenticated = response.data.authenticated;
            if (this.authenticated) {
                await this.loadRepositories();
            }
        }
        catch (error) {
            this.authenticated = false;
            console.error('Failed to check GitHub authentication:', error);
        }
    }
    async loadRepositories() {
        try {
            const response = await axios_1.default.get(`${this.baseUrl}/api/github/repositories`);
            this.repos = response.data;
            // Load workflows for each repository
            for (const repo of this.repos) {
                try {
                    const workflowResponse = await axios_1.default.get(`${this.baseUrl}/api/github/repositories/${repo.id}/workflows`);
                    this.workflows.set(repo.id, workflowResponse.data);
                }
                catch (error) {
                    console.error(`Failed to load workflows for ${repo.name}:`, error);
                    this.workflows.set(repo.id, []);
                }
            }
        }
        catch (error) {
            console.error('Failed to load repositories:', error);
            this.repos = [];
        }
    }
    async authenticateWithGitHub() {
        try {
            // Get authentication URL
            const response = await axios_1.default.get(`${this.baseUrl}/api/github/auth-url`);
            const authUrl = response.data.url;
            // Open browser for authentication
            await vscode.env.openExternal(vscode.Uri.parse(authUrl));
            // Show message and wait for completion
            const result = await vscode.window.showInformationMessage('Please complete GitHub authentication in your browser, then click "Done".', 'Done', 'Cancel');
            if (result === 'Done') {
                await this.checkAuthentication();
                this._onDidChangeTreeData.fire();
                if (this.authenticated) {
                    vscode.window.showInformationMessage('Successfully authenticated with GitHub!');
                }
                else {
                    vscode.window.showWarningMessage('GitHub authentication may not be complete. Please try again.');
                }
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to authenticate with GitHub: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async createRepository() {
        if (!this.authenticated) {
            vscode.window.showErrorMessage('Please authenticate with GitHub first.');
            return;
        }
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }
        try {
            // Get repository details
            const repoName = await vscode.window.showInputBox({
                prompt: 'Enter repository name',
                value: workspaceFolder.name,
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return 'Repository name is required';
                    }
                    if (!/^[a-zA-Z0-9\-_.]+$/.test(value.trim())) {
                        return 'Repository name can only contain letters, numbers, hyphens, periods, and underscores';
                    }
                    return null;
                }
            });
            if (!repoName)
                return;
            const description = await vscode.window.showInputBox({
                prompt: 'Enter repository description (optional)',
                value: ''
            });
            const isPrivate = await vscode.window.showQuickPick(['Public', 'Private'], { placeHolder: 'Select repository visibility' });
            if (!isPrivate)
                return;
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Creating GitHub repository...',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 20, message: 'Creating repository...' });
                const response = await axios_1.default.post(`${this.baseUrl}/api/github/repositories`, {
                    name: repoName.trim(),
                    description: description?.trim() || '',
                    private: isPrivate === 'Private',
                    projectPath: workspaceFolder.uri.fsPath
                });
                progress.report({ increment: 50, message: 'Setting up local git...' });
                const { repository, cloneUrl } = response.data;
                progress.report({ increment: 30, message: 'Pushing initial commit...' });
                // Repository is created and initial push is done by the backend
            });
            await this.refresh();
            vscode.window.showInformationMessage(`Successfully created repository: ${repoName}`);
        }
        catch (error) {
            console.error('Failed to create repository:', error);
            vscode.window.showErrorMessage(`Failed to create repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async setupWorkflow(repo) {
        if (!this.authenticated) {
            vscode.window.showErrorMessage('Please authenticate with GitHub first.');
            return;
        }
        try {
            // If no repo provided, let user select one
            if (!repo) {
                if (this.repos.length === 0) {
                    vscode.window.showErrorMessage('No repositories available');
                    return;
                }
                const repoItems = this.repos.map(r => ({
                    label: r.name,
                    description: r.fullName,
                    repo: r
                }));
                const selected = await vscode.window.showQuickPick(repoItems, {
                    placeHolder: 'Select repository to setup workflow'
                });
                if (!selected)
                    return;
                repo = selected.repo;
            }
            // Select workflow type
            const workflowTypes = [
                { label: 'Node.js CI/CD', description: 'Build, test, and deploy Node.js applications', id: 'nodejs' },
                { label: 'React App', description: 'Build and deploy React applications', id: 'react' },
                { label: 'Next.js App', description: 'Build and deploy Next.js applications', id: 'nextjs' },
                { label: 'Docker Build', description: 'Build and push Docker images', id: 'docker' },
                { label: 'Python CI/CD', description: 'Build, test, and deploy Python applications', id: 'python' }
            ];
            const selectedWorkflow = await vscode.window.showQuickPick(workflowTypes, {
                placeHolder: 'Select workflow template'
            });
            if (!selectedWorkflow)
                return;
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Setting up GitHub workflow...',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 30, message: 'Generating workflow file...' });
                await axios_1.default.post(`${this.baseUrl}/api/github/repositories/${repo.id}/workflows`, {
                    type: selectedWorkflow.id,
                    autoTrigger: true
                });
                progress.report({ increment: 70, message: 'Workflow created successfully!' });
            });
            await this.refresh();
            vscode.window.showInformationMessage(`Successfully setup ${selectedWorkflow.label} workflow!`);
        }
        catch (error) {
            console.error('Failed to setup workflow:', error);
            vscode.window.showErrorMessage(`Failed to setup workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async openRepository(repo) {
        await vscode.env.openExternal(vscode.Uri.parse(repo.url));
    }
    async triggerWorkflow(workflow) {
        try {
            await axios_1.default.post(`${this.baseUrl}/api/github/workflows/${workflow.id}/trigger`);
            vscode.window.showInformationMessage(`Triggered workflow: ${workflow.name}`);
            // Refresh after a delay to show updated status
            setTimeout(() => this.refresh(), 2000);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to trigger workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
exports.GitHubProvider = GitHubProvider;
//# sourceMappingURL=github-provider.js.map
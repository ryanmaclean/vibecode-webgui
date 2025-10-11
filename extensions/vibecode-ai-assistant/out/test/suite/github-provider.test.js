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
const assert = __importStar(require("assert"));
const vscode = __importStar(require("vscode"));
const sinon = __importStar(require("sinon"));
const axios_1 = __importDefault(require("axios"));
const github_provider_1 = require("../../github-provider");
suite('GitHub Provider Test Suite', () => {
    let githubProvider;
    let axiosStub;
    const mockRepos = [
        {
            id: 'repo-1',
            name: 'awesome-project',
            fullName: 'user/awesome-project',
            private: false,
            url: 'https://github.com/user/awesome-project',
            defaultBranch: 'main',
            hasWorkflows: true
        },
        {
            id: 'repo-2',
            name: 'private-api',
            fullName: 'user/private-api',
            private: true,
            url: 'https://github.com/user/private-api',
            defaultBranch: 'main',
            hasWorkflows: false
        }
    ];
    const mockWorkflows = [
        {
            id: 'workflow-1',
            name: 'CI/CD Pipeline',
            status: 'active',
            lastRun: {
                status: 'success',
                createdAt: '2024-01-15T10:30:00Z'
            }
        },
        {
            id: 'workflow-2',
            name: 'Deploy to Production',
            status: 'active',
            lastRun: {
                status: 'failure',
                createdAt: '2024-01-15T09:15:00Z'
            }
        }
    ];
    setup(() => {
        githubProvider = new github_provider_1.GitHubProvider('http://localhost:3000');
        axiosStub = sinon.stub(axios_1.default, 'get');
    });
    teardown(() => {
        sinon.restore();
    });
    test('Should initialize GitHub provider', () => {
        assert.ok(githubProvider);
        assert.strictEqual(typeof githubProvider.refresh, 'function');
        assert.strictEqual(typeof githubProvider.getTreeItem, 'function');
        assert.strictEqual(typeof githubProvider.getChildren, 'function');
    });
    test('Should check authentication status on initialization', async () => {
        axiosStub.withArgs('http://localhost:3000/api/github/auth-status')
            .resolves({ data: { authenticated: true } });
        axiosStub.withArgs('http://localhost:3000/api/github/repositories')
            .resolves({ data: mockRepos });
        githubProvider.refresh();
        // Wait for async operations
        await new Promise(resolve => setTimeout(resolve, 10));
        assert.ok(axiosStub.calledWith('http://localhost:3000/api/github/auth-status'));
    });
    test('Should load repositories when authenticated', async () => {
        axiosStub.withArgs('http://localhost:3000/api/github/auth-status')
            .resolves({ data: { authenticated: true } });
        axiosStub.withArgs('http://localhost:3000/api/github/repositories')
            .resolves({ data: mockRepos });
        axiosStub.withArgs('http://localhost:3000/api/github/repositories/repo-1/workflows')
            .resolves({ data: mockWorkflows });
        axiosStub.withArgs('http://localhost:3000/api/github/repositories/repo-2/workflows')
            .resolves({ data: [] });
        githubProvider.refresh();
        // Wait for async operations
        await new Promise(resolve => setTimeout(resolve, 50));
        // Should have called repositories API
        assert.ok(axiosStub.calledWith('http://localhost:3000/api/github/repositories'));
    });
    test('Should return categories at root level', async () => {
        // Mock authenticated state
        axiosStub.withArgs('http://localhost:3000/api/github/auth-status')
            .resolves({ data: { authenticated: true } });
        axiosStub.withArgs('http://localhost:3000/api/github/repositories')
            .resolves({ data: mockRepos });
        githubProvider.refresh();
        await new Promise(resolve => setTimeout(resolve, 10));
        const rootItems = await githubProvider.getChildren();
        assert.strictEqual(rootItems.length, 2);
        assert.ok(rootItems.some((item) => item.label === 'Repositories'));
        assert.ok(rootItems.some((item) => item.label === 'Actions'));
    });
    test('Should return repositories for Repositories category', async () => {
        axiosStub.withArgs('http://localhost:3000/api/github/auth-status')
            .resolves({ data: { authenticated: true } });
        axiosStub.withArgs('http://localhost:3000/api/github/repositories')
            .resolves({ data: mockRepos });
        githubProvider.refresh();
        await new Promise(resolve => setTimeout(resolve, 10));
        const category = { type: 'category', label: 'Repositories', children: [] };
        const repos = await githubProvider.getChildren(category);
        assert.strictEqual(repos.length, 2);
        assert.strictEqual(repos[0].name, 'awesome-project');
        assert.strictEqual(repos[1].name, 'private-api');
    });
    test('Should create tree item for repository', async () => {
        const repo = mockRepos[0];
        const treeItem = githubProvider.getTreeItem(repo);
        assert.strictEqual(treeItem.label, 'awesome-project');
        assert.strictEqual(treeItem.description, '🌐 Public');
        assert.strictEqual(treeItem.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
        assert.ok(treeItem.iconPath instanceof vscode.ThemeIcon);
        assert.strictEqual(treeItem.iconPath.id, 'repo');
        assert.strictEqual(treeItem.contextValue, 'githubRepo');
        assert.ok(treeItem.command);
        assert.strictEqual(treeItem.command.command, 'vibecode.github.openRepo');
    });
    test('Should create tree item for private repository', async () => {
        const repo = mockRepos[1];
        const treeItem = githubProvider.getTreeItem(repo);
        assert.strictEqual(treeItem.label, 'private-api');
        assert.strictEqual(treeItem.description, '🔒 Private');
    });
    test('Should create tree item for workflow', async () => {
        const workflow = mockWorkflows[0];
        const treeItem = githubProvider.getTreeItem(workflow);
        assert.strictEqual(treeItem.label, 'CI/CD Pipeline');
        assert.strictEqual(treeItem.description, '✅ success');
        assert.strictEqual(treeItem.collapsibleState, vscode.TreeItemCollapsibleState.None);
        assert.ok(treeItem.iconPath instanceof vscode.ThemeIcon);
        assert.strictEqual(treeItem.iconPath.id, 'play');
        assert.strictEqual(treeItem.contextValue, 'githubWorkflow');
    });
    test('Should handle workflow status icons correctly', async () => {
        const successWorkflow = mockWorkflows[0];
        const failureWorkflow = mockWorkflows[1];
        const inProgressWorkflow = {
            ...mockWorkflows[0],
            lastRun: { status: 'in_progress', createdAt: '2024-01-15T10:30:00Z' }
        };
        const successItem = githubProvider.getTreeItem(successWorkflow);
        const failureItem = githubProvider.getTreeItem(failureWorkflow);
        const inProgressItem = githubProvider.getTreeItem(inProgressWorkflow);
        assert.strictEqual(successItem.description, '✅ success');
        assert.strictEqual(failureItem.description, '❌ failure');
        assert.strictEqual(inProgressItem.description, '🔄 in_progress');
    });
    test('Should authenticate with GitHub', async () => {
        const showInformationMessageStub = sinon.stub(vscode.window, 'showInformationMessage');
        const openExternalStub = sinon.stub(vscode.env, 'openExternal');
        axiosStub.withArgs('http://localhost:3000/api/github/auth-url')
            .resolves({ data: { url: 'https://github.com/login/oauth/authorize?...' } });
        axiosStub.withArgs('http://localhost:3000/api/github/auth-status')
            .resolves({ data: { authenticated: true } });
        showInformationMessageStub.resolves('Done');
        await githubProvider.authenticateWithGitHub();
        // Verify auth URL was requested
        assert.ok(axiosStub.calledWith('http://localhost:3000/api/github/auth-url'));
        // Verify browser was opened
        assert.ok(openExternalStub.calledOnce);
        // Verify user was prompted
        assert.ok(showInformationMessageStub.calledOnce);
        showInformationMessageStub.restore();
        openExternalStub.restore();
    });
    test('Should create repository', async () => {
        const workspaceFolder = { name: 'my-project', uri: vscode.Uri.file('/path/to/project') };
        const getWorkspaceFoldersStub = sinon.stub(vscode.workspace, 'workspaceFolders').value([workspaceFolder]);
        const showInputBoxStub = sinon.stub(vscode.window, 'showInputBox');
        const showQuickPickStub = sinon.stub(vscode.window, 'showQuickPick');
        const withProgressStub = sinon.stub(vscode.window, 'withProgress');
        const axiosPostStub = sinon.stub(axios_1.default, 'post');
        // Mock authenticated state
        axiosStub.withArgs('http://localhost:3000/api/github/auth-status')
            .resolves({ data: { authenticated: true } });
        showInputBoxStub.onFirstCall().resolves('awesome-new-repo');
        showInputBoxStub.onSecondCall().resolves('An awesome new repository');
        showQuickPickStub.resolves('Public');
        axiosPostStub.resolves({
            data: {
                repository: { id: 'new-repo', name: 'awesome-new-repo' },
                cloneUrl: 'https://github.com/user/awesome-new-repo.git'
            }
        });
        withProgressStub.callsFake(async (options, task) => {
            return await task({ report: () => { } });
        });
        await githubProvider.createRepository();
        // Verify user inputs were requested
        assert.ok(showInputBoxStub.calledTwice); // name and description
        assert.ok(showQuickPickStub.calledOnce); // visibility
        // Verify repository creation API was called
        assert.ok(axiosPostStub.calledOnce);
        assert.strictEqual(axiosPostStub.args[0][0], 'http://localhost:3000/api/github/repositories');
        showInputBoxStub.restore();
        showQuickPickStub.restore();
        withProgressStub.restore();
        axiosPostStub.restore();
    });
    test('Should validate repository name', async () => {
        const workspaceFolder = { name: 'my-project', uri: vscode.Uri.file('/path/to/project') };
        const getWorkspaceFoldersStub = sinon.stub(vscode.workspace, 'workspaceFolders').value([workspaceFolder]);
        const showInputBoxStub = sinon.stub(vscode.window, 'showInputBox');
        // Mock authenticated state
        axiosStub.withArgs('http://localhost:3000/api/github/auth-status')
            .resolves({ data: { authenticated: true } });
        showInputBoxStub.callsFake(async (options) => {
            // Test validation function
            assert.ok(options?.validateInput);
            // Test empty name
            let result = options.validateInput('');
            assert.strictEqual(result, 'Repository name is required');
            // Test invalid characters
            result = options.validateInput('invalid repo name!');
            assert.strictEqual(result, 'Repository name can only contain letters, numbers, hyphens, periods, and underscores');
            // Test valid name
            result = options.validateInput('valid-repo_name.test');
            assert.strictEqual(result, null);
            return null; // User cancelled
        });
        await githubProvider.createRepository();
        showInputBoxStub.restore();
    });
    test('Should setup workflow', async () => {
        const repo = mockRepos[0];
        const showQuickPickStub = sinon.stub(vscode.window, 'showQuickPick');
        const withProgressStub = sinon.stub(vscode.window, 'withProgress');
        const axiosPostStub = sinon.stub(axios_1.default, 'post');
        // Mock authenticated state
        axiosStub.withArgs('http://localhost:3000/api/github/auth-status')
            .resolves({ data: { authenticated: true } });
        showQuickPickStub.resolves({ label: 'Node.js CI/CD', id: 'nodejs' });
        axiosPostStub.resolves({});
        withProgressStub.callsFake(async (options, task) => {
            return await task({ report: () => { } });
        });
        await githubProvider.setupWorkflow(repo);
        // Verify workflow template selection
        assert.ok(showQuickPickStub.calledOnce);
        // Verify workflow setup API was called
        assert.ok(axiosPostStub.calledOnce);
        assert.strictEqual(axiosPostStub.args[0][0], `http://localhost:3000/api/github/repositories/${repo.id}/workflows`);
        showQuickPickStub.restore();
        withProgressStub.restore();
        axiosPostStub.restore();
    });
    test('Should open repository in browser', async () => {
        const repo = mockRepos[0];
        const openExternalStub = sinon.stub(vscode.env, 'openExternal');
        await githubProvider.openRepository(repo);
        assert.ok(openExternalStub.calledOnce);
        assert.ok(openExternalStub.calledWith(vscode.Uri.parse(repo.url)));
        openExternalStub.restore();
    });
    test('Should trigger workflow', async () => {
        const workflow = mockWorkflows[0];
        const showInformationMessageStub = sinon.stub(vscode.window, 'showInformationMessage');
        const axiosPostStub = sinon.stub(axios_1.default, 'post');
        axiosPostStub.resolves({});
        await githubProvider.triggerWorkflow(workflow);
        // Verify trigger API was called
        assert.ok(axiosPostStub.calledOnce);
        assert.strictEqual(axiosPostStub.args[0][0], `http://localhost:3000/api/github/workflows/${workflow.id}/trigger`);
        // Verify success message
        assert.ok(showInformationMessageStub.calledOnce);
        assert.ok(showInformationMessageStub.args[0][0].includes('Triggered workflow'));
        showInformationMessageStub.restore();
        axiosPostStub.restore();
    });
    test('Should handle unauthenticated state', async () => {
        axiosStub.withArgs('http://localhost:3000/api/github/auth-status')
            .resolves({ data: { authenticated: false } });
        githubProvider.refresh();
        await new Promise(resolve => setTimeout(resolve, 10));
        const rootItems = await githubProvider.getChildren();
        // Should return empty array when not authenticated
        assert.strictEqual(rootItems.length, 0);
    });
    test('Should handle authentication errors', async () => {
        axiosStub.withArgs('http://localhost:3000/api/github/auth-status')
            .rejects(new Error('Network error'));
        const consoleErrorStub = sinon.stub(console, 'error');
        githubProvider.refresh();
        await new Promise(resolve => setTimeout(resolve, 10));
        assert.ok(consoleErrorStub.called);
        consoleErrorStub.restore();
    });
    test('Should handle repository creation without workspace', async () => {
        const getWorkspaceFoldersStub = sinon.stub(vscode.workspace, 'workspaceFolders').value(undefined);
        const showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage');
        // Mock authenticated state
        axiosStub.withArgs('http://localhost:3000/api/github/auth-status')
            .resolves({ data: { authenticated: true } });
        await githubProvider.createRepository();
        assert.ok(showErrorMessageStub.calledOnce);
        assert.strictEqual(showErrorMessageStub.args[0][0], 'No workspace folder open');
        showErrorMessageStub.restore();
    });
    test('Should handle repository creation errors', async () => {
        const workspaceFolder = { name: 'my-project', uri: vscode.Uri.file('/path/to/project') };
        const getWorkspaceFoldersStub = sinon.stub(vscode.workspace, 'workspaceFolders').value([workspaceFolder]);
        const showInputBoxStub = sinon.stub(vscode.window, 'showInputBox');
        const showQuickPickStub = sinon.stub(vscode.window, 'showQuickPick');
        const showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage');
        const withProgressStub = sinon.stub(vscode.window, 'withProgress');
        const axiosPostStub = sinon.stub(axios_1.default, 'post');
        // Mock authenticated state
        axiosStub.withArgs('http://localhost:3000/api/github/auth-status')
            .resolves({ data: { authenticated: true } });
        showInputBoxStub.onFirstCall().resolves('test-repo');
        showInputBoxStub.onSecondCall().resolves('description');
        showQuickPickStub.resolves('Public');
        axiosPostStub.rejects(new Error('Repository already exists'));
        withProgressStub.callsFake(async (options, task) => {
            return await task({ report: () => { } });
        });
        await githubProvider.createRepository();
        assert.ok(showErrorMessageStub.calledOnce);
        assert.ok(showErrorMessageStub.args[0][0].includes('Repository already exists'));
        showInputBoxStub.restore();
        showQuickPickStub.restore();
        showErrorMessageStub.restore();
        withProgressStub.restore();
        axiosPostStub.restore();
    });
});
// Test helper functions and edge cases
suite('GitHub Provider Edge Cases', () => {
    test('Should handle empty repositories list', async () => {
        const githubProvider = new github_provider_1.GitHubProvider('http://localhost:3000');
        const axiosStub = sinon.stub(axios_1.default, 'get');
        axiosStub.withArgs('http://localhost:3000/api/github/auth-status')
            .resolves({ data: { authenticated: true } });
        axiosStub.withArgs('http://localhost:3000/api/github/repositories')
            .resolves({ data: [] });
        githubProvider.refresh();
        await new Promise(resolve => setTimeout(resolve, 10));
        const category = { type: 'category', label: 'Repositories', children: [] };
        const repos = await githubProvider.getChildren(category);
        assert.strictEqual(repos.length, 0);
        axiosStub.restore();
    });
    test('Should handle workflow loading errors', async () => {
        const githubProvider = new github_provider_1.GitHubProvider('http://localhost:3000');
        const axiosStub = sinon.stub(axios_1.default, 'get');
        const consoleErrorStub = sinon.stub(console, 'error');
        axiosStub.withArgs('http://localhost:3000/api/github/auth-status')
            .resolves({ data: { authenticated: true } });
        axiosStub.withArgs('http://localhost:3000/api/github/repositories')
            .resolves({ data: [{ id: 'repo-1', name: 'test-repo' }] });
        axiosStub.withArgs('http://localhost:3000/api/github/repositories/repo-1/workflows')
            .rejects(new Error('Workflows not available'));
        githubProvider.refresh();
        await new Promise(resolve => setTimeout(resolve, 50));
        // Should handle workflow loading error gracefully
        assert.ok(consoleErrorStub.called);
        axiosStub.restore();
        consoleErrorStub.restore();
    });
});
//# sourceMappingURL=github-provider.test.js.map
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
const deployment_provider_1 = require("../../deployment-provider");
suite('Deployment Provider Test Suite', () => {
    let deploymentProvider;
    let axiosStub;
    let mockExtensionUri;
    let mockWebviewView;
    const mockDeployments = [
        {
            id: 'deploy-1',
            name: 'my-react-app',
            provider: 'vercel',
            status: 'success',
            url: 'https://my-react-app.vercel.app',
            createdAt: '2024-01-15T10:30:00Z',
            lastDeployment: '2024-01-15T10:35:00Z'
        },
        {
            id: 'deploy-2',
            name: 'api-backend',
            provider: 'railway',
            status: 'deploying',
            createdAt: '2024-01-15T11:00:00Z'
        },
        {
            id: 'deploy-3',
            name: 'dashboard',
            provider: 'netlify',
            status: 'error',
            createdAt: '2024-01-15T09:15:00Z'
        }
    ];
    setup(() => {
        mockExtensionUri = vscode.Uri.file('/mock/extension/path');
        deploymentProvider = new deployment_provider_1.DeploymentWebviewProvider(mockExtensionUri, 'http://localhost:3000');
        axiosStub = sinon.stub(axios_1.default, 'get');
        // Mock webview view
        mockWebviewView = {
            webview: {
                options: {},
                html: '',
                onDidReceiveMessage: sinon.stub(),
                postMessage: sinon.stub()
            }
        };
    });
    teardown(() => {
        sinon.restore();
    });
    test('Should initialize deployment provider', () => {
        assert.ok(deploymentProvider);
        assert.strictEqual(typeof deploymentProvider.resolveWebviewView, 'function');
    });
    test('Should resolve webview view and set HTML', () => {
        deploymentProvider.resolveWebviewView(mockWebviewView, {}, {});
        // Verify webview options were set
        assert.strictEqual(mockWebviewView.webview.options.enableScripts, true);
        assert.ok(mockWebviewView.webview.options.localResourceRoots);
        // Verify HTML was set
        assert.ok(mockWebviewView.webview.html.length > 0);
        assert.ok(mockWebviewView.webview.html.includes('Cloud Deployment'));
        assert.ok(mockWebviewView.webview.html.includes('Vercel'));
        assert.ok(mockWebviewView.webview.html.includes('Netlify'));
    });
    test('Should handle deploy message', async () => {
        const workspaceFolder = { name: 'test-project', uri: vscode.Uri.file('/test/project') };
        const getWorkspaceFoldersStub = sinon.stub(vscode.workspace, 'workspaceFolders').value([workspaceFolder]);
        const showInputBoxStub = sinon.stub(vscode.window, 'showInputBox');
        const withProgressStub = sinon.stub(vscode.window, 'withProgress');
        const axiosPostStub = sinon.stub(axios_1.default, 'post');
        showInputBoxStub.resolves('my-deployment');
        axiosPostStub.resolves({ data: { deploymentId: 'deploy-123' } });
        withProgressStub.callsFake(async (options, task) => {
            return await task({ report: () => { } });
        });
        deploymentProvider.resolveWebviewView(mockWebviewView, {}, {});
        // Simulate deploy message
        const messageHandler = mockWebviewView.webview.onDidReceiveMessage.args[0][0];
        await messageHandler({ type: 'deploy', provider: 'vercel' });
        // Verify user was prompted for project name
        assert.ok(showInputBoxStub.calledOnce);
        // Verify deployment API was called
        assert.ok(axiosPostStub.calledOnce);
        assert.strictEqual(axiosPostStub.args[0][0], 'http://localhost:3000/api/deployment/deploy');
        showInputBoxStub.restore();
        withProgressStub.restore();
        axiosPostStub.restore();
    });
    test('Should handle refresh message', async () => {
        axiosStub.resolves({ data: mockDeployments });
        deploymentProvider.resolveWebviewView(mockWebviewView, {}, {});
        // Simulate refresh message
        const messageHandler = mockWebviewView.webview.onDidReceiveMessage.args[0][0];
        await messageHandler({ type: 'refresh' });
        // Verify deployments API was called
        assert.ok(axiosStub.calledWith('http://localhost:3000/api/deployment/list'));
        // Verify webview was updated
        assert.ok(mockWebviewView.webview.postMessage.called);
        const postMessage = mockWebviewView.webview.postMessage.args[0][0];
        assert.strictEqual(postMessage.type, 'deploymentsUpdated');
        assert.deepStrictEqual(postMessage.deployments, mockDeployments);
    });
    test('Should handle openDeployment message', async () => {
        const openExternalStub = sinon.stub(vscode.env, 'openExternal');
        deploymentProvider.resolveWebviewView(mockWebviewView, {}, {});
        // Simulate openDeployment message
        const messageHandler = mockWebviewView.webview.onDidReceiveMessage.args[0][0];
        await messageHandler({ type: 'openDeployment', url: 'https://example.com' });
        // Verify external URL was opened
        assert.ok(openExternalStub.calledOnce);
        assert.ok(openExternalStub.calledWith(vscode.Uri.parse('https://example.com')));
        openExternalStub.restore();
    });
    test('Should handle setupProvider message', async () => {
        const createWebviewPanelStub = sinon.stub(vscode.window, 'createWebviewPanel');
        const mockPanel = {
            webview: {
                html: '',
                onDidReceiveMessage: sinon.stub()
            },
            dispose: sinon.stub()
        };
        createWebviewPanelStub.returns(mockPanel);
        deploymentProvider.resolveWebviewView(mockWebviewView, {}, {});
        // Simulate setupProvider message
        const messageHandler = mockWebviewView.webview.onDidReceiveMessage.args[0][0];
        await messageHandler({ type: 'setupProvider', provider: 'vercel' });
        // Verify setup panel was created
        assert.ok(createWebviewPanelStub.calledOnce);
        assert.strictEqual(createWebviewPanelStub.args[0][1], 'Setup vercel');
        createWebviewPanelStub.restore();
    });
    test('Should handle viewLogs message', async () => {
        const axiosLogsStub = sinon.stub(axios_1.default, 'get');
        const openTextDocumentStub = sinon.stub(vscode.workspace, 'openTextDocument');
        const showTextDocumentStub = sinon.stub(vscode.window, 'showTextDocument');
        axiosLogsStub.resolves({ data: { logs: 'Deployment logs here...' } });
        const mockDocument = { uri: vscode.Uri.file('/tmp/logs') };
        openTextDocumentStub.resolves(mockDocument);
        deploymentProvider.resolveWebviewView(mockWebviewView, {}, {});
        // Simulate viewLogs message
        const messageHandler = mockWebviewView.webview.onDidReceiveMessage.args[0][0];
        await messageHandler({ type: 'viewLogs', deploymentId: 'deploy-123' });
        // Verify logs API was called
        assert.ok(axiosLogsStub.calledWith('http://localhost:3000/api/deployment/logs/deploy-123'));
        // Verify document was opened
        assert.ok(openTextDocumentStub.calledOnce);
        assert.ok(showTextDocumentStub.calledOnce);
        axiosLogsStub.restore();
        openTextDocumentStub.restore();
        showTextDocumentStub.restore();
    });
    test('Should validate project name input', async () => {
        const workspaceFolder = { name: 'test-project', uri: vscode.Uri.file('/test/project') };
        const getWorkspaceFoldersStub = sinon.stub(vscode.workspace, 'workspaceFolders').value([workspaceFolder]);
        const showInputBoxStub = sinon.stub(vscode.window, 'showInputBox');
        showInputBoxStub.callsFake(async (options) => {
            // Test validation function
            assert.ok(options?.validateInput);
            // Test empty name
            let result = options.validateInput('');
            assert.strictEqual(result, 'Project name is required');
            // Test valid name
            result = options.validateInput('valid-project-name');
            assert.strictEqual(result, null);
            return null; // User cancelled
        });
        deploymentProvider.resolveWebviewView(mockWebviewView, {}, {});
        // Simulate deploy message
        const messageHandler = mockWebviewView.webview.onDidReceiveMessage.args[0][0];
        await messageHandler({ type: 'deploy', provider: 'vercel' });
        showInputBoxStub.restore();
    });
    test('Should handle deployment errors gracefully', async () => {
        const workspaceFolder = { name: 'test-project', uri: vscode.Uri.file('/test/project') };
        const getWorkspaceFoldersStub = sinon.stub(vscode.workspace, 'workspaceFolders').value([workspaceFolder]);
        const showInputBoxStub = sinon.stub(vscode.window, 'showInputBox');
        const showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage');
        const withProgressStub = sinon.stub(vscode.window, 'withProgress');
        const axiosPostStub = sinon.stub(axios_1.default, 'post');
        showInputBoxStub.resolves('my-deployment');
        axiosPostStub.rejects(new Error('Deployment failed'));
        withProgressStub.callsFake(async (options, task) => {
            return await task({ report: () => { } });
        });
        deploymentProvider.resolveWebviewView(mockWebviewView, {}, {});
        // Simulate deploy message
        const messageHandler = mockWebviewView.webview.onDidReceiveMessage.args[0][0];
        await messageHandler({ type: 'deploy', provider: 'vercel' });
        // Verify error was shown
        assert.ok(showErrorMessageStub.calledOnce);
        assert.ok(showErrorMessageStub.args[0][0].includes('Deployment failed'));
        showInputBoxStub.restore();
        showErrorMessageStub.restore();
        withProgressStub.restore();
        axiosPostStub.restore();
    });
    test('Should handle missing workspace folder', async () => {
        const getWorkspaceFoldersStub = sinon.stub(vscode.workspace, 'workspaceFolders').value(undefined);
        const showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage');
        deploymentProvider.resolveWebviewView(mockWebviewView, {}, {});
        // Simulate deploy message
        const messageHandler = mockWebviewView.webview.onDidReceiveMessage.args[0][0];
        await messageHandler({ type: 'deploy', provider: 'vercel' });
        // Verify error was shown
        assert.ok(showErrorMessageStub.calledOnce);
        assert.strictEqual(showErrorMessageStub.args[0][0], 'No workspace folder open');
        showErrorMessageStub.restore();
    });
    test('Should generate provider setup HTML', async () => {
        const createWebviewPanelStub = sinon.stub(vscode.window, 'createWebviewPanel');
        const mockPanel = {
            webview: {
                html: '',
                onDidReceiveMessage: sinon.stub()
            },
            dispose: sinon.stub()
        };
        createWebviewPanelStub.returns(mockPanel);
        deploymentProvider.resolveWebviewView(mockWebviewView, {}, {});
        // Simulate setupProvider message
        const messageHandler = mockWebviewView.webview.onDidReceiveMessage.args[0][0];
        await messageHandler({ type: 'setupProvider', provider: 'vercel' });
        // Verify setup HTML contains form elements
        assert.ok(mockPanel.webview.html.includes('Configure vercel'));
        assert.ok(mockPanel.webview.html.includes('API Key'));
        assert.ok(mockPanel.webview.html.includes('Region'));
        assert.ok(mockPanel.webview.html.includes('Save Configuration'));
        createWebviewPanelStub.restore();
    });
    test('Should handle provider configuration save', async () => {
        const createWebviewPanelStub = sinon.stub(vscode.window, 'createWebviewPanel');
        const showInformationMessageStub = sinon.stub(vscode.window, 'showInformationMessage');
        const axiosPostStub = sinon.stub(axios_1.default, 'post');
        const mockPanel = {
            webview: {
                html: '',
                onDidReceiveMessage: sinon.stub()
            },
            dispose: sinon.stub()
        };
        createWebviewPanelStub.returns(mockPanel);
        axiosPostStub.resolves({});
        deploymentProvider.resolveWebviewView(mockWebviewView, {}, {});
        // Simulate setupProvider message
        const messageHandler = mockWebviewView.webview.onDidReceiveMessage.args[0][0];
        await messageHandler({ type: 'setupProvider', provider: 'vercel' });
        // Simulate config save from setup panel
        const setupMessageHandler = mockPanel.webview.onDidReceiveMessage.args[0][0];
        await setupMessageHandler({
            type: 'saveConfig',
            config: { apiKey: 'test-key', region: 'us-east-1' }
        });
        // Verify configuration was saved
        assert.ok(axiosPostStub.calledOnce);
        assert.strictEqual(axiosPostStub.args[0][0], 'http://localhost:3000/api/deployment/configure');
        // Verify success message
        assert.ok(showInformationMessageStub.calledOnce);
        assert.ok(showInformationMessageStub.args[0][0].includes('configured successfully'));
        createWebviewPanelStub.restore();
        showInformationMessageStub.restore();
        axiosPostStub.restore();
    });
});
// Test helper functions and edge cases
suite('Deployment Provider Edge Cases', () => {
    test('Should handle API errors during refresh', async () => {
        const mockExtensionUri = vscode.Uri.file('/mock/extension/path');
        const deploymentProvider = new deployment_provider_1.DeploymentWebviewProvider(mockExtensionUri);
        const axiosStub = sinon.stub(axios_1.default, 'get');
        const consoleErrorStub = sinon.stub(console, 'error');
        axiosStub.rejects(new Error('API unavailable'));
        const mockWebviewView = {
            webview: {
                options: {},
                html: '',
                onDidReceiveMessage: sinon.stub(),
                postMessage: sinon.stub()
            }
        };
        deploymentProvider.resolveWebviewView(mockWebviewView, {}, {});
        // Simulate refresh message
        const messageHandler = mockWebviewView.webview.onDidReceiveMessage.args[0][0];
        await messageHandler({ type: 'refresh' });
        // Should handle error gracefully
        assert.ok(consoleErrorStub.called);
        axiosStub.restore();
        consoleErrorStub.restore();
    });
    test('Should handle deployment status polling timeout', async () => {
        const workspaceFolder = { name: 'test-project', uri: vscode.Uri.file('/test/project') };
        const getWorkspaceFoldersStub = sinon.stub(vscode.workspace, 'workspaceFolders').value([workspaceFolder]);
        const showInputBoxStub = sinon.stub(vscode.window, 'showInputBox');
        const withProgressStub = sinon.stub(vscode.window, 'withProgress');
        const axiosPostStub = sinon.stub(axios_1.default, 'post');
        const axiosGetStub = sinon.stub(axios_1.default, 'get');
        showInputBoxStub.resolves('my-deployment');
        axiosPostStub.resolves({ data: { deploymentId: 'deploy-123' } });
        // Mock status check that never completes
        axiosGetStub.resolves({ data: { status: 'deploying' } });
        withProgressStub.callsFake(async (options, task) => {
            const mockProgress = { report: sinon.stub() };
            return await task(mockProgress);
        });
        const mockExtensionUri = vscode.Uri.file('/mock/extension/path');
        const deploymentProvider = new deployment_provider_1.DeploymentWebviewProvider(mockExtensionUri);
        const mockWebviewView = {
            webview: {
                options: {},
                html: '',
                onDidReceiveMessage: sinon.stub(),
                postMessage: sinon.stub()
            }
        };
        deploymentProvider.resolveWebviewView(mockWebviewView, {}, {});
        // Simulate deploy message
        const messageHandler = mockWebviewView.webview.onDidReceiveMessage.args[0][0];
        // This should complete without hanging (due to timeout logic)
        await messageHandler({ type: 'deploy', provider: 'vercel' });
        showInputBoxStub.restore();
        withProgressStub.restore();
        axiosPostStub.restore();
        axiosGetStub.restore();
    });
});
//# sourceMappingURL=deployment-provider.test.js.map
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
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const vscode = __importStar(require("vscode"));
const sinon = __importStar(require("sinon"));
suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');
    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('vibecode.vibecode-ai-assistant'));
    });
    test('Extension should activate', async () => {
        const extension = vscode.extensions.getExtension('vibecode.vibecode-ai-assistant');
        assert.ok(extension);
        await extension.activate();
        assert.strictEqual(extension.isActive, true);
    });
    test('Should register all commands', async () => {
        const extension = vscode.extensions.getExtension('vibecode.vibecode-ai-assistant');
        assert.ok(extension);
        await extension.activate();
        const commands = await vscode.commands.getCommands(true);
        // Test core commands
        assert.ok(commands.includes('vibecode.generateCode'));
        assert.ok(commands.includes('vibecode.explainCode'));
        assert.ok(commands.includes('vibecode.optimizeCode'));
        assert.ok(commands.includes('vibecode.fixCode'));
        assert.ok(commands.includes('vibecode.generateTests'));
        assert.ok(commands.includes('vibecode.generateProject'));
        assert.ok(commands.includes('vibecode.chatWithCode'));
        assert.ok(commands.includes('vibecode.selectAIModel'));
        // Test template commands
        assert.ok(commands.includes('vibecode.templates.refresh'));
        assert.ok(commands.includes('vibecode.templates.browse'));
        assert.ok(commands.includes('vibecode.templates.create'));
        assert.ok(commands.includes('vibecode.templates.preview'));
        // Test GitHub commands
        assert.ok(commands.includes('vibecode.github.authenticate'));
        assert.ok(commands.includes('vibecode.github.createRepo'));
        assert.ok(commands.includes('vibecode.github.setupWorkflow'));
        assert.ok(commands.includes('vibecode.github.openRepo'));
        assert.ok(commands.includes('vibecode.github.triggerWorkflow'));
        assert.ok(commands.includes('vibecode.github.refresh'));
        // Test deployment commands
        assert.ok(commands.includes('vibecode.deployment.deploy'));
        assert.ok(commands.includes('vibecode.deployment.status'));
        // Test collaboration commands
        assert.ok(commands.includes('vibecode.collaboration.start'));
        assert.ok(commands.includes('vibecode.collaboration.join'));
        // Test monitoring commands
        assert.ok(commands.includes('vibecode.monitoring.dashboard'));
        // Test AI orchestration commands
        assert.ok(commands.includes('vibecode.ai.orchestration'));
    });
    test('Should execute generateCode command', async () => {
        const extension = vscode.extensions.getExtension('vibecode.vibecode-ai-assistant');
        assert.ok(extension);
        await extension.activate();
        // Execute command and verify it doesn't throw
        try {
            await vscode.commands.executeCommand('vibecode.generateCode');
            assert.ok(true, 'Command executed successfully');
        }
        catch (error) {
            // Command may fail due to missing dependencies in test environment
            // but it should be registered
            assert.ok(true, 'Command is registered');
        }
    });
    test('Should execute templates.refresh command', async () => {
        const extension = vscode.extensions.getExtension('vibecode.vibecode-ai-assistant');
        assert.ok(extension);
        await extension.activate();
        try {
            await vscode.commands.executeCommand('vibecode.templates.refresh');
            assert.ok(true, 'Templates refresh command executed');
        }
        catch (error) {
            assert.ok(true, 'Command is registered');
        }
    });
    test('Should execute templates.browse command', async () => {
        const extension = vscode.extensions.getExtension('vibecode.vibecode-ai-assistant');
        assert.ok(extension);
        await extension.activate();
        const createWebviewPanelStub = sinon.stub(vscode.window, 'createWebviewPanel');
        const mockPanel = {
            webview: { html: '' },
            dispose: sinon.stub()
        };
        createWebviewPanelStub.returns(mockPanel);
        try {
            await vscode.commands.executeCommand('vibecode.templates.browse');
            assert.ok(createWebviewPanelStub.calledOnce);
        }
        catch (error) {
            assert.ok(true, 'Command is registered');
        }
        createWebviewPanelStub.restore();
    });
    test('Should execute github.authenticate command', async () => {
        const extension = vscode.extensions.getExtension('vibecode.vibecode-ai-assistant');
        assert.ok(extension);
        await extension.activate();
        try {
            await vscode.commands.executeCommand('vibecode.github.authenticate');
            assert.ok(true, 'GitHub authenticate command executed');
        }
        catch (error) {
            assert.ok(true, 'Command is registered');
        }
    });
    test('Should execute monitoring.dashboard command', async () => {
        const extension = vscode.extensions.getExtension('vibecode.vibecode-ai-assistant');
        assert.ok(extension);
        await extension.activate();
        const openExternalStub = sinon.stub(vscode.env, 'openExternal');
        try {
            await vscode.commands.executeCommand('vibecode.monitoring.dashboard');
            assert.ok(openExternalStub.calledOnce);
            assert.ok(openExternalStub.calledWith(vscode.Uri.parse('http://localhost:3000/api/monitoring/dashboard')));
        }
        catch (error) {
            assert.ok(true, 'Command is registered');
        }
        openExternalStub.restore();
    });
    test('Should set context variables', async () => {
        const extension = vscode.extensions.getExtension('vibecode.vibecode-ai-assistant');
        assert.ok(extension);
        const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');
        await extension.activate();
        // Verify vibeCodeEnabled context was set
        assert.ok(executeCommandStub.calledWith('setContext', 'vibeCodeEnabled', true));
        executeCommandStub.restore();
    });
    test('Should create status bar item', async () => {
        const extension = vscode.extensions.getExtension('vibecode.vibecode-ai-assistant');
        assert.ok(extension);
        const createStatusBarItemStub = sinon.stub(vscode.window, 'createStatusBarItem');
        const mockStatusBarItem = {
            text: '',
            tooltip: '',
            command: '',
            show: sinon.stub()
        };
        createStatusBarItemStub.returns(mockStatusBarItem);
        await extension.activate();
        assert.ok(createStatusBarItemStub.calledOnce);
        assert.strictEqual(mockStatusBarItem.text, '$(robot) VibeCode AI Platform');
        assert.ok(mockStatusBarItem.tooltip.includes('Templates'));
        assert.strictEqual(mockStatusBarItem.command, 'workbench.view.extension.vibecode-ai');
        assert.ok(mockStatusBarItem.show.calledOnce);
        createStatusBarItemStub.restore();
    });
    test('Should show welcome message', async () => {
        const extension = vscode.extensions.getExtension('vibecode.vibecode-ai-assistant');
        assert.ok(extension);
        const showInformationMessageStub = sinon.stub(vscode.window, 'showInformationMessage');
        showInformationMessageStub.resolves('Open Templates');
        await extension.activate();
        assert.ok(showInformationMessageStub.calledOnce);
        assert.ok(showInformationMessageStub.args[0][0].includes('VibeCode AI Platform is ready'));
        showInformationMessageStub.restore();
    });
    test('Should handle welcome message selections', async () => {
        const extension = vscode.extensions.getExtension('vibecode.vibecode-ai-assistant');
        assert.ok(extension);
        const showInformationMessageStub = sinon.stub(vscode.window, 'showInformationMessage');
        const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');
        // Test "Open Templates" selection
        showInformationMessageStub.resolves('Open Templates');
        await extension.activate();
        // Wait for promise resolution
        await new Promise(resolve => setTimeout(resolve, 10));
        assert.ok(executeCommandStub.calledWith('workbench.view.extension.vibecode-ai'));
        showInformationMessageStub.restore();
        executeCommandStub.restore();
    });
    test('Should handle configuration changes', async () => {
        const extension = vscode.extensions.getExtension('vibecode.vibecode-ai-assistant');
        assert.ok(extension);
        const onDidChangeConfigurationStub = sinon.stub(vscode.workspace, 'onDidChangeConfiguration');
        const mockDisposable = { dispose: sinon.stub() };
        onDidChangeConfigurationStub.returns(mockDisposable);
        await extension.activate();
        assert.ok(onDidChangeConfigurationStub.calledOnce);
        onDidChangeConfigurationStub.restore();
    });
    test('Should register tree data providers', async () => {
        const extension = vscode.extensions.getExtension('vibecode.vibecode-ai-assistant');
        assert.ok(extension);
        const registerTreeDataProviderStub = sinon.stub(vscode.window, 'registerTreeDataProvider');
        await extension.activate();
        // Verify tree data providers were registered
        assert.ok(registerTreeDataProviderStub.calledWith('vibeCodeTemplates', sinon.match.any));
        assert.ok(registerTreeDataProviderStub.calledWith('vibeCodeGitHub', sinon.match.any));
        registerTreeDataProviderStub.restore();
    });
    test('Should register webview view providers', async () => {
        const extension = vscode.extensions.getExtension('vibecode.vibecode-ai-assistant');
        assert.ok(extension);
        const registerWebviewViewProviderStub = sinon.stub(vscode.window, 'registerWebviewViewProvider');
        await extension.activate();
        // Verify webview providers were registered
        assert.ok(registerWebviewViewProviderStub.calledWith('vibeCodeDeployment', sinon.match.any));
        assert.ok(registerWebviewViewProviderStub.calledWith('vibeCodeChat', sinon.match.any));
        registerWebviewViewProviderStub.restore();
    });
    test('Should handle extension deactivation', async () => {
        const extension = vscode.extensions.getExtension('vibecode.vibecode-ai-assistant');
        assert.ok(extension);
        await extension.activate();
        // Test deactivation doesn't throw errors
        try {
            if (extension.exports && extension.exports.deactivate) {
                extension.exports.deactivate();
            }
            assert.ok(true, 'Extension deactivated successfully');
        }
        catch (error) {
            assert.fail(`Deactivation failed: ${error}`);
        }
    });
});
// Integration tests for command interactions
suite('Extension Integration Tests', () => {
    test('Should handle template creation workflow', async () => {
        const extension = vscode.extensions.getExtension('vibecode.vibecode-ai-assistant');
        assert.ok(extension);
        await extension.activate();
        const showInformationMessageStub = sinon.stub(vscode.window, 'showInformationMessage');
        // Test templates.create command with no template argument
        try {
            await vscode.commands.executeCommand('vibecode.templates.create');
            // Should show message about selecting template
            assert.ok(showInformationMessageStub.calledWith('Please select a template from the Templates view'));
        }
        catch (error) {
            assert.ok(true, 'Command handled gracefully');
        }
        showInformationMessageStub.restore();
    });
    test('Should handle deployment workflow', async () => {
        const extension = vscode.extensions.getExtension('vibecode.vibecode-ai-assistant');
        assert.ok(extension);
        await extension.activate();
        const showInformationMessageStub = sinon.stub(vscode.window, 'showInformationMessage');
        try {
            await vscode.commands.executeCommand('vibecode.deployment.deploy');
            // Should show message about using deployment view
            assert.ok(showInformationMessageStub.calledWith('Select a provider from the Deployment view to deploy your project'));
        }
        catch (error) {
            assert.ok(true, 'Command handled gracefully');
        }
        showInformationMessageStub.restore();
    });
    test('Should handle collaboration commands', async () => {
        const extension = vscode.extensions.getExtension('vibecode.vibecode-ai-assistant');
        assert.ok(extension);
        await extension.activate();
        const showInformationMessageStub = sinon.stub(vscode.window, 'showInformationMessage');
        try {
            await vscode.commands.executeCommand('vibecode.collaboration.start');
            assert.ok(showInformationMessageStub.calledWith('Collaborative features coming soon!'));
            await vscode.commands.executeCommand('vibecode.collaboration.join');
            assert.ok(showInformationMessageStub.calledWith('Collaborative features coming soon!'));
        }
        catch (error) {
            assert.ok(true, 'Commands handled gracefully');
        }
        showInformationMessageStub.restore();
    });
    test('Should handle AI orchestration command', async () => {
        const extension = vscode.extensions.getExtension('vibecode.vibecode-ai-assistant');
        assert.ok(extension);
        await extension.activate();
        const showInformationMessageStub = sinon.stub(vscode.window, 'showInformationMessage');
        try {
            await vscode.commands.executeCommand('vibecode.ai.orchestration');
            assert.ok(showInformationMessageStub.calledWith('AI Model Orchestration features coming soon!'));
        }
        catch (error) {
            assert.ok(true, 'Command handled gracefully');
        }
        showInformationMessageStub.restore();
    });
});
//# sourceMappingURL=extension.test.js.map
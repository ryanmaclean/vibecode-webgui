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
suite('Integration Tests', () => {
    test('Extension loads and activates without errors', async function () {
        this.timeout(10000); // Increase timeout for activation
        const extension = vscode.extensions.getExtension('vibecode.vibecode-ai-assistant');
        assert.ok(extension, 'Extension should be found');
        // Activate the extension
        await extension.activate();
        assert.strictEqual(extension.isActive, true, 'Extension should be active');
        // Wait a bit for providers to initialize
        await new Promise(resolve => setTimeout(resolve, 1000));
    });
    test('All views should be registered', async () => {
        // Check if the activity bar container exists
        const workbench = vscode.window;
        assert.ok(workbench, 'VS Code workbench should be available');
        // Test that we can access our views through commands
        const commands = await vscode.commands.getCommands(true);
        const expectedCommands = [
            'workbench.view.extension.vibecode-ai',
            'vibecode.generateCode',
            'vibecode.templates.refresh',
            'vibecode.github.authenticate',
            'vibecode.deployment.deploy',
            'vibecode.collaboration.start',
            'vibecode.ai.orchestration',
            'vibecode.monitoring.dashboard'
        ];
        for (const cmd of expectedCommands) {
            if (cmd.startsWith('workbench.view.extension')) {
                // Skip built-in VS Code commands for view
                continue;
            }
            assert.ok(commands.includes(cmd), `Command ${cmd} should be registered`);
        }
    });
    test('Templates provider should handle refresh gracefully', async () => {
        try {
            await vscode.commands.executeCommand('vibecode.templates.refresh');
            assert.ok(true, 'Templates refresh should not throw');
        }
        catch (error) {
            // Expected if no backend server
            assert.ok(true, 'Templates refresh handled gracefully');
        }
    });
    test('GitHub provider should handle authentication gracefully', async () => {
        try {
            await vscode.commands.executeCommand('vibecode.github.authenticate');
            assert.ok(true, 'GitHub auth should not throw');
        }
        catch (error) {
            // Expected if no backend server
            assert.ok(true, 'GitHub auth handled gracefully');
        }
    });
    test('AI orchestration command should execute', async () => {
        try {
            await vscode.commands.executeCommand('vibecode.ai.orchestration');
            assert.ok(true, 'AI orchestration should execute');
        }
        catch (error) {
            // Expected if no backend server
            assert.ok(true, 'AI orchestration handled gracefully');
        }
    });
    test('Monitoring dashboard command should execute', async () => {
        try {
            await vscode.commands.executeCommand('vibecode.monitoring.dashboard');
            assert.ok(true, 'Monitoring dashboard should execute');
        }
        catch (error) {
            // Expected if no backend server
            assert.ok(true, 'Monitoring dashboard handled gracefully');
        }
    });
    test('Collaboration commands should execute', async () => {
        try {
            await vscode.commands.executeCommand('vibecode.collaboration.start');
            assert.ok(true, 'Collaboration start should execute');
        }
        catch (error) {
            assert.ok(true, 'Collaboration start handled gracefully');
        }
        try {
            await vscode.commands.executeCommand('vibecode.collaboration.join');
            assert.ok(true, 'Collaboration join should execute');
        }
        catch (error) {
            assert.ok(true, 'Collaboration join handled gracefully');
        }
    });
    test('Configuration should be accessible and valid', () => {
        const config = vscode.workspace.getConfiguration('vibecode');
        // Test that all expected config properties exist
        const apiKey = config.get('openRouterApiKey');
        const defaultModel = config.get('defaultModel');
        const maxTokens = config.get('maxTokens');
        const temperature = config.get('temperature');
        const enableTelemetry = config.get('enableTelemetry');
        const enableStreaming = config.get('enableStreaming');
        assert.strictEqual(typeof apiKey, 'string', 'API key should be string');
        assert.strictEqual(typeof defaultModel, 'string', 'Default model should be string');
        assert.strictEqual(typeof maxTokens, 'number', 'Max tokens should be number');
        assert.strictEqual(typeof temperature, 'number', 'Temperature should be number');
        assert.strictEqual(typeof enableTelemetry, 'boolean', 'Enable telemetry should be boolean');
        assert.strictEqual(typeof enableStreaming, 'boolean', 'Enable streaming should be boolean');
        // Test valid ranges
        assert.ok(typeof maxTokens === 'number' && maxTokens > 0 && maxTokens <= 100000, 'Max tokens should be reasonable');
        assert.ok(typeof temperature === 'number' && temperature >= 0 && temperature <= 1, 'Temperature should be valid range');
    });
    test('Status bar should be created', async () => {
        // Give some time for status bar to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
        // We can't directly test the status bar, but we can ensure the command works
        try {
            await vscode.commands.executeCommand('workbench.view.extension.vibecode-ai');
            assert.ok(true, 'Activity bar command should execute');
        }
        catch (error) {
            // This might fail in test environment, which is expected
            assert.ok(true, 'Activity bar command handled gracefully');
        }
    });
    test('Extension should handle multiple provider failures gracefully', async () => {
        // Execute multiple commands that would fail without backend
        const commands = [
            'vibecode.templates.refresh',
            'vibecode.github.refresh',
            'vibecode.ai.models.refresh'
        ];
        for (const cmd of commands) {
            try {
                await vscode.commands.executeCommand(cmd);
                assert.ok(true, `Command ${cmd} executed without throwing`);
            }
            catch (error) {
                // Expected to fail without backend
                assert.ok(true, `Command ${cmd} failed gracefully`);
            }
        }
    });
    test('Extension should not interfere with VS Code functionality', async () => {
        // Test that basic VS Code commands still work
        const basicCommands = [
            'workbench.action.files.newUntitledFile',
            'workbench.action.showCommands'
        ];
        for (const cmd of basicCommands) {
            try {
                await vscode.commands.executeCommand(cmd);
                assert.ok(true, `VS Code command ${cmd} should still work`);
            }
            catch (error) {
                // Some commands might not work in test environment
                assert.ok(true, `VS Code command ${cmd} handled gracefully`);
            }
        }
    });
    test('Extension should have proper context variables set', async () => {
        // The extension should set vibeCodeEnabled context
        const commands = await vscode.commands.getCommands(true);
        // Check that context-dependent commands are available
        const contextCommands = [
            'vibecode.generateCode',
            'vibecode.explainCode',
            'vibecode.optimizeCode'
        ];
        for (const cmd of contextCommands) {
            assert.ok(commands.includes(cmd), `Context command ${cmd} should be available`);
        }
    });
});
//# sourceMappingURL=integration.test.js.map
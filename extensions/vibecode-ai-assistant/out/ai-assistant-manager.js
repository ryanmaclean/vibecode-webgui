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
exports.AIAssistantManager = void 0;
const vscode = __importStar(require("vscode"));
class AIAssistantManager {
    constructor(openRouterClient) {
        this.openRouterClient = openRouterClient;
        this.outputChannel = vscode.window.createOutputChannel('VibeCode AI Assistant');
    }
    async explainCode() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }
        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showErrorMessage('Please select code to explain');
            return;
        }
        const selectedText = editor.document.getText(selection);
        if (!selectedText.trim()) {
            vscode.window.showErrorMessage('No code selected');
            return;
        }
        try {
            await this.validateApiKey();
            // Show progress indicator
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Explaining code...",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0 });
                const explanation = await this.openRouterClient.explainCode(selectedText);
                progress.report({ increment: 100 });
                // Create a new document with the explanation
                const doc = await vscode.workspace.openTextDocument({
                    content: `# Code Explanation\n\n## Original Code\n\`\`\`${editor.document.languageId}\n${selectedText}\n\`\`\`\n\n## Explanation\n\n${explanation}`,
                    language: 'markdown'
                });
                await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
            });
        }
        catch (error) {
            this.handleError('Failed to explain code', error);
        }
    }
    async optimizeCode() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }
        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showErrorMessage('Please select code to optimize');
            return;
        }
        const selectedText = editor.document.getText(selection);
        if (!selectedText.trim()) {
            vscode.window.showErrorMessage('No code selected');
            return;
        }
        try {
            await this.validateApiKey();
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Optimizing code...",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0 });
                const optimization = await this.openRouterClient.optimizeCode(selectedText);
                progress.report({ increment: 100 });
                // Show optimization in a new document
                const doc = await vscode.workspace.openTextDocument({
                    content: `# Code Optimization\n\n## Original Code\n\`\`\`${editor.document.languageId}\n${selectedText}\n\`\`\`\n\n## Optimization\n\n${optimization}`,
                    language: 'markdown'
                });
                await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
            });
        }
        catch (error) {
            this.handleError('Failed to optimize code', error);
        }
    }
    async fixCode() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }
        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showErrorMessage('Please select code to fix');
            return;
        }
        const selectedText = editor.document.getText(selection);
        if (!selectedText.trim()) {
            vscode.window.showErrorMessage('No code selected');
            return;
        }
        try {
            await this.validateApiKey();
            // Get diagnostic information for the selected code
            const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
            const relevantDiagnostics = diagnostics.filter(diagnostic => selection.intersection(diagnostic.range));
            const errorMessages = relevantDiagnostics.map(d => d.message).join('\n');
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Fixing code...",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0 });
                const fix = await this.openRouterClient.fixCode(selectedText, errorMessages);
                progress.report({ increment: 100 });
                // Show the fix and offer to apply it
                const action = await vscode.window.showInformationMessage('Code fix generated. Would you like to apply it?', 'Apply Fix', 'Show Fix', 'Cancel');
                if (action === 'Apply Fix') {
                    await editor.edit(editBuilder => {
                        editBuilder.replace(selection, this.extractCodeFromResponse(fix));
                    });
                }
                else if (action === 'Show Fix') {
                    const doc = await vscode.workspace.openTextDocument({
                        content: `# Code Fix\n\n## Original Code\n\`\`\`${editor.document.languageId}\n${selectedText}\n\`\`\`\n\n## Fixed Code\n\n${fix}`,
                        language: 'markdown'
                    });
                    await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
                }
            });
        }
        catch (error) {
            this.handleError('Failed to fix code', error);
        }
    }
    async selectAIModel() {
        try {
            await this.validateApiKey();
            const models = await this.openRouterClient.getModels();
            const currentModel = vscode.workspace.getConfiguration('vibecode').get('defaultModel');
            const quickPickItems = models.map(model => ({
                label: model.name,
                description: model.id,
                detail: `Provider: ${model.provider} | Context: ${model.context_length} tokens`,
                picked: model.id === currentModel
            }));
            const selected = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: 'Select an AI model',
                matchOnDescription: true,
                matchOnDetail: true
            });
            if (selected) {
                await vscode.workspace.getConfiguration('vibecode').update('defaultModel', selected.description, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage(`AI model changed to: ${selected.label}`);
            }
        }
        catch (error) {
            this.handleError('Failed to select model', error);
        }
    }
    async validateApiKey() {
        const apiKey = vscode.workspace.getConfiguration('vibecode').get('openRouterApiKey');
        if (!apiKey) {
            const action = await vscode.window.showErrorMessage('OpenRouter API key is required. Please set it in settings.', 'Open Settings');
            if (action === 'Open Settings') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'vibecode.openRouterApiKey');
            }
            throw new Error('API key not configured');
        }
        const isValid = await this.openRouterClient.validateApiKey();
        if (!isValid) {
            const action = await vscode.window.showErrorMessage('Invalid OpenRouter API key. Please check your settings.', 'Open Settings');
            if (action === 'Open Settings') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'vibecode.openRouterApiKey');
            }
            throw new Error('Invalid API key');
        }
    }
    extractCodeFromResponse(response) {
        // Extract code from markdown code blocks
        const codeBlockMatch = response.match(/```[\w]*\n([\s\S]*?)\n```/);
        if (codeBlockMatch) {
            return codeBlockMatch[1];
        }
        // If no code block found, return the response as is
        return response;
    }
    handleError(message, error) {
        console.error(message, error);
        this.outputChannel.appendLine(`${message}: ${error.message}`);
        vscode.window.showErrorMessage(`${message}: ${error.message}`);
    }
}
exports.AIAssistantManager = AIAssistantManager;
//# sourceMappingURL=ai-assistant-manager.js.map
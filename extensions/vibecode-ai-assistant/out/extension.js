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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const openrouter_client_1 = require("./openrouter-client");
const ai_assistant_manager_1 = require("./ai-assistant-manager");
const chat_webview_provider_1 = require("./chat-webview-provider");
const code_generator_1 = require("./code-generator");
const project_generator_1 = require("./project-generator");
function activate(context) {
    console.log('VibeCode AI Assistant is now active!');
    // Initialize OpenRouter client
    const openRouterClient = new openrouter_client_1.OpenRouterClient();
    // Initialize AI Assistant Manager
    const aiAssistantManager = new ai_assistant_manager_1.AIAssistantManager(openRouterClient);
    // Initialize Code Generator
    const codeGenerator = new code_generator_1.CodeGenerator(openRouterClient);
    // Initialize Project Generator
    const projectGenerator = new project_generator_1.ProjectGenerator(openRouterClient);
    // Register Chat WebView Provider
    const chatProvider = new chat_webview_provider_1.ChatWebviewProvider(context.extensionUri, openRouterClient);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(chat_webview_provider_1.ChatWebviewProvider.viewType, chatProvider));
    // Register commands
    const commands = [
        // Code generation commands
        vscode.commands.registerCommand('vibecode.generateCode', async () => {
            await codeGenerator.generateCode();
        }),
        vscode.commands.registerCommand('vibecode.explainCode', async () => {
            await aiAssistantManager.explainCode();
        }),
        vscode.commands.registerCommand('vibecode.optimizeCode', async () => {
            await aiAssistantManager.optimizeCode();
        }),
        vscode.commands.registerCommand('vibecode.fixCode', async () => {
            await aiAssistantManager.fixCode();
        }),
        vscode.commands.registerCommand('vibecode.generateTests', async () => {
            await codeGenerator.generateTests();
        }),
        vscode.commands.registerCommand('vibecode.generateProject', async () => {
            await projectGenerator.generateProject();
        }),
        vscode.commands.registerCommand('vibecode.chatWithCode', async () => {
            await chatProvider.focusChat();
        }),
        vscode.commands.registerCommand('vibecode.selectAIModel', async () => {
            await aiAssistantManager.selectAIModel();
        })
    ];
    // Register all commands
    commands.forEach(command => {
        context.subscriptions.push(command);
    });
    // Set context for chat view
    vscode.commands.executeCommand('setContext', 'vibeCodeChatEnabled', true);
    // Register status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(robot) VibeCode AI";
    statusBarItem.tooltip = "VibeCode AI Assistant";
    statusBarItem.command = 'vibecode.chatWithCode';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    // Handle configuration changes
    const configurationChangeHandler = vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('vibecode')) {
            openRouterClient.updateConfiguration();
        }
    });
    context.subscriptions.push(configurationChangeHandler);
    // Welcome message
    vscode.window.showInformationMessage('VibeCode AI Assistant is ready! Use Ctrl+Shift+C to open chat or right-click in editor.', 'Open Chat', 'Select Model').then(selection => {
        if (selection === 'Open Chat') {
            vscode.commands.executeCommand('vibecode.chatWithCode');
        }
        else if (selection === 'Select Model') {
            vscode.commands.executeCommand('vibecode.selectAIModel');
        }
    });
}
function deactivate() {
    console.log('VibeCode AI Assistant is now deactivated.');
}
//# sourceMappingURL=extension.js.map

import * as vscode from 'vscode';
import { OpenRouterClient } from './openrouter-client';
import { AIAssistantManager } from './ai-assistant-manager';
import { ChatWebviewProvider } from './chat-webview-provider';
import { CodeGenerator } from './code-generator';
import { ProjectGenerator } from './project-generator';

export function activate(context: vscode.ExtensionContext) {
    console.log('VibeCode AI Assistant is now active!');

    // Initialize OpenRouter client
    const openRouterClient = new OpenRouterClient();
    
    // Initialize AI Assistant Manager
    const aiAssistantManager = new AIAssistantManager(openRouterClient);
    
    // Initialize Code Generator
    const codeGenerator = new CodeGenerator(openRouterClient);
    
    // Initialize Project Generator
    const projectGenerator = new ProjectGenerator(openRouterClient);

    // Register Chat WebView Provider
    const chatProvider = new ChatWebviewProvider(context.extensionUri, openRouterClient);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ChatWebviewProvider.viewType, chatProvider)
    );

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
    vscode.window.showInformationMessage(
        'VibeCode AI Assistant is ready! Use Ctrl+Shift+C to open chat or right-click in editor.',
        'Open Chat',
        'Select Model'
    ).then(selection => {
        if (selection === 'Open Chat') {
            vscode.commands.executeCommand('vibecode.chatWithCode');
        } else if (selection === 'Select Model') {
            vscode.commands.executeCommand('vibecode.selectAIModel');
        }
    });
}

export function deactivate() {
    console.log('VibeCode AI Assistant is now deactivated.');
}
import * as vscode from 'vscode';
import { OpenRouterClient } from './openrouter-client';
import { AIAssistantManager } from './ai-assistant-manager';
import { ChatWebviewProvider } from './chat-webview-provider';
import { CodeGenerator } from './code-generator';
import { ProjectGenerator } from './project-generator';
import { TemplatesProvider } from './templates-provider';
import { DeploymentWebviewProvider } from './deployment-provider';
import { GitHubProvider } from './github-provider';
import { activateAgentAPI, AgentAPIExtension } from './agentapi-integration';
// import { logger } from '@/lib/logger';
export function activate(context: vscode.ExtensionContext) {
    console.info('VibeCode AI Assistant is now active!');

    // Initialize Agent API integration
    const agentAPIExtension = activateAgentAPI(context);
    console.info('Agent API integration activated');

    // Initialize OpenRouter client
    const openRouterClient = new OpenRouterClient();

    // Initialize AI Assistant Manager
    const aiAssistantManager = new AIAssistantManager(openRouterClient);

    // Initialize Code Generator
    const codeGenerator = new CodeGenerator(openRouterClient);

    // Initialize Project Generator
    const projectGenerator = new ProjectGenerator(openRouterClient);

    // Initialize Templates Provider
    const templatesProvider = new TemplatesProvider();
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('vibeCodeTemplates', templatesProvider)
    );

    // Initialize Deployment Provider
    const deploymentProvider = new DeploymentWebviewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('vibeCodeDeployment', deploymentProvider)
    );

    // Initialize GitHub Provider
    const githubProvider = new GitHubProvider();
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('vibeCodeGitHub', githubProvider)
    );

    // Register Chat WebView Provider
    const chatProvider = new ChatWebviewProvider(context.extensionUri, openRouterClient);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('vibeCodeChat', chatProvider)
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
        }),

        // Template commands
        vscode.commands.registerCommand('vibecode.templates.refresh', () => {
            templatesProvider.refresh();
        }),

        vscode.commands.registerCommand('vibecode.templates.browse', async () => {
            const panel = vscode.window.createWebviewPanel(
                'templateMarketplace',
                'Template Marketplace',
                vscode.ViewColumn.One,
                { enableScripts: true }
            );
            panel.webview.html = `
                <html>
                <body>
                    <h1>Template Marketplace</h1>
                    <p>Browse and discover templates at <a href="http://localhost:3000/marketplace">localhost:3000/marketplace</a></p>
                    <script>window.open('http://localhost:3000/marketplace', '_blank');</script>
                </body>
                </html>
            `;
        }),

        vscode.commands.registerCommand('vibecode.templates.create', async (template: any) => {
            if (template) {
                await templatesProvider.createProjectFromTemplate(template);
            } else {
                vscode.window.showInformationMessage('Please select a template from the Templates view');
            }
        }),

        vscode.commands.registerCommand('vibecode.templates.preview', async (template: any) => {
            await templatesProvider.previewTemplate(template);
        }),

        // GitHub commands
        vscode.commands.registerCommand('vibecode.github.authenticate', async () => {
            await githubProvider.authenticateWithGitHub();
        }),

        vscode.commands.registerCommand('vibecode.github.createRepo', async () => {
            await githubProvider.createRepository();
        }),

        vscode.commands.registerCommand('vibecode.github.setupWorkflow', async (repo: any) => {
            await githubProvider.setupWorkflow(repo);
        }),

        vscode.commands.registerCommand('vibecode.github.openRepo', async (repo: any) => {
            await githubProvider.openRepository(repo);
        }),

        vscode.commands.registerCommand('vibecode.github.triggerWorkflow', async (workflow: any) => {
            await githubProvider.triggerWorkflow(workflow);
        }),

        vscode.commands.registerCommand('vibecode.github.refresh', () => {
            githubProvider.refresh();
        }),

        // Deployment commands
        vscode.commands.registerCommand('vibecode.deployment.deploy', async () => {
            vscode.window.showInformationMessage('Select a provider from the Deployment view to deploy your project');
        }),

        vscode.commands.registerCommand('vibecode.deployment.status', async () => {
            vscode.window.showInformationMessage('Check deployment status in the Deployment view');
        }),

        // Collaboration commands
        vscode.commands.registerCommand('vibecode.collaboration.start', async () => {
            vscode.window.showInformationMessage('Collaborative features coming soon!');
        }),

        vscode.commands.registerCommand('vibecode.collaboration.join', async () => {
            vscode.window.showInformationMessage('Collaborative features coming soon!');
        }),

        // Monitoring commands
        vscode.commands.registerCommand('vibecode.monitoring.dashboard', async () => {
            vscode.env.openExternal(vscode.Uri.parse('http://localhost:3000/api/monitoring/dashboard'));
        }),

        // AI orchestration commands
        vscode.commands.registerCommand('vibecode.ai.orchestration', async () => {
            vscode.window.showInformationMessage('AI Model Orchestration features coming soon!');
        })
    ];

    // Register all commands
    commands.forEach(command => {
        context.subscriptions.push(command);
    });

    // Set context for all views
    vscode.commands.executeCommand('setContext', 'vibeCodeEnabled', true);

    // Register status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(robot) VibeCode AI Platform";
    statusBarItem.tooltip = "VibeCode AI Platform - Templates • Deployment • Collaboration • AI Models";
    statusBarItem.command = 'workbench.view.extension.vibecode-ai';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Handle configuration changes
    const configurationChangeHandler = vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
        if (event.affectsConfiguration('vibecode')) {
            openRouterClient.updateConfiguration();
        }
    });
    context.subscriptions.push(configurationChangeHandler);

    // Welcome message
    vscode.window.showInformationMessage(
        'VibeCode AI Platform is ready! Access all features from the VibeCode AI sidebar.',
        'Open Templates',
        'Browse Marketplace',
        'Setup GitHub'
    ).then((selection: string | undefined) => {
        if (selection === 'Open Templates') {
            vscode.commands.executeCommand('workbench.view.extension.vibecode-ai');
        } else if (selection === 'Browse Marketplace') {
            vscode.commands.executeCommand('vibecode.templates.browse');
        } else if (selection === 'Setup GitHub') {
            vscode.commands.executeCommand('vibecode.github.authenticate');
        }
    });
}

export function deactivate() {
    console.info('VibeCode AI Assistant is now deactivated.');
}

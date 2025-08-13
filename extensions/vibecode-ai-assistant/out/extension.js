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
const templates_provider_1 = require("./templates-provider");
const deployment_provider_1 = require("./deployment-provider");
const github_provider_1 = require("./github-provider");
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
    // Initialize Templates Provider
    const templatesProvider = new templates_provider_1.TemplatesProvider();
    context.subscriptions.push(vscode.window.registerTreeDataProvider('vibeCodeTemplates', templatesProvider));
    // Initialize Deployment Provider
    const deploymentProvider = new deployment_provider_1.DeploymentWebviewProvider(context.extensionUri);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('vibeCodeDeployment', deploymentProvider));
    // Initialize GitHub Provider
    const githubProvider = new github_provider_1.GitHubProvider();
    context.subscriptions.push(vscode.window.registerTreeDataProvider('vibeCodeGitHub', githubProvider));
    // Register Chat WebView Provider
    const chatProvider = new chat_webview_provider_1.ChatWebviewProvider(context.extensionUri, openRouterClient);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('vibeCodeChat', chatProvider));
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
            const panel = vscode.window.createWebviewPanel('templateMarketplace', 'Template Marketplace', vscode.ViewColumn.One, { enableScripts: true });
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
        vscode.commands.registerCommand('vibecode.templates.create', async (template) => {
            if (template) {
                await templatesProvider.createProjectFromTemplate(template);
            }
            else {
                vscode.window.showInformationMessage('Please select a template from the Templates view');
            }
        }),
        vscode.commands.registerCommand('vibecode.templates.preview', async (template) => {
            await templatesProvider.previewTemplate(template);
        }),
        // GitHub commands
        vscode.commands.registerCommand('vibecode.github.authenticate', async () => {
            await githubProvider.authenticateWithGitHub();
        }),
        vscode.commands.registerCommand('vibecode.github.createRepo', async () => {
            await githubProvider.createRepository();
        }),
        vscode.commands.registerCommand('vibecode.github.setupWorkflow', async (repo) => {
            await githubProvider.setupWorkflow(repo);
        }),
        vscode.commands.registerCommand('vibecode.github.openRepo', async (repo) => {
            await githubProvider.openRepository(repo);
        }),
        vscode.commands.registerCommand('vibecode.github.triggerWorkflow', async (workflow) => {
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
    const configurationChangeHandler = vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('vibecode')) {
            openRouterClient.updateConfiguration();
        }
    });
    context.subscriptions.push(configurationChangeHandler);
    // Welcome message
    vscode.window.showInformationMessage('VibeCode AI Platform is ready! Access all features from the VibeCode AI sidebar.', 'Open Templates', 'Browse Marketplace', 'Setup GitHub').then(selection => {
        if (selection === 'Open Templates') {
            vscode.commands.executeCommand('workbench.view.extension.vibecode-ai');
        }
        else if (selection === 'Browse Marketplace') {
            vscode.commands.executeCommand('vibecode.templates.browse');
        }
        else if (selection === 'Setup GitHub') {
            vscode.commands.executeCommand('vibecode.github.authenticate');
        }
    });
}
function deactivate() {
    console.log('VibeCode AI Assistant is now deactivated.');
}
//# sourceMappingURL=extension.js.map
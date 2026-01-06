// src/extension.ts
import * as vscode from 'vscode';
import { Logger } from './logger';
import { getTracingManager, TracingManager } from './tracing';
import { WorkspaceIndexer } from './workspaceIndexer';
import { MLXEmbeddingService } from './mlxEmbeddingService';
import { RagService } from './ragService';
import { ErrorHandler } from './errorHandler';
import { getWorkspaceId, getWorkspaceName } from './utils';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
    const logger = new Logger(context);
    const tracing = getTracingManager(logger);
    const errorHandler = new ErrorHandler(logger);

    // Initialize tracing (non-blocking)
    tracing.initialize().catch(error => {
        logger.debug('Tracing initialization failed (optional feature)', error);
    });

    logger.info('Workspace RAG Extension activated');

    // Initialize services
    const embeddingService = new MLXEmbeddingService(logger, tracing);
    const workspaceIndexer = new WorkspaceIndexer(logger, tracing, embeddingService);
    const ragService = new RagService(logger, tracing, embeddingService, context);

    // Command: Index Workspace
    const indexCommand = vscode.commands.registerCommand('workspace-rag.indexWorkspace', async () => {
        return errorHandler.wrapAsync(async () => {
            return tracing.trace('command.indexWorkspace', async (span) => {
                span.setTag('command', 'indexWorkspace');
                
                if (!getWorkspaceId()) {
                    throw new Error('No workspace found. Please open a workspace first.');
                }

                await workspaceIndexer.indexWorkspace(context);
            });
        }, 'Index Workspace', { showError: true });
    });

    // Command: Set API Key (with provider selection)
    const setApiKeyCommand = vscode.commands.registerCommand('workspace-rag.setApiKey', async () => {
        const provider = await vscode.window.showQuickPick([
            { label: 'OpenAI', value: 'openai', description: 'GPT-4, GPT-3.5' },
            { label: 'Anthropic', value: 'anthropic', description: 'Claude 3.5 Sonnet' },
            { label: 'Google', value: 'google', description: 'Gemini 1.5 Pro' },
            { label: 'OpenRouter', value: 'openrouter', description: 'Access multiple models' }
        ], {
            placeHolder: 'Select LLM provider'
        });

        if (!provider) return;

        const key = await vscode.window.showInputBox({
            prompt: `Enter your ${provider.label} API Key`,
            password: true,
            placeHolder: provider.value === 'openai' ? 'sk-...' : provider.value === 'anthropic' ? 'sk-ant-...' : '',
            ignoreFocusOut: true
        });

        if (key) {
            await context.secrets.store(`${provider.value}ApiKey`, key);
            vscode.window.showInformationMessage(`${provider.label} API Key saved securely.`);
            logger.info(`${provider.value} API key updated`);
        }
    });

    // Command: Show Dashboard (placeholder for future enhancement)
    const showDashboardCommand = vscode.commands.registerCommand('workspace-rag.showDashboard', () => {
        vscode.window.showInformationMessage('Performance dashboard coming soon.');
    });

    // Webview Provider for Chat Interface
    class RagChatViewProvider implements vscode.WebviewViewProvider {
        private _view?: vscode.WebviewView;

        constructor(private readonly extensionUri: vscode.Uri) {}

        public resolveWebviewView(
            webviewView: vscode.WebviewView,
            context: vscode.WebviewViewResolveContext,
            _token: vscode.CancellationToken
        ): void {
            this._view = webviewView;

            webviewView.webview.options = {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.extensionUri, 'media')
                ]
            };

            webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

            // Handle messages from webview
            webviewView.webview.onDidReceiveMessage(async (data) => {
                switch (data.command) {
                    case 'ready':
                        await this.handleReady();
                        break;
                    case 'askQuestion':
                        await this.handleQuestion(data.text, data.timestamp);
                        break;
                    case 'openFile':
                        this.openFile(data.path);
                        break;
                }
            });
        }

        private async handleReady() {
            if (!this._view) return;

            // Send initial status
            try {
                await embeddingService.initialize(context);
                const modelInfo = embeddingService.getCurrentModelInfo();
                
                this._view.webview.postMessage({
                    command: 'status',
                    status: 'connected',
                    isLocal: modelInfo.type === 'local'
                });
            } catch (error) {
                logger.error('Failed to initialize embedding service', error);
                this._view.webview.postMessage({
                    command: 'status',
                    status: 'error',
                    isLocal: false
                });
            }
        }

        private async handleQuestion(question: string, timestamp: number) {
            if (!this._view) return;

            return errorHandler.wrapAsync(async () => {
                return tracing.trace('webview.handleQuestion', async (span) => {
                    span.setTag('question', question.substring(0, 100));

                    const workspaceId = getWorkspaceId();
                    if (!workspaceId) {
                        throw new Error('No workspace found. Please open a workspace first.');
                    }

                    try {
                    // Update progress
                    this._view!.webview.postMessage({
                        command: 'progress',
                        text: 'Generating embedding...'
                    });

                    // Initialize services if needed
                    await embeddingService.initialize(context);
                    await ragService.initialize(context);

                    // Update progress
                    this._view!.webview.postMessage({
                        command: 'progress',
                        text: 'Searching workspace...'
                    });

                    // Process query
                    const response = await ragService.processQuery(workspaceId, question, context);

                    span.setTag('response.sources_count', response.sources.length);
                    span.setTag('response.answer_length', response.answer.length);

                    // Send response
                    this._view!.webview.postMessage({
                        command: 'answer',
                        text: response.answer,
                        sources: response.sources
                    });

                } catch (error: any) {
                    span.setTag('error', true);
                    span.setTag('error.msg', error.message);
                    logger.error('Failed to process question', error);

                    this._view!.webview.postMessage({
                        command: 'error',
                        text: error.message || 'An unexpected error occurred.'
                    });
                }
            });
            }, 'RAG Query', { showError: false, rethrow: true });
        }

        private openFile(filePath: string) {
            tracing.trace('webview.openFile', async (span) => {
                span.setTag('file.path', filePath);
                
                try {
                    const uri = vscode.Uri.file(filePath);
                    await vscode.commands.executeCommand('vscode.open', uri);
                    logger.debug(`Opened file: ${filePath}`);
                } catch (error) {
                    logger.error(`Failed to open file: ${filePath}`, error);
                }
            });
        }

        private getHtmlForWebview(webview: vscode.Webview): string {
            const htmlPath = vscode.Uri.joinPath(this.extensionUri, 'media', 'chat.html');
            
            try {
                const htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');
                
                // Add CSP
                const cspSource = webview.cspSource;
                const htmlWithCsp = htmlContent.replace(
                    '<head>',
                    `<head>
                    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource} 'unsafe-inline';">`
                );
                
                return htmlWithCsp;
            } catch (error) {
                logger.error('Failed to load chat HTML', error);
                return this.getErrorHtml();
            }
        }

        private getErrorHtml(): string {
            return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
    <h3>Failed to load chat interface</h3>
    <p>Please check the extension logs for more details.</p>
</body>
</html>`;
        }
    }

    // Register webview provider
    const provider = new RagChatViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('workspace-rag.chatView', provider)
    );

    // Register all commands
    context.subscriptions.push(
        indexCommand,
        setApiKeyCommand,
        showDashboardCommand
    );

    // Status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(database) RAG";
    statusBarItem.tooltip = "Workspace RAG: Click to index";
    statusBarItem.command = 'workspace-rag.indexWorkspace';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Show welcome message on first activation
    const hasShownWelcome = context.globalState.get('hasShownWelcome', false);
    if (!hasShownWelcome) {
        vscode.window.showInformationMessage(
            'Workspace RAG activated. Index your workspace to start asking questions.',
            'Index Now',
            'Set API Key'
        ).then(selection => {
            if (selection === 'Index Now') {
                vscode.commands.executeCommand('workspace-rag.indexWorkspace');
            } else if (selection === 'Set API Key') {
                vscode.commands.executeCommand('workspace-rag.setApiKey');
            }
        });
        context.globalState.update('hasShownWelcome', true);
    }

    logger.info('Extension activation complete', {
        workspace: getWorkspaceName(),
        tracingEnabled: tracing.isTracingEnabled()
    });
}

export async function deactivate() {
    const logger = new Logger();
    logger.info('Extension deactivating');
    
    // Flush traces
    const tracing = getTracingManager(logger);
    await tracing.flush();
    
    logger.info('Extension deactivated');
}


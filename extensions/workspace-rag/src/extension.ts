// src/extension.ts
import * as vscode from 'vscode';
import { WorkspaceIndexer } from './workspaceIndexer';
import { RagService } from './ragService';
import { Logger } from './logger';
import { getTracingManager } from './tracing';
import { getWorkspaceId } from './utils';

export function activate(context: vscode.ExtensionContext) {
    const logger = new Logger(context);
    const tracingManager = getTracingManager(logger);
    
    // Initialize tracing first
    tracingManager.initialize().then(() => {
        logger.info('Tracing initialized during extension activation');
    }).catch(error => {
        logger.error('Tracing initialization failed', error);
    });

    const indexingService = new WorkspaceIndexer(logger);
    const ragService = new RagService(logger);

    // Wrap extension activation in a trace
    tracingManager.trace('vscode.extension.activate', async (span) => {
        span.setTag('extension.name', 'workspace-rag');
        span.setTag('extension.version', '0.1.0');
        span.setTag('vscode.version', vscode.version);

        logger.info('MLX-Powered RAG Extension activated with tracing');

        // Register commands with tracing
        const indexCommand = vscode.commands.registerCommand('workspace-rag.indexWorkspace', () => {
            tracingManager.trace('command.indexWorkspace', async (cmdSpan) => {
                cmdSpan.setTag('command.name', 'indexWorkspace');
                await indexingService.indexWorkspace(context);
            });
        });

        const setApiKeyCommand = vscode.commands.registerCommand('workspace-rag.setApiKey', async () => {
            tracingManager.trace('command.setApiKey', async (cmdSpan) => {
                cmdSpan.setTag('command.name', 'setApiKey');
                
                const key = await vscode.window.showInputBox({
                    prompt: 'Enter your OpenAI API Key',
                    password: true,
                    placeHolder: 'sk-...'
                });
                
                if (key) {
                    await context.secrets.store('openaiApiKey', key);
                    vscode.window.showInformationMessage('OpenAI API Key saved securely.');
                    logger.info('API key was set');
                }
            });
        });

        // Register webview provider
        class RAGChatWebviewProvider implements vscode.WebviewViewProvider {
            public static readonly viewType = 'workspace-rag.chatView';
            private _view?: vscode.WebviewView;

            constructor(private readonly _extensionUri: vscode.Uri) {}

            public resolveWebviewView(
                webviewView: vscode.WebviewView,
                context: vscode.WebviewViewResolveContext,
                _token: vscode.CancellationToken,
            ) {
                this._view = webviewView;

                webviewView.webview.options = {
                    enableScripts: true,
                    localResourceRoots: [
                        vscode.Uri.joinPath(this._extensionUri, 'media')
                    ]
                };

                webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
                
                // Handle messages from the webview
                webviewView.webview.onDidReceiveMessage(async (data) => {
                    switch (data.command) {
                        case 'askQuestion':
                            await this.handleQuestion(data.text, data.timestamp);
                            break;
                        case 'openFile':
                            this.openFile(data.path);
                            break;
                    }
                });
            }
            
            private async handleQuestion(question: string, timestamp: number) {
                if (!this._view) {
                    logger.warn('Webview not available when handling question');
                    return;
                }
                
                const tracing = getTracingManager(logger);
                
                return tracing.trace('webview.handle_question', async (span) => {
                    span.setTag('question', question.substring(0, 100));
                    
                    const apiKey = await context.secrets.get('openaiApiKey');
                    
                    if (!apiKey) {
                        this._view!.webview.postMessage({ 
                            command: 'error', 
                            text: 'OpenAI API Key is not set. Use the "Set OpenAI API Key" command.',
                            timestamp: timestamp
                        });
                        return;
                    }

                    const config = vscode.workspace.getConfiguration('workspaceRag');
                    const workspaceId = getWorkspaceId();
                    
                    if (!workspaceId) {
                        this._view!.webview.postMessage({ 
                            command: 'error', 
                            text: 'No workspace found. Please open a workspace and try again.',
                            timestamp: timestamp
                        });
                        return;
                    }

                    this._view!.webview.postMessage({ 
                        command: 'status', 
                        text: 'Embedding your question...',
                        timestamp: timestamp
                    });

                    const dbConfig = {
                        host: config.get('pgHost'),
                        port: config.get('pgPort'),
                        user: config.get('pgUser'),
                        password: config.get('pgPassword'),
                        database: config.get('pgDatabase'),
                    };

                    try {
                        // Initialize RAG service if needed
                        await ragService.initialize(context);

                        this._view!.webview.postMessage({ 
                            command: 'status', 
                            text: 'Searching for relevant information...',
                            timestamp: timestamp
                        });

                        const result = await ragService.processQuery(workspaceId, question, dbConfig, context);

                        this._view!.webview.postMessage({ 
                            command: 'status', 
                            text: 'Generating answer...',
                            timestamp: timestamp
                        });

                        this._view!.webview.postMessage({ 
                            command: 'answer', 
                            text: result.answer,
                            source: result.sources[0] || null,
                            sources: result.sources,
                            timestamp: timestamp
                        });

                    } catch (error: any) {
                        span.setTag('error', true);
                        span.setTag('error.msg', error.message);
                        logger.error('Error in RAG process', error);
                        this._view!.webview.postMessage({ 
                            command: 'error', 
                            text: `Error: ${error.message || 'Unknown error'}`,
                            timestamp: timestamp
                        });
                    }
                });
            }

            private openFile(filePath: string) {
                const uri = vscode.Uri.file(filePath);
                vscode.commands.executeCommand('vscode.open', uri)
                    .then(() => logger.debug(`Opened file: ${filePath}`));
            }

            private _getHtmlForWebview(webview: vscode.Webview): string {
                return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RAG Chat</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            margin: 0;
            padding: 15px;
            height: 100vh;
            display: flex;
            flex-direction: column;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-foreground);
        }
        
        #chat-container {
            flex-grow: 1;
            overflow-y: auto;
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 15px;
            background-color: var(--vscode-editorWidget-background);
        }
        
        .message {
            margin-bottom: 18px;
            display: flex;
            gap: 10px;
        }
        
        .message-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            flex-shrink: 0;
            font-size: 12px;
        }
        
        .user .message-avatar {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }
        
        .bot .message-avatar {
            background-color: var(--vscode-sideBar-background);
            color: var(--vscode-sideBar-foreground);
        }
        
        .message-content {
            padding: 12px;
            border-radius: 8px;
            max-width: 85%;
            line-height: 1.5;
        }
        
        .user .message-content {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }
        
        .bot .message-content {
            background-color: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-editorWidget-border);
        }
        
        .source-info {
            font-size: 0.85em;
            color: var(--vscode-textLink-foreground);
            margin-top: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        .source-info:hover {
            text-decoration: underline;
        }
        
        #input-form {
            display: flex;
            gap: 10px;
        }
        
        #question-input {
            flex-grow: 1;
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 22px;
            padding: 10px 15px;
            background-color: var(--vscode-editorWidget-background);
            color: var(--vscode-foreground);
        }
        
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 22px;
            padding: 0 15px;
            min-width: 70px;
            cursor: pointer;
            font-weight: 500;
        }
        
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        
        .loading {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.9em;
            color: var(--vscode-foreground);
        }
        
        .loading-spinner {
            width: 16px;
            height: 16px;
            border: 2px solid rgba(0, 0, 0, 0.1);
            border-top: 2px solid var(--vscode-foreground);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div id="chat-container"></div>
    <form id="input-form">
        <input type="text" id="question-input" placeholder="Ask a question about your code..." autocomplete="off">
        <button type="submit" id="send-button">Send</button>
    </form>

    <script>
        const vscode = acquireVsCodeApi();
        const chatContainer = document.getElementById('chat-container');
        const inputForm = document.getElementById('input-form');
        const questionInput = document.getElementById('question-input');
        const sendButton = document.getElementById('send-button');
        let isProcessing = false;

        inputForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (isProcessing) return;
            
            const question = questionInput.value.trim();
            if (!question) return;

            // Disable input while processing
            isProcessing = true;
            sendButton.disabled = true;
            questionInput.disabled = true;
            
            // Display user message
            addMessage('user', question);
            questionInput.value = '';

            // Send question to extension
            vscode.postMessage({ 
                command: 'askQuestion', 
                text: question,
                timestamp: Date.now()
            });
            
            // Show loading indicator
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'message bot';
            loadingDiv.innerHTML = \`
                <div class="message-avatar">AI</div>
                <div class="message-content">
                    <div class="loading">
                        <div class="loading-spinner"></div>
                        Thinking...
                    </div>
                </div>
            \`;
            chatContainer.appendChild(loadingDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        });

        function addMessage(role, content, source, timestamp) {
            // Remove loading indicator if exists
            const loadingElements = chatContainer.querySelectorAll('.loading');
            if (loadingElements.length > 0) {
                loadingElements[0].closest('.message').remove();
            }
            
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${role}\`;
            
            messageDiv.innerHTML = \`
                <div class="message-avatar">\${role === 'user' ? 'You' : 'AI'}</div>
                <div class="message-content">\${content.replace(/\\n/g, '<br>')}</div>
            \`;
            
            if (source) {
                const sourceDiv = document.createElement('div');
                sourceDiv.className = 'source-info';
                sourceDiv.innerHTML = \`<span>Source:</span> \${source}\`;
                sourceDiv.onclick = () => vscode.postMessage({ 
                    command: 'openFile', 
                    path: source,
                    timestamp: timestamp
                });
                messageDiv.querySelector('.message-content').appendChild(sourceDiv);
            }
            
            chatContainer.appendChild(messageDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
            
            // Re-enable input
            isProcessing = false;
            sendButton.disabled = false;
            questionInput.disabled = false;
            questionInput.focus();
        }

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'answer':
                    addMessage('bot', message.text, message.source, message.timestamp);
                    break;
                case 'error':
                    addMessage('bot', \`Error: \${message.text}\`, null, message.timestamp);
                    break;
                case 'status':
                    // Update status in loading indicator if it exists
                    const loadingElements = chatContainer.querySelectorAll('.loading');
                    if (loadingElements.length > 0) {
                        loadingElements[0].textContent = message.text;
                    }
                    break;
            }
        });
    </script>
</body>
</html>`;
            }
        }
        
        const provider = new RAGChatWebviewProvider(context.extensionUri);
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(RAGChatWebviewProvider.viewType, provider),
            indexCommand,
            setApiKeyCommand
        );

    }).catch(error => {
        logger.error('Extension activation failed', error);
    });
}

export async function deactivate() {
    const logger = new Logger();
    const tracingManager = getTracingManager(logger);
    
    await tracingManager.trace('vscode.extension.deactivate', async (span) => {
        span.setTag('shutdown.reason', 'deactivation');
        await tracingManager.flush();
        logger.info('Extension deactivated with tracing cleanup');
    });
}

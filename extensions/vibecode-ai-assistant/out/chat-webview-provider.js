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
exports.ChatWebviewProvider = void 0;
const vscode = __importStar(require("vscode"));
class ChatWebviewProvider {
    constructor(_extensionUri, openRouterClient) {
        this._extensionUri = _extensionUri;
        this.openRouterClient = openRouterClient;
        this.chatHistory = [];
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(message => {
            switch (message.type) {
                case 'sendMessage':
                    this.handleChatMessage(message.text, message.includeContext);
                    break;
                case 'clearChat':
                    this.clearChatHistory();
                    break;
                case 'exportChat':
                    this.exportChatHistory();
                    break;
            }
        }, undefined, []);
    }
    async focusChat() {
        if (this._view) {
            this._view.show?.(true);
        }
    }
    async handleChatMessage(text, includeContext) {
        if (!text.trim()) {
            return;
        }
        try {
            // Add user message to history
            const userMessage = { role: 'user', content: text };
            this.chatHistory.push(userMessage);
            // Get code context if requested
            let context = '';
            if (includeContext) {
                context = this.getCurrentCodeContext();
            }
            // Prepare messages for AI
            const messages = [
                {
                    role: 'system',
                    content: `You are a helpful AI coding assistant. You can help with code generation, debugging, explanation, and general programming questions.
                    ${context ? `\n\nCurrent code context:\n${context}` : ''}`
                },
                ...this.chatHistory
            ];
            // Show user message in chat
            this.updateChatUI(userMessage);
            // Get AI response
            const config = vscode.workspace.getConfiguration('vibecode');
            const enableStreaming = config.get('enableStreaming', true);
            if (enableStreaming) {
                await this.handleStreamingResponse(messages);
            }
            else {
                await this.handleNonStreamingResponse(messages);
            }
        }
        catch (error) {
            this.handleChatError(error);
        }
    }
    async handleStreamingResponse(messages) {
        let assistantMessage = '';
        // Start streaming response
        this.updateChatUI({ role: 'assistant', content: '...' }, true);
        await this.openRouterClient.streamChatCompletion(messages, undefined, (chunk) => {
            assistantMessage += chunk;
            this.updateChatUI({ role: 'assistant', content: assistantMessage }, true);
        });
        // Add complete response to history
        this.chatHistory.push({ role: 'assistant', content: assistantMessage });
    }
    async handleNonStreamingResponse(messages) {
        const response = await this.openRouterClient.chatCompletion(messages);
        const assistantMessage = {
            role: 'assistant',
            content: response.choices[0].message.content
        };
        this.chatHistory.push(assistantMessage);
        this.updateChatUI(assistantMessage);
    }
    getCurrentCodeContext() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return '';
        }
        const document = editor.document;
        const selection = editor.selection;
        let context = `File: ${document.fileName}\nLanguage: ${document.languageId}\n\n`;
        if (!selection.isEmpty) {
            context += `Selected code:\n${document.getText(selection)}\n\n`;
        }
        // Add surrounding context
        const currentLine = selection.active.line;
        const startLine = Math.max(0, currentLine - 5);
        const endLine = Math.min(document.lineCount - 1, currentLine + 5);
        context += `Context (lines ${startLine + 1}-${endLine + 1}):\n`;
        for (let i = startLine; i <= endLine; i++) {
            const lineText = document.lineAt(i).text;
            context += `${i + 1}: ${lineText}\n`;
        }
        return context;
    }
    updateChatUI(message, isStreaming = false) {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'updateChat',
                message: message,
                isStreaming: isStreaming
            });
        }
    }
    clearChatHistory() {
        this.chatHistory = [];
        if (this._view) {
            this._view.webview.postMessage({
                type: 'clearChat'
            });
        }
    }
    async exportChatHistory() {
        if (this.chatHistory.length === 0) {
            vscode.window.showInformationMessage('No chat history to export');
            return;
        }
        const chatExport = this.chatHistory
            .map(msg => `**${msg.role.toUpperCase()}**: ${msg.content}`)
            .join('\n\n---\n\n');
        const doc = await vscode.workspace.openTextDocument({
            content: `# VibeCode AI Chat Export\n\n${chatExport}`,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(doc);
    }
    handleChatError(error) {
        console.error('Chat error:', error);
        if (this._view) {
            this._view.webview.postMessage({
                type: 'chatError',
                error: error.message
            });
        }
    }
    getHtmlForWebview(webview) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>VibeCode AI Chat</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    line-height: 1.6;
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    margin: 0;
                    padding: 10px;
                }

                .chat-container {
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                }

                .chat-header {
                    padding: 10px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .chat-title {
                    font-weight: bold;
                    color: var(--vscode-foreground);
                }

                .chat-controls {
                    display: flex;
                    gap: 5px;
                }

                .chat-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 10px;
                    scroll-behavior: smooth;
                }

                .message {
                    margin-bottom: 15px;
                    padding: 10px;
                    border-radius: 5px;
                    max-width: 90%;
                }

                .user-message {
                    background-color: var(--vscode-input-background);
                    border-left: 3px solid var(--vscode-activityBarBadge-background);
                    margin-left: auto;
                }

                .assistant-message {
                    background-color: var(--vscode-editor-background);
                    border-left: 3px solid var(--vscode-charts-green);
                    margin-right: auto;
                }

                .message-role {
                    font-weight: bold;
                    font-size: 0.9em;
                    margin-bottom: 5px;
                    text-transform: uppercase;
                }

                .message-content {
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }

                .message-content code {
                    background-color: var(--vscode-textCodeBlock-background);
                    padding: 2px 4px;
                    border-radius: 3px;
                    font-family: var(--vscode-editor-font-family);
                }

                .message-content pre {
                    background-color: var(--vscode-textCodeBlock-background);
                    padding: 10px;
                    border-radius: 5px;
                    overflow-x: auto;
                    font-family: var(--vscode-editor-font-family);
                }

                .chat-input-container {
                    padding: 10px;
                    border-top: 1px solid var(--vscode-panel-border);
                }

                .chat-input {
                    width: 100%;
                    min-height: 40px;
                    padding: 10px;
                    border: 1px solid var(--vscode-input-border);
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border-radius: 4px;
                    resize: vertical;
                    font-family: var(--vscode-font-family);
                }

                .chat-input:focus {
                    outline: none;
                    border-color: var(--vscode-focusBorder);
                }

                .input-controls {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 10px;
                }

                .checkbox-container {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }

                .checkbox-container input[type="checkbox"] {
                    margin: 0;
                }

                .checkbox-container label {
                    font-size: 0.9em;
                    color: var(--vscode-descriptionForeground);
                }

                .btn {
                    padding: 6px 12px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.9em;
                    transition: opacity 0.2s;
                }

                .btn:hover {
                    opacity: 0.8;
                }

                .btn-primary {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                }

                .btn-secondary {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }

                .btn-small {
                    padding: 4px 8px;
                    font-size: 0.8em;
                }

                .error-message {
                    background-color: var(--vscode-errorBackground);
                    color: var(--vscode-errorForeground);
                    padding: 10px;
                    border-radius: 4px;
                    margin-bottom: 10px;
                }

                .streaming-indicator {
                    display: inline-block;
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background-color: var(--vscode-charts-green);
                    animation: pulse 1s ease-in-out infinite;
                }

                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }
            </style>
        </head>
        <body>
            <div class="chat-container">
                <div class="chat-header">
                    <div class="chat-title">VibeCode AI Chat</div>
                    <div class="chat-controls">
                        <button class="btn btn-secondary btn-small" onclick="exportChat()">Export</button>
                        <button class="btn btn-secondary btn-small" onclick="clearChat()">Clear</button>
                    </div>
                </div>

                <div class="chat-messages" id="chatMessages">
                    <div class="assistant-message">
                        <div class="message-role">Assistant</div>
                        <div class="message-content">Hello! I'm your AI coding assistant. I can help you with code generation, debugging, explanations, and more. How can I assist you today?</div>
                    </div>
                </div>

                <div class="chat-input-container">
                    <textarea
                        class="chat-input"
                        id="chatInput"
                        placeholder="Ask me anything about your code..."
                        rows="3"
                    ></textarea>
                    <div class="input-controls">
                        <div class="checkbox-container">
                            <input type="checkbox" id="includeContext" checked>
                            <label for="includeContext">Include code context</label>
                        </div>
                        <button class="btn btn-primary" onclick="sendMessage()">Send</button>
                    </div>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                const chatMessages = document.getElementById('chatMessages');
                const chatInput = document.getElementById('chatInput');
                const includeContext = document.getElementById('includeContext');

                let currentStreamingMessage = null;

                chatInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        sendMessage();
                    }
                });

                function sendMessage() {
                    const text = chatInput.value.trim();
                    if (!text) return;

                    vscode.postMessage({
                        type: 'sendMessage',
                        text: text,
                        includeContext: includeContext.checked
                    });

                    chatInput.value = '';
                    chatInput.focus();
                }

                function clearChat() {
                    vscode.postMessage({
                        type: 'clearChat'
                    });
                }

                function exportChat() {
                    vscode.postMessage({
                        type: 'exportChat'
                    });
                }

                function addMessage(message, isStreaming = false) {
                    if (isStreaming && currentStreamingMessage) {
                        // Update existing streaming message
                        const contentDiv = currentStreamingMessage.querySelector('.message-content');
                        contentDiv.innerHTML = formatMessageContent(message.content);
                        return;
                    }

                    const messageDiv = document.createElement('div');
                    messageDiv.className = 'message ' + (message.role === 'user' ? 'user-message' : 'assistant-message');

                    const roleDiv = document.createElement('div');
                    roleDiv.className = 'message-role';
                    roleDiv.textContent = message.role === 'user' ? 'You' : 'Assistant';

                    const contentDiv = document.createElement('div');
                    contentDiv.className = 'message-content';
                    contentDiv.innerHTML = formatMessageContent(message.content);

                    messageDiv.appendChild(roleDiv);
                    messageDiv.appendChild(contentDiv);

                    if (isStreaming) {
                        const indicator = document.createElement('span');
                        indicator.className = 'streaming-indicator';
                        roleDiv.appendChild(indicator);
                        currentStreamingMessage = messageDiv;
                    } else {
                        currentStreamingMessage = null;
                    }

                    chatMessages.appendChild(messageDiv);
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }

                function formatMessageContent(content) {
                    return content
                        .replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>')
                        .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
                        .replace(/\\n/g, '<br>');
                }

                function showError(error) {
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'error-message';
                    errorDiv.textContent = 'Error: ' + error;
                    chatMessages.appendChild(errorDiv);
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }

                window.addEventListener('message', event => {
                    const message = event.data;

                    switch (message.type) {
                        case 'updateChat':
                            addMessage(message.message, message.isStreaming);
                            break;
                        case 'clearChat':
                            chatMessages.innerHTML = '';
                            currentStreamingMessage = null;
                            break;
                        case 'chatError':
                            showError(message.error);
                            break;
                    }
                });

                // Focus input on load
                chatInput.focus();
            </script>
        </body>
        </html>`;
    }
}
exports.ChatWebviewProvider = ChatWebviewProvider;
ChatWebviewProvider.viewType = 'vibeCodeChat';
//# sourceMappingURL=chat-webview-provider.js.map

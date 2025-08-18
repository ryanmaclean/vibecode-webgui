import * as vscode from 'vscode';
import axios from 'axios';

interface CollaborationSession {
    id: string;
    name: string;
    participants: string[];
    status: 'active' | 'ended';
    created_at: string;
    workspace_path?: string;
    shared_files: string[];
    active_cursors: { [userId: string]: { file: string; line: number; character: number } };
}

interface Participant {
    id: string;
    name: string;
    avatar?: string;
    cursor?: { file: string; line: number; character: number };
    status: 'online' | 'offline' | 'away';
}

export class CollaborationProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'vibeCodeCollaboration';

    private _view?: vscode.WebviewView;
    private _context: vscode.ExtensionContext;
    private _apiBaseUrl: string;
    private _currentSession: CollaborationSession | null = null;
    private _participants: Participant[] = [];
    private _statusBarItem: vscode.StatusBarItem;

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
        this._apiBaseUrl = 'http://localhost:3000';
        this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this._statusBarItem.command = 'vibecode.collaboration.showPanel';
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._context.extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.command) {
                case 'startSession':
                    await this.startCollaborativeSession(data.sessionName, data.inviteEmails);
                    break;
                case 'joinSession':
                    await this.joinCollaborativeSession(data.sessionId, data.accessCode);
                    break;
                case 'endSession':
                    await this.endCollaborativeSession();
                    break;
                case 'shareFile':
                    await this.shareFile(data.filePath);
                    break;
                case 'unshareFile':
                    await this.unshareFile(data.filePath);
                    break;
                case 'sendChatMessage':
                    await this.sendChatMessage(data.message);
                    break;
                case 'updateCursor':
                    await this.updateCursorPosition(data.file, data.line, data.character);
                    break;
            }
        });

        this._loadActiveSessions();
    }

    private async startCollaborativeSession(sessionName: string, inviteEmails: string[]): Promise<void> {
        try {
            if (!sessionName.trim()) {
                vscode.window.showErrorMessage('Session name is required');
                return;
            }

            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder found. Please open a project first.');
                return;
            }

            this._showProgress('Creating collaborative session...');

            const response = await axios.post(`${this._apiBaseUrl}/api/collaboration/start`, {
                name: sessionName,
                workspace_path: workspaceFolder.uri.fsPath,
                invite_emails: inviteEmails
            });

            this._currentSession = response.data.session;
            
            if (this._currentSession) {
                this._updateStatusBar(`📡 ${sessionName}`, 'Active collaboration session');
                this._updateWebview();

                const sessionId = this._currentSession.id;
                vscode.window.showInformationMessage(
                    `Collaborative session "${sessionName}" started! Session ID: ${sessionId}`,
                    'Copy Link'
                ).then(selection => {
                    if (selection === 'Copy Link') {
                        const inviteLink = `vscode://vibecode.vibecode-ai-assistant/join/${sessionId}`;
                        vscode.env.clipboard.writeText(inviteLink);
                        vscode.window.showInformationMessage('Invite link copied to clipboard!');
                    }
                });
            }

            // Start monitoring session
            this._startSessionMonitoring();

        } catch (error: any) {
            console.error('Failed to start collaborative session:', error);
            vscode.window.showErrorMessage(`Failed to start session: ${error.response?.data?.error || error.message}`);
        }
    }

    private async joinCollaborativeSession(sessionId: string, accessCode?: string): Promise<void> {
        try {
            if (!sessionId.trim()) {
                vscode.window.showErrorMessage('Session ID is required');
                return;
            }

            this._showProgress('Joining collaborative session...');

            const response = await axios.post(`${this._apiBaseUrl}/api/collaboration/join`, {
                session_id: sessionId,
                access_code: accessCode
            });

            this._currentSession = response.data.session;
            this._participants = response.data.participants || [];

            if (this._currentSession) {
                this._updateStatusBar(`📡 ${this._currentSession.name}`, 'Connected to collaboration session');
                this._updateWebview();

                vscode.window.showInformationMessage(`Joined session "${this._currentSession.name}"`);
            }

            // Start monitoring session
            this._startSessionMonitoring();

            // Sync shared files
            this._syncSharedFiles();

        } catch (error: any) {
            console.error('Failed to join collaborative session:', error);
            vscode.window.showErrorMessage(`Failed to join session: ${error.response?.data?.error || error.message}`);
        }
    }

    private async endCollaborativeSession(): Promise<void> {
        try {
            if (!this._currentSession) {
                vscode.window.showWarningMessage('No active session to end');
                return;
            }

            const confirmation = await vscode.window.showWarningMessage(
                `Are you sure you want to end the session "${this._currentSession.name}"?`,
                'Yes', 'Cancel'
            );

            if (confirmation !== 'Yes') {
                return;
            }

            await axios.post(`${this._apiBaseUrl}/api/collaboration/end`, {
                session_id: this._currentSession.id
            });

            const sessionName = this._currentSession.name;
            this._currentSession = null;
            this._participants = [];

            this._updateStatusBar('', '');
            this._updateWebview();

            vscode.window.showInformationMessage(`Session "${sessionName}" ended`);

        } catch (error: any) {
            console.error('Failed to end collaborative session:', error);
            vscode.window.showErrorMessage(`Failed to end session: ${error.response?.data?.error || error.message}`);
        }
    }

    private async shareFile(filePath: string): Promise<void> {
        try {
            if (!this._currentSession) {
                vscode.window.showWarningMessage('No active collaboration session');
                return;
            }

            await axios.post(`${this._apiBaseUrl}/api/collaboration/share-file`, {
                session_id: this._currentSession.id,
                file_path: filePath
            });

            if (!this._currentSession.shared_files.includes(filePath)) {
                this._currentSession.shared_files.push(filePath);
                this._updateWebview();
            }

            vscode.window.showInformationMessage(`File "${filePath}" is now shared`);

        } catch (error: any) {
            console.error('Failed to share file:', error);
            vscode.window.showErrorMessage(`Failed to share file: ${error.response?.data?.error || error.message}`);
        }
    }

    private async unshareFile(filePath: string): Promise<void> {
        try {
            if (!this._currentSession) {
                vscode.window.showWarningMessage('No active collaboration session');
                return;
            }

            await axios.post(`${this._apiBaseUrl}/api/collaboration/unshare-file`, {
                session_id: this._currentSession.id,
                file_path: filePath
            });

            this._currentSession.shared_files = this._currentSession.shared_files.filter(f => f !== filePath);
            this._updateWebview();

            vscode.window.showInformationMessage(`File "${filePath}" is no longer shared`);

        } catch (error: any) {
            console.error('Failed to unshare file:', error);
            vscode.window.showErrorMessage(`Failed to unshare file: ${error.response?.data?.error || error.message}`);
        }
    }

    private async sendChatMessage(message: string): Promise<void> {
        try {
            if (!this._currentSession) {
                return;
            }

            await axios.post(`${this._apiBaseUrl}/api/collaboration/chat`, {
                session_id: this._currentSession.id,
                message: message
            });

        } catch (error: any) {
            console.error('Failed to send chat message:', error);
        }
    }

    private async updateCursorPosition(file: string, line: number, character: number): Promise<void> {
        try {
            if (!this._currentSession) {
                return;
            }

            await axios.post(`${this._apiBaseUrl}/api/collaboration/cursor`, {
                session_id: this._currentSession.id,
                file: file,
                line: line,
                character: character
            });

        } catch (error: any) {
            console.error('Failed to update cursor position:', error);
        }
    }

    private async _loadActiveSessions(): Promise<void> {
        try {
            const response = await axios.get(`${this._apiBaseUrl}/api/collaboration/sessions`);
            const activeSessions = response.data.sessions || [];

            // Check if we have an active session
            const activeSession = activeSessions.find((s: CollaborationSession) => s.status === 'active');
            if (activeSession) {
                this._currentSession = activeSession;
                this._updateStatusBar(`📡 ${activeSession.name}`, 'Active collaboration session');
                this._startSessionMonitoring();
            }

            this._updateWebview();

        } catch (error: any) {
            console.error('Failed to load active sessions:', error);
        }
    }

    private _startSessionMonitoring(): void {
        if (!this._currentSession) {
            return;
        }

        // Poll for session updates every 5 seconds
        const sessionId = this._currentSession.id;
        const interval = setInterval(async () => {
            try {
                if (!this._currentSession || this._currentSession.id !== sessionId) {
                    clearInterval(interval);
                    return;
                }

                const response = await axios.get(`${this._apiBaseUrl}/api/collaboration/session/${sessionId}`);
                const updatedSession = response.data.session;

                if (updatedSession.status === 'ended') {
                    this._currentSession = null;
                    this._participants = [];
                    this._updateStatusBar('', '');
                    this._updateWebview();
                    vscode.window.showInformationMessage('Collaboration session ended');
                    clearInterval(interval);
                } else {
                    this._currentSession = updatedSession;
                    this._participants = response.data.participants || [];
                    this._updateWebview();
                }

            } catch (error) {
                // Session may no longer exist
                clearInterval(interval);
            }
        }, 5000);

        this._context.subscriptions.push({ dispose: () => clearInterval(interval) });
    }

    private async _syncSharedFiles(): Promise<void> {
        if (!this._currentSession) {
            return;
        }

        // Open shared files in tabs
        for (const filePath of this._currentSession.shared_files) {
            try {
                const uri = vscode.Uri.file(filePath);
                await vscode.window.showTextDocument(uri, { preview: false });
            } catch (error) {
                console.error(`Failed to open shared file: ${filePath}`, error);
            }
        }
    }

    private _showProgress(message: string): void {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: message,
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });
            await new Promise(resolve => setTimeout(resolve, 1000));
        });
    }

    private _updateStatusBar(text: string, tooltip: string): void {
        if (text) {
            this._statusBarItem.text = text;
            this._statusBarItem.tooltip = tooltip;
            this._statusBarItem.show();
        } else {
            this._statusBarItem.hide();
        }
    }

    private _updateWebview(): void {
        if (this._view) {
            this._view.webview.postMessage({
                command: 'update',
                session: this._currentSession,
                participants: this._participants
            });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Collaboration</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    padding: 16px;
                    margin: 0;
                }
                
                .section {
                    margin-bottom: 24px;
                }
                
                .section h3 {
                    margin: 0 0 12px 0;
                    font-size: 14px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                }
                
                .form-group {
                    margin-bottom: 12px;
                }
                
                label {
                    display: block;
                    font-size: 12px;
                    font-weight: 500;
                    margin-bottom: 4px;
                    color: var(--vscode-descriptionForeground);
                }
                
                input, textarea {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid var(--vscode-input-border);
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border-radius: 2px;
                    font-size: 13px;
                    box-sizing: border-box;
                }
                
                button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 14px;
                    border-radius: 2px;
                    cursor: pointer;
                    font-size: 13px;
                    font-family: var(--vscode-font-family);
                }
                
                button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                
                button:disabled {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    cursor: not-allowed;
                }
                
                .session-info {
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                    padding: 12px;
                    border-radius: 4px;
                    margin-bottom: 16px;
                }
                
                .session-name {
                    font-weight: 600;
                    font-size: 14px;
                    margin-bottom: 8px;
                }
                
                .session-id {
                    font-family: var(--vscode-editor-font-family);
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    background-color: var(--vscode-textCodeBlock-background);
                    padding: 4px 6px;
                    border-radius: 2px;
                    margin-bottom: 8px;
                    cursor: pointer;
                }
                
                .participants {
                    margin-top: 12px;
                }
                
                .participant {
                    display: flex;
                    align-items: center;
                    padding: 8px;
                    margin-bottom: 4px;
                    background-color: var(--vscode-list-hoverBackground);
                    border-radius: 4px;
                }
                
                .participant-status {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    margin-right: 8px;
                }
                
                .status-online { background-color: #4caf50; }
                .status-away { background-color: #ff9800; }
                .status-offline { background-color: #f44336; }
                
                .shared-files {
                    margin-top: 12px;
                }
                
                .shared-file {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 6px 8px;
                    margin-bottom: 2px;
                    background-color: var(--vscode-list-hoverBackground);
                    border-radius: 2px;
                    font-size: 12px;
                }
                
                .file-name {
                    font-family: var(--vscode-editor-font-family);
                }
                
                .unshare-btn {
                    background: none;
                    color: var(--vscode-descriptionForeground);
                    border: none;
                    padding: 2px 6px;
                    cursor: pointer;
                    font-size: 11px;
                }
                
                .unshare-btn:hover {
                    background-color: var(--vscode-list-activeSelectionBackground);
                }
                
                .no-session {
                    text-align: center;
                    color: var(--vscode-descriptionForeground);
                    font-style: italic;
                    margin: 40px 0;
                }
                
                .chat-container {
                    border-top: 1px solid var(--vscode-panel-border);
                    padding-top: 12px;
                    margin-top: 16px;
                }
                
                .chat-messages {
                    height: 120px;
                    overflow-y: auto;
                    border: 1px solid var(--vscode-input-border);
                    padding: 8px;
                    margin-bottom: 8px;
                    font-size: 12px;
                }
                
                .chat-input-container {
                    display: flex;
                    gap: 8px;
                }
                
                .chat-input {
                    flex: 1;
                }
                
                .hidden {
                    display: none;
                }
            </style>
        </head>
        <body>
            <div id="no-session-view" class="no-session">
                <p>No active collaboration session</p>
                <p style="font-size: 12px; margin-top: 16px;">Start a new session or join an existing one to collaborate with your team.</p>
            </div>
            
            <div id="session-controls" class="hidden">
                <div class="section">
                    <h3>🚀 Start New Session</h3>
                    <div class="form-group">
                        <label for="sessionName">Session Name</label>
                        <input type="text" id="sessionName" placeholder="My awesome project">
                    </div>
                    <div class="form-group">
                        <label for="inviteEmails">Invite Team Members (optional)</label>
                        <textarea id="inviteEmails" rows="2" placeholder="email1@example.com, email2@example.com"></textarea>
                    </div>
                    <button id="startSessionBtn">Start Session</button>
                </div>
                
                <div class="section">
                    <h3>🔗 Join Session</h3>
                    <div class="form-group">
                        <label for="sessionId">Session ID</label>
                        <input type="text" id="sessionId" placeholder="session-12345">
                    </div>
                    <div class="form-group">
                        <label for="accessCode">Access Code (if required)</label>
                        <input type="text" id="accessCode" placeholder="Optional access code">
                    </div>
                    <button id="joinSessionBtn">Join Session</button>
                </div>
            </div>
            
            <div id="active-session" class="hidden">
                <div class="session-info">
                    <div class="session-name" id="sessionNameDisplay"></div>
                    <div class="session-id" id="sessionIdDisplay" title="Click to copy"></div>
                    <button id="endSessionBtn" style="background-color: var(--vscode-inputValidation-errorBackground);">End Session</button>
                </div>
                
                <div class="section">
                    <h3>👥 Participants (<span id="participantCount">0</span>)</h3>
                    <div id="participantsList"></div>
                </div>
                
                <div class="section">
                    <h3>📁 Shared Files</h3>
                    <button id="shareCurrentFileBtn" style="margin-bottom: 8px;">Share Current File</button>
                    <div id="sharedFilesList"></div>
                </div>
                
                <div class="chat-container">
                    <h3>💬 Team Chat</h3>
                    <div id="chatMessages" class="chat-messages"></div>
                    <div class="chat-input-container">
                        <input type="text" id="chatInput" class="chat-input" placeholder="Type a message...">
                        <button id="sendChatBtn">Send</button>
                    </div>
                </div>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                
                // UI Elements
                const noSessionView = document.getElementById('no-session-view');
                const sessionControls = document.getElementById('session-controls');
                const activeSession = document.getElementById('active-session');
                
                // Session controls
                document.getElementById('startSessionBtn').addEventListener('click', () => {
                    const sessionName = document.getElementById('sessionName').value;
                    const inviteEmails = document.getElementById('inviteEmails').value
                        .split(',')
                        .map(email => email.trim())
                        .filter(email => email);
                    
                    vscode.postMessage({
                        command: 'startSession',
                        sessionName,
                        inviteEmails
                    });
                });
                
                document.getElementById('joinSessionBtn').addEventListener('click', () => {
                    const sessionId = document.getElementById('sessionId').value;
                    const accessCode = document.getElementById('accessCode').value;
                    
                    vscode.postMessage({
                        command: 'joinSession',
                        sessionId,
                        accessCode
                    });
                });
                
                document.getElementById('endSessionBtn').addEventListener('click', () => {
                    vscode.postMessage({ command: 'endSession' });
                });
                
                document.getElementById('shareCurrentFileBtn').addEventListener('click', () => {
                    vscode.postMessage({ command: 'shareFile' });
                });
                
                document.getElementById('sendChatBtn').addEventListener('click', () => {
                    sendChatMessage();
                });
                
                document.getElementById('chatInput').addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        sendChatMessage();
                    }
                });
                
                function sendChatMessage() {
                    const input = document.getElementById('chatInput');
                    const message = input.value.trim();
                    if (message) {
                        vscode.postMessage({
                            command: 'sendChatMessage',
                            message
                        });
                        input.value = '';
                    }
                }
                
                // Session ID copy functionality
                document.getElementById('sessionIdDisplay').addEventListener('click', () => {
                    const sessionId = document.getElementById('sessionIdDisplay').textContent;
                    navigator.clipboard.writeText(sessionId);
                });
                
                // Handle messages from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    if (message.command === 'update') {
                        updateUI(message.session, message.participants);
                    }
                });
                
                function updateUI(session, participants) {
                    if (session) {
                        // Show active session view
                        noSessionView.classList.add('hidden');
                        sessionControls.classList.add('hidden');
                        activeSession.classList.remove('hidden');
                        
                        // Update session info
                        document.getElementById('sessionNameDisplay').textContent = session.name;
                        document.getElementById('sessionIdDisplay').textContent = session.id;
                        
                        // Update participants
                        document.getElementById('participantCount').textContent = participants.length;
                        const participantsList = document.getElementById('participantsList');
                        participantsList.innerHTML = '';
                        
                        participants.forEach(participant => {
                            const div = document.createElement('div');
                            div.className = 'participant';
                            div.innerHTML = \`
                                <div class="participant-status status-\${participant.status}"></div>
                                <div>\${participant.name}</div>
                            \`;
                            participantsList.appendChild(div);
                        });
                        
                        // Update shared files
                        const sharedFilesList = document.getElementById('sharedFilesList');
                        sharedFilesList.innerHTML = '';
                        
                        (session.shared_files || []).forEach(filePath => {
                            const div = document.createElement('div');
                            div.className = 'shared-file';
                            div.innerHTML = \`
                                <span class="file-name">\${filePath.split('/').pop()}</span>
                                <button class="unshare-btn" onclick="unshareFile('\${filePath}')">×</button>
                            \`;
                            sharedFilesList.appendChild(div);
                        });
                        
                    } else {
                        // Show no session view
                        noSessionView.classList.remove('hidden');
                        sessionControls.classList.remove('hidden');
                        activeSession.classList.add('hidden');
                    }
                }
                
                function unshareFile(filePath) {
                    vscode.postMessage({
                        command: 'unshareFile',
                        filePath
                    });
                }
                
                // Initialize view
                updateUI(null, []);
            </script>
        </body>
        </html>`;
    }

    public async shareCurrentFile(): Promise<void> {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showWarningMessage('No active file to share');
            return;
        }

        const filePath = activeEditor.document.uri.fsPath;
        await this.shareFile(filePath);
    }
}
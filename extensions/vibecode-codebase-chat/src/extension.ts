import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'

class ChatViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView
  private chatHistory: Array<{ role: string; content: string }> = []

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    }

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview)

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'askQuestion':
          await this.handleQuestion(data.question)
          break
      }
    })
  }

  private async handleQuestion(question: string) {
    this.chatHistory.push({ role: 'user', content: question })
    this._view?.webview.postMessage({ type: 'userMessage', content: question })

    try {
      // Search codebase using our vector search
      const context = await this.searchCodebase(question)

      // Call AI with context
      const response = await fetch('http://localhost:3000/api/code-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Answer this question about the codebase:\n\nQuestion: ${question}\n\nRelevant code:\n${context}`,
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          metadata: {
            type: 'codebase-chat',
          },
        }),
      })

      const data = await response.json()
      const answer = data.completion || data.choices?.[0]?.message?.content

      this.chatHistory.push({ role: 'assistant', content: answer })
      this._view?.webview.postMessage({ type: 'aiMessage', content: answer })
    } catch (error) {
      this._view?.webview.postMessage({
        type: 'error',
        content: `Error: ${error}`,
      })
    }
  }

  private async searchCodebase(query: string): Promise<string> {
    // Use our vector search API
    try {
      const response = await fetch('http://localhost:3000/api/search/vector', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          limit: 5,
          type: 'code',
        }),
      })

      const data = await response.json()
      return data.results?.map((r: any) => r.content).join('\n\n') || ''
    } catch (error) {
      // Fallback: search workspace files
      return await this.fallbackSearch(query)
    }
  }

  private async fallbackSearch(query: string): Promise<string> {
    const workspaceFolders = vscode.workspace.workspaceFolders
    if (!workspaceFolders) {
      return ''
    }

    const files = await vscode.workspace.findFiles(
      '**/*.{ts,tsx,js,jsx,py,go,rs}',
      '**/node_modules/**',
      10
    )

    let context = ''
    for (const file of files.slice(0, 5)) {
      const content = await vscode.workspace.fs.readFile(file)
      context += `\n\n// ${file.path}\n${content.toString()}`
    }

    return context
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Codebase Chat</title>
    <style>
        body {
            padding: 10px;
            color: var(--vscode-foreground);
            font-family: var(--vscode-font-family);
        }
        #chat-container {
            display: flex;
            flex-direction: column;
            height: calc(100vh - 100px);
        }
        #messages {
            flex: 1;
            overflow-y: auto;
            margin-bottom: 10px;
        }
        .message {
            margin: 10px 0;
            padding: 8px;
            border-radius: 4px;
        }
        .user-message {
            background: var(--vscode-input-background);
        }
        .ai-message {
            background: var(--vscode-editor-background);
            border-left: 3px solid var(--vscode-focusBorder);
        }
        #input-container {
            display: flex;
            gap: 5px;
        }
        #question-input {
            flex: 1;
            padding: 8px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
        }
        button {
            padding: 8px 16px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    <div id="chat-container">
        <div id="messages"></div>
        <div id="input-container">
            <input type="text" id="question-input" placeholder="Ask about your codebase..." />
            <button onclick="sendQuestion()">Send</button>
        </div>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        const messagesDiv = document.getElementById('messages');
        const input = document.getElementById('question-input');

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'userMessage':
                    addMessage(message.content, 'user');
                    break;
                case 'aiMessage':
                    addMessage(message.content, 'ai');
                    break;
                case 'error':
                    addMessage(message.content, 'error');
                    break;
            }
        });

        function addMessage(content, type) {
            const div = document.createElement('div');
            div.className = \`message \${type}-message\`;
            div.textContent = content;
            messagesDiv.appendChild(div);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }

        function sendQuestion() {
            const question = input.value.trim();
            if (question) {
                vscode.postMessage({ type: 'askQuestion', question });
                input.value = '';
            }
        }

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendQuestion();
            }
        });
    </script>
</body>
</html>`
  }
}

export function activate(context: vscode.ExtensionContext) {
  const provider = new ChatViewProvider(context.extensionUri)

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('vibecodeChatView', provider)
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('vibecode.askCodebase', async () => {
      const question = await vscode.window.showInputBox({
        prompt: 'Ask a question about your codebase',
        placeHolder: 'e.g., "How does authentication work?"',
      })

      if (question) {
        vscode.commands.executeCommand('vibecodeChatView.focus')
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('vibecode.indexCodebase', async () => {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Indexing codebase...',
          cancellable: false,
        },
        async () => {
          // Call our indexing API
          try {
            await fetch('http://localhost:3000/api/search/index', {
              method: 'POST',
            })
            vscode.window.showInformationMessage('✅ Codebase indexed successfully')
          } catch (error) {
            vscode.window.showErrorMessage(`Indexing failed: ${error}`)
          }
        }
      )
    })
  )
}

export function deactivate() {}

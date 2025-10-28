import * as vscode from 'vscode'

let decorationType: vscode.TextEditorDecorationType

export function activate(context: vscode.ExtensionContext) {
  decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(100, 100, 255, 0.1)',
    border: '1px solid rgba(100, 100, 255, 0.3)',
  })

  const disposable = vscode.commands.registerCommand('vibecode.inlineEdit', async () => {
    const editor = vscode.window.activeTextEditor
    if (!editor) {
      return
    }

    const selection = editor.selection
    const selectedText = editor.document.getText(selection)

    // Show input box for instruction
    const instruction = await vscode.window.showInputBox({
      prompt: 'What would you like to do with this code?',
      placeHolder: 'e.g., "add error handling", "refactor to async/await", "add comments"',
    })

    if (!instruction) {
      return
    }

    // Show progress
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'AI is editing your code...',
        cancellable: true,
      },
      async (progress, token) => {
        try {
          // Call our API
          const response = await fetch('http://localhost:3000/api/code-completion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: `${instruction}\n\nCode:\n${selectedText}`,
              provider: 'openai',
              model: 'gpt-4',
              metadata: {
                language: editor.document.languageId,
                filename: editor.document.fileName,
              },
            }),
          })

          if (!response.ok) {
            throw new Error('API request failed')
          }

          const data = await response.json()
          const newCode = data.completion || data.choices?.[0]?.message?.content

          if (!newCode) {
            throw new Error('No completion received')
          }

          // Show diff preview
          const doc = await vscode.workspace.openTextDocument({
            content: newCode,
            language: editor.document.languageId,
          })

          await vscode.commands.executeCommand('vscode.diff', editor.document.uri, doc.uri, 'AI Edit Preview')

          // Ask to apply
          const apply = await vscode.window.showInformationMessage(
            'Apply AI edit?',
            'Apply',
            'Cancel'
          )

          if (apply === 'Apply') {
            await editor.edit((editBuilder) => {
              editBuilder.replace(selection, newCode)
            })

            vscode.window.showInformationMessage('✅ AI edit applied')
          }
        } catch (error) {
          vscode.window.showErrorMessage(`AI edit failed: ${error}`)
        }
      }
    )
  })

  context.subscriptions.push(disposable)
}

export function deactivate() {
  if (decorationType) {
    decorationType.dispose()
  }
}

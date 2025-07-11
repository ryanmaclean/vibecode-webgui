import * as vscode from 'vscode';
import { OpenRouterClient } from './openrouter-client';

export class CodeGenerator {
    private openRouterClient: OpenRouterClient;
    private outputChannel: vscode.OutputChannel;

    constructor(openRouterClient: OpenRouterClient) {
        this.openRouterClient = openRouterClient;
        this.outputChannel = vscode.window.createOutputChannel('VibeCode Code Generator');
    }

    public async generateCode(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        // Get user input for code generation
        const prompt = await vscode.window.showInputBox({
            prompt: 'Describe what code you want to generate',
            placeHolder: 'e.g., "Create a function that validates email addresses"',
            validateInput: (value) => {
                return value.trim().length === 0 ? 'Please enter a description' : null;
            }
        });

        if (!prompt) {
            return;
        }

        try {
            await this.validateApiKey();
            
            // Get current file context
            const document = editor.document;
            const language = document.languageId;
            const currentPosition = editor.selection.active;
            const contextLines = this.getContextLines(document, currentPosition);
            
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Generating code...",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0 });
                
                const generatedCode = await this.openRouterClient.generateCode(
                    prompt,
                    contextLines,
                    language
                );
                
                progress.report({ increment: 100 });
                
                // Show generated code and offer to insert it
                const action = await vscode.window.showInformationMessage(
                    'Code generated successfully. Would you like to insert it?',
                    'Insert at Cursor',
                    'Insert on New Line',
                    'Show in New Document',
                    'Cancel'
                );
                
                if (action === 'Insert at Cursor') {
                    await editor.edit(editBuilder => {
                        editBuilder.insert(currentPosition, generatedCode);
                    });
                } else if (action === 'Insert on New Line') {
                    await editor.edit(editBuilder => {
                        const lineEnd = document.lineAt(currentPosition.line).range.end;
                        editBuilder.insert(lineEnd, '\n' + generatedCode);
                    });
                } else if (action === 'Show in New Document') {
                    const doc = await vscode.workspace.openTextDocument({
                        content: generatedCode,
                        language: language
                    });
                    await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
                }
            });
        } catch (error) {
            this.handleError('Failed to generate code', error);
        }
    }

    public async generateTests(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const selection = editor.selection;
        let codeToTest: string;
        
        if (!selection.isEmpty) {
            codeToTest = editor.document.getText(selection);
        } else {
            // Use the entire document if no selection
            codeToTest = editor.document.getText();
        }

        if (!codeToTest.trim()) {
            vscode.window.showErrorMessage('No code found to generate tests for');
            return;
        }

        // Ask for test framework preference
        const testFramework = await vscode.window.showQuickPick([
            'Jest',
            'Mocha',
            'Vitest',
            'Pytest',
            'JUnit',
            'Go Test',
            'RSpec',
            'Minitest',
            'Auto-detect'
        ], {
            placeHolder: 'Select test framework (or auto-detect)'
        });

        if (!testFramework) {
            return;
        }

        try {
            await this.validateApiKey();
            
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Generating tests...",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0 });
                
                const tests = await this.openRouterClient.generateTests(
                    codeToTest,
                    testFramework === 'Auto-detect' ? undefined : testFramework
                );
                
                progress.report({ increment: 100 });
                
                // Create a new test file
                const originalFileName = editor.document.fileName;
                const testFileName = this.generateTestFileName(originalFileName);
                const testLanguage = this.getTestLanguage(editor.document.languageId);
                
                const doc = await vscode.workspace.openTextDocument({
                    content: tests,
                    language: testLanguage
                });
                
                await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
                
                // Offer to save the test file
                const saveAction = await vscode.window.showInformationMessage(
                    `Test file generated. Save as ${testFileName}?`,
                    'Save',
                    'Save As...',
                    'Don\'t Save'
                );
                
                if (saveAction === 'Save' || saveAction === 'Save As...') {
                    const saveAs = saveAction === 'Save As...';
                    await vscode.commands.executeCommand('workbench.action.files.save', { saveAs });
                }
            });
        } catch (error) {
            this.handleError('Failed to generate tests', error);
        }
    }

    private getContextLines(document: vscode.TextDocument, position: vscode.Position): string {
        const startLine = Math.max(0, position.line - 10);
        const endLine = Math.min(document.lineCount - 1, position.line + 10);
        
        let context = '';
        for (let i = startLine; i <= endLine; i++) {
            const line = document.lineAt(i);
            context += line.text + '\n';
        }
        
        return context;
    }

    private generateTestFileName(originalFileName: string): string {
        const path = require('path');
        const ext = path.extname(originalFileName);
        const baseName = path.basename(originalFileName, ext);
        const dir = path.dirname(originalFileName);
        
        // Common test file naming patterns
        const testPatterns = [
            `${baseName}.test${ext}`,
            `${baseName}.spec${ext}`,
            `${baseName}_test${ext}`,
            `test_${baseName}${ext}`
        ];
        
        // Return the first pattern (most common)
        return path.join(dir, testPatterns[0]);
    }

    private getTestLanguage(originalLanguage: string): string {
        // Map languages to their test equivalents
        const languageMap: { [key: string]: string } = {
            'typescript': 'typescript',
            'javascript': 'javascript',
            'python': 'python',
            'java': 'java',
            'go': 'go',
            'rust': 'rust',
            'csharp': 'csharp',
            'cpp': 'cpp',
            'c': 'c'
        };
        
        return languageMap[originalLanguage] || originalLanguage;
    }

    private async validateApiKey(): Promise<void> {
        const apiKey = vscode.workspace.getConfiguration('vibecode').get<string>('openRouterApiKey');
        
        if (!apiKey) {
            const action = await vscode.window.showErrorMessage(
                'OpenRouter API key is required. Please set it in settings.',
                'Open Settings'
            );
            
            if (action === 'Open Settings') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'vibecode.openRouterApiKey');
            }
            
            throw new Error('API key not configured');
        }
    }

    private handleError(message: string, error: any): void {
        console.error(message, error);
        this.outputChannel.appendLine(`${message}: ${error.message}`);
        vscode.window.showErrorMessage(`${message}: ${error.message}`);
    }
}
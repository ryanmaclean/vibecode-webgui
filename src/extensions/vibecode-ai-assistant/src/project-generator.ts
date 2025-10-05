import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { OpenRouterClient, ChatMessage } from './openrouter-client';

export interface ProjectTemplate {
    name: string;
    description: string;
    language: string;
    framework?: string;
    files: ProjectFile[];
}

export interface ProjectFile {
    path: string;
    content: string;
    language: string;
}

export class ProjectGenerator {
    private openRouterClient: OpenRouterClient;
    private outputChannel: vscode.OutputChannel;

    constructor(openRouterClient: OpenRouterClient) {
        this.openRouterClient = openRouterClient;
        this.outputChannel = vscode.window.createOutputChannel('VibeCode Project Generator');
    }

    public async generateProject(): Promise<void> {
        try {
            await this.validateApiKey();

            // Check if workspace is empty
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                const action = await vscode.window.showErrorMessage(
                    'No workspace folder found. Please open a folder first.',
                    'Open Folder'
                );

                if (action === 'Open Folder') {
                    vscode.commands.executeCommand('workbench.action.files.openFolder');
                }
                return;
            }

            const workspaceFolder = workspaceFolders[0];
            const folderPath = workspaceFolder.uri.fsPath;

            // Check if folder is not empty
            const files = await this.listDirectoryContents(folderPath);
            if (files.length > 0) {
                const proceed = await vscode.window.showWarningMessage(
                    'The current folder is not empty. Generated files may overwrite existing ones.',
                    'Proceed',
                    'Cancel'
                );

                if (proceed !== 'Proceed') {
                    return;
                }
            }

            // Get project description from user
            const projectDescription = await vscode.window.showInputBox({
                prompt: 'Describe the project you want to generate',
                placeHolder: 'e.g., "A REST API for a todo app with user authentication"',
                validateInput: (value) => {
                    return value.trim().length < 10 ? 'Please provide a more detailed description' : null;
                }
            });

            if (!projectDescription) {
                return;
            }

            // Get project type/language preference
            const projectType = await vscode.window.showQuickPick([
                'Web Application (React/TypeScript)',
                'Web Application (Vue.js/TypeScript)',
                'REST API (Node.js/Express)',
                'REST API (Python/FastAPI)',
                'REST API (Go/Gin)',
                'Desktop Application (Electron)',
                'CLI Application (Node.js)',
                'CLI Application (Python)',
                'CLI Application (Go)',
                'Library/Package (TypeScript)',
                'Library/Package (Python)',
                'Mobile App (React Native)',
                'Auto-detect from description'
            ], {
                placeHolder: 'Select project type'
            });

            if (!projectType) {
                return;
            }

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Generating project...",
                cancellable: true
            }, async (progress, token) => {
                progress.report({ increment: 0, message: 'Analyzing requirements...' });

                const projectTemplate = await this.generateProjectTemplate(
                    projectDescription,
                    projectType,
                    token
                );

                if (token.isCancellationRequested) {
                    return;
                }

                progress.report({ increment: 50, message: 'Creating files...' });

                await this.createProjectFiles(projectTemplate, folderPath, progress);

                progress.report({ increment: 100, message: 'Project generated successfully!' });

                // Show completion message
                const viewProject = await vscode.window.showInformationMessage(
                    `Project "${projectTemplate.name}" generated successfully!`,
                    'View Files',
                    'Open README'
                );

                if (viewProject === 'View Files') {
                    vscode.commands.executeCommand('workbench.view.explorer');
                } else if (viewProject === 'Open README') {
                    const readmePath = path.join(folderPath, 'README.md');
                    if (fs.existsSync(readmePath)) {
                        const doc = await vscode.workspace.openTextDocument(readmePath);
                        await vscode.window.showTextDocument(doc);
                    }
                }
            });
        } catch (error) {
            this.handleError('Failed to generate project', error);
        }
    }

    private async generateProjectTemplate(
        description: string,
        projectType: string,
        token: vscode.CancellationToken
    ): Promise<ProjectTemplate> {
        const systemPrompt = `You are a senior software architect. Generate a complete project structure based on the user's description and project type.

Project Type: ${projectType}
Description: ${description}

Generate a JSON response with this structure:
{
  "name": "project-name",
  "description": "Brief project description",
  "language": "primary-language",
  "framework": "framework-if-applicable",
  "files": [
    {
      "path": "relative/path/to/file.ext",
      "content": "complete file content",
      "language": "file-language"
    }
  ]
}

Requirements:
- Include all necessary files (source code, config files, package.json, README, etc.)
- Follow best practices and project structure conventions
- Include proper error handling and logging
- Add comprehensive comments and documentation
- Include basic tests if applicable
- Ensure all files are production-ready
- Include a detailed README with setup instructions

Generate between 5-15 files depending on project complexity.`;

        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Generate a ${projectType} project: ${description}` }
        ];

        const response = await this.openRouterClient.chatCompletion(messages);
        const content = response.choices[0].message.content;

        try {
            // Extract JSON from response (handle markdown code blocks)
            const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
            const jsonContent = jsonMatch ? jsonMatch[1] : content;

            const projectTemplate: ProjectTemplate = JSON.parse(jsonContent);
            return projectTemplate;
        } catch (error) {
            throw new Error(`Failed to parse project template: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async createProjectFiles(
        template: ProjectTemplate,
        basePath: string,
        progress: vscode.Progress<{ increment?: number; message?: string }>
    ): Promise<void> {
        const totalFiles = template.files.length;
        let completedFiles = 0;

        for (const file of template.files) {
            const filePath = path.join(basePath, file.path);
            const directory = path.dirname(filePath);

            // Create directory if it doesn't exist
            if (!fs.existsSync(directory)) {
                fs.mkdirSync(directory, { recursive: true });
            }

            // Write file content
            fs.writeFileSync(filePath, file.content, 'utf8');

            completedFiles++;
            const increment = (completedFiles / totalFiles) * 50; // 50% of remaining progress
            progress.report({
                increment,
                message: `Created ${file.path}`
            });

            // Small delay to show progress
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    private async listDirectoryContents(dirPath: string): Promise<string[]> {
        try {
            const files = fs.readdirSync(dirPath);
            return files.filter(file => !file.startsWith('.'));
        } catch (error) {
            return [];
        }
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

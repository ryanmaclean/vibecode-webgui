/**
 * Command Handlers for VibeCode Enhancements
 * 
 * Implements commands for:
 * - Code explanation (anti-vibe coding)
 * - Budget management
 * - Datadog dashboard access
 */

import * as vscode from 'vscode';
import { CodeExplainerService } from './codeExplainer';
import { TokenTracker } from './tokenTracker';

export class CommandHandlers {
    private codeExplainer: CodeExplainerService;
    private tokenTracker: TokenTracker;

    constructor(
        private context: vscode.ExtensionContext,
        codeExplainer: CodeExplainerService,
        tokenTracker: TokenTracker
    ) {
        this.codeExplainer = codeExplainer;
        this.tokenTracker = tokenTracker;
    }

    /**
     * Register all command handlers
     */
    registerCommands(): void {
        this.context.subscriptions.push(
            vscode.commands.registerCommand('workspace-rag.explainCode', () => this.handleExplainCode()),
            vscode.commands.registerCommand('workspace-rag.setBudget', () => this.handleSetBudget()),
            vscode.commands.registerCommand('workspace-rag.openCostDashboard', () => this.handleOpenCostDashboard()),
            vscode.commands.registerCommand('workspace-rag.openQualityDashboard', () => this.handleOpenQualityDashboard())
        );
    }

    /**
     * Handle: Explain Code command
     */
    private async handleExplainCode(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor. Please open a file and select code to explain.');
            return;
        }

        const selection = editor.selection;
        const code = editor.document.getText(selection.isEmpty ? undefined : selection);

        if (!code || code.trim().length === 0) {
            vscode.window.showWarningMessage('No code selected. Please select code to explain or open a file.');
            return;
        }

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Analyzing code...',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: 'Detecting patterns and complexity...' });

                const explanation = await this.codeExplainer.explainCode(code, editor.document.fileName);

                progress.report({ increment: 100, message: 'Complete!' });

                // Show results in information message
                const complexityEmoji = this.getComplexityEmoji(explanation.complexity.overall);
                const message = `${complexityEmoji} Complexity: ${explanation.complexity.overall} (${explanation.complexity.score}/100)\n` +
                    `Patterns: ${explanation.patterns.length} | Warnings: ${explanation.warnings.length}`;

                const action = await vscode.window.showInformationMessage(
                    message,
                    'View in Datadog',
                    'Dismiss'
                );

                if (action === 'View in Datadog') {
                    await this.handleOpenQualityDashboard();
                }
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Code analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Handle: Set Budget command
     */
    private async handleSetBudget(): Promise<void> {
        const period = await vscode.window.showQuickPick([
            { label: 'Daily', value: 'daily' as const, description: 'Set daily spending limit' },
            { label: 'Weekly', value: 'weekly' as const, description: 'Set weekly spending limit' },
            { label: 'Monthly', value: 'monthly' as const, description: 'Set monthly spending limit' }
        ], {
            placeHolder: 'Select budget period'
        });

        if (!period) return;

        const limitStr = await vscode.window.showInputBox({
            prompt: `Enter ${period.label.toLowerCase()} budget limit (USD)`,
            placeHolder: '10.00',
            validateInput: (value) => {
                const num = parseFloat(value);
                if (isNaN(num) || num < 0) {
                    return 'Please enter a valid positive number';
                }
                return null;
            }
        });

        if (!limitStr) return;

        const limit = parseFloat(limitStr);

        try {
            await this.tokenTracker.setBudget(period.value, limit);

            // Also save to VS Code settings for persistence
            const config = vscode.workspace.getConfiguration('workspaceRag');
            await config.update(`budget.${period.value}`, limit, vscode.ConfigurationTarget.Global);

            const action = await vscode.window.showInformationMessage(
                `✅ ${period.label} budget set to $${limit.toFixed(2)}. You'll be alerted at 80% usage.`,
                'View Dashboard'
            );

            if (action === 'View Dashboard') {
                await this.handleOpenCostDashboard();
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to set budget: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Handle: Open Cost Dashboard command
     */
    private async handleOpenCostDashboard(): Promise<void> {
        const config = vscode.workspace.getConfiguration('workspaceRag');
        const dashboardUrl = config.get<string>('datadog.costDashboardUrl');

        if (!dashboardUrl || dashboardUrl.trim() === '') {
            const action = await vscode.window.showWarningMessage(
                'Datadog Cost Dashboard URL not configured.',
                'Configure Now',
                'Learn More'
            );

            if (action === 'Configure Now') {
                await vscode.commands.executeCommand('workbench.action.openSettings', 'workspaceRag.datadog.costDashboardUrl');
            } else if (action === 'Learn More') {
                await vscode.env.openExternal(vscode.Uri.parse('https://github.com/vibecode/vibecode-webgui/blob/main/datadog/dashboards/README.md'));
            }
            return;
        }

        try {
            await vscode.env.openExternal(vscode.Uri.parse(dashboardUrl));
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open dashboard: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Handle: Open Quality Dashboard command
     */
    private async handleOpenQualityDashboard(): Promise<void> {
        const config = vscode.workspace.getConfiguration('workspaceRag');
        const dashboardUrl = config.get<string>('datadog.qualityDashboardUrl');

        if (!dashboardUrl || dashboardUrl.trim() === '') {
            const action = await vscode.window.showWarningMessage(
                'Datadog Quality Dashboard URL not configured.',
                'Configure Now',
                'Learn More'
            );

            if (action === 'Configure Now') {
                await vscode.commands.executeCommand('workbench.action.openSettings', 'workspaceRag.datadog.qualityDashboardUrl');
            } else if (action === 'Learn More') {
                await vscode.env.openExternal(vscode.Uri.parse('https://github.com/vibecode/vibecode-webgui/blob/main/datadog/dashboards/README.md'));
            }
            return;
        }

        try {
            await vscode.env.openExternal(vscode.Uri.parse(dashboardUrl));
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open dashboard: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get emoji for complexity level
     */
    private getComplexityEmoji(level: string): string {
        switch (level) {
            case 'simple': return '✅';
            case 'moderate': return '⚠️';
            case 'complex': return '🔴';
            case 'very-complex': return '💀';
            default: return 'ℹ️';
        }
    }
}

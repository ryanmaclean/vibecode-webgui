// src/logger.ts
import * as vscode from 'vscode';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export class Logger {
    private outputChannel: vscode.OutputChannel;
    private debugMode: boolean;

    constructor(context?: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel('Workspace RAG');
        this.debugMode = vscode.workspace.getConfiguration('workspaceRag').get('debugMode', false);
        
        if (context) {
            context.subscriptions.push(this.outputChannel);
        }
    }

    private log(level: LogLevel, message: string, data?: any) {
        const timestamp = new Date().toISOString();
        let logMessage = `[${timestamp}] [${level}] ${message}`;
        
        if (data) {
            if (typeof data === 'object') {
                logMessage += '\n' + JSON.stringify(data, null, 2);
            } else {
                logMessage += ` ${data}`;
            }
        }
        
        this.outputChannel.appendLine(logMessage);
    }

    public debug(message: string, data?: any) {
        if (this.debugMode) {
            this.log('DEBUG', message, data);
        }
    }

    public info(message: string, data?: any) {
        this.log('INFO', message, data);
    }

    public warn(message: string, data?: any) {
        this.log('WARN', message, data);
        vscode.window.showWarningMessage(message);
    }

    public error(message: string, error?: any) {
        this.log('ERROR', message, error);
        
        // Show error message to user
        const errorMsg = error?.message || message;
        vscode.window.showErrorMessage(`RAG Extension: ${errorMsg}`);
    }

    public showOutput() {
        this.outputChannel.show();
    }

    public clear() {
        this.outputChannel.clear();
    }
}


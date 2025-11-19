// src/logger.ts
import * as vscode from 'vscode';
import { ExtensionContext } from 'vscode';

export class Logger {
    private context: ExtensionContext | undefined;
    private outputChannel: vscode.OutputChannel;

    constructor(context?: ExtensionContext) {
        this.context = context;
        this.outputChannel = vscode.window.createOutputChannel('Workspace RAG');
    }

    public info(message: string, metadata?: any) {
        this.log('INFO', message, metadata);
    }

    public warn(message: string, metadata?: any) {
        this.log('WARN', message, metadata);
    }

    public error(message: string, error?: any, metadata?: any) {
        this.log('ERROR', message, metadata);
        if (error) {
            this.outputChannel.appendLine(`Error details: ${JSON.stringify(error, null, 2)}`);
            if (error.stack) {
                this.outputChannel.appendLine(`Stack trace: ${error.stack}`);
            }
        }
    }

    public debug(message: string, metadata?: any) {
        const config = vscode.workspace.getConfiguration('workspaceRag');
        if (config.get('tracing.debug', false)) {
            this.log('DEBUG', message, metadata);
        }
    }

    private log(level: string, message: string, metadata?: any) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level}] ${message}`;
        this.outputChannel.appendLine(logMessage);
        
        if (metadata) {
            this.outputChannel.appendLine(`  Metadata: ${JSON.stringify(metadata, null, 2)}`);
        }
    }

    public showOutput() {
        this.outputChannel.show();
    }
}


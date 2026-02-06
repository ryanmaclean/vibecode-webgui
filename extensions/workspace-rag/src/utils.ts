// src/utils.ts
import * as vscode from 'vscode';

export function getWorkspaceId(): string | null {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return null;
    }
    
    // Use workspace name as ID (with sanitization)
    const workspaceName = vscode.workspace.workspaceFolders[0].name;
    return workspaceName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

export function getWorkspaceRoot(): string | null {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return null;
    }
    
    return vscode.workspace.workspaceFolders[0].uri.fsPath;
}


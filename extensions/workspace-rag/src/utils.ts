// src/utils.ts
import * as vscode from 'vscode';
import * as crypto from 'crypto';

/**
 * Get a unique identifier for the current workspace
 */
export function getWorkspaceId(): string | null {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return null;
    }
    
    // Use workspace folder path hash as ID for uniqueness
    const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const hash = crypto.createHash('sha256').update(workspacePath).digest('hex');
    return hash.substring(0, 16);
}

/**
 * Get workspace name for display purposes
 */
export function getWorkspaceName(): string | null {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return null;
    }
    return vscode.workspace.workspaceFolders[0].name;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format duration in milliseconds to human-readable format
 */
export function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
}

/**
 * Sanitize text for safe display
 */
export function sanitizeText(text: string): string {
    return text.replace(/[<>]/g, '');
}

/**
 * Check if running on Apple Silicon
 */
export function isAppleSilicon(): boolean {
    return process.platform === 'darwin' && process.arch === 'arm64';
}


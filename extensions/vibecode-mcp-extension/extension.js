// MIT License
// Minimal MCP Extension activation
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  try {
    console.log('[MCP] MCP Extension Activated');
    // Write a marker file to the current workspace for test detection
    try {
      const folders = vscode.workspace.workspaceFolders || [];
      if (folders.length > 0) {
        const root = folders[0].uri.fsPath;
        const marker = path.join(root, '.mcp-activated');
        fs.writeFileSync(marker, String(Date.now()));
        console.log('[MCP] Wrote activation marker to', marker);
      } else {
        console.log('[MCP] No workspace folder to write activation marker');
      }
    } catch (e) {
      console.error('[MCP] Marker write error:', e && e.message ? e.message : e);
    }
    const disposable = vscode.commands.registerCommand('vibecode.mcp.ping', () => {
      vscode.window.showInformationMessage('VibeCode MCP Extension: ping');
      console.log('[MCP] Command vibecode.mcp.ping executed');
    });
    context.subscriptions.push(disposable);
  } catch (e) {
    console.error('[MCP] Activation error:', e && e.message ? e.message : e);
  }
}

function deactivate() {
  console.log('[MCP] MCP Extension Deactivated');
}

module.exports = { activate, deactivate };

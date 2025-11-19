#!/usr/bin/env node

/**
 * Mock VS Code Server for testing Electron integration
 * This creates a simple HTTP server that mimics the VS Code Server interface
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8081;
const HOST = process.env.HOST || '127.0.0.1';

// Simple HTML page that looks like VS Code
const mockHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mock VS Code Server</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1e1e1e;
      color: #cccccc;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .header {
      background: #323233;
      padding: 8px 16px;
      border-bottom: 1px solid #2d2d30;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .menu-item {
      padding: 4px 12px;
      cursor: pointer;
      border-radius: 3px;
    }
    .menu-item:hover {
      background: #2a2d2e;
    }
    .main {
      flex: 1;
      display: flex;
    }
    .sidebar {
      width: 48px;
      background: #333333;
      border-right: 1px solid #2d2d30;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px 0;
    }
    .icon {
      width: 32px;
      height: 32px;
      margin: 8px 0;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      border-radius: 4px;
      color: #858585;
    }
    .icon:hover {
      color: #cccccc;
    }
    .icon.active {
      color: #007acc;
      background: #094771;
    }
    .explorer {
      width: 250px;
      background: #252526;
      border-right: 1px solid #2d2d30;
      padding: 16px;
    }
    .explorer-title {
      font-size: 11px;
      text-transform: uppercase;
      color: #858585;
      margin-bottom: 8px;
    }
    .editor {
      flex: 1;
      background: #1e1e1e;
      padding: 32px;
      overflow: auto;
    }
    .welcome-message {
      max-width: 600px;
      margin: 0 auto;
    }
    .welcome-message h1 {
      font-size: 32px;
      margin-bottom: 16px;
      color: #ffffff;
    }
    .welcome-message p {
      line-height: 1.6;
      margin-bottom: 12px;
    }
    .success-badge {
      display: inline-block;
      background: #4caf50;
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .info-box {
      background: #252526;
      border: 1px solid #3e3e42;
      border-radius: 4px;
      padding: 16px;
      margin-top: 24px;
    }
    .info-box h3 {
      font-size: 14px;
      margin-bottom: 12px;
      color: #007acc;
    }
    .info-box ul {
      list-style: none;
      padding-left: 16px;
    }
    .info-box li {
      margin-bottom: 8px;
      position: relative;
    }
    .info-box li:before {
      content: "✓";
      position: absolute;
      left: -16px;
      color: #4caf50;
    }
    .statusbar {
      background: #007acc;
      color: white;
      padding: 4px 16px;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 16px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="menu-item">File</div>
    <div class="menu-item">Edit</div>
    <div class="menu-item">Selection</div>
    <div class="menu-item">View</div>
    <div class="menu-item">Go</div>
    <div class="menu-item">Run</div>
    <div class="menu-item">Terminal</div>
    <div class="menu-item">Help</div>
  </div>

  <div class="main">
    <div class="sidebar">
      <div class="icon active" title="Explorer">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 3h8l2 2h8v14H3V3z"/>
        </svg>
      </div>
      <div class="icon" title="Search">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/>
          <path d="M16 16l5 5"/>
        </svg>
      </div>
      <div class="icon" title="Source Control">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5 9h14M5 15h14"/>
        </svg>
      </div>
    </div>

    <div class="explorer">
      <div class="explorer-title">Explorer</div>
      <div style="color: #858585; font-size: 13px;">No folder opened</div>
    </div>

    <div class="editor">
      <div class="welcome-message">
        <span class="success-badge">Integration Successful!</span>
        <h1>Mock VS Code Server Running</h1>
        <p>
          This is a mock VS Code Server running on <strong>http://${HOST}:${PORT}</strong>
          for testing the Electron integration.
        </p>
        <p>
          The Electron app successfully launched this server as a subprocess and loaded
          it in a BrowserWindow with proper security settings.
        </p>

        <div class="info-box">
          <h3>What This Demonstrates</h3>
          <ul>
            <li>Electron can launch a Node.js subprocess (VS Code Server)</li>
            <li>BrowserWindow can load the server via HTTP</li>
            <li>Chromium renders the interface consistently</li>
            <li>Process lifecycle is properly managed</li>
            <li>Security policies (CSP, context isolation) are in place</li>
          </ul>
        </div>

        <div class="info-box" style="margin-top: 16px;">
          <h3>Next Steps</h3>
          <ul>
            <li>Replace this mock server with real OpenVSCode Server</li>
            <li>Test with actual VS Code extensions</li>
            <li>Measure performance and bundle size</li>
            <li>Compare with Tauri WebKit rendering</li>
          </ul>
        </div>
      </div>
    </div>
  </div>

  <div class="statusbar">
    <span>Mock Server</span>
    <span>•</span>
    <span>Port: ${PORT}</span>
    <span>•</span>
    <span>Electron Integration POC</span>
  </div>

  <script>
    console.log('Mock VS Code Server loaded successfully');
    console.log('This demonstrates that Electron can embed and display web-based IDEs');
  </script>
</body>
</html>
`;

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  // Serve the mock HTML for all routes
  res.writeHead(200, {
    'Content-Type': 'text/html',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(mockHTML);
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('='.repeat(60));
  console.log('  Mock VS Code Server');
  console.log('='.repeat(60));
  console.log('');
  console.log(`  🚀 Server running at: http://${HOST}:${PORT}`);
  console.log('  📝 This is a mock server for testing Electron integration');
  console.log('');
  console.log('  To stop: Press Ctrl+C');
  console.log('');
  console.log('='.repeat(60));
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

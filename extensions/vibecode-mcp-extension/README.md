# VibeCode MCP Extension

A minimal Model Context Protocol (MCP) client extension for Visual Studio Code.

## Features

- Activates automatically when VS Code starts
- Logs activation and lifecycle events for debugging
- Creates a workspace marker file (`.mcp-activated`) for test detection
- Provides a ping command for testing extension functionality

## Usage

### Testing Extension Activation

The extension creates a `.mcp-activated` marker file in your workspace root when it activates. This file contains a timestamp and can be used for automated testing.

### Ping Command

Run the command `VibeCode MCP: Ping` from the command palette to verify the extension is active.

## Development

This extension is part of the VibeCode project and serves as a foundation for MCP integration with VS Code.

## License

MIT License

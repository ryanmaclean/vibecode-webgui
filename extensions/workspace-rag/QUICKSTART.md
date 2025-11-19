# Quick Start Guide

## Prerequisites Check

1. **PostgreSQL with pgvector**:
   ```bash
   # Check if PostgreSQL is running
   brew services list | grep postgresql
   
   # If not installed:
   brew install postgresql@15 pgvector
   brew services start postgresql@15
   
   # Create database
   createdb workspace_rag
   psql workspace_rag -c "CREATE EXTENSION vector;"
   ```

2. **Node.js** (should be installed):
   ```bash
   node --version  # Should be >= 18
   npm --version
   ```

## Installation Steps

1. **Install dependencies**:
   ```bash
   cd extensions/workspace-rag
   npm install
   ```

2. **Build the extension**:
   ```bash
   npm run build
   ```

3. **Verify build**:
   ```bash
   ls -la dist/extension.js  # Should exist
   ```

## VS Code Setup

1. **Open Extension Development Host**:
   - Press `F5` in VS Code
   - This opens a new "Extension Development Host" window

2. **Configure Settings** (in the new window):
   - Press `Cmd+,` (or `Ctrl+,`) to open Settings
   - Search for "Workspace RAG"
   - Configure database settings:
     - Host: `localhost`
     - Port: `5432`
     - User: `postgres` (or your user)
     - Password: Your PostgreSQL password
     - Database: `workspace_rag`

3. **Set OpenAI API Key**:
   - Press `Cmd+Shift+P` (or `Ctrl+Shift+P`)
   - Run: `Workspace RAG: Set OpenAI API Key`
   - Enter your OpenAI API key

## First Run

1. **Open a workspace** in the Extension Development Host window
   - File > Open Folder
   - Select any code project

2. **Index the workspace**:
   - Press `Cmd+Shift+P`
   - Run: `Workspace RAG: Index Workspace`
   - Wait for indexing to complete (progress notification)

3. **Open the chat**:
   - Look for "Workspace RAG Chat" in the Explorer sidebar
   - Click to open

4. **Ask a question**:
   - Try: "What is the main entry point of this project?"
   - Or: "How does authentication work?"
   - Or: "Show me the database configuration"

## Troubleshooting

### Build Errors
- Run `npm install` again
- Check Node.js version: `node --version`
- Clear and rebuild: `rm -rf node_modules dist && npm install && npm run build`

### Database Connection Issues
- Verify PostgreSQL is running: `brew services list`
- Test connection: `psql -h localhost -U postgres -d workspace_rag`
- Check settings match your PostgreSQL configuration

### MLX Not Working
- Verify Apple Silicon: `uname -m` (should show `arm64`)
- Extension will automatically fallback to OpenAI API
- Check `workspaceRag.useMLX` setting

### No Chat Panel
- Ensure a workspace folder is open
- Check Output panel for errors: View > Output > "Workspace RAG"
- Reload window: `Cmd+R` or `Ctrl+R`

## Next Steps After Setup

1. **Enable Tracing** (optional):
   - Settings > Workspace RAG > Tracing > Enable
   - Configure exporters (console/datadog/jaeger)

2. **Customize File Patterns**:
   - Adjust `includeGlob` and `excludeGlob` in settings
   - Default includes: `**/*.{js,ts,jsx,tsx,py,md,txt,json,go,java,rb,rs}`

3. **Tune Chunking**:
   - Adjust `chunkSize` (default: 1000 characters)
   - Smaller = more granular, larger = more context

4. **Test Different Queries**:
   - Architecture questions
   - Code explanation requests
   - Finding specific functionality

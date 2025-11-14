# Quick Start Guide

Get up and running with Workspace RAG in 5 minutes.

## Step 1: Install PostgreSQL with pgvector

### macOS
```bash
brew install postgresql@15 pgvector
brew services start postgresql@15
```

### Linux
```bash
sudo apt install postgresql postgresql-contrib postgresql-15-pgvector
sudo systemctl start postgresql
```

## Step 2: Create Database

```bash
# Connect to PostgreSQL
psql postgres

# In psql, run:
CREATE DATABASE rag_db;
\c rag_db
CREATE EXTENSION vector;
\q
```

## Step 3: Install Extension

```bash
cd extensions/workspace-rag
npm install
npm run compile
```

Then press `F5` in VS Code to launch.

## Step 4: Configure

In VS Code settings (`Ctrl+,`), search for "Workspace RAG" and set:

```json
{
  "workspaceRag.pgPassword": "your_postgres_password"
}
```

Other settings use sensible defaults.

## Step 5: Index Your Workspace

1. Open Command Palette (`Ctrl+Shift+P`)
2. Run: `RAG: Index Workspace for RAG`
3. Wait for completion (~1-10 minutes depending on project size)

## Step 6: Ask Questions

1. Open the "RAG Chat" panel in the Explorer sidebar
2. Type: "What is this project about?"
3. Get instant answers with source references

## Optional: Set OpenAI API Key

For better LLM-powered answers:

1. Command Palette → `RAG: Set OpenAI API Key`
2. Enter your key from https://platform.openai.com/api-keys

Without an API key, you'll still get relevant code snippets.

## Pro Tips

### Best Questions to Ask
- "How does authentication work?"
- "Where is the database configured?"
- "What APIs are exposed?"
- "Show me examples of X"

### Performance
- **Apple Silicon**: Embeddings run locally via MLX (fast & private)
- **Other platforms**: Falls back to OpenAI API automatically

### Incremental Indexing
- Only modified files are re-indexed
- Run index command anytime to update

### Troubleshooting
- Can't connect? Check PostgreSQL is running: `brew services list`
- Slow indexing? Exclude more directories in settings
- No results? Verify files match your include glob pattern

## What's Next?

- Try the quick action buttons in the chat
- Adjust chunk size for better results
- Enable tracing to monitor performance
- Share feedback and star the repo!

---

**Need help?** Check the full [README.md](./README.md) or open an issue.


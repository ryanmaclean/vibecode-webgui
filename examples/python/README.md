# VibeCode Python SDK Examples

Example scripts demonstrating the VibeCode Python client SDK.

## Setup

1. Install dependencies:

```bash
pip install -r requirements.txt
```

2. Set environment variables:

```bash
export VIBECODE_API_URL="http://localhost:3000/api"
export VIBECODE_TOKEN="your-jwt-token"
```

## Examples

### Basic Usage

Demonstrates workspace creation, listing, updating, and deletion:

```bash
python basic_usage.py
```

### AI Chat

Shows how to interact with AI models for code assistance:

```bash
python ai_chat.py
```

### Vector Search

Demonstrates semantic search and RAG (Retrieval-Augmented Generation):

```bash
python vector_search.py
```

### MFA Setup

Interactive example for setting up multi-factor authentication:

```bash
python mfa_setup.py
```

## Running All Examples

```bash
python basic_usage.py
python ai_chat.py
python vector_search.py
```

## Features Demonstrated

- Async/await patterns with context managers
- Error handling with custom exceptions
- Rate limit tracking
- CSRF token management
- Workspace CRUD operations
- AI chat with context
- Vector search for code discovery
- Multi-factor authentication setup

## Notes

- All examples use async context managers for proper resource cleanup
- Environment variables are used for configuration
- Error handling demonstrates best practices
- Examples include comprehensive comments and documentation

# VibeCode TypeScript SDK Examples

Example scripts demonstrating the VibeCode TypeScript/JavaScript client SDK.

## Setup

1. Install dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
```

2. Set environment variables:

```bash
export VIBECODE_API_URL="http://localhost:3000/api"
export VIBECODE_TOKEN="your-jwt-token"
```

Or create a `.env` file:

```
VIBECODE_API_URL=http://localhost:3000/api
VIBECODE_TOKEN=your-jwt-token
```

## Examples

### Basic Usage

Demonstrates workspace creation, listing, updating, and deletion:

```bash
npm run basic
# or
npx tsx basic-usage.ts
```

### AI Chat

Shows how to interact with AI models for code assistance:

```bash
npm run chat
# or
npx tsx ai-chat.ts
```

### Vector Search

Demonstrates semantic search and RAG (Retrieval-Augmented Generation):

```bash
npm run search
# or
npx tsx vector-search.ts
```

### MFA Setup

Interactive example for setting up multi-factor authentication:

```bash
npm run mfa
# or
npx tsx mfa-setup.ts
```

## Running All Examples

```bash
npm run all
```

## Features Demonstrated

- Client initialization and configuration
- Error handling with typed errors
- Rate limit tracking
- CSRF token management
- Workspace CRUD operations
- AI chat with context
- Vector search for code discovery
- Multi-factor authentication setup

## Notes

- All examples use TypeScript for type safety
- Environment variables are used for configuration
- Error handling demonstrates best practices
- Examples include comprehensive comments and JSDoc

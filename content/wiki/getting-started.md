---
title: Getting Started
slug: getting-started
---

# Getting Started with VibeCode

Welcome to VibeCode, a comprehensive AI-powered development platform featuring intelligent project generation, multi-model orchestration, cloud deployment automation, and GitHub integration.

## Prerequisites

- Node.js >=18.18.0 <25.0.0
- PostgreSQL 16+ with pgvector extension
- Redis 6+ (or Upstash account)
- Container runtime (choose one):
  - [Docker Desktop](https://www.docker.com/products/docker-desktop/)
  - [Orbstack](https://orbstack.dev/) (recommended alternative to Docker Desktop, lighter weight and faster)

### Important Notes

- **Azure PostgreSQL:** There's a specific limitation when deploying on Azure PostgreSQL Flexible Server. See [Azure PostgreSQL Deployment Guide](/docs/azure-postgresql-deployment.md) for details on the pgvector setup workaround.
- **Azure OpenAI for embeddings:** For setting up and using Azure OpenAI for embeddings, see our [Azure Embedding Service Setup Guide](/docs/azure-embedding-service-setup.md).

## Installation

### Option 1: Using Docker Desktop

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. Start Docker Desktop
3. Proceed with the setup below

### Option 2: Using Orbstack (Recommended)

1. Download and install [Orbstack](https://orbstack.dev/)
2. Start Orbstack (it will automatically start the Docker daemon)
3. Verify installation by running:
   ```bash
   docker --version
   docker-compose --version
   ```
4. (Optional) For better performance, configure Orbstack settings:
   - Open Orbstack settings
   - Go to Resources and allocate at least 4GB RAM and 2 CPU cores
   - Enable Kubernetes if needed (disabled by default)

### Project Setup

```bash
# Clone the repository
git clone <repository-url>
cd vibecode-webgui

# Install dependencies
npm install --legacy-peer-deps

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start services (optional)
docker-compose -f docker-compose.dev.yml up -d

# Initialize database
npm run db:deploy
npm run db:generate

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## Troubleshooting

### Orbstack Issues

1. **Docker commands not found after installation**
   - Make sure Orbstack is running in the background
   - Restart your terminal or run `source ~/.zshrc` (or `source ~/.bashrc` if using bash)
   - Verify the installation by running `orb version`

2. **Performance issues**
   - Open Orbstack settings and increase allocated resources (CPU/RAM)
   - Go to Settings > Resources and allocate at least 4GB RAM and 2 CPU cores
   - Disable Kubernetes if not needed (Settings > Kubernetes)

3. **Port conflicts**
   - Check for port conflicts with `lsof -i :<port>`
   - Update your `.env` file to use different ports if needed

4. **Volume mounting issues**
   - Make sure the project directory is in an allowed path (check Orbstack settings > File Sharing)
   - Try resetting file sharing permissions in Orbstack settings

5. **Networking issues**
   - Reset Orbstack networking: `orb reset-network`
   - Restart Orbstack if you encounter network-related errors

If you continue to experience issues, check the Orbstack logs at `~/Library/Logs/Orbstack/` or file an issue in our [GitHub repository](https://github.com/your-org/vibecode-webgui/issues).

## Next Steps

- [Features Overview](/wiki/features) - Learn about VibeCode's capabilities
- [API Reference](/wiki/api-reference) - Explore available endpoints
- [Development Scripts](/wiki/development-scripts) - Available npm commands
- [Project Structure](/wiki/project-structure) - Understanding the codebase

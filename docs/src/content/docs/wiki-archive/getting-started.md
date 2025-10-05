---
title: "Quick Start Guide"
description: "Get up and running with VibeCode in minutes"
sidebar:
  order: 1
---

# Quick Start Guide

Get up and running with VibeCode in minutes! This guide will help you set up your first workspace and generate your first AI-powered project.

## Prerequisites

Before you begin, ensure you have:

- **Node.js** ≥18.18.0 (recommend using Node 25.x for best performance)
- **PostgreSQL** 16+ with pgvector extension
- **Redis/Valkey** 6+ (self-hosted or community-managed)
- **Docker** and **Docker Compose** (optional, for containerized setup)

## Installation

### Option 1: Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/ryanmaclean/vibecode-webgui.git
   cd vibecode-webgui
   ```

2. **Install dependencies**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your configuration:
   ```bash
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/vibecode"
   
   # Redis
   REDIS_URL="redis://localhost:6379"
   
   # Authentication
   NEXTAUTH_SECRET="your-secret-key-here"
   NEXTAUTH_URL="http://localhost:3000"
   
   # AI Services
   OPENAI_API_KEY="your-openai-key"
   ANTHROPIC_API_KEY="your-anthropic-key"
   ```

4. **Initialize the database**
   ```bash
   npm run db:deploy
   npm run db:generate
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

   Visit [http://localhost:3000](http://localhost:3000) to see your VibeCode instance!

### Option 2: Docker Setup

1. **Clone and navigate to the repository**
   ```bash
   git clone https://github.com/ryanmaclean/vibecode-webgui.git
   cd vibecode-webgui
   ```

2. **Start with Docker Compose**
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

3. **Initialize the database**
   ```bash
   docker-compose exec app npm run db:deploy
   ```

## Your First AI Project

### 1. Access the Platform

Navigate to [http://localhost:3000](http://localhost:3000) and sign in with your preferred authentication method.

### 2. Create a New Project

1. Click **"Generate New Project"** on the dashboard
2. Describe your project in natural language:
   
   *Example prompts:*
   - "Create a React todo app with TypeScript and Tailwind CSS"
   - "Build a Next.js blog with Markdown support and dark mode"
   - "Generate a Python FastAPI backend with PostgreSQL"

3. Choose a template or let AI select the best one
4. Click **"Generate Project"**

### 3. Explore Your Generated Project

- **Code Editor**: Full VS Code experience in your browser
- **Terminal**: Integrated terminal for running commands
- **File Explorer**: Navigate and edit your project files
- **AI Assistant**: Get help and suggestions as you code

### 4. Deploy Your Project

Once you're happy with your project, deploy it with one click:

1. Go to the **Deploy** tab
2. Choose your deployment target (Vercel, Netlify, Railway, etc.)
3. Click **"Deploy Now"**

## Essential Features

### AI Code Generation
- **Natural Language**: Describe what you want to build
- **Context Aware**: AI understands your project structure
- **Multiple Models**: Choose between OpenAI, Claude, and others

### Real-time Collaboration
- **Live Editing**: See changes from team members in real-time
- **Conflict Resolution**: Automatic handling of simultaneous edits
- **Chat Integration**: Discuss changes without leaving the editor

### Integrated Development Environment
- **VS Code Experience**: Full-featured editor with extensions
- **Terminal Access**: Run any command or script
- **Git Integration**: Built-in version control

### Cloud Deployment
- **One-Click Deploy**: Deploy to major platforms instantly
- **Environment Management**: Separate dev, staging, and production
- **Monitoring**: Built-in observability and metrics

## Common Use Cases

### 1. Rapid Prototyping
Generate a working prototype in minutes:
- Describe your idea to the AI
- Get a functional application
- Iterate and refine quickly

### 2. Learning New Technologies
Explore frameworks and tools:
- Ask AI to create examples
- Learn from generated code
- Experiment safely

### 3. Team Collaboration
Work together effectively:
- Share workspaces with team members
- Real-time editing and discussion
- Version control and deployment

### 4. Enterprise Development
Build production applications:
- Use enterprise templates
- Implement security best practices
- Deploy with confidence

## Next Steps

Now that you have VibeCode running:

1. **[Explore AI Features](/ai-integration/)** - Learn about advanced AI capabilities
2. **[Read the Developer Guide](/development/)** - Understand the architecture and contribute
3. **[Check the API Reference](/api-reference/)** - Integrate with external services
4. **[Set up Monitoring](/monitoring/)** - Add observability to your deployment

## Troubleshooting

### Common Issues

**Database connection errors**
- Ensure PostgreSQL is running and accessible
- Verify DATABASE_URL is correct
- Check that the database exists

**Redis connection issues**
- Confirm Redis is running
- Verify REDIS_URL configuration
- Check firewall settings

**AI features not working**
- Verify API keys are set correctly
- Check API key permissions and quotas
- Review logs for specific error messages

### Getting Help

- **Documentation**: Search these docs for answers
- **GitHub Issues**: Report bugs and request features
- **Community**: Join discussions and get help from other users

## Next Steps

**🔧 Production Setup**
- **[Production Deployment Guide](./production-deployment-guide/)** - Deploy to production with enterprise features
- **[Azure OpenAI Monitoring](./azure-openai-monitoring/)** - Set up comprehensive monitoring for AI operations
- **[PostgreSQL + pgvector](./prisma-pgvector/)** - Configure vector database for AI features

**🚀 Advanced Features**
- **[Kubernetes Secrets Automation](./kubernetes-secrets-automation/)** - Enterprise-grade secret management
- **[Developer Guide](./developer-guide/)** - In-depth development workflows

---

**🎉 Congratulations!** You now have VibeCode up and running. Start building amazing projects with AI assistance!

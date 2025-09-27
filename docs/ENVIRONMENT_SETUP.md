# Environment Setup Guide

## Quick Start

The fastest way to set up your environment:

```bash
# 1. Run the interactive setup script
npm run setup:env

# 2. Install dependencies
npm install --legacy-peer-deps

# 3. Validate your environment
npm run env:validate

# 4. Start development
npm run dev
```

## Manual Setup

If you prefer to configure manually:

1. **Copy the example file:**
   ```bash
   cp .env.local.example .env.local
   ```

2. **Edit `.env.local` with your values**

## Required Environment Variables

### 🔐 Authentication (REQUIRED)
```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-min-32-chars
```

### 🗃️ Database (REQUIRED)
```env
DATABASE_URL=postgresql://username:password@localhost:5432/vibecode
VALKEY_URL=redis://localhost:6379
```

### 🤖 AI Services (REQUIRED)
```env
OPENROUTER_API_KEY=your-openrouter-api-key-here
```

### 📊 Monitoring (REQUIRED)
```env
DD_API_KEY=your-datadog-api-key-here
DD_SITE=datadoghq.com
```

## Environment Validation

Check your environment setup:

```bash
# Quick validation
npm run env:validate

# Detailed validation report  
npm run env:check

# Test database connections
curl http://localhost:3000/api/health/environment?connections=true
```

## Database Setup

### PostgreSQL with pgvector

1. **Install PostgreSQL with pgvector extension**
2. **Create database:**
   ```sql
   CREATE DATABASE vibecode;
   CREATE USER vibecode WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE vibecode TO vibecode;
   ```

3. **Set DATABASE_URL:**
   ```env
   DATABASE_URL=postgresql://vibecode:your_password@localhost:5432/vibecode
   ```

### Redis/Valkey Cache

We use Valkey (BSD-licensed Redis fork):

```bash
# Install Valkey
# Ubuntu/Debian:
sudo apt install valkey

# macOS:
brew install valkey

# Start Valkey
valkey-server

# Set VALKEY_URL
VALKEY_URL=redis://localhost:6379
```

### MongoDB (Optional)

For chat features:

```bash
# Install MongoDB
# Set connection string
MONGODB_URL=mongodb://localhost:27017/vibecode_chat
```

## AI Service Configuration

### OpenRouter (Recommended)

1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Get your API key
3. Set environment variable:
   ```env
   OPENROUTER_API_KEY=sk-or-v1-your-key-here
   ```

### Alternative AI Providers

```env
# OpenAI
OPENAI_API_KEY=sk-your-openai-key

# Anthropic
ANTHROPIC_API_KEY=sk-ant-your-key

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-azure-key
```

## Monitoring Setup

### Datadog

1. Sign up at [datadoghq.com](https://datadoghq.com)
2. Get API key from [API Keys page](https://app.datadoghq.com/organization-settings/api-keys)
3. Configure environment:
   ```env
   DD_API_KEY=your-datadog-api-key
   DD_SITE=datadoghq.com
   DD_ENV=development
   ```

## Development vs Production

### Development (.env.local)
```env
NODE_ENV=development
DD_API_KEY=dummy-key-for-local-dev  # OK for development
ENABLE_DEBUG_LOGGING=true
```

### Production
```env
NODE_ENV=production
DD_API_KEY=real-datadog-api-key     # Real key required
ENABLE_DEBUG_LOGGING=false
```

## Troubleshooting

### Common Issues

**Build fails with "Cannot find module"**
```bash
# Clean and reinstall
npm run clean
npm install --legacy-peer-deps
```

**Database connection fails**
```bash
# Check DATABASE_URL format
npm run env:check

# Test connection
npm run db:test
```

**Missing environment variables**
```bash
# Run validation
npm run env:validate

# Interactive setup
npm run setup:env
```

### Environment Health Check

Monitor your environment status:

```bash
# Basic health check
curl http://localhost:3000/api/health/environment

# Include connection tests
curl http://localhost:3000/api/health/environment?connections=true
```

### Getting Help

1. **Check validation output:** `npm run env:check`
2. **Review logs:** Check console output for detailed error messages  
3. **Documentation:** See `docs/wiki-archive/ENV_VARIABLES.md`
4. **Setup script:** Run `npm run setup:env` for guided configuration

## Security Notes

- Never commit secrets to version control
- Use different keys for development/staging/production
- Rotate keys regularly
- Use environment-specific `.env` files:
  - `.env.local` - Local development (ignored by git)
  - `.env.production` - Production secrets (ignored by git)
  - `.env.example` - Template (committed to git)

## Environment Validation

The application automatically validates environment variables on startup. Missing or invalid variables will:

- **Development:** Show warnings but continue
- **Production:** Exit with error code 1

Environment validation happens in:
- Application startup
- Build process (`npm run build`)
- Health check endpoint (`/api/health/environment`)
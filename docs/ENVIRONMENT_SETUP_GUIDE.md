# Environment Setup Guide

**Complete guide to configuring VibeCode environment variables for all deployment scenarios**

## Table of Contents

- [Quick Start (TL;DR)](#quick-start-tldr)
- [Required vs Optional Variables](#required-vs-optional-variables)
- [Step-by-Step Setup](#step-by-step-setup)
  - [1. PostgreSQL Database](#1-postgresql-database)
  - [2. Redis Cache](#2-redis-cache)
  - [3. NextAuth Authentication](#3-nextauth-authentication)
  - [4. AI Services](#4-ai-services)
  - [5. Monitoring (Optional)](#5-monitoring-optional)
- [Obtaining API Keys](#obtaining-api-keys)
- [Security Best Practices](#security-best-practices)
- [Environment-Specific Configuration](#environment-specific-configuration)
- [Troubleshooting](#troubleshooting)
- [Complete Variable Reference](#complete-variable-reference)

---

## Quick Start (TL;DR)

### New Developer Setup (5 Minutes)

```bash
# 1. Copy template
cp .env.example .env.local

# 2. Generate secrets
export NEXTAUTH_SECRET=$(openssl rand -base64 32)
export JWT_SECRET=$(openssl rand -base64 48)

# 3. Update .env.local with minimum required values
cat > .env.local <<EOF
NODE_ENV=development
DATABASE_URL=postgresql://vibecode:password@localhost:5432/vibecode
REDIS_URL=redis://localhost:6379
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
NEXTAUTH_URL=http://localhost:3000
JWT_SECRET=$JWT_SECRET
EOF

# 4. Start services (if using Docker Compose)
docker-compose up -d postgres redis

# 5. Install dependencies and run
npm install
npm run dev

# 6. Verify application health
curl http://localhost:3000/api/health
```

### Minimum Required Variables

```env
NODE_ENV=development                                           # Required
DATABASE_URL=postgresql://user:pass@localhost:5432/vibecode    # Required
REDIS_URL=redis://localhost:6379                              # Required
NEXTAUTH_SECRET=<generated-with-openssl-rand-base64-32>       # Required
NEXTAUTH_URL=http://localhost:3000                            # Required
JWT_SECRET=<generated-with-openssl-rand-base64-48>            # Required
```

---

## Required vs Optional Variables

### ✅ Required (Application Won't Start Without These)

| Variable | Purpose | How to Generate |
|----------|---------|----------------|
| `NODE_ENV` | Environment mode | `development`, `production`, or `test` |
| `DATABASE_URL` | PostgreSQL connection string | See [PostgreSQL Setup](#1-postgresql-database) |
| `REDIS_URL` | Redis connection string | See [Redis Setup](#2-redis-cache) |
| `NEXTAUTH_SECRET` | NextAuth session encryption | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Application base URL | `http://localhost:3000` (dev) |
| `JWT_SECRET` | WebSocket JWT encryption | `openssl rand -base64 48` |

### 🔶 Optional (Required for Specific Features)

| Variable | Feature Enabled | Default Behavior |
|----------|----------------|------------------|
| `OPENAI_API_KEY` | AI chat with OpenAI | Falls back to other providers |
| `ANTHROPIC_API_KEY` | AI chat with Claude | Falls back to other providers |
| `OPENROUTER_API_KEY` | Multi-provider AI routing | Falls back to other providers |
| `DD_API_KEY` | Datadog APM monitoring | Monitoring disabled |
| `GITHUB_ID` / `GITHUB_SECRET` | GitHub OAuth login | OAuth disabled |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth login | OAuth disabled |

### ⚪ Optional (Nice to Have)

| Variable | Purpose | Default |
|----------|---------|---------|
| `DD_TRACE_ENABLED` | Enable distributed tracing | `false` |
| `ENABLE_MONITORING` | Enable monitoring features | `false` |
| `OFFLINE_MODE_ENABLED` | Enable offline AI fallback | `false` |
| `LOG_LEVEL` | Logging verbosity | `info` |

---

## Step-by-Step Setup

### 1. PostgreSQL Database

#### Option A: Docker (Recommended for Development)

```bash
# Start PostgreSQL with Docker Compose
docker-compose up -d postgres

# Or use standalone Docker
docker run -d \
  --name vibecode-postgres \
  -e POSTGRES_USER=vibecode \
  -e POSTGRES_PASSWORD=secure_password_here \
  -e POSTGRES_DB=vibecode \
  -p 5432:5432 \
  postgres:16-alpine

# Verify connection
docker exec vibecode-postgres psql -U vibecode -c "SELECT version();"
```

**Add to .env.local:**
```env
DATABASE_URL=postgresql://vibecode:secure_password_here@localhost:5432/vibecode
POSTGRES_USER=vibecode
POSTGRES_PASSWORD=secure_password_here
POSTGRES_DB=vibecode
```

#### Option B: Local PostgreSQL Installation

**macOS (Homebrew):**
```bash
# Install PostgreSQL
brew install postgresql@16
brew services start postgresql@16

# Create database and user
createuser -s vibecode
createdb vibecode -O vibecode

# Set password
psql -c "ALTER USER vibecode WITH PASSWORD 'secure_password_here';"
```

**Ubuntu/Debian:**
```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Create user and database
sudo -u postgres psql <<EOF
CREATE USER vibecode WITH PASSWORD 'secure_password_here';
CREATE DATABASE vibecode OWNER vibecode;
GRANT ALL PRIVILEGES ON DATABASE vibecode TO vibecode;
EOF
```

**Windows:**
1. Download PostgreSQL installer from [postgresql.org/download](https://www.postgresql.org/download/)
2. Run installer and note the superuser password
3. Use pgAdmin or `psql` to create database:
```sql
CREATE USER vibecode WITH PASSWORD 'secure_password_here';
CREATE DATABASE vibecode OWNER vibecode;
```

**Add to .env.local:**
```env
DATABASE_URL=postgresql://vibecode:secure_password_here@localhost:5432/vibecode
```

#### Testing PostgreSQL Connection

```bash
# Test connection with psql
psql "$DATABASE_URL" -c "SELECT 1;"

# Or with Node.js
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error('❌ Connection failed:', err);
  else console.log('✅ Connected to PostgreSQL:', res.rows[0].now);
  pool.end();
});
"
```

---

### 2. Redis Cache

#### Option A: Docker (Recommended for Development)

```bash
# Start Redis with Docker Compose
docker-compose up -d redis

# Or use standalone Docker
docker run -d \
  --name vibecode-redis \
  -p 6379:6379 \
  redis:7-alpine \
  redis-server --appendonly yes

# Verify connection
docker exec vibecode-redis redis-cli ping
# Expected: PONG
```

**Add to .env.local:**
```env
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
```

#### Option B: Local Redis Installation

**macOS (Homebrew):**
```bash
# Install Redis
brew install redis
brew services start redis

# Test connection
redis-cli ping
# Expected: PONG
```

**Ubuntu/Debian:**
```bash
# Install Redis
sudo apt update
sudo apt install redis-server

# Start service
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Test connection
redis-cli ping
```

**Windows:**
1. Download Redis for Windows from [redis.io/download](https://redis.io/download)
2. Or use WSL2 with Linux installation
3. Or use Docker Desktop

**Add to .env.local:**
```env
REDIS_URL=redis://localhost:6379
```

#### Redis with Password (Production)

```bash
# Set Redis password
redis-cli CONFIG SET requirepass "your_secure_redis_password"

# Test authenticated connection
redis-cli -a "your_secure_redis_password" ping
```

**Update .env.local:**
```env
REDIS_URL=redis://:your_secure_redis_password@localhost:6379
REDIS_PASSWORD=your_secure_redis_password
```

#### Testing Redis Connection

```bash
# Test with redis-cli
redis-cli ping

# Or with Node.js
node -e "
const redis = require('redis');
const client = redis.createClient({ url: process.env.REDIS_URL });
client.on('error', (err) => console.error('❌ Redis error:', err));
client.connect().then(() => {
  console.log('✅ Connected to Redis');
  client.quit();
});
"
```

---

### 3. NextAuth Authentication

NextAuth handles user authentication and session management.

#### Step 1: Generate Secrets

```bash
# Generate NEXTAUTH_SECRET (minimum 32 characters)
openssl rand -base64 32

# Generate JWT_SECRET (for WebSocket authentication)
openssl rand -base64 48
```

#### Step 2: Configure Base Authentication

**Add to .env.local:**
```env
# Required for all authentication
NEXTAUTH_SECRET=<paste-generated-secret-here>
NEXTAUTH_URL=http://localhost:3000
JWT_SECRET=<paste-generated-jwt-secret-here>

# Development only: Enable test users (optional)
NODE_ENV=development
```

#### Step 3: (Optional) Setup OAuth Providers

**GitHub OAuth:**
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in:
   - Application name: `VibeCode Local`
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
4. Click "Register application"
5. Copy the Client ID and generate a Client Secret

**Add to .env.local:**
```env
GITHUB_ID=your_github_client_id_here
GITHUB_SECRET=your_github_client_secret_here
```

**Google OAuth:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Navigate to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "OAuth client ID"
5. Configure consent screen if prompted
6. Application type: "Web application"
7. Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
8. Copy Client ID and Client Secret

**Add to .env.local:**
```env
GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
```

#### Testing Authentication

```bash
# Start application
npm run dev

# Test authentication endpoints
curl http://localhost:3000/api/auth/providers
# Should return configured providers (credentials, github, google)

# Access sign-in page
open http://localhost:3000/api/auth/signin
```

---

### 4. AI Services

Configure one or more AI providers for AI chat features.

#### Option 1: OpenAI (Most Common)

1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create account
3. Navigate to "API keys"
4. Click "Create new secret key"
5. Copy the key (starts with `sk-`)

**Add to .env.local:**
```env
OPENAI_API_KEY=sk-your_openai_api_key_here
OPENAI_API_BASE=https://api.openai.com/v1
AI_PROVIDER=openai
AI_MODEL=gpt-4-turbo-preview
```

**Test connection:**
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  | jq '.data[0].id'
```

#### Option 2: Anthropic Claude

1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Sign in or create account
3. Navigate to "API Keys"
4. Create new key
5. Copy the key (starts with `sk-ant-`)

**Add to .env.local:**
```env
ANTHROPIC_API_KEY=sk-ant-your_anthropic_api_key_here
AI_PROVIDER=anthropic
AI_MODEL=claude-3-5-sonnet-20241022
```

#### Option 3: OpenRouter (Multi-Provider)

1. Visit [OpenRouter](https://openrouter.ai/)
2. Sign in with GitHub or Google
3. Navigate to "Keys" section
4. Create new key
5. Add credits to account

**Add to .env.local:**
```env
OPENROUTER_API_KEY=sk-or-v1-your_openrouter_key_here
OPENROUTER_API_BASE=https://openrouter.ai/api/v1
AI_PROVIDER=openrouter
AI_MODEL=anthropic/claude-3.5-sonnet
```

#### Option 4: Azure OpenAI

1. Create Azure OpenAI resource in Azure Portal
2. Deploy a model (e.g., gpt-4-turbo)
3. Get endpoint and API key from "Keys and Endpoint"

**Add to .env.local:**
```env
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your_azure_openai_api_key_here
AZURE_OPENAI_API_VERSION=2024-02-01
AZURE_OPENAI_DEPLOYMENT=gpt-4-turbo
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4-turbo
AI_PROVIDER=azure
```

#### Option 5: Offline Mode (Ollama)

For air-gapped or offline environments:

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a coding model
ollama pull qwen2.5-coder:1.5b

# Verify it's running
curl http://localhost:11434/api/tags
```

**Add to .env.local:**
```env
OFFLINE_MODE_ENABLED=true
OLLAMA_HOST=http://localhost:11434
OLLAMA_BASE_URL=http://localhost:11434
OFFLINE_PREFERRED_MODEL=qwen2.5-coder:1.5b
OFFLINE_AUTO_FALLBACK=true
```

---

### 5. Monitoring (Optional)

#### Datadog Setup

Datadog provides APM, logs, and infrastructure monitoring.

**Step 1: Get Datadog Credentials**

1. Sign up at [Datadog](https://www.datadoghq.com/)
2. Navigate to "Organization Settings" > "API Keys"
3. Create or copy existing API key
4. Navigate to "Organization Settings" > "Application Keys"
5. Create new application key

**Step 2: Configure Server-Side Monitoring**

**Add to .env.local (Development - use dummy keys):**
```env
# Datadog API Keys
DD_API_KEY=dummy-key-for-local-dev
DD_APP_KEY=dummy-app-key-for-local-dev
DD_SITE=datadoghq.com

# Service Identification
DD_SERVICE=vibecode-webgui
DD_ENV=development
DD_VERSION=1.0.0

# Enable monitoring features
DD_TRACE_ENABLED=false          # Disable in dev to reduce noise
DD_APM_ENABLED=true
DD_LOGS_ENABLED=true
DD_RUNTIME_METRICS_ENABLED=true

# Custom tags
DD_TAGS=project:vibecode,team:engineering,env:local
```

**Production configuration:**
```env
# Use real API keys in production
DD_API_KEY=<real-datadog-api-key>
DD_APP_KEY=<real-datadog-app-key>
DD_TRACE_ENABLED=true
DD_ENV=production
```

**Step 3: Configure Real User Monitoring (RUM)**

1. In Datadog, go to "UX Monitoring" > "RUM Applications"
2. Click "New Application"
3. Select "JS" as application type
4. Copy Application ID and Client Token

**Add to .env.local:**
```env
# RUM Configuration (client-side monitoring)
NEXT_PUBLIC_DD_APPLICATION_ID=your-rum-application-id
NEXT_PUBLIC_DD_CLIENT_TOKEN=pub_your-rum-client-token
NEXT_PUBLIC_DD_SITE=datadoghq.com
NEXT_PUBLIC_DD_ENV=development
NEXT_PUBLIC_DD_SERVICE=vibecode-webgui
```

**Testing Monitoring:**
```bash
# Start application with monitoring
npm run dev

# Generate some traffic
curl http://localhost:3000/api/health

# Check Datadog dashboard for traces/logs
# APM: https://app.datadoghq.com/apm/traces
# Logs: https://app.datadoghq.com/logs
```

---

## Obtaining API Keys

### Quick Reference Links

| Service | Purpose | Sign-up Link | Docs |
|---------|---------|--------------|------|
| **OpenAI** | AI chat/completions | [platform.openai.com/signup](https://platform.openai.com/signup) | [API Docs](https://platform.openai.com/docs) |
| **Anthropic** | Claude AI | [console.anthropic.com](https://console.anthropic.com/) | [API Docs](https://docs.anthropic.com/) |
| **OpenRouter** | Multi-provider AI | [openrouter.ai](https://openrouter.ai/) | [Docs](https://openrouter.ai/docs) |
| **GitHub OAuth** | Social login | [github.com/settings/developers](https://github.com/settings/developers) | [OAuth Docs](https://docs.github.com/en/developers/apps/building-oauth-apps) |
| **Google OAuth** | Social login | [console.cloud.google.com](https://console.cloud.google.com/) | [OAuth Docs](https://developers.google.com/identity/protocols/oauth2) |
| **Datadog** | Monitoring/APM | [datadoghq.com/free-trial](https://www.datadoghq.com/free-trial/) | [APM Docs](https://docs.datadoghq.com/tracing/) |
| **Azure OpenAI** | Enterprise AI | [portal.azure.com](https://portal.azure.com/) | [Azure OpenAI Docs](https://learn.microsoft.com/en-us/azure/ai-services/openai/) |
| **Supabase** | Managed PostgreSQL | [supabase.com](https://supabase.com/) | [Docs](https://supabase.com/docs) |

### Free Tier Availability

| Service | Free Tier | Limits |
|---------|-----------|--------|
| OpenAI | $5 credit (new users) | Time-limited |
| Anthropic | Limited free credits | Check current offering |
| OpenRouter | Free tier available | Rate limited |
| Datadog | 14-day free trial | Full features |
| GitHub OAuth | Free | Unlimited |
| Google OAuth | Free | Unlimited |
| Supabase | Free tier | 500MB database, 2GB bandwidth |

---

## Security Best Practices

### ⚠️ Critical Security Rules

1. **NEVER commit `.env.local` or `.env.production.local` to git**
2. **NEVER put real secrets in `.env.example`** (use placeholders only)
3. **NEVER share environment files via email/Slack**
4. **ALWAYS use strong, unique secrets for each environment**
5. **ALWAYS rotate secrets regularly** (every 90 days minimum)

### Generating Secure Secrets

```bash
# NextAuth Secret (32+ characters)
openssl rand -base64 32

# JWT Secret (48+ characters for WebSockets)
openssl rand -base64 48

# Database Password (16+ characters)
openssl rand -base64 16

# Session Secret (64+ characters)
openssl rand -base64 64

# Hex-encoded secret (for some services)
openssl rand -hex 32

# Generate multiple secrets at once
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)"
echo "JWT_SECRET=$(openssl rand -base64 48)"
echo "SESSION_SECRET=$(openssl rand -base64 64)"
```

### Secret Storage Best Practices

#### Development
```env
# .env.local - Use dummy/test values
DD_API_KEY=dummy-key-for-local-dev
OPENAI_API_KEY=sk-test-key-for-local-dev
ENABLE_MONITORING=false
```

#### Production
```bash
# Use secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)
# Never store in .env files

# Example: AWS Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id vibecode/production/database-url \
  --query SecretString \
  --output text

# Example: Kubernetes Secrets
kubectl create secret generic vibecode-secrets \
  --from-literal=database-url="postgresql://..." \
  --from-literal=nextauth-secret="..."
```

### Checking for Exposed Secrets

```bash
# Verify .env files are gitignored
git status --ignored | grep ".env"

# Check if any .env files are tracked
git ls-files | grep "\.env\."

# Scan git history for leaked secrets
git log --all --full-history --source -- .env.local

# Use git-secrets to prevent commits
git secrets --install
git secrets --register-aws
```

### Rotating Secrets

```bash
# 1. Generate new secret
NEW_SECRET=$(openssl rand -base64 32)

# 2. Update .env.local
sed -i.bak "s/NEXTAUTH_SECRET=.*/NEXTAUTH_SECRET=$NEW_SECRET/" .env.local

# 3. Update production secrets (use your secrets manager)

# 4. Restart application
npm run dev

# 5. Verify old secret is no longer valid
# Test authentication/features
```

### Environment File Permissions

```bash
# Restrict .env.local to owner read/write only
chmod 600 .env.local

# Verify permissions
ls -la .env.local
# Should show: -rw------- (600)

# Set for all environment files
find . -maxdepth 1 -name ".env*" -type f -exec chmod 600 {} \;
```

---

## Environment-Specific Configuration

### Local Development

**Goal:** Fast iteration, easy debugging, minimal cost

```env
# .env.local
NODE_ENV=development
DATABASE_URL=postgresql://vibecode:password@localhost:5432/vibecode
REDIS_URL=redis://localhost:6379

# Use dummy keys to avoid charges
DD_API_KEY=dummy-key-for-local-dev
OPENAI_API_KEY=sk-test-key-or-use-real-for-testing

# Disable expensive features
ENABLE_MONITORING=false
DD_TRACE_ENABLED=false
DD_PROFILING_ENABLED=false

# Enable debugging
DEBUG=true
LOG_LEVEL=debug
DD_LOG_LEVEL=DEBUG

# Use test OAuth credentials
GITHUB_ID=test-github-oauth-id
GITHUB_SECRET=test-github-oauth-secret
```

### Docker Development

**Goal:** Production parity, isolated services

```env
# .env.local (for use with docker-compose)
NODE_ENV=development

# Use Docker service names as hostnames
DATABASE_URL=postgresql://vibecode:password@postgres:5432/vibecode
REDIS_URL=redis://redis:6379

# NextAuth URL matches docker-compose setup
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate-with-openssl>

# Docker internal networking
COLLABORATION_SERVER_URL=http://vibecode-web:3000
```

**Start services:**
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Staging Environment

**Goal:** Production-like testing, real integrations

```env
# .env.production.local (on staging server)
NODE_ENV=production

# Use staging database (separate from production)
DATABASE_URL=postgresql://vibecode:SECURE_PASS@staging-db.internal:5432/vibecode
REDIS_URL=redis://:SECURE_PASS@staging-redis.internal:6379

# Real monitoring (tagged as staging)
DD_API_KEY=<real-datadog-key>
DD_ENV=staging
DD_TAGS=env:staging,team:engineering

# Real AI providers (with rate limits)
OPENAI_API_KEY=<real-openai-key>

# Staging-specific URL
NEXTAUTH_URL=https://staging.vibecode.dev
NEXTAUTH_SECRET=<unique-staging-secret>

# Enable monitoring
ENABLE_MONITORING=true
DD_TRACE_ENABLED=true
```

### Production Environment

**Goal:** Maximum security, performance, reliability

```env
# .env.production.local (managed by secrets manager)
NODE_ENV=production

# Use managed services
DATABASE_URL=<from-secrets-manager>
REDIS_URL=<from-secrets-manager>

# All monitoring enabled
DD_API_KEY=<from-secrets-manager>
DD_APP_KEY=<from-secrets-manager>
DD_ENV=production
DD_TRACE_ENABLED=true
DD_APM_ENABLED=true
DD_PROFILING_ENABLED=true
DD_DATABASE_MONITORING_ENABLED=true
DD_RUNTIME_METRICS_ENABLED=true

# Production AI keys (high limits)
OPENAI_API_KEY=<from-secrets-manager>
ANTHROPIC_API_KEY=<from-secrets-manager>

# Production domain
NEXTAUTH_URL=https://vibecode.com
NEXTAUTH_SECRET=<from-secrets-manager>

# Security hardening
FORCE_HTTPS=true
SECURE_COOKIES=true
HSTS_MAX_AGE=31536000
RATE_LIMIT_ENABLED=true

# Custom tags for production
DD_TAGS=env:production,team:engineering,version:1.0.0,criticality:high
```

**Load from secrets manager:**
```bash
# Example: Load from AWS Secrets Manager
export DATABASE_URL=$(aws secretsmanager get-secret-value --secret-id prod/database-url --query SecretString --output text)
export NEXTAUTH_SECRET=$(aws secretsmanager get-secret-value --secret-id prod/nextauth-secret --query SecretString --output text)

# Or use with Docker
docker run -d \
  -e DATABASE_URL=$(aws secretsmanager get-secret-value ...) \
  -e NEXTAUTH_SECRET=$(aws secretsmanager get-secret-value ...) \
  vibecode:latest
```

### Testing/CI Environment

**Goal:** Automated testing, reproducible builds

```env
# .env.test.local (for CI/CD)
NODE_ENV=test

# Ephemeral test database
DATABASE_URL=postgresql://vibecode:test@localhost:5432/vibecode_test
REDIS_URL=redis://localhost:6379/1

# Test-specific secrets (not real)
NEXTAUTH_SECRET=test-secret-32-chars-minimum-required
JWT_SECRET=test-jwt-secret-48-chars-minimum-required
NEXTAUTH_URL=http://localhost:3000

# Disable external services
ENABLE_REAL_AI_TESTS=false
ENABLE_REAL_INTEGRATION_TESTS=false
ENABLE_MONITORING=false

# Fast test execution
DD_TRACE_ENABLED=false
SKIP_DB_MIGRATIONS=false
```

---

## Troubleshooting

### Issue: Application Won't Start

**Symptom:** Application crashes immediately or fails to start

**Solution 1: Check for missing required variables**
```bash
# List all required variables
grep "REQUIRED" .env.example

# Check if they're set in your .env.local
node -e "
const required = ['NODE_ENV', 'DATABASE_URL', 'REDIS_URL', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL', 'JWT_SECRET'];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error('❌ Missing required variables:', missing);
  process.exit(1);
}
console.log('✅ All required variables present');
"
```

**Solution 2: Check .env.local syntax**
```bash
# Look for syntax errors (missing quotes, invalid characters)
grep -n "=" .env.local | head -20

# Check for invalid variable names (must start with letter/underscore)
grep -n "^[0-9]" .env.local
```

**Solution 3: Verify file is being loaded**
```bash
# Check if .env.local exists
ls -la .env.local

# Verify it's in the project root
pwd
# Should be in: /path/to/vibecode-webgui

# Check Next.js is loading it
npm run dev 2>&1 | grep -i "env"
```

### Issue: Database Connection Fails

**Symptom:** Error: "connect ECONNREFUSED" or "password authentication failed"

**Solution 1: Verify PostgreSQL is running**
```bash
# Check if PostgreSQL is running
# Docker:
docker ps | grep postgres

# macOS:
brew services list | grep postgresql

# Linux:
systemctl status postgresql

# Test direct connection
psql "$DATABASE_URL" -c "SELECT 1;"
```

**Solution 2: Check DATABASE_URL format**
```bash
# Correct format:
# postgresql://username:password@host:port/database

# Verify your DATABASE_URL
echo $DATABASE_URL

# Common mistakes:
# ❌ postgres://... (should be postgresql://)
# ❌ Missing password
# ❌ Wrong port (should be 5432)
# ❌ Wrong database name
```

**Solution 3: Check credentials**
```bash
# Test with psql
psql -h localhost -p 5432 -U vibecode -d vibecode
# Enter password when prompted

# If fails, reset password
psql -U postgres -c "ALTER USER vibecode WITH PASSWORD 'new_password';"

# Update .env.local with new password
```

### Issue: Redis Connection Fails

**Symptom:** Error: "connect ECONNREFUSED 127.0.0.1:6379"

**Solution 1: Verify Redis is running**
```bash
# Check if Redis is running
# Docker:
docker ps | grep redis

# macOS:
brew services list | grep redis

# Linux:
systemctl status redis

# Test connection
redis-cli ping
# Expected: PONG
```

**Solution 2: Check Redis URL format**
```bash
# Correct format:
# redis://[password@]host:port[/database]

# Examples:
# redis://localhost:6379              # No password
# redis://:mypassword@localhost:6379  # With password
# redis://localhost:6379/1            # Database 1

# Verify your REDIS_URL
echo $REDIS_URL
```

**Solution 3: Check for password requirements**
```bash
# Check if Redis requires password
redis-cli ping
# If error: "NOAUTH Authentication required"

# Connect with password
redis-cli -a "your_password" ping

# Update REDIS_URL
REDIS_URL=redis://:your_password@localhost:6379
```

### Issue: NextAuth Session Errors

**Symptom:** "NEXTAUTH_SECRET is not set" or session creation fails

**Solution 1: Verify NEXTAUTH_SECRET is set**
```bash
# Check if variable is set
node -e "console.log('NEXTAUTH_SECRET:', process.env.NEXTAUTH_SECRET ? '✅ Set' : '❌ Not set');"

# Verify length (must be at least 32 characters)
node -e "
const secret = process.env.NEXTAUTH_SECRET;
if (!secret) {
  console.error('❌ NEXTAUTH_SECRET not set');
} else if (secret.length < 32) {
  console.error('❌ NEXTAUTH_SECRET too short:', secret.length, 'chars (min: 32)');
} else {
  console.log('✅ NEXTAUTH_SECRET valid:', secret.length, 'chars');
}
"
```

**Solution 2: Generate new secret**
```bash
# Generate secure secret
NEW_SECRET=$(openssl rand -base64 32)
echo "NEXTAUTH_SECRET=$NEW_SECRET"

# Add to .env.local
echo "NEXTAUTH_SECRET=$NEW_SECRET" >> .env.local

# Restart application
npm run dev
```

**Solution 3: Check NEXTAUTH_URL matches**
```bash
# NEXTAUTH_URL must match actual application URL
# Development:
NEXTAUTH_URL=http://localhost:3000

# Production:
NEXTAUTH_URL=https://your-domain.com

# Verify it's correct
echo $NEXTAUTH_URL
curl $NEXTAUTH_URL/api/auth/providers
```

### Issue: AI Provider Authentication Fails

**Symptom:** 401 Unauthorized from AI provider

**Solution 1: Verify API key format**
```bash
# Check API key starts with correct prefix
echo $OPENAI_API_KEY | cut -c1-3
# Expected: sk-

echo $ANTHROPIC_API_KEY | cut -c1-7
# Expected: sk-ant-

echo $OPENROUTER_API_KEY | cut -c1-6
# Expected: sk-or-
```

**Solution 2: Test API key directly**
```bash
# OpenAI
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  | jq '.data[0].id'

# Anthropic
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'

# OpenRouter
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

**Solution 3: Check account status**
- Verify API key hasn't expired
- Check account has available credits/quota
- Ensure billing is set up (for paid tiers)
- Check for rate limiting

### Issue: Datadog Not Receiving Data

**Symptom:** No traces/metrics in Datadog dashboard

**Solution 1: Verify DD_API_KEY is set**
```bash
# Check API key is set (don't print full value!)
node -e "console.log('DD_API_KEY:', process.env.DD_API_KEY ? '✅ Set (' + process.env.DD_API_KEY.slice(0,8) + '...)' : '❌ Not set');"

# Verify site
echo $DD_SITE
# Expected: datadoghq.com (or datadoghq.eu, us3.datadoghq.com, etc.)
```

**Solution 2: Test Datadog API connection**
```bash
# Test API key validity
curl -X GET "https://api.${DD_SITE}/api/v1/validate" \
  -H "DD-API-KEY: ${DD_API_KEY}"
# Expected: {"valid": true}
```

**Solution 3: Enable trace logging**
```env
# Add to .env.local
DD_TRACE_DEBUG=true
DD_TRACE_STARTUP_LOGS=true
DD_LOG_LEVEL=DEBUG

# Restart and check logs
npm run dev 2>&1 | grep -i datadog
```

### Issue: Environment Variables Not Updating

**Symptom:** Changes to .env.local don't take effect

**Solution 1: Restart development server**
```bash
# Next.js caches env vars at startup
# Must restart to pick up changes

# Stop server (Ctrl+C)
# Start again
npm run dev
```

**Solution 2: Clear Next.js cache**
```bash
# Remove .next cache directory
rm -rf .next

# Restart server
npm run dev
```

**Solution 3: Check for NEXT_PUBLIC_ prefix**
```bash
# Client-side variables MUST start with NEXT_PUBLIC_
# Server-side variables must NOT have this prefix

# ✅ Client-side (exposed to browser):
NEXT_PUBLIC_APP_NAME=VibeCode
NEXT_PUBLIC_DD_CLIENT_TOKEN=pub_abc123

# ✅ Server-side (not exposed):
DATABASE_URL=postgresql://...
DD_API_KEY=abc123

# After adding NEXT_PUBLIC_, rebuild
npm run build
npm run dev
```

### Issue: Port Already in Use

**Symptom:** Error: "Port 3000 is already in use"

**Solution:**
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=3001 npm run dev
```

---

## Complete Variable Reference

For a complete reference of all available variables, see:
- [`.env.example`](../.env.example) - Comprehensive template with all variables
- [Configuration Quick Reference](./CONFIGURATION_QUICK_REFERENCE.md) - Quick reference guide
- [Configuration Migration Guide](./CONFIGURATION_MIGRATION.md) - Migration details

### By Category

| Category | Variables | Documentation |
|----------|-----------|---------------|
| **Core Application** | `NODE_ENV`, `PORT`, `ENVIRONMENT` | Above |
| **Authentication** | `NEXTAUTH_*`, `JWT_SECRET`, `GITHUB_*`, `GOOGLE_*` | [Step 3](#3-nextauth-authentication) |
| **Database** | `DATABASE_URL`, `POSTGRES_*` | [Step 1](#1-postgresql-database) |
| **Redis** | `REDIS_URL`, `REDIS_*` | [Step 2](#2-redis-cache) |
| **AI Services** | `OPENAI_*`, `ANTHROPIC_*`, `OPENROUTER_*`, `AZURE_*` | [Step 4](#4-ai-services) |
| **Monitoring** | `DD_*`, `NEXT_PUBLIC_DD_*`, `OTEL_*` | [Step 5](#5-monitoring-optional) |
| **Security** | `ALLOWED_ORIGINS`, `RATE_LIMIT_*`, `FORCE_HTTPS` | [Security Best Practices](#security-best-practices) |
| **Feature Flags** | `ENABLE_*`, `OFFLINE_MODE_ENABLED` | [.env.example](../.env.example) |

---

## Next Steps

After completing environment setup:

1. **Run Application**
   ```bash
   npm run dev
   ```

2. **Verify Health**
   ```bash
   curl http://localhost:3000/api/health
   ```

3. **Run Tests**
   ```bash
   npm run test
   ```

4. **Configure Production**
   - Review [Production Configuration](#production-environment)
   - Set up secrets manager
   - Enable monitoring

5. **Read Additional Docs**
   - [Configuration Quick Reference](./CONFIGURATION_QUICK_REFERENCE.md)
   - [Configuration Migration Guide](./CONFIGURATION_MIGRATION.md)
   - [Kubernetes Secrets Setup](../platforms/kubernetes/k8s/SECRETS-SETUP.md)

---

## Support

### Documentation
- [GitHub Discussions](https://github.com/vibecode/webgui/discussions)
- [Configuration Issue #447](https://github.com/vibecode/webgui/issues/447)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)

### Getting Help
- Check [Troubleshooting](#troubleshooting) section above
- Search existing [GitHub Issues](https://github.com/vibecode/webgui/issues)
- Join community Slack/Discord (if available)

---

**Last Updated:** 2025-10-01
**Version:** 1.0.0
**Maintained by:** VibeCode Engineering Team

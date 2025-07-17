# VibeCode Deployment Guide

This guide covers all deployment options for the VibeCode platform, from one-click cloud deployments to self-hosted Kubernetes clusters.

## 🚀 Quick Deployment Options

### Option 1: One-Click Cloud Deployment (Recommended)

**Fastest way to get started - No technical expertise required**

#### Deploy to Vercel (2-3 minutes)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyour-repo%2Fvibecode-webgui&env=OPENROUTER_API_KEY,NEXTAUTH_SECRET&envDescription=API%20keys%20required%20for%20AI%20chat%20functionality)

1. Click the deploy button above
2. Connect your GitHub account
3. Add environment variables (see below)
4. Deploy!

#### Deploy to Netlify (3-5 minutes)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/your-repo/vibecode-webgui)

#### Deploy to Railway (5-7 minutes)
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https%3A%2F%2Fgithub.com%2Fyour-repo%2Fvibecode-webgui)

### Option 2: Automated CLI Deployment

Use our deployment script for guided setup:

```bash
# Clone the repository
git clone https://github.com/your-repo/vibecode-webgui.git
cd vibecode-webgui

# Install dependencies
npm install

# Run deployment script
node scripts/deploy.js
```

The script will:
- Check prerequisites
- Help you choose a platform
- Set up environment variables
- Deploy automatically

## 📋 Environment Variables

### Required Variables

```bash
# AI Service Configuration
OPENROUTER_API_KEY=sk-or-your-api-key-here

# Authentication
NEXTAUTH_SECRET=your-secure-random-string-here
NEXTAUTH_URL=https://your-app-domain.com

# Database (optional - uses file storage if not provided)
DATABASE_URL=postgresql://user:password@host:5432/database

# Redis (optional - uses memory if not provided)
REDIS_URL=redis://host:6379
```

### Getting API Keys

#### OpenRouter API Key
1. Visit [OpenRouter](https://openrouter.ai/keys)
2. Sign up for an account
3. Create a new API key
4. Copy the key (starts with `sk-or-`)

#### NextAuth Secret
Generate a secure random string:
```bash
# Option 1: Use OpenSSL
openssl rand -base64 32

# Option 2: Use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 3: Online generator
# Visit: https://generate-secret.vercel.app/32
```

### Platform-Specific Setup

#### Vercel
1. Add environment variables in the Vercel dashboard
2. Redeploy if variables were added after initial deployment

#### Netlify
1. Go to Site Settings > Environment Variables
2. Add each variable individually
3. Redeploy the site

#### Railway
1. Variables are set during initial deployment
2. Update in Project Settings > Variables if needed

## 🐳 Docker Deployment

### Single Container (Simple)

```bash
# Build and run
docker build -f Dockerfile.production -t vibecode .
docker run -p 3000:3000 \
  -e OPENROUTER_API_KEY=your-key \
  -e NEXTAUTH_SECRET=your-secret \
  -e NEXTAUTH_URL=http://localhost:3000 \
  vibecode
```

### Full Stack with Docker Compose (Production)

```bash
# Create environment file
cp .env.example .env
# Edit .env with your values

# Start all services
docker-compose -f docker-compose.production.yml up -d

# With monitoring (optional)
docker-compose -f docker-compose.production.yml --profile monitoring up -d
```

Services included:
- VibeCode App (port 3000)
- PostgreSQL Database (port 5432)
- Redis Cache (port 6379)
- NGINX Reverse Proxy (ports 80/443)
- Code Server for VS Code (port 8080)
- Prometheus + Grafana (ports 9090/3001) - optional

## ☸️ Kubernetes Deployment

### Using Helm (Recommended)

```bash
# Add the repository
helm repo add vibecode ./helm

# Install with custom values
helm install vibecode vibecode/vibecode-platform \
  --set app.openrouter.apiKey=your-key \
  --set app.nextauth.secret=your-secret \
  --set app.nextauth.url=https://vibecode.example.com

# Or use a values file
helm install vibecode vibecode/vibecode-platform -f values.yaml
```

### KIND (Local Development)

```bash
# Set up KIND cluster
./scripts/kind-setup.sh setup

# Deploy to KIND
kubectl apply -k k8s/
```

## 🔧 Self-Hosted Server

### Prerequisites
- Ubuntu 20.04+ or similar Linux distribution
- Node.js 18+
- PostgreSQL 13+ (optional)
- Redis 6+ (optional)
- NGINX (for reverse proxy)

### Installation

```bash
# 1. Clone and build
git clone https://github.com/your-repo/vibecode-webgui.git
cd vibecode-webgui
npm install
npm run build

# 2. Set up environment
cp .env.example .env
# Edit .env with your configuration

# 3. Install PM2 for process management
npm install -g pm2

# 4. Start the application
pm2 start npm --name "vibecode" -- start
pm2 save
pm2 startup

# 5. Set up NGINX reverse proxy
sudo cp docker/nginx/nginx.conf /etc/nginx/sites-available/vibecode
sudo ln -s /etc/nginx/sites-available/vibecode /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🔍 Health Monitoring

All deployments include health check endpoints:

- **Health Check:** `GET /api/health`
- **Metrics:** Available in Docker/K8s deployments

Example health check response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 3600,
  "version": "1.0.0",
  "checks": {
    "memory": { "status": "healthy" },
    "database": { "status": "healthy" },
    "ai": { "status": "healthy" }
  }
}
```

## 🛠️ Troubleshooting

### Common Issues

#### "OpenRouter API key not configured"
- Ensure `OPENROUTER_API_KEY` is set correctly
- Check the key format (should start with `sk-or-`)
- Verify the key is active on OpenRouter dashboard

#### "NextAuth configuration error"
- Set `NEXTAUTH_SECRET` to a secure random string
- Update `NEXTAUTH_URL` to match your deployment URL
- For HTTPS deployments, ensure the URL uses `https://`

#### "Build failed" during deployment
- Check Node.js version (requires 18+)
- Ensure all dependencies are properly installed
- Review build logs for specific error messages

#### Database connection issues
- Verify `DATABASE_URL` format: `postgresql://user:pass@host:port/db`
- Ensure database server is accessible
- Check firewall rules and security groups

### Performance Optimization

#### For High Traffic
- Use PostgreSQL instead of file storage
- Enable Redis for caching
- Set up CDN for static assets
- Configure horizontal scaling (K8s/Railway)

#### For Large Files
- Configure file upload limits
- Use cloud storage (S3, etc.) for file uploads
- Enable compression in NGINX

## 📊 Monitoring and Analytics

### Built-in Monitoring
- Health check endpoint (`/api/health`)
- Performance metrics in production
- Error tracking and logging

### External Monitoring
- Datadog integration (configured)
- Prometheus metrics (Docker/K8s)
- Custom monitoring via webhooks

## 🔒 Security Considerations

### Production Checklist
- [ ] Use strong `NEXTAUTH_SECRET`
- [ ] Enable HTTPS/TLS
- [ ] Configure CORS properly
- [ ] Set up rate limiting
- [ ] Use environment variables for secrets
- [ ] Enable security headers
- [ ] Regular security updates
- [ ] Database connection encryption
- [ ] API key rotation schedule

### Firewall Rules
```bash
# Essential ports
80/tcp    # HTTP
443/tcp   # HTTPS
22/tcp    # SSH (limit to specific IPs)

# Optional (if exposing directly)
3000/tcp  # VibeCode app
5432/tcp  # PostgreSQL (limit to app servers)
6379/tcp  # Redis (limit to app servers)
```

## 📞 Support

- **Documentation:** [GitHub Wiki](https://github.com/your-repo/vibecode-webgui/wiki)
- **Issues:** [GitHub Issues](https://github.com/your-repo/vibecode-webgui/issues)
- **Discussions:** [GitHub Discussions](https://github.com/your-repo/vibecode-webgui/discussions)

---

**Need help?** Open an issue on GitHub or check our troubleshooting guide.

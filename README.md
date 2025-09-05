# vibecode-webgui

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-18.18.0 25.0.0-brightgreen.svg)
![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)
![React](https://img.shields.io/badge/React-19-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)

A comprehensive AI-powered development platform featuring intelligent project generation, multi-model orchestration, cloud deployment automation, and GitHub integration. Transform ideas into production-ready applications with 20+ templates, automated deployments, and enterprise-grade security.

## 🚀 Quick Start

### Prerequisites
- Node.js >=18.18.0 <25.0.0
- PostgreSQL 16+ with pgvector extension
- Redis 6+ (or Upstash account)
- Docker Desktop or [Orbstack](https://orbstack.dev/) (recommended)

### Installation

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

## 📚 Documentation

For comprehensive documentation, visit our **Wiki**:

- **[Getting Started Guide](/wiki/getting-started)** - Detailed installation and setup
- **[Features Overview](/wiki/features)** - AI capabilities and platform features
- **[API Reference](/wiki/api-reference)** - Complete REST API documentation
- **[Development Scripts](/wiki/development-scripts)** - Available npm commands
- **[Project Structure](/wiki/project-structure)** - Codebase organization

## 🎯 Key Features

- **AI-Powered Development** - 20+ templates, multi-model orchestration, intelligent project generation
- **Cloud-Native Platform** - One-click deployment, GitHub integration, Kubernetes native
- **Enterprise Security** - WCAG 2.1 AA compliance, security middleware, performance monitoring
- **Modern Stack** - Next.js 15, React 19, TypeScript, PostgreSQL + pgvector, Redis

## 🛠️ Available Scripts

### Development
```bash
npm run dev          # Start development server
npm run build        # Build production application
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript checking
```

### Testing
```bash
npm run test         # Run unit tests
npm run test:e2e     # Run end-to-end tests
npm run test:integration # Run integration tests
```

### Database
```bash
npm run db:deploy    # Deploy database migrations
npm run db:setup     # Setup database schemas
npm run db:check     # Check database connectivity
```

## 🔧 Environment Setup

Required environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `NEXTAUTH_SECRET` - Authentication secret
- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key

## 📖 Additional Resources

- **API Documentation**: [docs/API.md](docs/API.md) (auto-generated)
- **Developer Guide**: [docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md)
- **Health Checks**: `npm run monitoring:health`
- **Monitoring**: `http://localhost:3000/api/monitoring/performance`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make changes with tests: `npm run test && npm run test:e2e`
4. Check code quality: `npm run lint && npm run type-check`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Need Help?** 
- Check the [Wiki](/wiki/home) for comprehensive documentation
- Review [API Documentation](docs/API.md)
- Run health checks: `npm run monitoring:health`

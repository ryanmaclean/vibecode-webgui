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

This README is intentionally concise. See the wiki for full details:

- [Developer Guide](./content/wiki/developer-guide.md)
- [API Reference](./content/wiki/api-reference.md)
- [Development Scripts](./content/wiki/development-scripts.md)

## 🎯 Key Features

- **AI-Powered Development** - 20+ templates, multi-model orchestration, intelligent project generation
- **Cloud-Native Platform** - One-click deployment, GitHub integration, Kubernetes native
- **Enterprise Security** - WCAG 2.1 AA compliance, security middleware, performance monitoring
- **Modern Stack** - Next.js 15, React 19, TypeScript, PostgreSQL + pgvector, Redis

## 🛠️ Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run test         # Run test suite
npm run lint         # Code quality checks
```

See full list: [Development Scripts](./content/wiki/development-scripts.md)

## 🔧 Environment Setup (Summary)

Copy `.env.example` to `.env` and configure variables as needed. See wiki for full environment documentation.

## 📖 Additional Resources

See the wiki for all additional resources and references.

## 🚀 CI/CD

CI details are available in GitHub Actions and the wiki.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make changes with tests: `npm run test && npm run test:e2e`
4. Check code quality: `npm run lint && npm run type-check`
5. Submit a pull request

**Note**: Complete CI pipeline is now fully stable and production-ready with all tests passing.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Need Help?** 
- Check the [Wiki](./content/wiki/home.md) for comprehensive documentation
- Review [API Documentation](./content/wiki/api-reference.md)
- Run health checks: `npm run monitoring:health`

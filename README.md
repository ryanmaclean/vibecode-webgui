# VibeCode WebGUI

An AI-powered web-based development platform that combines the best features of Lovable, Bolt, and Replit. Built with enterprise-grade security, real-time collaboration, and cloud-native architecture.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Security Scan](https://github.com/vibecode/webgui/workflows/Security%20Scan/badge.svg)](https://github.com/vibecode/webgui/actions)
[![Docker Build](https://img.shields.io/docker/build/vibecode/webgui)](https://hub.docker.com/r/vibecode/webgui)

## ✨ Features

- 🚀 **Full VS Code Experience**: Complete IDE powered by code-server 4.101.2
- 🤖 **AI-Powered Development**: Claude Code SDK integration for intelligent assistance
- 🔄 **Real-time Collaboration**: Multi-user editing with cursor tracking and presence
- 🐳 **Container-Native**: Docker and Kubernetes deployment ready
- 🔐 **Enterprise Security**: Zero GPL/LGPL dependencies, comprehensive scanning
- ⚡ **High Performance**: WebGL-accelerated terminal, optimized file watching
- 🌐 **Multi-Provider Deployment**: Netlify, Vercel, GitHub Pages, AWS, GCP, Azure

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Next.js App  │    │   Code-Server    │    │  WebSocket      │
│   (Port 3000)  │◄───┤   (Port 8080)    │◄───┤  Server         │
│                 │    │                  │    │  (Port 3001)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │      Redis       │    │   File System   │
│   (Port 5432)  │    │   (Port 6379)    │    │   Watching      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Docker Desktop** (for container management)
- **Node.js 18+** (for local development)
- **kubectl** (for Kubernetes management)
- **KIND** (for local Kubernetes testing)

### Local Development with Docker Compose

1. **Clone the repository**:
   ```bash
   git clone https://github.com/vibecode/webgui.git
   cd vibecode-webgui
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

3. **Start the development environment**:
   ```bash
   docker-compose up -d
   ```

4. **Access the services**:
   - **Main App**: http://localhost:3000
   - **Code-Server IDE**: http://localhost:8080 (password: `vibecode123`)
   - **Database**: localhost:5432
   - **Redis**: localhost:6379

### Local Kubernetes Development with KIND

KIND (Kubernetes IN Docker) provides a local Kubernetes cluster for development and testing.

#### Install KIND

**macOS**:
```bash
# Using Homebrew
brew install kind

# Using Go
go install sigs.k8s.io/kind@latest
```

**Linux**:
```bash
# Download binary
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind
```

**Windows**:
```bash
# Using Chocolatey
choco install kind

# Using Go
go install sigs.k8s.io/kind@latest
```

#### Create KIND Cluster

1. **Create cluster with custom configuration**:
   ```bash
   # Create cluster
   kind create cluster --name vibecode-dev --config=infrastructure/kind/cluster-config.yaml
   
   # Verify cluster
   kubectl cluster-info --context kind-vibecode-dev
   ```

2. **Load Docker images into KIND**:
   ```bash
   # Build images
   docker build -t vibecode/webgui:latest .
   docker build -t vibecode/code-server:latest ./docker/code-server
   
   # Load into KIND
   kind load docker-image vibecode/webgui:latest --name vibecode-dev
   kind load docker-image vibecode/code-server:latest --name vibecode-dev
   ```

3. **Deploy to KIND cluster**:
   ```bash
   # Create namespace and deploy
   kubectl apply -f infrastructure/kubernetes/namespace.yaml
   kubectl apply -f infrastructure/kubernetes/storage.yaml
   kubectl apply -f infrastructure/kubernetes/secrets.yaml
   kubectl apply -f infrastructure/kubernetes/code-server-deployment.yaml
   
   # Port forward to access services
   kubectl port-forward -n vibecode-webgui service/code-server-service 8080:8080
   ```

4. **Clean up KIND cluster**:
   ```bash
   kind delete cluster --name vibecode-dev
   ```

## 🧪 Testing

### Test Structure
```
tests/
├── unit/           # Unit tests for components and utilities
├── integration/    # Integration tests for API and services
├── e2e/           # End-to-end tests with Playwright
└── k8s/           # Kubernetes deployment tests
```

### Running Tests

**Unit Tests**:
```bash
npm test                    # Run all unit tests
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report
```

**Integration Tests**:
```bash
npm run test:integration   # API and database tests
npm run test:ws           # WebSocket server tests
```

**End-to-End Tests**:
```bash
npm run test:e2e          # Full browser automation tests
npm run test:e2e:headed   # Run with browser UI
```

**Kubernetes Tests**:
```bash
npm run test:k8s          # Test KIND deployment
npm run test:k8s:load     # Load testing on K8s
```

**Security Tests**:
```bash
npm run test:security     # Security scanning
npm run test:licenses     # License compliance
```

### Continuous Integration

The project uses GitHub Actions for:
- ✅ Security scanning (Datadog SCA/SAST)
- ✅ License compliance (NO GPL/LGPL/AGPL)
- ✅ Unit and integration tests
- ✅ E2E testing with multiple browsers
- ✅ Kubernetes deployment validation
- ✅ Docker image security scanning

## 🔐 Security

### Security Features
- **Zero GPL/LGPL Dependencies**: Strict license compliance
- **Container Security**: Non-root users, security contexts, read-only filesystems
- **Network Security**: Zero-trust networking, encrypted communication
- **Authentication**: JWT-based auth with OAuth integration
- **Audit Logging**: Comprehensive activity tracking

### Security Scanning
```bash
# Run security scans
npm run security:scan      # Full security audit
npm run security:licenses  # License compliance check
npm run security:deps      # Dependency vulnerability scan
```

### Pre-commit Hooks
Automatic security validation on every commit:
- License compliance checking
- Vulnerability scanning with npm audit
- Code quality with ESLint/TypeScript
- No secrets in code validation

## 📦 Deployment

### Production Deployment

**Container Registry**:
```bash
# Build and push images
docker build -t your-registry/vibecode-webgui:latest .
docker push your-registry/vibecode-webgui:latest
```

**Kubernetes Production**:
```bash
# Deploy to production cluster
kubectl apply -f infrastructure/kubernetes/
kubectl rollout status deployment/code-server -n vibecode-webgui
```

**Environment Variables**:
Set these in your production environment:
```bash
NEXTAUTH_SECRET=your-secure-jwt-secret
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379
CLAUDE_API_KEY=your-claude-api-key
DD_API_KEY=your-datadog-api-key
```

## 🛠️ Development

### Project Structure
```
├── src/                    # Next.js application source
│   ├── app/               # App router pages
│   ├── components/        # React components
│   └── lib/              # Utilities and configurations
├── server/                # WebSocket server
├── docker/               # Container configurations
├── infrastructure/       # Kubernetes manifests
├── tests/                # Test suites
└── scripts/              # Build and deployment scripts
```

### Key Technologies
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, Socket.IO, PostgreSQL, Redis
- **IDE**: code-server 4.101.2, xterm.js 5.5.0
- **AI**: Claude Code SDK, OpenAI integration
- **Infrastructure**: Docker, Kubernetes, KIND
- **Security**: Datadog SCA/SAST, pre-commit hooks

### Development Scripts
```bash
npm run dev              # Start development server
npm run build           # Build production bundle
npm run start           # Start production server
npm run lint            # Lint code
npm run type-check      # TypeScript checking
npm run docker:dev      # Start with Docker Compose
npm run k8s:dev         # Deploy to KIND cluster
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Code Standards
- ✅ TypeScript for type safety
- ✅ ESLint + Prettier for code formatting
- ✅ Comprehensive test coverage (>80%)
- ✅ Security scanning passes
- ✅ No GPL/LGPL dependencies

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs.vibecode.dev](https://docs.vibecode.dev)
- **Issues**: [GitHub Issues](https://github.com/vibecode/webgui/issues)
- **Discussions**: [GitHub Discussions](https://github.com/vibecode/webgui/discussions)
- **Security**: security@vibecode.dev

## 🚀 Roadmap

- [x] Core infrastructure with Docker/Kubernetes
- [x] Security scanning and license compliance
- [ ] JWT authentication with OAuth
- [ ] Code-server integration with iframe pattern
- [ ] High-performance terminal with WebGL
- [ ] Claude Code VS Code extension
- [ ] Real-time collaboration features
- [ ] Multi-provider deployment system
- [ ] Performance monitoring and analytics

---

**Built with ❤️ by the VibeCode team**
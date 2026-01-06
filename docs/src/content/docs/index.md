---
title: "VibeCode Documentation"
description: "Complete documentation for the VibeCode AI-powered development platform"
template: splash
hero:
  title: VibeCode Platform
  tagline: AI-Powered Development Platform with Intelligent Workflows
  actions:
    - text: Quick Start Guide
      link: /getting-started/
      icon: rocket
      variant: primary
    - text: API Reference
      link: /api-reference/
      icon: document
    - text: View on GitHub
      link: https://github.com/ryanmaclean/vibecode-webgui
      icon: github
---

## What is VibeCode?

VibeCode is a comprehensive AI-powered development platform that transforms how developers build applications. It combines cutting-edge AI technology with cloud-native architecture to provide an unparalleled development experience.

### 🚀 Key Features

- **🤖 AI-Powered Code Generation** - Generate complete projects with natural language prompts
- **☁️ Cloud-Native Architecture** - Deploy anywhere with Docker and Kubernetes support
- **💻 Integrated Development Environment** - Full VS Code experience in your browser
- **🔧 Real-time Collaboration** - Work together with live editing and chat
- **📊 Advanced Monitoring** - Built-in observability with Datadog integration
- **🔒 Enterprise Security** - SAML SSO, MFA, and comprehensive audit logging

## Quick Navigation

<div class="grid cards">

- **🚀 [Getting Started](/getting-started/)**
  
  Set up your first VibeCode workspace and generate your first AI-powered project in minutes

- **📚 [API Reference](/api-reference/)**
  
  Complete API documentation with examples, authentication, and interactive testing

- **🤖 [AI Features](./genai-integration/)**
  
  Learn how to leverage AI features for code generation, analysis, and intelligent assistance

- **🛠️ [Development Guide](./developer-guide/)**
  
  Development guides, best practices, and detailed contribution guidelines

- **🚀 [Deployment](./production-deployment-guide/)**
  
  Deploy VibeCode to production with Docker, Kubernetes, and cloud providers

- **📊 [Monitoring](./monitoring/overview/)**
  
  Set up observability, metrics, and monitoring for your VibeCode deployment

</div>

## Platform Status

### Quality Metrics (January 2025)
- ✅ **3,630 tests passing** - 100% pass rate across 225 test suites
- ✅ **0 security vulnerabilities** - npm audit clean, all dependencies up-to-date
- ✅ **159 Datadog tests** - Full observability integration with real API calls
- ✅ **GitHub Actions CI/CD** - Automated testing and deployment
- ✅ **Pre-commit security** - Automated API key scanning and validation

### Observability & Monitoring
- **Python APM**: ddtrace instrumentation across 47 files
- **JavaScript Tracing**: dd-trace integration in all Node.js services
- **Bash Logging**: Custom Datadog logging library for shell scripts
- **Real-time Metrics**: Live monitoring with Datadog API integration
- **Distributed Tracing**: Full request tracing across microservices

## Platform Overview

### AI-Powered Development
- **Multi-Model Orchestration**: OpenAI, Anthropic, Google, Mistral with intelligent routing
- **Project Generation**: Create full applications from natural language descriptions
- **Code Analysis**: Get intelligent suggestions and automated code reviews
- **Smart Templates**: 20+ production-ready project templates

### Cloud-Native Platform
- **Container-First**: Full Docker containerization for development and production
- **Kubernetes Native**: Production-ready with comprehensive scaling and monitoring
- **Multi-Cloud**: Deploy on AWS, GCP, Azure, or any Kubernetes cluster
- **Auto-Scaling**: Dynamic resource allocation based on workload demands

### Enterprise Features
- **Authentication**: SAML SSO, OAuth, and multi-factor authentication
- **Security**: Role-based access control, audit logging, and compliance ready
- **Monitoring**: Real-time metrics, distributed tracing, and performance insights
- **Scalability**: Handle enterprise workloads with horizontal scaling

### Developer Experience
- **Browser-Based IDE**: Full VS Code functionality without local installation
- **Collaboration**: Real-time editing with conflict resolution
- **Version Control**: Integrated Git workflows and branch management
- **Terminal Access**: Full terminal access with AI-enhanced command assistance

## Architecture

VibeCode is built with modern, scalable technologies:

- **Frontend**: Next.js 15, React 19, TypeScript
- **Backend**: Node.js, Next.js API Routes, PostgreSQL
- **AI Integration**: OpenAI, Anthropic Claude, Google AI
- **Caching**: Redis/Valkey with intelligent invalidation
- **Monitoring**: OpenTelemetry, Datadog, custom metrics
- **Deployment**: Docker, Kubernetes, Helm charts

## Community and Support

- 🌟 **[GitHub Repository](https://github.com/ryanmaclean/vibecode-webgui)** - Source code and contributions
- 📖 **[Documentation](/)** - Comprehensive guides and references
- 🐛 **[Issue Tracker](https://github.com/ryanmaclean/vibecode-webgui/issues)** - Bug reports and feature requests
- 💬 **[Discussions](https://github.com/ryanmaclean/vibecode-webgui/discussions)** - Community discussion and Q&A

## Getting Help

Need assistance? Here are the best ways to get help:

1. **Check the Documentation** - Most questions are answered in our comprehensive docs
2. **Search Issues** - See if your question has been asked before
3. **Create an Issue** - Report bugs or request new features
4. **Join Discussions** - Ask questions and share ideas with the community

---

*Built with ❤️ using Astro + Starlight. Last updated: 8/25/2025*

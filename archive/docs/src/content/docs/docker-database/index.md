---
title: "Docker & OpenVSCode Setup"
description: "Complete guide for running OpenVSCode Server with PostgreSQL using Docker Compose with automatic secure password generation"
---

# Docker & OpenVSCode Server Setup

This section provides comprehensive documentation for setting up OpenVSCode Server with PostgreSQL using Docker Compose, featuring **automatic secure password generation**.

## 🎯 Quick Start

Get started in under 2 minutes with zero manual configuration:

```bash
docker-compose up -d
open http://localhost:3000
```

That's it! A secure random password is generated automatically and both services are configured to use it.

## 📚 Documentation

### Essential Guides

- **[Complete Setup Guide](/docker-database/openvscode-postgres-setup/)** - Start here for a complete overview
- **[Auto-Generated Passwords](/docker-database/auto-password-setup/)** ⭐ Recommended - Secure password automation
- **[Docker Compose Setup](/docker-database/docker-compose-setup/)** - Complete Docker Compose guide

### Technical Details

- **[Password Setup Complete](/docker-database/random-password-complete/)** - Implementation summary
- **[Database Connection Fix](/docker-database/db-connection-fixed/)** - Technical details of connection fix

## ✨ Key Features

### 🔐 Automatic Secure Passwords
- **256-bit cryptographic security** - Generated using OpenSSL
- **Zero manual configuration** - Auto-generated on first startup
- **Unique per installation** - Never the same password twice
- **Production ready** - Compatible with Docker Swarm & Kubernetes

### 🚀 Zero Configuration
- No manual password setup required
- Both services auto-configured
- Works out of the box
- Just run `docker-compose up -d`

### 🏗️ Production Ready
- Docker Compose orchestration
- Health checks for proper startup order
- Data persistence with Docker volumes
- Compatible with Docker Swarm secrets

## 🎨 What You Get

```
Services:
├─ PostgreSQL with pgvector (Auto-configured)
│  ├─ Random password from shared volume
│  ├─ Database: workspace_rag
│  └─ Initialized with vector extension
│
└─ OpenVSCode Server (Auto-configured)
   ├─ workspace-rag extension pre-installed
   ├─ Settings auto-generated with password
   └─ Ready to use at http://localhost:3000
```

## 📖 Learning Path

1. **New Users**: Start with [Complete Setup Guide](/docker-database/openvscode-postgres-setup/)
2. **Understanding Auto-Passwords**: Read [Auto-Generated Passwords](/docker-database/auto-password-setup/)
3. **Production Deployment**: See [Docker Compose Setup](/docker-database/docker-compose-setup/)
4. **Technical Deep Dive**: Review [Password Setup Complete](/docker-database/random-password-complete/)

## 🔧 Architecture

```
1. docker-compose up -d
   ↓
2. init-secrets (generates password)
   └─ openssl rand -base64 32 > /run/secrets/db_password
   ↓
3. postgres-pgvector (reads password)
   └─ POSTGRES_PASSWORD_FILE=/run/secrets/db_password
   ↓
4. openvscode-server (reads password)
   ├─ Entrypoint reads /run/secrets/db_password
   ├─ Creates settings.json with password
   └─ Starts IDE
   ↓
5. ✅ Both services using same secure password!
```

## 🎯 Use Cases

- **Development** - Quick local setup with secure defaults
- **Testing** - Reproducible environment with fresh passwords
- **Production** - Enterprise-ready with Docker Swarm/Kubernetes secrets
- **Education** - Learn Docker Compose with real-world example

## 🆘 Troubleshooting

Common issues and solutions are documented in each guide:

- Connection issues → [Database Connection Fix](/docker-database/db-connection-fixed/)
- Password problems → [Auto-Generated Passwords](/docker-database/auto-password-setup/)
- Docker issues → [Docker Compose Setup](/docker-database/docker-compose-setup/)

## 🔗 Related Documentation

- [Database & Storage](/database-consolidation-phase2/) - Database consolidation guide
- [PostgreSQL + pgvector](/prisma-pgvector/) - pgvector integration
- [Production Deployment](/production-deployment-guide/) - Production setup

---

**Ready to get started?** Head to the [Complete Setup Guide](/docker-database/openvscode-postgres-setup/) or jump straight to [Auto-Generated Passwords](/docker-database/auto-password-setup/) for the recommended approach.

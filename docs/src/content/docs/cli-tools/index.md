---
title: "CLI Tools Overview"
description: "Unified command-line interface for managing all aspects of the Vibecode platform"
sidebar:
  order: 1
---

# VibeCode CLI Tools

A unified, interactive command-line interface for managing all aspects of the Vibecode platform - from development and testing to deployment and monitoring.

## What is the VibeCode CLI?

The VibeCode CLI provides a centralized, menu-driven interface that consolidates hundreds of scripts and operations into an organized, discoverable system. Instead of remembering individual script names and locations, developers can navigate through intuitive menus to find and execute the operations they need.

## Key Features

### Unified Interface
- Single entry point for all platform operations
- Consistent UX across all categories
- Interactive menu navigation
- Context-aware help and documentation

### Comprehensive Coverage
- **Development & Testing** - Local setup, testing, code quality
- **Security & Compliance** - Vulnerability scanning, audits, monitoring
- **Database Operations** - Migrations, seeding, backup/restore
- **Deployment Automation** - Multi-platform, multi-environment deployment
- **VM Management** - Virtual machine lifecycle and configuration
- **Monitoring & Observability** - Metrics, logs, health checks, Datadog integration

### Developer-Friendly
- No need to memorize script names or locations
- Interactive prompts guide you through operations
- Confirmation for destructive operations
- Clear error messages and troubleshooting help

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/vibecode-webgui.git
cd vibecode-webgui

# Run the installer
bash scripts/vibecode-cli/install.sh
```

### First Run

```bash
# Launch the CLI
bash scripts/vibecode-cli.sh

# Or if installed globally
vibecode-cli
```

## Main Menu Categories

### 1. Development & Testing
Manage development workflows, testing, and code quality:
- Local development setup
- Test execution (unit, integration, e2e)
- Code quality checks (lint, format, type-check)
- Build and compilation

### 2. Security & Compliance
Security scanning, vulnerability assessment, and compliance:
- Dependency scanning
- Security audits
- Secret detection
- Compliance validation
- Continuous security monitoring

### 3. Database Operations
Database management and operations:
- Schema migrations
- Database seeding
- Backup and restore
- Performance tuning
- Connection testing

### 4. Deployment Automation
Deploy to various platforms and environments:
- Multi-environment deployment (dev, staging, prod)
- Platform-specific deployment (AKS, Fly.io, Docker)
- Blue/green deployments
- Rollback capabilities

### 5. VM Management
Manage virtual machines for development and testing:
- VM creation and destruction
- VM configuration
- Snapshot management
- Resource monitoring

### 6. Monitoring & Observability
Comprehensive monitoring and observability:
- Datadog setup (APM, DBM, CNM, LLM Observability)
- Performance baseline recording
- Log analysis
- Health checks
- Security monitoring

## Documentation

- [User Guide](/cli-tools/user-guide/) - Complete guide to using the CLI
- [Architecture](/cli-tools/architecture/) - Technical architecture and development guide

## Version Information

**Version:** 1.0.0
**Last Updated:** 2025-10-24
**License:** MIT

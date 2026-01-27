---
title: "VibeCode CLI User Guide"
description: "Complete guide to using the VibeCode unified command-line interface"
sidebar:
  order: 2
---

# Vibecode CLI User Guide

**Version:** 1.0.0
**Last Updated:** 2025-10-24

A unified, interactive command-line interface for managing all aspects of the Vibecode platform - from development and testing to deployment and monitoring.

## Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Menu Navigation](#menu-navigation)
- [Category Guide](#category-guide)
  - [Development & Testing](#1-development--testing)
  - [Security & Compliance](#2-security--compliance)
  - [Database Operations](#3-database-operations)
  - [Deployment Automation](#4-deployment-automation)
  - [VM Management](#5-vm-management)
  - [Monitoring & Observability](#6-monitoring--observability)
- [Script Mapping](#script-mapping)
- [Configuration](#configuration)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)
- [Advanced Usage](#advanced-usage)

## Quick Start

### Prerequisites

- **Node.js** >= 18.18
- **npm** or **yarn**
- **Docker** (optional, for container workflows)
- **Git**

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

## Installation

### Standard Installation

The installation script sets up your development environment with all necessary dependencies:

```bash
bash scripts/vibecode-cli/install.sh
```

**What it does:**
1. Checks for required tools (Node.js, npm, Docker)
2. Verifies Node.js version (>= 18.18)
3. Creates `.env.local` from example
4. Installs npm dependencies
5. Runs project setup
6. Executes health checks

### Installation Options

```bash
# Skip package installation (dependencies already installed)
bash scripts/vibecode-cli/install.sh --skip-install

# Skip project setup (environment already configured)
bash scripts/vibecode-cli/install.sh --skip-setup

# Show help
bash scripts/vibecode-cli/install.sh --help
```

### Global Installation (Optional)

For convenience, you can add the CLI to your PATH:

```bash
# Add to ~/.bashrc or ~/.zshrc
export PATH="$PATH:/path/to/vibecode-webgui/scripts"

# Create alias
alias vibecode-cli='/path/to/vibecode-webgui/scripts/vibecode-cli.sh'

# Reload shell
source ~/.bashrc  # or source ~/.zshrc
```

### Validation

Verify your installation:

```bash
# Run validation script
bash scripts/vibecode-cli/validate-config.sh

# Expected output:
# ✓ Configuration valid
# ✓ All required tools available
# ✓ Environment variables set
```

### Uninstallation

To remove the CLI and clean up:

```bash
bash scripts/vibecode-cli/uninstall.sh
```

## Menu Navigation

### Main Menu Structure

When you launch the CLI, you'll see:

```
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║                      VIBECODE CLI                              ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝

  Unified interface for Vibecode platform operations

  1) Development & Testing
  2) Security & Compliance
  3) Database Operations
  4) Deployment Automation
  5) VM Management
  6) Monitoring & Observability
  7) Help & Documentation
  0) Exit

Enter your choice:
```

### Navigation Tips

- **Numbers** - Select menu options by entering their number
- **0** - Return to previous menu or exit
- **Ctrl+C** - Emergency exit (may leave processes running)
- **Arrow Keys** - Not supported; use number selection
- **Enter** - Confirm selection

### Menu Breadcrumbs

Current location shown in menu header:

```
Main > Monitoring & Observability > Datadog Setup
```

## Category Guide

### 1. Development & Testing

**Purpose:** Manage development workflows, testing, and code quality.

#### Menu Options

```
DEVELOPMENT SETUP
  1) Setup Local Development Environment
  2) Start Development Server
  3) Stop Development Server
  4) Reset Development Environment

TESTING
  5) Run All Tests
  6) Run Unit Tests
  7) Run Integration Tests
  8) Run E2E Tests
  9) Test Coverage Report

CODE QUALITY
 10) Run Linter
 11) Format Code
 12) Type Check
 13) Run All Checks

BUILD
 14) Build Project
 15) Build for Production
 16) Clean Build Artifacts
```

#### Common Workflows

**Setup New Environment:**
```bash
# Select: 1) Development & Testing
# Then: 1) Setup Local Development Environment
# Automatically handles:
# - npm install
# - .env.local creation
# - database migrations
# - seed data
```

**Pre-commit Checks:**
```bash
# Select: 1) Development & Testing
# Then: 13) Run All Checks
# Runs:
# - ESLint
# - Prettier
# - TypeScript compiler
# - Tests
```

#### Key Scripts

| Script | Purpose |
|--------|---------|
| `setup-local-dev.sh` | Initialize development environment |
| `run-tests.sh` | Execute test suites |
| `lint-fix.sh` | Run and fix linting issues |
| `build-production.sh` | Production build |

### 2. Security & Compliance

**Purpose:** Security scanning, vulnerability assessment, and compliance validation.

#### Menu Options

```
VULNERABILITY SCANNING
  1) Scan Dependencies
  2) Audit npm Packages
  3) Check for Known Vulnerabilities
  4) Generate Security Report

SECRET DETECTION
  5) Scan for Exposed Secrets
  6) Validate Environment Variables
  7) Check Git History for Secrets

COMPLIANCE
  8) Run Security Audit
  9) Check Compliance Standards
 10) Generate Compliance Report

MONITORING
 11) Start Security Monitoring
 12) View Security Alerts
 13) Security Dashboard
```

#### Common Workflows

**Pre-deployment Security Check:**
```bash
# Select: 2) Security & Compliance
# Then: 1) Scan Dependencies
# Then: 5) Scan for Exposed Secrets
# Then: 8) Run Security Audit
```

**Continuous Monitoring:**
```bash
# Select: 2) Security & Compliance
# Then: 11) Start Security Monitoring
# Monitors:
# - Suspicious processes
# - Failed authentication attempts
# - Unusual network activity
# - Configuration changes
```

#### Key Scripts

| Script | Purpose |
|--------|---------|
| `security-monitoring.sh` | Continuous security monitoring |
| `scan-vulnerabilities.sh` | Dependency vulnerability scan |
| `detect-secrets.sh` | Secret detection in codebase |
| `compliance-audit.sh` | Compliance validation |

### 3. Database Operations

**Purpose:** Database management, migrations, and operations.

#### Menu Options

```
MIGRATIONS
  1) Run Migrations
  2) Rollback Migration
  3) Migration Status
  4) Create Migration

SEEDING
  5) Seed Database
  6) Reset and Seed
  7) Seed Test Data

BACKUP & RESTORE
  8) Backup Database
  9) Restore Database
 10) List Backups

MAINTENANCE
 11) Optimize Database
 12) Vacuum Database
 13) Analyze Performance
 14) Connection Test
```

#### Common Workflows

**Database Setup:**
```bash
# Select: 3) Database Operations
# Then: 1) Run Migrations
# Then: 5) Seed Database
```

**Backup Before Changes:**
```bash
# Select: 3) Database Operations
# Then: 8) Backup Database
# Creates timestamped backup in backups/
```

#### Key Scripts

| Script | Purpose |
|--------|---------|
| `migrate-database.sh` | Schema migrations |
| `seed-database.sh` | Data seeding |
| `backup-database.sh` | Database backup |
| `restore-database.sh` | Database restore |

### 4. Deployment Automation

**Purpose:** Deploy applications to various platforms and environments.

#### Menu Options

```
ENVIRONMENT DEPLOYMENT
  1) Deploy to Development
  2) Deploy to Staging
  3) Deploy to Production
  4) Deploy to Custom Environment

PLATFORM DEPLOYMENT
  5) Deploy to AKS (Azure)
  6) Deploy to Fly.io
  7) Deploy to Docker
  8) Deploy to Kubernetes

ADVANCED
  9) Blue/Green Deployment
 10) Canary Deployment
 11) Rollback Deployment
 12) Deployment Status

VALIDATION
 13) Validate Deployment
 14) Health Check
 15) Smoke Tests
```

#### Common Workflows

**Production Deployment:**
```bash
# Select: 4) Deployment Automation
# Then: 3) Deploy to Production
# Prompts for:
# - Version/tag to deploy
# - Confirmation
# - Deployment method
# Automatically:
# - Runs pre-deployment checks
# - Executes deployment
# - Runs health checks
# - Sends notifications
```

**Rollback:**
```bash
# Select: 4) Deployment Automation
# Then: 11) Rollback Deployment
# Lists recent deployments
# Prompts for version to rollback to
# Executes rollback with validation
```

#### Key Scripts

| Script | Purpose |
|--------|---------|
| `deploy-production.sh` | Production deployment |
| `deploy-aks.sh` | Azure Kubernetes Service deployment |
| `deploy-flyio.sh` | Fly.io deployment |
| `rollback-deployment.sh` | Deployment rollback |

### 5. VM Management

**Purpose:** Manage virtual machines for development and testing.

#### Menu Options

```
VM LIFECYCLE
  1) Create VM
  2) Start VM
  3) Stop VM
  4) Delete VM
  5) VM Status

CONFIGURATION
  6) Configure VM
  7) Update VM Settings
  8) Install Tools
  9) Setup Environment

SNAPSHOTS
 10) Create Snapshot
 11) Restore Snapshot
 12) List Snapshots
 13) Delete Snapshot

MONITORING
 14) VM Resource Usage
 15) VM Logs
 16) Connect to VM
```

#### Common Workflows

**Create Development VM:**
```bash
# Select: 5) VM Management
# Then: 1) Create VM
# Prompts for:
# - VM name
# - Resources (CPU, RAM, Disk)
# - Base image
# Creates and configures VM
```

**Snapshot Before Changes:**
```bash
# Select: 5) VM Management
# Then: 10) Create Snapshot
# Creates snapshot with timestamp
# Allows easy rollback if needed
```

#### Key Scripts

| Script | Purpose |
|--------|---------|
| `create-vm.sh` | VM creation |
| `configure-vm.sh` | VM configuration |
| `snapshot-vm.sh` | Snapshot management |
| `monitor-vm.sh` | Resource monitoring |

### 6. Monitoring & Observability

**Purpose:** Comprehensive monitoring, metrics, logs, and observability.

#### Menu Options

```
DATADOG SETUP
  1) Deploy Datadog Monitoring Stack
  2) Setup Azure OpenAI Monitoring
  3) Setup AKS Datadog Monitoring
  4) Setup PostgreSQL Datadog Monitoring
  5) Check Datadog DBM Metrics
  6) Verify Datadog Metrics

PERFORMANCE BASELINES
  7) Record Performance Baseline
  8) View Performance Baselines
  9) Compare Performance Baselines
 10) Continuous Performance Monitor

LOG ANALYSIS
 11) View Application Logs
 12) Search Logs
 13) Tail Live Logs
 14) Test Datadog Logging

METRICS DASHBOARD
 15) View System Metrics
 16) View Application Metrics
 17) Setup Production Monitoring
 18) Validate Monitoring Setup

HEALTH CHECKS
 19) Check System Health
 20) Check Services Health
 21) Validate Health Endpoints
 22) Test K8s Health Probes
 23) Validate PostgreSQL Monitoring

SECURITY MONITORING
 24) Start Security Monitoring
 25) Monitor with Error Tracking

SPECIALIZED MONITORING
 26) Setup AgentAPI Monitoring
 27) Apply AI Gateway Monitoring
 28) Deploy Local Dev with Monitoring
```

#### Common Workflows

**Initial Monitoring Setup:**
```bash
# Select: 6) Monitoring & Observability
# Then: 1) Deploy Datadog Monitoring Stack
# Prompts for:
# - Deployment method (Docker Compose / Kubernetes)
# - Datadog API key
# - Environment name
# Deploys:
# - Datadog agent
# - APM (Application Performance Monitoring)
# - Log collection
# - Metrics collection
```

**Performance Baseline:**
```bash
# Before making changes:
# Select: 6) Monitoring & Observability
# Then: 7) Record Performance Baseline
# Enter baseline name: "pre-optimization"

# After making changes:
# Then: 7) Record Performance Baseline
# Enter baseline name: "post-optimization"

# Compare:
# Then: 9) Compare Performance Baselines
# Select both baselines to compare
```

**Log Investigation:**
```bash
# Select: 6) Monitoring & Observability
# Then: 12) Search Logs
# Enter search pattern: "error.*authentication"
# Searches all log files for pattern
```

**Health Check:**
```bash
# Select: 6) Monitoring & Observability
# Then: 19) Check System Health
# Shows:
# - Disk usage
# - Docker status
# - Application status
# - Memory usage
# - CPU usage
```

#### Datadog Integration

##### APM (Application Performance Monitoring)

Monitors application performance and traces requests:

```bash
# Setup APM
# Select: 6) Monitoring & Observability
# Then: 1) Deploy Datadog Monitoring Stack

# Verify APM is working
# Then: 6) Verify Datadog Metrics
```

**What APM monitors:**
- Request latency and throughput
- Service dependencies
- Error rates
- Database queries
- External API calls
- Custom spans and traces

##### DBM (Database Monitoring)

Monitors PostgreSQL performance:

```bash
# Setup DBM
# Select: 6) Monitoring & Observability
# Then: 4) Setup PostgreSQL Datadog Monitoring

# Check metrics
# Then: 5) Check Datadog DBM Metrics
```

**What DBM monitors:**
- Query performance
- Connection pool usage
- Slow queries
- Lock contention
- Index usage
- Table statistics

##### CNM (Cloud Network Monitoring)

Monitors network traffic and connections:

```bash
# Included in main monitoring stack
# Select: 6) Monitoring & Observability
# Then: 1) Deploy Datadog Monitoring Stack
```

**What CNM monitors:**
- Network throughput
- Connection states
- DNS queries
- TCP/UDP traffic
- Service connectivity

##### LLM Observability

Monitors AI/LLM operations:

```bash
# Setup LLM monitoring
# Select: 6) Monitoring & Observability
# Then: 2) Setup Azure OpenAI Monitoring
```

**What it monitors:**
- Token usage
- Model latency
- Request/response sizes
- Error rates
- Cost tracking

#### Performance Baselines

Track and compare system performance over time:

**Recording Baselines:**

```bash
# Record current state
# Select: 6) Monitoring & Observability
# Then: 7) Record Performance Baseline
# Enter name: "baseline-2025-10-24"

# Captures:
# - CPU usage
# - Memory usage
# - Disk usage
# - Network stats
# - Application metrics
```

**Comparing Baselines:**

```bash
# Select: 6) Monitoring & Observability
# Then: 9) Compare Performance Baselines
# Enter first baseline: baseline-2025-10-24
# Enter second baseline: baseline-2025-10-25

# Shows side-by-side comparison:
# CPU: 45% → 38% (↓ 7%)
# Memory: 2.1GB → 1.8GB (↓ 14%)
# Response Time: 120ms → 95ms (↓ 21%)
```

#### Log Analysis

**View Logs:**

```bash
# Select: 6) Monitoring & Observability
# Then: 11) View Application Logs
# Lists available log files
# Select file to view
```

**Search Logs:**

```bash
# Select: 6) Monitoring & Observability
# Then: 12) Search Logs
# Enter pattern: "ERROR.*database"
# Searches all logs for pattern
# Results shown with context
```

**Tail Logs:**

```bash
# Select: 6) Monitoring & Observability
# Then: 13) Tail Live Logs
# Select log file to tail
# Shows real-time log updates
# Press Ctrl+C to stop
```

#### Health Checks

**System Health:**

```bash
# Select: 6) Monitoring & Observability
# Then: 19) Check System Health

# Output:
# ✓ Disk usage OK: 45%
# ✓ Docker is healthy
# ✓ Application is running
# ⚠ Memory usage high: 85%
```

**Services Health:**

```bash
# Select: 6) Monitoring & Observability
# Then: 20) Check Services Health

# Checks:
# - Database connectivity
# - Redis connectivity
# - External API health
# - Service endpoints
```

**Health Endpoints:**

```bash
# Select: 6) Monitoring & Observability
# Then: 21) Validate Health Endpoints

# Tests all /health endpoints:
# ✓ GET /api/health → 200 OK
# ✓ GET /api/health/db → 200 OK
# ✓ GET /api/health/cache → 200 OK
```

#### Security Monitoring

**Continuous Monitoring:**

```bash
# Select: 6) Monitoring & Observability
# Then: 24) Start Security Monitoring

# Monitors every 5 minutes:
# - Suspicious processes
# - Failed authentication attempts
# - Unusual network activity
# - Disk usage spikes
# - Malicious file uploads
# - Configuration tampering
# - Vulnerability scans (hourly)

# Sends alerts via webhook if configured
```

**Alert Levels:**
- **HIGH** - Immediate action required
- **MEDIUM** - Investigate soon
- **LOW** - Informational

#### Key Scripts

| Script | Purpose | Category |
|--------|---------|----------|
| `deploy-monitoring.sh` | Deploy monitoring stack | Datadog Setup |
| `setup-azure-openai-monitoring.sh` | Azure OpenAI monitoring | Datadog Setup |
| `setup-aks-datadog-monitoring.sh` | AKS monitoring | Datadog Setup |
| `setup-postgres-datadog-monitoring.sh` | PostgreSQL monitoring | Datadog Setup |
| `check-datadog-dbmon-metrics.sh` | Check DBM metrics | Datadog Setup |
| `verify-datadog-metrics.js` | Verify metrics | Datadog Setup |
| `continuous-performance-monitor.sh` | Performance monitoring | Performance |
| `test_datadog_logging.py` | Test logging | Logs |
| `test-health-endpoints.sh` | Test health checks | Health |
| `validate-healthchecks.sh` | Validate endpoints | Health |
| `test-k8s-health-probes.sh` | K8s health probes | Health |
| `validate-postgres-monitoring.sh` | Validate PostgreSQL | Health |
| `security-monitoring.sh` | Security monitoring | Security |
| `monitor-with-error-tracking.sh` | Error tracking | Specialized |
| `setup-agentapi-monitoring.ts` | AgentAPI monitoring | Specialized |
| `apply-ai-gateway-monitoring.ts` | AI Gateway monitoring | Specialized |
| `setup-local-dev-with-monitoring.sh` | Local dev monitoring | Specialized |

## Script Mapping

Complete mapping from standalone scripts to menu options:

### Monitoring Scripts

| Original Script | Menu Path | Description |
|----------------|-----------|-------------|
| `deploy-monitoring.sh` | Monitoring > 1 | Deploy Datadog monitoring stack |
| `setup-azure-openai-monitoring.sh` | Monitoring > 2 | Setup Azure OpenAI monitoring |
| `setup-aks-datadog-monitoring.sh` | Monitoring > 3 | Setup AKS Datadog monitoring |
| `setup-postgres-datadog-monitoring.sh` | Monitoring > 4 | Setup PostgreSQL monitoring |
| `check-datadog-dbmon-metrics.sh` | Monitoring > 5 | Check Datadog DBM metrics |
| `verify-datadog-metrics.js` | Monitoring > 6 | Verify Datadog metrics |
| `continuous-performance-monitor.sh` | Monitoring > 10 | Continuous performance monitoring |
| `test_datadog_logging.py` | Monitoring > 14 | Test Datadog logging |
| `validate-monitoring.js` | Monitoring > 18 | Validate monitoring setup |
| `test-monitoring.sh` | Monitoring > 18 | Test monitoring integration |
| `test-health-endpoints.sh` | Monitoring > 20 | Check services health |
| `validate-healthchecks.sh` | Monitoring > 21 | Validate health endpoints |
| `test-k8s-health-probes.sh` | Monitoring > 22 | Test K8s health probes |
| `validate-postgres-monitoring.sh` | Monitoring > 23 | Validate PostgreSQL monitoring |
| `security-monitoring.sh` | Monitoring > 24 | Start security monitoring |
| `monitor-with-error-tracking.sh` | Monitoring > 25 | Monitor with error tracking |
| `setup-agentapi-monitoring.ts` | Monitoring > 26 | Setup AgentAPI monitoring |
| `apply-ai-gateway-monitoring.ts` | Monitoring > 27 | Apply AI Gateway monitoring |
| `setup-local-dev-with-monitoring.sh` | Monitoring > 28 | Deploy local dev with monitoring |

### Security Scripts

| Original Script | Menu Path | Description |
|----------------|-----------|-------------|
| `security-monitoring.sh` | Security > 11 | Start security monitoring |
| `scan-vulnerabilities.sh` | Security > 1 | Scan dependencies |
| `audit-security.sh` | Security > 8 | Security audit |

### Database Scripts

| Original Script | Menu Path | Description |
|----------------|-----------|-------------|
| `migrate-database.sh` | Database > 1 | Run migrations |
| `seed-database.sh` | Database > 5 | Seed database |
| `backup-database.sh` | Database > 8 | Backup database |
| `restore-database.sh` | Database > 9 | Restore database |

### Deployment Scripts

| Original Script | Menu Path | Description |
|----------------|-----------|-------------|
| `deploy-production.sh` | Deploy > 3 | Deploy to production |
| `deploy-aks.sh` | Deploy > 5 | Deploy to AKS |
| `deploy-flyio.sh` | Deploy > 6 | Deploy to Fly.io |
| `rollback-deployment.sh` | Deploy > 11 | Rollback deployment |

## Configuration

### Environment Variables

#### Required Variables

```bash
# Database
DATABASE_URL="postgresql://user:pass@host:5432/db"

# Datadog (at least one API key required for monitoring)
DD_API_KEY="your_datadog_api_key"
# or
DATADOG_API_KEY="your_datadog_api_key"

# Application
NODE_ENV="development"
```

#### Optional Variables

```bash
# Datadog Configuration
DD_SERVICE="vibecode-webgui"
DD_ENV="production"
DD_VERSION="1.0.0"
DD_SITE="datadoghq.com"
DD_LLMOBS_ENABLED="true"

# Azure Configuration
AZURE_CLIENT_ID="..."
AZURE_CLIENT_SECRET="..."
AZURE_TENANT_ID="..."
AZURE_SUBSCRIPTION_ID="..."

# Deployment Configuration
ENVIRONMENT="production"
DEPLOY_METHOD="kubernetes"
NAMESPACE="vibecode"

# Security Monitoring
SECURITY_MONITORING_INTERVAL="300"
SECURITY_ALERT_WEBHOOK="https://..."
MAX_LOG_SIZE="104857600"
```

### Configuration Files

#### `.env.local`

Primary environment configuration:

```bash
# Created automatically by install script
# Copy from env.development.example

DATABASE_URL=postgresql://...
DD_API_KEY=...
NEXT_PUBLIC_API_URL=...
```

#### `vibecode-cli.config.sh`

CLI-specific configuration:

```bash
# Optional: Create for custom CLI settings

# Default deployment method
export DEFAULT_DEPLOY_METHOD="kubernetes"

# Default monitoring interval
export DEFAULT_MONITOR_INTERVAL=60

# Custom scripts directory
export CUSTOM_SCRIPTS_DIR="/path/to/custom/scripts"
```

## Examples

### Example 1: Complete Monitoring Setup

```bash
# 1. Install CLI
bash scripts/vibecode-cli/install.sh

# 2. Configure environment
cp env.development.example .env.local
# Edit .env.local and add DD_API_KEY

# 3. Launch CLI
bash scripts/vibecode-cli.sh

# 4. Deploy monitoring stack
# Select: 6) Monitoring & Observability
# Select: 1) Deploy Datadog Monitoring Stack
# Select: 1) Docker Compose
# Enter API key (from .env.local)

# 5. Setup PostgreSQL monitoring
# Select: 4) Setup PostgreSQL Datadog Monitoring

# 6. Validate setup
# Select: 18) Validate Monitoring Setup

# 7. Record baseline
# Select: 7) Record Performance Baseline
# Enter name: "initial-setup"
```

### Example 2: Security Audit Workflow

```bash
# Launch CLI
bash scripts/vibecode-cli.sh

# Navigate to Security menu
# Select: 2) Security & Compliance

# Run dependency scan
# Select: 1) Scan Dependencies

# Check for secrets
# Select: 5) Scan for Exposed Secrets

# Run full audit
# Select: 8) Run Security Audit

# Start continuous monitoring
# Select: 11) Start Security Monitoring
# (Press Ctrl+C to stop when done)
```

### Example 3: Database Operations

```bash
# Launch CLI
bash scripts/vibecode-cli.sh

# Navigate to Database menu
# Select: 3) Database Operations

# Backup current database
# Select: 8) Backup Database
# Backup saved to: backups/db-2025-10-24-143022.sql

# Run migrations
# Select: 1) Run Migrations

# Seed with test data
# Select: 7) Seed Test Data
```

### Example 4: Production Deployment

```bash
# Launch CLI
bash scripts/vibecode-cli.sh

# Navigate to Deployment menu
# Select: 4) Deployment Automation

# Validate before deploy
# Select: 13) Validate Deployment

# Deploy to production
# Select: 3) Deploy to Production
# Confirm: yes
# Enter version: v1.2.3

# Health check after deploy
# Select: 14) Health Check
```

### Example 5: Log Investigation

```bash
# Launch CLI
bash scripts/vibecode-cli.sh

# Navigate to Monitoring menu
# Select: 6) Monitoring & Observability

# Search for errors
# Select: 12) Search Logs
# Pattern: "ERROR.*timeout"
# Directory: logs/

# Tail live logs for monitoring
# Select: 13) Tail Live Logs
# Select: logs/error.log
# (Watch for new errors)
```

## Troubleshooting

### Common Issues

#### Issue: "Command not found: vibecode-cli"

**Solution:**
```bash
# Use full path
bash /path/to/vibecode-webgui/scripts/vibecode-cli.sh

# Or add to PATH
export PATH="$PATH:/path/to/vibecode-webgui/scripts"
```

#### Issue: "Script not found" when selecting menu option

**Solution:**
```bash
# Verify script exists
ls -la scripts/deploy-monitoring.sh

# Check execute permissions
chmod +x scripts/*.sh

# Verify PROJECT_ROOT is set correctly
echo $PROJECT_ROOT
```

#### Issue: "DD_API_KEY is required"

**Solution:**
```bash
# Add to .env.local
echo "DD_API_KEY=your_api_key_here" >> .env.local

# Or export in shell
export DD_API_KEY="your_api_key_here"

# Or pass as parameter
bash scripts/deploy-monitoring.sh -d "your_api_key_here"
```

#### Issue: Colors not displaying properly

**Solution:**
```bash
# Disable colors
export NO_COLOR=1

# Use a terminal with color support
# macOS: iTerm2, Terminal.app
# Linux: gnome-terminal, konsole
# Windows: Windows Terminal, WSL
```

#### Issue: "Permission denied" when running scripts

**Solution:**
```bash
# Add execute permissions
chmod +x scripts/vibecode-cli.sh
chmod +x scripts/vibecode-cli-lib/*.sh

# Or run with bash explicitly
bash scripts/vibecode-cli.sh
```

#### Issue: Database connection failures

**Solution:**
```bash
# Check DATABASE_URL
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Verify PostgreSQL is running
docker ps | grep postgres
# or
pg_isready
```

#### Issue: Docker not accessible

**Solution:**
```bash
# Start Docker Desktop (macOS/Windows)
open -a Docker

# Or start Docker daemon (Linux)
sudo systemctl start docker

# Check Docker status
docker info

# Add user to docker group (Linux)
sudo usermod -aG docker $USER
# Then log out and back in
```

### Debug Mode

Enable debug output:

```bash
# Run with debug flag
DEBUG=1 bash scripts/vibecode-cli.sh

# Or set in environment
export DEBUG=1
bash scripts/vibecode-cli.sh

# See all commands being executed
set -x
bash scripts/vibecode-cli.sh
```

### Logs

CLI logs are stored in:

```bash
# View CLI logs
tail -f .vibecode-cli/logs/cli.log

# View script logs
tail -f .vibecode-cli/logs/scripts.log

# View error logs
tail -f .vibecode-cli/logs/error.log
```

### Getting Help

```bash
# In-CLI help
# Select: 7) Help & Documentation

# Script help
bash scripts/deploy-monitoring.sh --help
bash scripts/vibecode-cli/install.sh --help

# Read documentation
cat scripts/VIBECODE_CLI.md
cat scripts/vibecode-cli-lib/README.md
```

## Advanced Usage

### Direct Script Execution

You can bypass the menu and run scripts directly:

```bash
# Deploy monitoring
bash scripts/deploy-monitoring.sh -d "$DD_API_KEY"

# Run tests
bash scripts/run-tests.sh --coverage

# Database migration
bash scripts/migrate-database.sh
```

### Environment-Specific Configuration

Use different configurations for different environments:

```bash
# Development
ENV=development bash scripts/vibecode-cli.sh

# Staging
ENV=staging bash scripts/deploy-production.sh

# Production
ENV=production bash scripts/deploy-production.sh
```

### Automation and CI/CD

Use the CLI in automated workflows:

```bash
#!/bin/bash
# deploy.sh - Automated deployment script

set -e

# Run security checks
bash scripts/vibecode-cli.sh << EOF
2
1
8
0
0
EOF

# Deploy
bash scripts/vibecode-cli.sh << EOF
4
3
yes
$VERSION
0
EOF

# Verify
bash scripts/vibecode-cli.sh << EOF
6
19
20
0
EOF
```

### Custom Scripts

Add custom scripts to the CLI:

```bash
# 1. Create custom script
cat > scripts/custom-deploy.sh << 'EOF'
#!/bin/bash
echo "Running custom deployment..."
# Your custom logic here
EOF

# 2. Make executable
chmod +x scripts/custom-deploy.sh

# 3. Add to menu (edit scripts/vibecode-cli-lib/deploy-menu.sh)
# Add option and case statement

# 4. Test
bash scripts/vibecode-cli.sh
```

### Parallel Execution

Run multiple operations in parallel:

```bash
# Run in background
bash scripts/deploy-monitoring.sh &
bash scripts/setup-postgres-monitoring.sh &
bash scripts/validate-monitoring.sh &

# Wait for all to complete
wait

echo "All monitoring setup complete"
```

### Remote Execution

Execute CLI commands on remote servers:

```bash
# SSH to remote server
ssh user@server 'bash -s' < scripts/deploy-monitoring.sh

# Or with parameters
ssh user@server "cd /app && DD_API_KEY=$DD_API_KEY bash scripts/deploy-monitoring.sh"
```

## Best Practices

### 1. Always Validate Before Deploy

```bash
# Run validation checks before any deployment
# Monitoring > Validate Monitoring Setup
# Deployment > Validate Deployment
```

### 2. Create Backups

```bash
# Before major changes:
# Database > Backup Database
# VM > Create Snapshot
```

### 3. Use Performance Baselines

```bash
# Record baseline before and after changes
# Monitoring > Record Performance Baseline
# Make changes
# Monitoring > Record Performance Baseline
# Monitoring > Compare Performance Baselines
```

### 4. Monitor Security Continuously

```bash
# Start security monitoring in production
# Security > Start Security Monitoring
# Configure webhook alerts
```

### 5. Review Logs Regularly

```bash
# Set up log review routine
# Monitoring > View Application Logs
# Monitoring > Search Logs
```

## Support and Resources

### Documentation

- **This Guide:** `scripts/VIBECODE_CLI.md`
- **Library Docs:** `scripts/vibecode-cli-lib/README.md`
- **Main README:** `README.md`
- **API Docs:** `docs/`

### Help Commands

```bash
# CLI help
bash scripts/vibecode-cli.sh --help

# Script help
bash scripts/[script-name].sh --help

# In-menu help
# Select: 7) Help & Documentation
```

### Common Commands Reference

```bash
# Installation
bash scripts/vibecode-cli/install.sh

# Validation
bash scripts/vibecode-cli/validate-config.sh

# Launch CLI
bash scripts/vibecode-cli.sh

# Direct script execution
bash scripts/[script-name].sh [options]

# Debug mode
DEBUG=1 bash scripts/vibecode-cli.sh

# Uninstall
bash scripts/vibecode-cli/uninstall.sh
```

---

**Version:** 1.0.0
**Last Updated:** 2025-10-24
**Maintainer:** Vibecode Platform Team
**License:** MIT

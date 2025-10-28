# VibeCode Documentation Consolidation Plan

**Status**: ✅ Astro Setup Complete | 🔄 Content Migration In Progress

## Problem Analysis

- **2,153 total markdown files** (2,098 in node_modules, 55 project files)
- **32 root-level docs** scattered across directories
- **Inconsistent monitoring information** across documentation
- **No centralized documentation site**

## Solution: Astro + Starlight Documentation Site

### ✅ Completed Setup

1. **Astro Configuration** (`docs/astro.config.mjs`)
   - Starlight integration for documentation
   - GitHub Pages deployment configuration
   - Custom sidebar navigation structure

2. **GitHub Actions Workflow** (`.github/workflows/deploy-docs.yml`)
   - Automatic deployment to GitHub Pages
   - Build on push to main branch
   - Node.js 22 with npm caching

3. **Documentation Structure** (`docs/src/content/docs/`)
   ```
   docs/
   ├── src/content/docs/
   │   ├── index.mdx (landing page)
   │   ├── guides/ (getting started, tutorials)
   │   ├── architecture/ (system design)
   │   ├── monitoring/ (observability stack)
   │   ├── deployment/ (local, azure, production)
   │   └── development/ (contributing, API)
   ├── astro.config.mjs
   ├── package.json
   └── src/styles/custom.css
   ```

## Documentation Site Structure

### Landing Page (`/`)
- Hero section with key features
- Card grid showcasing capabilities
- Quick links to major sections
- Architecture overview with monitoring stack details

### Navigation Sections

1. **Getting Started**
   - Introduction
   - Quick Start ✅
   - Installation

2. **Architecture**
   - System Overview
   - AI Integration
   - Kubernetes Stack

3. **Monitoring & Observability** ✅
   - Overview (hybrid stack explanation)
   - Datadog Setup
   - Prometheus Stack
   - Vector Pipeline
   - OpenTelemetry

4. **Deployment**
   - Local Development
   - Azure Deployment
   - Production Setup

5. **Development**
   - Contributing
   - Testing
   - API Reference

## Content Migration Strategy

### Phase 1: High-Priority Pages ✅
- [x] Landing page with monitoring stack overview
- [x] Monitoring overview with hybrid architecture
- [x] Quick start guide
- [x] Custom styling and branding

### Phase 2: Core Documentation (In Progress)
- [ ] Migrate `README.md` content to structured guides
- [ ] Convert `docs/database-monitoring.md` to monitoring section
- [ ] Migrate `docs/DEPLOYMENT.md` to deployment guides
- [ ] Update `TODO.md` content to development section

### Phase 3: Specialized Documentation
- [ ] Infrastructure guides from `infrastructure/` folders
- [ ] Extension documentation from `extensions/`
- [ ] Service-specific docs from `services/`

### Phase 4: Cleanup
- [ ] Remove redundant markdown files
- [ ] Update main README.md to point to docs site
- [ ] Archive outdated documentation

## File Consolidation Map

### Root Directory Files (32 files)
```
Current Location → New Location
├── README.md → Multiple guide pages
├── TODO.md → development/roadmap.md
├── DEPLOYMENT.md → deployment/ section
├── PRODUCTION_STATUS_REPORT.md → development/status.md
├── ENHANCED_AI_FEATURES.md → architecture/ai-integration.md
└── ...
```

### Docs Directory (7 files)
```
docs/ → docs/src/content/docs/
├── database-monitoring.md → monitoring/database.md
├── DEPLOYMENT.md → deployment/production.md
├── NEW_FEATURES.md → guides/features.md
└── ...
```

### Infrastructure Docs (3 files)
```
infrastructure/ → deployment/
├── terraform/azure/README.md → deployment/azure.md
├── arm/README.md → deployment/arm-templates.md
└── ...
```

## Monitoring Information Standardization

### Current State Issues
- Different API key references across files
- Inconsistent license information
- Outdated Grafana references (now removed)
- Missing Vector documentation

### ✅ Standardized Monitoring Stack Documentation

**Primary Stack**: Datadog + Prometheus + Vector Hybrid
- Datadog Agent + Cluster Agent (commercial license)
- Prometheus (Apache 2.0 license)
- Vector (MPL-2.0 license)

**Alternatives**: OpenTelemetry Collector (Apache 2.0), Grafana (AGPL v3)

**Security**: Kubehound attack path analysis

## Deployment Instructions

### Local Development
```bash
cd docs
npm install
npm run dev
# Visit http://localhost:4321
```

### GitHub Pages Deployment
1. Push to main branch
2. GitHub Actions builds and deploys automatically
3. Site available at: https://vibecode.github.io/vibecode-webgui

## Benefits of New Structure

1. **Centralized Documentation**: Single source of truth
2. **Professional Appearance**: Modern, searchable interface
3. **Consistent Information**: Standardized monitoring stack details
4. **SEO Optimized**: Better discoverability
5. **Mobile Responsive**: Works on all devices
6. **Fast Performance**: Static site generation
7. **Version Control**: Documentation changes tracked with code

## Next Steps

1. Complete content migration (Phase 2-3)
2. Enable GitHub Pages on repository
3. Update main README.md with link to docs site
4. Clean up redundant files
5. Monitor and maintain content consistency
# VibeCode Architecture Documentation

> **📌 Canonical Architecture Guide**: This is the official and authoritative source for VibeCode's technology stack decisions, architectural patterns, and platform choices. Always refer to this document when making technology decisions or understanding the project's technical foundation.

This document provides comprehensive architectural guidance for VibeCode Studio, including canonical platform choices, technology stack decisions, and the rationale behind key architectural decisions.

## Table of Contents

- [Technology Stack Overview](#technology-stack-overview)
- [Canonical Frontend: Next.js](#canonical-frontend-nextjs)
- [Canonical Desktop Runtime: Tauri](#canonical-desktop-runtime-tauri)
- [Web-Dashboard Status](#web-dashboard-status)
- [Infrastructure Stack](#infrastructure-stack)
- [Development Environment](#development-environment)
- [Architecture Decision Records](#architecture-decision-records)

---

## Technology Stack Overview

VibeCode Studio is built on a modern, carefully-selected technology stack designed for performance, maintainability, and developer experience.

### Core Technology Stack

| Layer | Technology | Version | Status |
|-------|-----------|---------|--------|
| **Frontend Framework** | Next.js | 16.1.6 | ✅ Canonical |
| **UI Library** | React | 19.2.4 | ✅ Canonical |
| **Desktop Runtime** | Tauri | 2.10.0 | ✅ Canonical |
| **Language** | TypeScript | Latest | ✅ Primary |
| **Code Editor** | Monaco Editor | 0.53.0 | ✅ Canonical |
| **Package Manager** | npm | Latest | ✅ Canonical |
| **Backend Language** | Rust (Tauri) | 1.75+ | ✅ Canonical |

### Deprecated Technologies

| Technology | Status | Migration Path |
|-----------|--------|----------------|
| **Electron** | ❌ Deprecated | Migrate to Tauri (see below) |
| **web-dashboard** | ❌ Archived | Use Next.js frontend |

---

## Canonical Frontend: Next.js

> **📌 Next.js is the official and canonical web frontend framework for VibeCode Studio.**

### Why Next.js?

Next.js 16.1.6 with React 19.2.4 serves as the foundation for VibeCode's web-based IDE experience.

**Key Benefits:**

1. **Modern React Architecture**
   - App Router with React Server Components
   - Streaming SSR for faster initial page loads
   - Automatic code splitting and optimization

2. **Performance Optimizations**
   - Built-in image optimization
   - Font optimization with `next/font`
   - Automatic static optimization
   - Edge runtime support

3. **Developer Experience**
   - Fast Refresh for instant feedback
   - TypeScript support out of the box
   - Built-in API routes for backend logic
   - Comprehensive error handling and debugging

4. **Production-Ready Features**
   - Automatic static optimization
   - Server-side rendering (SSR)
   - Incremental Static Regeneration (ISR)
   - Built-in SEO optimization

### Technical Specifications

**Configuration:** `next.config.js`
- Custom webpack configuration for Monaco Editor
- Environment variable handling
- Output configuration for Tauri integration

**Directory Structure:**
```
src/
├── app/              # Next.js App Router pages
├── components/       # React components
├── lib/             # Utility functions and libraries
├── styles/          # Global styles and Tailwind config
└── types/           # TypeScript type definitions
```

**Build Commands:**
```bash
npm run dev          # Development server (http://localhost:3000)
npm run build        # Production build
npm run start        # Production server
```

### Performance Metrics

- **Initial Page Load:** ~1.2s (optimized)
- **Time to Interactive:** ~2.0s
- **Bundle Size:** ~300KB (gzipped, excluding Monaco Editor)
- **Lighthouse Score:** 95+ (Performance)

### Integration Points

- **Monaco Editor:** Integrated via custom webpack configuration
- **Tauri Desktop:** Next.js serves as the UI layer for Tauri desktop app
- **AI Services:** API routes handle AI provider integrations
- **WebSocket:** Real-time collaboration via WebSocket connections

---

## Canonical Desktop Runtime: Tauri

> **📌 Tauri is the official and canonical desktop runtime for VibeCode Studio.**

### Why Tauri?

Tauri provides a secure, lightweight, and high-performance desktop application framework that significantly outperforms traditional Electron-based solutions.

**Performance Comparison:**

| Metric | Tauri | Electron (Deprecated) |
|--------|-------|----------------------|
| **Binary Size** | 3-5 MB | 100-150 MB |
| **Memory Usage** | 50-80 MB | 150-300 MB |
| **Startup Time** | 0.4s | 1.5s |
| **Bundle Distribution** | Single binary | Multiple files + Chromium |

**Key Advantages:**

1. **Security-First Design**
   - Rust-based backend prevents memory safety vulnerabilities
   - Granular permission system for system APIs
   - No Node.js runtime exposure to frontend
   - Sandboxed WebView environment

2. **Cross-Platform Native**
   - Single codebase for macOS, Windows, and Linux
   - Uses OS-native WebView (no bundled Chromium):
     - **macOS:** WKWebView
     - **Windows:** WebView2
     - **Linux:** WebKitGTK
   - Native system integration and performance

3. **Small Footprint**
   - 95% smaller bundle size vs Electron
   - Lower memory consumption
   - Faster startup and runtime performance
   - Efficient resource usage

4. **Modern Development Stack**
   - Seamless Next.js integration
   - TypeScript support throughout
   - Rust backend for system operations
   - Hot reload in development

### Platform Support

**Minimum Requirements:**

- **macOS:** 10.13 (High Sierra) or later
  - Intel (x86_64) and Apple Silicon (aarch64) supported
  - Xcode Command Line Tools required for development

- **Windows:** Windows 10 or later (64-bit)
  - WebView2 runtime (usually pre-installed on Windows 10/11)
  - Visual Studio Build Tools or Visual Studio Community

- **Linux:** Ubuntu 20.04+, Fedora 35+, or equivalent
  - WebKitGTK 4.1
  - GTK 3 development libraries
  - System dependencies vary by distribution

### Technical Architecture

**Configuration:** `tauri.conf.json`
- Application metadata and branding
- Window configuration and permissions
- Bundle settings for each platform
- Security policies and allowlists

**Rust Backend:** `src-tauri/` (when present)
- System API access
- File system operations
- Native integrations
- Custom commands for frontend

**Frontend Integration:**
- Next.js app served in Tauri WebView
- IPC communication between frontend and Rust backend
- Custom protocol for local file serving
- Security context separation

### Build Commands

```bash
# Development
npm run tauri:dev         # Launch Tauri with hot reload

# Production Builds
npm run tauri:build       # Build for current platform
npm run build:macos       # macOS-specific build
npm run build:linux       # Linux-specific build
npm run build:windows     # Windows-specific build
```

### Setup and Installation

For detailed platform-specific setup instructions, including:
- Rust toolchain installation
- System dependencies
- Platform-specific requirements
- Comprehensive troubleshooting

**See: [Tauri Desktop Setup Guide](docs/setup/TAURI_DESKTOP_SETUP.md)**

### Migration from Electron

**Status:** Electron support has been deprecated and removed as of February 2026.

**Why We Migrated:**

1. **Security:** Rust backend eliminates entire classes of memory safety vulnerabilities
2. **Performance:** 3-4x faster startup, 50-70% less memory usage
3. **Distribution:** 95% smaller binaries mean faster downloads and updates
4. **Maintenance:** Single, well-maintained codebase vs. dual Electron/Tauri maintenance

**For Electron Users:**

If you were using the legacy Electron builds:
1. Download the latest Tauri-based VibeCode Desktop from releases
2. Uninstall the old Electron version
3. Install the new Tauri version
4. Your settings and projects will be preserved

**Developer Migration:**

- Remove `electron-vibecode/` references (directory removed)
- Use `npm run tauri:dev` instead of `npm run start:electron`
- Refer to Tauri documentation for system API access patterns

---

## Web-Dashboard Status

> **⚠️ ARCHIVED**: The `web-dashboard` component has been archived and is no longer maintained.

### Status: Archived (February 2026)

The legacy `web-dashboard` implementation has been fully replaced by the Next.js-based frontend.

**Historical Context:**

The web-dashboard was an early prototype for the VibeCode web interface. It has been superseded by the current Next.js implementation, which provides:
- Better performance and user experience
- Modern React 19 features
- Improved maintainability
- Seamless Tauri desktop integration

**What This Means:**

- ✅ **Use Next.js** (`src/` directory) for all web development
- ❌ **Do not use** web-dashboard references found in archived documentation
- 📚 **Historical references** may exist in `docs/reports/` but are not applicable to current development

**Migration Guidance:**

If you encounter references to web-dashboard in legacy documentation or code:
1. Ignore them - they are historical artifacts
2. Use the Next.js frontend instead (`src/` directory)
3. Refer to this document for current canonical stack

---

## Infrastructure Stack

### Backend Services

- **Database:** PostgreSQL 16 with pgvector extension
- **Caching:** Redis/Valkey for session and data caching
- **Vector Database:** pgvector with HNSW indexes for semantic search
- **Orchestration:** Kubernetes for production deployment
- **Containerization:** Docker for service packaging

### Observability

VibeCode uses a dual observability approach:

- **OpenTelemetry (@vercel/otel):** Distributed tracing and OTLP-compatible backends
- **Datadog (dd-trace):** Production APM, custom metrics, and monitoring

For detailed guidance on when to use each tool, see: **[Observability Documentation](OBSERVABILITY.md)**

### Development Tools

- **Code Editor:** Monaco Editor 0.53.0 with AI completion
- **Terminal:** node-pty for integrated terminal
- **AI Providers:** OpenAI, Anthropic, Gemini, Groq, DeepSeek support
- **Collaboration:** WebSocket-based real-time editing

---

## Development Environment

### System Requirements

**Minimum:**
- RAM: 8GB (16GB recommended)
- Disk: 5GB free space
- Node.js: 18+ (20+ recommended)
- Rust: 1.75+ (for Tauri development)

### Quick Start

```bash
# Install dependencies
npm install

# Development mode (web)
npm run dev

# Development mode (desktop)
npm run tauri:dev

# Production build
npm run build
npm run tauri:build
```

### Environment Variables

Key environment variables for development:

```bash
# Disable Next.js telemetry (privacy)
NEXT_TELEMETRY_DISABLED=1

# Enable OpenTelemetry instrumentation (optional)
OTEL_ENABLED=true

# Node environment
NODE_ENV=development|production|test
```

### Service URLs

- **Next.js Web:** http://localhost:3000
- **Documentation Site:** http://localhost:4321 (if running docs server)

---

## Architecture Decision Records

### ADR-001: Adopt Next.js as Canonical Frontend

**Date:** 2025
**Status:** ✅ Accepted

**Decision:** Use Next.js 16.1.6 with React 19.2.4 as the canonical frontend framework.

**Rationale:**
- Modern App Router with Server Components
- Superior performance and developer experience
- Strong ecosystem and community support
- Seamless TypeScript integration
- Built-in optimization features

**Alternatives Considered:**
- Custom React setup (rejected: too much configuration overhead)
- Vue.js (rejected: team expertise in React)
- Remix (rejected: less mature ecosystem at the time)

---

### ADR-002: Adopt Tauri as Canonical Desktop Runtime

**Date:** February 2026
**Status:** ✅ Accepted

**Decision:** Use Tauri 2.10.0 as the canonical desktop runtime, deprecating Electron.

**Rationale:**
- 95% smaller bundle size (3-5 MB vs 100-150 MB)
- 3-4x faster startup time (0.4s vs 1.5s)
- 50-70% lower memory usage
- Rust backend provides memory safety and security
- Native OS WebView eliminates Chromium bundling

**Performance Metrics:**
- Binary size: 3-5 MB (vs 100-150 MB Electron)
- Memory usage: 50-80 MB (vs 150-300 MB Electron)
- Startup time: 0.4s (vs 1.5s Electron)

**Alternatives Considered:**
- Continue dual Tauri/Electron support (rejected: maintenance burden)
- Neutralino (rejected: less mature, smaller community)
- Pure Electron (rejected: poor performance characteristics)

**Migration Path:**
- Remove `electron-vibecode/` directory and references
- Remove `start:electron` script from package.json
- Update documentation to reflect Tauri as canonical
- Provide migration guide for Electron users

---

### ADR-003: Archive web-dashboard

**Date:** February 2026
**Status:** ✅ Accepted

**Decision:** Archive the legacy web-dashboard implementation.

**Rationale:**
- Superseded by Next.js frontend
- No active maintenance or usage
- Removing reduces confusion for new developers
- Next.js provides superior functionality

**Alternatives Considered:**
- Maintain both (rejected: unnecessary maintenance burden)
- Gradual deprecation (rejected: already effectively unused)

---

### ADR-004: Dual Observability with OpenTelemetry and Datadog

**Date:** 2025
**Status:** ✅ Accepted

**Decision:** Support both @vercel/otel and dd-trace for different observability use cases.

**Rationale:**
- OpenTelemetry: Vendor-neutral distributed tracing
- Datadog: Production-grade APM with custom metrics
- Both tools serve complementary purposes
- Conditional activation prevents conflicts

**Usage Guidance:**
- Use OpenTelemetry for distributed tracing across services
- Use Datadog for production APM and monitoring
- Enable via environment variables (OTEL_ENABLED, DD_TRACE_ENABLED)
- See OBSERVABILITY.md for detailed guidance

**Alternatives Considered:**
- OpenTelemetry only (rejected: loses Datadog-specific features)
- Datadog only (rejected: vendor lock-in concerns)
- Custom instrumentation (rejected: reinventing the wheel)

---

## Summary

**Canonical Stack:**
- ✅ **Frontend:** Next.js 16.1.6 with React 19.2.4
- ✅ **Desktop:** Tauri 2.10.0
- ✅ **Language:** TypeScript + Rust (Tauri backend)
- ✅ **Editor:** Monaco Editor 0.53.0
- ✅ **Observability:** OpenTelemetry + Datadog (dual approach)

**Deprecated/Archived:**
- ❌ **Electron** (deprecated February 2026)
- ❌ **web-dashboard** (archived February 2026)

**Key Principles:**

1. **Performance First:** Choose technologies that provide measurable performance benefits
2. **Security by Default:** Prefer memory-safe languages and secure-by-default frameworks
3. **Developer Experience:** Prioritize tools that improve productivity and maintainability
4. **Modern Standards:** Adopt cutting-edge but stable technologies
5. **Minimal Overlap:** Avoid maintaining parallel implementations of the same functionality

For questions about architectural decisions or to propose changes, please refer to the project's contribution guidelines and open a discussion with the architecture team.

---

**Last Updated:** February 2026
**Maintained By:** VibeCode Architecture Team
**Review Cycle:** Quarterly or when major technology decisions are made

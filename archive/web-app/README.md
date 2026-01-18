# Archived: Next.js Web Application

**Archived:** 2026-01-14
**Reason:** Project simplified to menubar app only
**Agent:** AGENT 163

## What was this?

Full-featured Next.js web application with:
- 156+ routes across multiple feature areas
- Comprehensive React component library
- Tailwind CSS design system
- Playwright E2E tests
- Integration tests
- API routes for AI, vector databases, agents, and more

## Architecture Highlights

### Application Structure
- **app/**: Next.js 13+ app directory with file-based routing
- **components/**: 50+ React components for UI, forms, data visualization
- **lib/**: 114+ utility libraries (web-related only, VM code preserved)
- **styles/**: Global styles and Tailwind configuration

### Key Features
- Multi-provider AI integration (OpenAI, Anthropic, Azure, Ollama)
- Vector database support (Qdrant, Pinecone, Weaviate, ChromaDB)
- Agent framework with workflow orchestration
- Real-time collaboration and WebSocket support
- Authentication and session management
- File upload and workspace management

### Testing Infrastructure
- **E2E Tests**: Playwright tests for critical user flows
- **Integration Tests**: API and service integration testing
- **Component Tests**: React component testing

## Why archived?

VibeCode's core purpose is a simple macOS menubar app for running VMs with AI assistance. The web application represented significant scope creep and complexity that was not aligned with the core product vision.

By archiving the web app:
- Simplified codebase to focus on menubar app
- Reduced maintenance burden
- Improved build and deployment times
- Clearer product positioning

## What was preserved?

The following core infrastructure was NOT archived:
- `src/lib/vm/`: Native VM providers (QEMU, VFKit, Lima, WSL2, Docker)
- Root configuration files needed for the menubar app
- Backend services and APIs used by the menubar app

## How to restore?

If you need to bring back the web application:

### Option 1: Copy from archive
```bash
# Copy back to main repo
cp -r archive/web-app/app/ src/app/
cp -r archive/web-app/components/ src/components/
cp -r archive/web-app/lib/* src/lib/  # Be careful not to overwrite VM code
cp -r archive/web-app/styles/ src/styles/
cp -r archive/web-app/public/ public/
cp archive/web-app/*.config.* .
# etc...
```

### Option 2: Checkout pre-cleanup branch
```bash
git checkout pre-cleanup-backup
```

### Option 3: Cherry-pick specific features
```bash
# Extract just the parts you need
cp -r archive/web-app/components/ChatInterface/ src/components/
```

## Archive Contents

```
archive/web-app/
├── app/                      # Next.js app directory (routes, layouts, pages)
├── components/               # React component library
├── lib/                      # Web-related utilities (114 items)
├── styles/                   # CSS and Tailwind styles
├── public/                   # Static assets
├── src/                      # Additional source directories
│   ├── hooks/               # React hooks
│   ├── providers/           # Context providers
│   ├── stores/              # State management
│   ├── middleware/          # Next.js middleware
│   ├── pages/               # Pages directory
│   ├── design-system/       # Design system components
│   ├── stubs/               # Test stubs
│   └── workers/             # Web workers
├── tests/                   # Test suites
│   ├── e2e/                # End-to-end tests
│   ├── integration/        # Integration tests
│   └── components/         # Component tests
├── next.config.mjs          # Next.js configuration
├── next.config.tauri.js     # Tauri-specific Next.js config
├── tailwind.config.js       # Tailwind CSS configuration
├── postcss.config.mjs       # PostCSS configuration
├── playwright.config.ts     # Playwright test configuration
├── tsconfig.json            # TypeScript configuration
└── README.md                # This file
```

## Related Documentation

- Original project documentation: See `docs/` directory in main repo
- Test documentation: `tests/TESTING_GUIDE.md` (archived)
- API documentation: `docs/API.md` (if exists in main repo)

## Historical Context

The web application was developed over several months as the project scope expanded. It grew to include:
- Advanced AI agent orchestration
- Multi-tenant workspace management
- Real-time collaboration features
- Extensive vector database integrations
- Complex authentication flows

While technically impressive, this complexity moved away from the core value proposition of VibeCode as a simple, elegant menubar app for VM management.

## Questions?

If you have questions about the archived code or need to restore specific functionality, please:
1. Check this README for restoration instructions
2. Review the git history for the pre-cleanup state
3. Contact the development team for guidance

---

**Archive Date:** 2026-01-14
**Archival Agent:** AGENT 163: Archive Web App
**Cleanup Initiative:** Project Simplification - Focus on Menubar App

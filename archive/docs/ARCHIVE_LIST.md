# ARCHIVE LIST - Files to Preserve in archive/

**Generated:** 2026-01-14
**Purpose:** Files to move to archive/ directory (preserve but remove from active development)

---

## Summary

These files represent **working code and documentation** that is no longer part of the core product, but may have historical value or could be referenced later. They will be:
1. Moved to `archive/` directory
2. Organized by category
3. Preserved in git history
4. Excluded from active development

**Total Files to Archive:** ~404,000 (99% of codebase)
**Total Space:** ~6.5GB

---

## Archive Structure

```
archive/
├── web-app/                     # Next.js web application (2.5GB)
├── desktop-apps/                # Alternative desktop implementations (1.5GB)
├── infrastructure/              # Cloud/container infrastructure (1GB)
├── tests/                       # Test infrastructure (635MB)
├── docs/                        # Documentation (295MB)
├── experiments/                 # Experimental features (200MB)
├── abandoned/                   # Abandoned projects (2GB)
├── services/                    # Service implementations (300MB)
├── monitoring/                  # Monitoring infrastructure (100MB)
└── legacy/                      # Legacy code (remaining)
```

---

## archive/web-app/ (2.5GB)

**Reason:** VibeCode is a menubar app, not a web app

### Next.js Application
```
src/
├── app/                         # 156 Next.js routes
│   ├── api/                     # API routes
│   ├── auth/                    # Authentication pages
│   ├── chat/                    # Chat interface
│   ├── dashboard/               # Dashboard pages
│   ├── upload/                  # Upload functionality
│   └── [... 40+ more routes]
├── components/                  # React components
│   ├── ui/                      # UI components
│   ├── chat/                    # Chat components
│   └── [... more components]
├── lib/                         # Library code
├── styles/                      # CSS/styling
└── types/                       # TypeScript types
```

### Web Configs
```
next.config.mjs                  # Next.js configuration
next.config.tauri.js             # Tauri-specific Next.js config
tailwind.config.ts               # Tailwind CSS config
postcss.config.js                # PostCSS config
postcss.config.docker.js         # Docker-specific PostCSS
eslint.config.mjs                # ESLint configuration
tsconfig.json                    # TypeScript config (keep base)
```

### Web Assets
```
public/                          # Static web assets
├── images/
├── icons/
└── fonts/
```

### Web Tests
```
src/app/__tests__/               # Next.js route tests
tests/e2e/                       # Playwright E2E tests
playwright.config.ts             # Playwright config
playwright.config.production.ts  # Production Playwright config
```

---

## archive/desktop-apps/ (1.5GB)

**Reason:** We have SwiftUI menubar app - don't need Tauri or Electron

### Tauri Desktop App
```
src-tauri/                       # 1.4GB Tauri application
├── src/                         # Rust source code
├── target/                      # Cargo build artifacts (if committed)
├── Cargo.toml                   # Rust dependencies
├── Cargo.lock                   # Dependency lock
├── tauri.conf.json              # Tauri configuration
└── icons/                       # App icons
```

### Electron Desktop App
```
electron-vibecode/               # Electron implementation
├── main.js                      # Electron main process
├── renderer/                    # Renderer process
└── package.json                 # Electron dependencies
```

### Chromium Kiosk
```
chromium-kiosk/                  # Kiosk mode implementation
├── launcher.js
└── configs/
```

### Desktop Configs
```
.tauri/                          # Tauri metadata
tauri.conf.json                  # Tauri config (if in root)
```

---

## archive/infrastructure/ (1GB)

**Reason:** Desktop app doesn't need cloud infrastructure

### Docker (3,613 files, ~25MB)
```
docker/                          # Docker configurations
├── dev/                         # Development containers
├── prod/                        # Production containers
└── compose/                     # Docker Compose configs

Dockerfile                       # Base Dockerfile
Dockerfile.*                     # All Dockerfile variants
docker-compose.yml               # Compose file
docker-compose.*.yml             # All compose variants
.dockerignore                    # Docker ignore
```

### Kubernetes (213 files, ~5MB)
```
k8s/                             # Kubernetes manifests (155 files)
├── base/
├── overlays/
└── monitoring/

helm/                            # Helm charts (58 files)
├── charts/
└── values/

helm-charts/                     # More Helm charts
kubernetes/                      # More K8s configs
```

### Cloud Infrastructure
```
azure-functions/                 # Azure Functions
terraform/                       # Terraform IaC
tofu/                           # OpenTofu configs
infrastructure/                  # Infrastructure code
ops/                            # Operations configs
ansible/                        # Ansible playbooks
```

### CI/CD (Keep only build-macos.yml)
```
.github/workflows/               # GitHub Actions
├── build-and-push-image.yml    # Docker build
├── ci.yml                      # Main CI
├── ci-simplified.yml           # Simplified CI
├── deploy-docs.yml             # Docs deployment
├── e2e.yml                     # E2E tests
├── pr-checks.yml               # PR checks
├── pr-test.yml                 # PR tests
├── release.yml                 # Release workflow
├── security-audit.yml          # Security audits
├── security-scan.yml           # Security scanning
├── tauri-release.yml           # Tauri release
├── tauri-test.yml              # Tauri tests
└── [... 10+ more workflows]

# KEEP ONLY:
# .github/workflows/build-macos.yml
```

---

## archive/tests/ (635MB)

**Reason:** Keep only essential tests for menubar app

### Test Files (2,088 files, ~6MB)
```
tests/                           # Test directory
├── unit/                        # Unit tests
├── integration/                 # Integration tests
├── e2e/                         # E2E tests
├── security/                    # Security tests
├── performance/                 # Performance tests
├── k8s/                         # K8s tests
└── complete/                    # Complete test suites

# All *.test.ts files (2,015)
# All *.test.tsx files (73)
```

### Test Configs
```
jest.config.js                   # Jest config
jest.config.*.js                 # Jest variants (6+ files)
jest.performance.config.mjs      # Performance tests
playwright.config.ts             # Playwright config
playwright.config.production.ts  # Production Playwright
```

### Test Artifacts (already in DELETE list, but document)
```
test-results/                    # Test results (5MB)
playwright-report/               # HTML reports
coverage/                        # Coverage (130MB)
```

### Test Tools
```
lighthouse-ci.json               # Lighthouse CI
lighthouserc.js                  # Lighthouse config
datadog-synthetics.json          # Datadog synthetic tests
```

---

## archive/docs/ (295MB, 10,523 files!)

**Reason:** Keep only README, CHANGELOG, LICENSE

```
docs/                            # Documentation directory
├── api/                         # API documentation
├── architecture/                # Architecture docs
├── deployment/                  # Deployment guides
├── development/                 # Development guides
├── guides/                      # User guides
├── planning/                    # Planning documents
├── security/                    # Security docs
├── troubleshooting/             # Troubleshooting
└── [... 100+ subdirectories]

wiki/                            # Wiki (duplicate docs)
content/                         # Content directory (more docs)
reports/                         # Reports

# All README.md files except root (100+ files)
# All *.md files in subdirectories (10,400+ files)
```

---

## archive/experiments/ (200MB)

**Reason:** Not part of core product

```
experiments/                     # Experimental features
demos/                          # Demo projects
demo/                           # More demos
samples/                        # Sample projects
examples/                       # Example projects
templates/                      # Project templates
patches/                        # Random patches
```

---

## archive/abandoned/ (2GB)

**Reason:** Duplicate/abandoned implementations of VM/desktop app

### Duplicate VM Implementations
```
macos-vm/                        # Duplicate VM
swift-vfkit-macos/              # Another VM implementation
vz-swift/                       # Yet another VM
fast-openvscode-vm/             # Fast VM variant
VibeCode-VMs/                   # VM configs
vm-assets/                      # VM assets (consolidate to menubar/)
```

### Duplicate Swift Projects
```
VibeCodeSwift/                   # 491MB duplicate Swift code
Swift/                          # Swift experiments
Sources/                        # Duplicate sources
```

### Container/Runtime Experiments
```
AppleContainerRuntime/          # Abandoned container runtime
apple-container/                # Duplicate
```

### OpenVSCode Duplicates
```
openvscode-server/              # 145MB OpenVSCode build
vibecode-optimized/             # Optimization experiments
```

### Database Experiments
```
vibecode-pgvector/              # PostgreSQL experiments
prisma/                         # Prisma ORM
database/                       # Database migrations
```

### Package Artifacts
```
vibecode-v1.4a-package/         # Old version package
packages/                       # 180MB of packages
```

---

## archive/services/ (300MB)

**Reason:** Desktop app doesn't need backend services

```
services/                        # 110MB service implementations
server/                         # Server code
queue-worker/                   # Queue worker
litellm/                        # LiteLLM integration
macos-services/                 # macOS services
macos-fleet-orchestration/      # Fleet management
```

---

## archive/monitoring/ (100MB)

**Reason:** Desktop app doesn't need infrastructure monitoring

```
monitoring/                      # Monitoring infrastructure
dashboards/                     # Grafana dashboards

# Monitoring configs (in root)
datadog-dashboard-*.json        # Datadog dashboards (5+ files)
datadog-synthetics.json         # Synthetic tests
datadog-rag-verification.js     # RAG verification
performance-benchmark-*.json    # Performance benchmarks
performance-budget.json         # Performance budgets
```

---

## archive/legacy/ (remaining)

**Reason:** Miscellaneous legacy code

### Language-Specific
```
go/                             # Go code in Swift project
cmd/                            # Go command structure
requirements/                   # Python requirements
```

### Build Tools
```
tools/                          # Random tools
plugins/                        # Plugin system
extensions/                     # 169MB of extensions (consolidate Datadog to menubar/)
sdk/                           # SDK implementations
```

### Web Dashboard
```
web-dashboard/                  # 192MB web dashboard
```

### Benchmarks
```
bench-images/                   # 1.8GB benchmark images
```

### Miscellaneous
```
configs/                        # Config files
config/                         # More config files
security/                       # Security configs
launchd/                        # LaunchDaemons
homebrew-vibecode/              # Homebrew formula
watermarkpodautoscaler/         # What even is this?
macos-native-build/             # Native build experiments
macos-fleet-orchestration/      # Fleet orchestration
platforms/                      # Platform code (keep only vm/)
scripts-consolidated/           # Duplicate scripts
```

---

## Archive Organization Script

```bash
#!/bin/bash
# archive-files.sh - Move files to archive/

set -e

ARCHIVE_DIR="archive"
mkdir -p "$ARCHIVE_DIR"

# Create archive structure
mkdir -p "$ARCHIVE_DIR"/{web-app,desktop-apps,infrastructure,tests,docs,experiments,abandoned,services,monitoring,legacy}

# Archive web app
echo "Archiving web app..."
mv src/app "$ARCHIVE_DIR/web-app/"
mv src/components "$ARCHIVE_DIR/web-app/"
mv src/lib "$ARCHIVE_DIR/web-app/"
mv src/styles "$ARCHIVE_DIR/web-app/"
mv public "$ARCHIVE_DIR/web-app/"
mv next.config.mjs "$ARCHIVE_DIR/web-app/"
mv tailwind.config.ts "$ARCHIVE_DIR/web-app/" 2>/dev/null || true
mv postcss.config*.js "$ARCHIVE_DIR/web-app/" 2>/dev/null || true

# Archive desktop apps
echo "Archiving desktop apps..."
mv src-tauri "$ARCHIVE_DIR/desktop-apps/"
mv electron-vibecode "$ARCHIVE_DIR/desktop-apps/" 2>/dev/null || true
mv chromium-kiosk "$ARCHIVE_DIR/desktop-apps/" 2>/dev/null || true

# Archive infrastructure
echo "Archiving infrastructure..."
mv docker "$ARCHIVE_DIR/infrastructure/"
mv k8s "$ARCHIVE_DIR/infrastructure/" 2>/dev/null || true
mv helm "$ARCHIVE_DIR/infrastructure/" 2>/dev/null || true
mv kubernetes "$ARCHIVE_DIR/infrastructure/" 2>/dev/null || true
mv terraform "$ARCHIVE_DIR/infrastructure/" 2>/dev/null || true
mv Dockerfile* "$ARCHIVE_DIR/infrastructure/" 2>/dev/null || true
mv docker-compose*.yml "$ARCHIVE_DIR/infrastructure/" 2>/dev/null || true

# Archive tests
echo "Archiving tests..."
mv tests "$ARCHIVE_DIR/tests/"
mv playwright.config*.ts "$ARCHIVE_DIR/tests/" 2>/dev/null || true
mv jest.config*.js "$ARCHIVE_DIR/tests/" 2>/dev/null || true

# Archive docs
echo "Archiving docs..."
mv docs "$ARCHIVE_DIR/docs/"
mv wiki "$ARCHIVE_DIR/docs/" 2>/dev/null || true
mv content "$ARCHIVE_DIR/docs/" 2>/dev/null || true

# Archive experiments
echo "Archiving experiments..."
mv experiments "$ARCHIVE_DIR/experiments/" 2>/dev/null || true
mv demos "$ARCHIVE_DIR/experiments/" 2>/dev/null || true
mv samples "$ARCHIVE_DIR/experiments/" 2>/dev/null || true

# Archive abandoned
echo "Archiving abandoned projects..."
mv VibeCodeSwift "$ARCHIVE_DIR/abandoned/" 2>/dev/null || true
mv macos-vm "$ARCHIVE_DIR/abandoned/" 2>/dev/null || true
mv openvscode-server "$ARCHIVE_DIR/abandoned/" 2>/dev/null || true

# Archive services
echo "Archiving services..."
mv services "$ARCHIVE_DIR/services/" 2>/dev/null || true
mv server "$ARCHIVE_DIR/services/" 2>/dev/null || true

echo "Archive complete!"
echo "Files archived to: $ARCHIVE_DIR/"
```

---

## Verification After Archive

```bash
# Check archive structure
tree -L 2 archive/

# Verify no archived files remain in root
ls -la | wc -l  # Should be ~20

# Verify main directories
ls -d */ | wc -l  # Should be ~5 (menubar/, vm/, scripts/, archive/, vendor/)

# Check archive size
du -sh archive/  # Should be ~6.5GB
```

---

## Archive README

Create `archive/README.md`:

```markdown
# VibeCode Archive

This directory contains code that was part of VibeCode but is no longer
actively developed. All code is preserved for historical reference.

## Why These Files Were Archived

VibeCode's core purpose is: **A simple macOS menubar app that runs
OpenVSCode Server in a VM.**

The archived code represents scope creep, experiments, and alternative
implementations that distracted from this core purpose.

## Archive Structure

- `web-app/` - Next.js web application (VibeCode is a desktop app)
- `desktop-apps/` - Tauri/Electron implementations (we use SwiftUI)
- `infrastructure/` - Cloud/container infrastructure (not needed for desktop)
- `tests/` - Test infrastructure (simplified for core app)
- `docs/` - Documentation (10,523 files → 3 files)
- `experiments/` - Experimental features
- `abandoned/` - Duplicate/abandoned implementations
- `services/` - Backend services (desktop app is self-contained)
- `monitoring/` - Infrastructure monitoring
- `legacy/` - Miscellaneous legacy code

## Statistics

- Files archived: 404,000+ (99% of codebase)
- Space: 6.5GB
- Date: 2026-01-14
- Reason: Return to core purpose

## Restoration

If you need to restore any archived code:

```bash
# View archived files
ls -la archive/

# Restore specific file
cp archive/path/to/file destination/

# Reference in git history
git log --all --full-history -- "archived-file-path"
```

## See Also

- `/docs/CLEANUP_PLAN.md` - Full cleanup plan
- `/CHANGELOG.md` - Version history
```

---

## Notes

- All archived code is **working code** - it just doesn't belong in the core product
- Git history is **preserved** - you can always `git checkout` old commits
- Archive is **searchable** - grep works across archived files
- Archive is **organized** - easy to find and restore if needed
- Archive is **documented** - each category has a README explaining why it was archived

**Philosophy:** Archive aggressively, delete conservatively. Code is cheap, clarity is expensive.

---

*End of ARCHIVE_LIST.md*

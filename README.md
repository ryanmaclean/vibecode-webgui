# VibeCode

<<<<<<< HEAD
AI-powered development platform. Next.js 15 + Monaco 0.53.0 + pgvector + Kubernetes.
=======
![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-25.0.0-brightgreen.svg)
![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)
![React](https://img.shields.io/badge/React-19-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)
>>>>>>> ai-sdk-openai-v2-test

## Tech Stack

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS
- **Editor:** Monaco 0.53.0 with Monacopilot AI completion
- **Database:** PostgreSQL 16 + pgvector (HNSW indexes)
- **AI:** OpenAI, Anthropic, Gemini, Groq, DeepSeek
- **Infra:** Kubernetes (AKS), Docker, Helm
- **Monitoring:** Datadog (APM, DBM, RUM, Logs)
- **Testing:** Comprehensive offline cloud infrastructure testing framework

## Quick Install

### Docker
```bash
docker run -d -p 3000:3000 vibecode/webgui:latest
```

### Docker Compose
```bash
curl -O https://raw.githubusercontent.com/ryanmaclean/vibecode-webgui/main/docker-compose.yml
docker compose --project-name vibecode up -d
```

For a persistent “cloud workspace” variant with resumable state, try the experimental bundle:

```bash
git clone https://github.com/ryanmaclean/vibecode-webgui
cd vibecode-webgui
CODE_SERVER_PASSWORD=changeme scripts/cloud/docker/start-compose.sh
```
Shelled-out volumes live under `workspace/` and `config/`; run `scripts/cloud/docker/stop-compose.sh` to tear down.

> Tip: Run `docker compose -f docker-compose.yml config` first to validate the stack, and see [docker/code-server/DEPLOYMENT_GUIDE.md](docker/code-server/DEPLOYMENT_GUIDE.md#option-2-docker-compose-recommended) for full guidance.

### Kubernetes (KinD)
```bash
kind create cluster --name vibecode
kubectl apply -f https://raw.githubusercontent.com/ryanmaclean/vibecode-webgui/main/k8s/vibecode-kind.yaml
kubectl port-forward svc/vibecode 3000:80
```

### Local Development
```bash
git clone https://github.com/ryanmaclean/vibecode-webgui
cd vibecode-webgui
npm install
npm run dev
```

> 2025-10-01 update: Browser bundles now alias Datadog/OpenTelemetry packages to lightweight stubs. If `npm run dev:simple` still fails, finish the TypeScript fixes called out in TODO.md before retrying so the `/tools/codeium` smoke test can complete.

## Features

- **Cmd+K Inline Edit** - Natural language code transformations
- **Codebase Chat** - Ask questions about your code (vector search)
- **AI Completion** - Multi-provider support (OpenAI/Anthropic/etc)
- **7-Step Onboarding** - Theme, workspace, extensions, integrations
- **53+ Extensions** - Continue, Codeium, Cline, Aider, Prettier, ESLint, etc
- **MCP Server** - Model Context Protocol for Windsurf/Claude Desktop
- **Vector Search** - Semantic code search with pgvector + HNSW
- **Offline Testing** - Comprehensive cloud infrastructure validation without cloud resources

## Testing

### Offline Cloud Infrastructure Testing

Our comprehensive offline testing framework validates cloud infrastructure configurations without creating actual cloud resources:

```bash
# Run comprehensive offline tests
./tests/tofu/offline-cloud-testing.sh

# Run specific test suites
npm run test:scripts  # Bats tests for shell scripts
python3 tests/tofu/test_aws_cloud_deployment.py -v
python3 tests/tofu/test_gcp_cloud_deployment.py -v
python3 tests/tofu/test_security_validation.py -v
```

**Test Coverage:**
- **AWS ECS/Fargate**: 12 comprehensive test cases with retry logic
- **GCP Compute Engine**: 12 comprehensive test cases with validation
- **Security Validation**: Comprehensive security best practices testing
- **Shell Script Testing**: Bats test suite for script validation
- **GitHub Integration**: Automated issue updates and test reporting

**Benefits:**
- **Cost Savings**: No cloud resources created during testing
- **Fast Feedback**: Tests run in seconds with comprehensive validation
- **Security**: Automated security validation and secret detection
- **CI/CD Ready**: GitHub Actions integration ready

## Daily Checkpoint — 2025-10-01

The code-server editor smoke test hardening shipped today (Ready pod gating, kubectl timeouts, structured logging), but three follow-ups remain before closing the loop:

- [#415](https://github.com/ryanmaclean/vibecode-webgui/issues/415): propagate `kubectl wait` errors, refresh the Ready pod list between retries, mask pod identifiers in logs, and install `shellcheck`/`bats` locally + in CI.
- [#416](https://github.com/ryanmaclean/vibecode-webgui/issues/416): add checksum/signature verification for kubectl/helm/kubectx/kubens and redact stderr output before it reaches shared telemetry.
- [#417](https://github.com/ryanmaclean/vibecode-webgui/issues/417): expand the Bats suite to cover pod rotation, “no Ready pod” errors, structured status parsing, and timeout overrides.

- ✅ 2025-10-01: Shellcheck/bats now installed in the KinD playbook; `scripts/test-code-server-editors.sh` surfaces `kubectl wait`/timeout failures, masks pod IDs, and Dockerfile installs for helm/kubectl/kubectx/kubens now verify upstream checksums (tracks #415/#416/#417).

Heads-up: attempts to gather end-of-day guidance via `roundtable-ai/gemini_subagent` currently fail even though the CLI reports the agent as available. Re-run those persona prompts once the MCP server recognises Gemini again.

## Screenshots

### Monaco Editor with AI Completion
![Monaco Editor](docs/screenshots/monaco-editor.png)

### Codebase Chat
![Codebase Chat](docs/screenshots/codebase-chat.png)

### Onboarding Flow
![Onboarding](docs/screenshots/onboarding.png)

## Deployment

See [DOCKER_DEPLOYMENT.md](docs/DOCKER_DEPLOYMENT.md) for:
- macOS (Intel + Apple Silicon)
- Linux (Ubuntu/Debian/Fedora/Arch)
- Windows (Desktop + Server)
- QNAP, Synology, Asustor NAS
- Docker Compose
- Kubernetes (KinD + Production)

### Cloud Workspaces (code-server)

We are standardising low-cost, resumable developer workspaces on both Google Cloud Platform and AWS. Key points:

| Cloud | Minimal Footprint | Persistent Storage | Auth | Notes |
|-------|------------------|--------------------|------|-------|
| **GCP** | Preemptible `e2-small` VM running code-server in Docker | Regional Persistent Disk per user (50 GiB) | Cloud HTTPS LB + Identity-Aware Proxy | Stop the VM when idle; snapshot PD nightly. |
|       | GKE Autopilot deployment on Spot nodes (multi-user) | Filestore Basic HDD or PD PVC | IAP/OAuth proxy | Use StatefulSet for disk reattachment. |
| **AWS** | EC2 `t4g.small` Spot instance + Docker | gp3 EBS per user (50 GiB) | ALB + Amazon Cognito | Lambda watcher stops idle instances; attach EBS on resume. |
|       | ECS Fargate Spot (or EKS + Spot node groups) | EFS One Zone (IA) shared workspaces | Cognito/OIDC proxy | Suspend tasks when no active sessions. |

Next deliverables:

- ✅ Docker Compose + stop/start scripts for single-user VMs (`scripts/cloud/gcp`, `scripts/cloud/aws`, `scripts/cloud/docker`).
- Kind/GKE/EKS manifests with Filestore/EFS-backed StatefulSets.
- Helm chart modules + Terraform/OpenTofu stacks for managed rollout.
- Idle detection hooks (WebSocket + CPU) that trigger Scheduler/Lambda jobs to shut down workloads.

Progress is tracked in [docs/logs/issues/code-server-cloud-deployment.md](docs/logs/issues/code-server-cloud-deployment.md).

Current tooling:

- `scripts/cloud/gcp/*`, `scripts/cloud/aws/*` – launch/stop Spot or preemptible VMs with persistent disks.
- `docker/code-server/docker-compose.cloud.yml` + `scripts/cloud/docker/*` – resumable Compose bundle for local testing.
- `helm/code-server-cloud/` – experimental Helm chart parameterised for persistence and Datadog sidecar.
- `tofu/code-server-gke`, `tofu/code-server-eks` – OpenTofu modules that install the chart onto existing clusters.
- `scripts/cloud/kind/test-cloud-chart.sh` – quick KinD smoke test mirroring the cloud chart.

## Environment Variables

```bash
# Required
DATABASE_URL="postgresql://user:pass@host:5432/vibecode"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"

# Optional - AI Providers
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
GOOGLE_AI_API_KEY="..."

# Optional - Monitoring
DD_API_KEY="..."
DD_SITE="datadoghq.com"
```

## Architecture

```text
┌─────────────────────────────────────────┐
│  Next.js 15 App (React 19)             │
│  ├─ Monaco 0.53.0 + Monacopilot        │
│  ├─ AI Completion API                  │
│  └─ Vector Search API                  │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  PostgreSQL 16 + pgvector               │
│  ├─ HNSW indexes                        │
│  ├─ User preferences                    │
│  └─ Code embeddings                     │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  Datadog Monitoring                     │
│  ├─ APM (traces)                        │
│  ├─ DBM (query samples)                 │
│  └─ RUM (user sessions)                 │
└─────────────────────────────────────────┘
```

## Code-Server v1.1.1 - GPL-Free Multi-Profile Images

**NEW**: 5 optimized profiles for different use cases, all with essential CLI tools included!

### Quick Start

```bash
# Recommended: Standard profile (700MB, 12 extensions)
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.1-standard
docker run -it --rm -p 8080:8080 ghcr.io/ryanmaclean/vibecode-codeserver:standard

# Or from Docker Hub
docker pull ryanmaclean/vibecode-codeserver:1.1.1-standard
```

### Available Profiles

| Profile | Size | Extensions | Use Case | Pull Command |
|---------|------|------------|----------|--------------|
| **minimal** | 400MB | 5 | Lightweight development | `docker pull ghcr.io/ryanmaclean/vibecode-codeserver:minimal` |
| **standard** | 700MB | 12 | General development (recommended) | `docker pull ghcr.io/ryanmaclean/vibecode-codeserver:standard` |
| **ai** | 900MB | 15 | AI/ML development | `docker pull ghcr.io/ryanmaclean/vibecode-codeserver:ai` |
| **web** | 600MB | 14 | Web development | `docker pull ghcr.io/ryanmaclean/vibecode-codeserver:web` |
| **full** | 1.2GB | 26 | Complete Swiss Army knife | `docker pull ghcr.io/ryanmaclean/vibecode-codeserver:latest` |

### Included CLI Tools (All Profiles)

**Terminal Editors:**
- vim 9.0, neovim 0.7.2

**AI Coding Assistants:**
- aider 0.84.0, goose (latest)

**DevOps Tools:**
- kubectl 1.31.1, helm 3.19.0, k9s 0.50.13
- stern, helmfile, sops, glab, kubectx, kubens

**Shell Enhancements:**
- nushell, delta, chezmoi, just

### VS Code Extensions by Profile

**AI Assistants (in ai/full profiles):**
- Anthropic Claude Code (official)
- OpenAI ChatGPT (official Codex)
- GitHub Copilot + Chat
- Codeium, Cline
- VibeCode AI Assistant, Inline Edit, Codebase Chat

**Productivity (varies by profile):**
- Prettier, ESLint, Git Graph, Jest, Datadog, etc.

### Features

- Multi-architecture (ARM64 + AMD64)
- Multi-registry (GHCR + Docker Hub)
- OAuth authentication (port 46203)
- Port 8765 (VibeCode's unique port)
- Trusted domains pre-configured
- No API keys in image (runtime config)
- All CLI tools verified and working

See [docker/code-server/](docker/code-server/) for complete documentation:
- [PROFILES.md](docker/code-server/PROFILES.md) - Detailed profile comparison
- [CHANGELOG.md](docker/code-server/CHANGELOG.md) - Version history
- [VERIFICATION_GUIDE.md](docker/code-server/VERIFICATION_GUIDE.md) - Testing guide

## API Endpoints

```bash
# AI Completion
curl -X POST http://localhost:3000/api/code-completion \
  -H "Content-Type: application/json" \
  -d '{"prompt":"write a function","provider":"openai"}'

# Vector Search
curl -X POST http://localhost:3000/api/search/vector \
  -H "Content-Type: application/json" \
  -d '{"query":"authentication logic","limit":5}'

# User Preferences
curl http://localhost:3000/api/user/preferences
```

## Testing

```bash
npm run test:unit          # Unit tests
npm run test:integration   # Integration tests
npm run test:e2e           # E2E tests (Playwright)
npm run type-check         # TypeScript
npm run lint               # ESLint
```

## Documentation

- [Onboarding Guide](docs/ONBOARDING.md)
- [Monaco Integration](docs/MONACOPILOT_INTEGRATION.md)
- [MCP Server](docs/MCP_INTEGRATION.md)
- [Docker Deployment](docs/DOCKER_DEPLOYMENT.md)
- [Test Coverage](docs/TEST_COVERAGE_AUDIT.md)
- [Kubernetes Guide](docs/azure-aks-deployment.md)

## Contributing

```bash
# Fork, clone, create branch
git checkout -b feature/your-feature

# Make changes, test
npm run test
npm run type-check

# Commit, push, PR
git commit -m "feat: your feature"
git push origin feature/your-feature
```

## License

MIT

## Links

- [Live Demo](https://vibecode.eastus2.cloudapp.azure.com)
- [Documentation](docs/)
- [Issues](https://github.com/ryanmaclean/vibecode-webgui/issues)
- [Discussions](https://github.com/ryanmaclean/vibecode-webgui/discussions)

### 📌 CI/CD Workflow Coverage
- Tracking issues: see `docs/logs/WORKFLOW_TRACKING.md` (maps each `.github/workflows/*.yml` to issue #355–#395).
- Draft issue blurbs live in `docs/logs/workflow-issues/` for quick copy/paste when filing.

## Daily Check-out (2025-10-01)

- Config Guardian: captured env-template follow-ups in `TODO(config-env-templates)` and issue #416 (reconfirm hostnames, restore VALKEY/REDIS alias mapping, rotate secrets).
- Workflow SRE: logged recommendations in issue #418 to scope validation tags per run, enforce concurrency, and fail on SBOM upload errors before promotion.
- Observability Lead: noted doc/runbook updates for deploy-next-docs smoke-test logs, dashboards, and rollback steps in issue #405 and the Observability Callouts of `TODO.md`.
- Docs Steward: refreshed the Status at a Glance table, Agent Update summary, and assigned owners/dates for outstanding lint/testing actions in `TODO.md`.
- Docker Buildsmith: recorded install/cleanup improvements for kubectl/kubectx/kubens in issue #416 ahead of the security hardening backlog.

Next pass: implement the workflow/env/doc adjustments above, rerun `codeserver-multiarch` with `promote_latest=false`, and close out the outstanding TODO items.

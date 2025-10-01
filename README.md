# VibeCode

AI-powered development platform. Next.js 15 + Monaco 0.53.0 + pgvector + Kubernetes.

## Tech Stack

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS
- **Editor:** Monaco 0.53.0 with Monacopilot AI completion
- **Database:** PostgreSQL 16 + pgvector (HNSW indexes)
- **AI:** OpenAI, Anthropic, Gemini, Groq, DeepSeek
- **Infra:** Kubernetes (AKS), Docker, Helm
- **Monitoring:** Datadog (APM, DBM, RUM, Logs)

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

## Features

- **Cmd+K Inline Edit** - Natural language code transformations
- **Codebase Chat** - Ask questions about your code (vector search)
- **AI Completion** - Multi-provider support (OpenAI/Anthropic/etc)
- **7-Step Onboarding** - Theme, workspace, extensions, integrations
- **53+ Extensions** - Continue, Codeium, Cline, Aider, Prettier, ESLint, etc
- **MCP Server** - Model Context Protocol for Windsurf/Claude Desktop
- **Vector Search** - Semantic code search with pgvector + HNSW

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

## Code-Server Extensions

Custom Docker image with official AI extensions and OAuth support:

**AI Assistants (9):**
- Anthropic Claude Code (official)
- OpenAI ChatGPT (official Codex)
- GitHub Copilot + Chat
- Codeium, Cline
- VibeCode AI Assistant, Inline Edit, Codebase Chat

**Features:**
- OAuth authentication (port 46203)
- Port 8765 (VibeCode's unique port)
- Multi-architecture (ARM64 + AMD64)
- Trusted domains pre-configured
- No API keys in image (runtime config)

**Productivity (20+):**
- Prettier, ESLint, Git Graph, Jest, Datadog, etc.

See [docker/code-server/README.md](docker/code-server/README.md) for full list.

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

# VibeCode Code-Server Profiles

## Overview

VibeCode Code-Server is available in multiple profiles optimized for different use cases. All profiles are available on both **GitHub Container Registry (GHCR)** and **Docker Hub**.

## Available Profiles

### 🎯 **Minimal** (~400MB)
**Best for**: Quick testing, CI/CD, resource-constrained environments

**Extensions (5)**:
- Anthropic Claude Code
- Codeium
- Python
- ESLint
- Prettier

**Pull**:
```bash
docker pull ryanmaclean/vibecode-codeserver:minimal
# or
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:minimal
```

---

### ⭐ **Standard** (~700MB) - **RECOMMENDED**
**Best for**: Most users, balanced features and size

**Extensions (12)**:
- **AI (4)**: Claude, Codeium, Continue, Roo Code
- **Languages (3)**: Python, TypeScript, Clangd
- **Tools (5)**: ESLint, Prettier, Git Graph, Material Icons, Error Lens

**Pull**:
```bash
docker pull ryanmaclean/vibecode-codeserver:standard
# or
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:standard
```

---

### 🤖 **AI** (~900MB)
**Best for**: AI-focused development, testing multiple AI assistants

**Extensions (15)**:
- **AI (10)**: Claude, OpenAI, Codeium, Cline, Kilo Code, Roo Code, Rubberduck, Continue, Supermaven, TabNine
- **Languages (2)**: Python, TypeScript
- **Tools (3)**: ESLint, Prettier, Material Icons

**Pull**:
```bash
docker pull ryanmaclean/vibecode-codeserver:ai
# or
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:ai
```

---

### 🌐 **Web** (~600MB)
**Best for**: Web development (React, Next.js, etc.)

**Extensions (14)**:
- **AI (3)**: Claude, Codeium, Continue
- **Web (4)**: TypeScript, Tailwind CSS, REST Client, DotENV
- **Tools (7)**: ESLint, Prettier, Git Graph, Material Icons, Error Lens, YAML, Markdown

**Pull**:
```bash
docker pull ryanmaclean/vibecode-codeserver:web
# or
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:web
```

---

### 🚀 **Full** (~1.2GB)
**Best for**: Power users, all features

**Extensions (26)**:
- **AI (11)**: All AI assistants
- **Languages (4)**: Python, Python Debugger, TypeScript, Clangd
- **Tools (11)**: All development tools

**Pull**:
```bash
docker pull ryanmaclean/vibecode-codeserver:latest
# or
docker pull ryanmaclean/vibecode-codeserver:full
# or
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:latest
```

---

## Version Tags

Each profile is available with version tags:

```bash
# Specific version
docker pull ryanmaclean/vibecode-codeserver:1.0.0-minimal
docker pull ryanmaclean/vibecode-codeserver:1.0.0-standard
docker pull ryanmaclean/vibecode-codeserver:1.0.0-ai
docker pull ryanmaclean/vibecode-codeserver:1.0.0-web
docker pull ryanmaclean/vibecode-codeserver:1.0.0

# Latest (rolling)
docker pull ryanmaclean/vibecode-codeserver:minimal
docker pull ryanmaclean/vibecode-codeserver:standard
docker pull ryanmaclean/vibecode-codeserver:ai
docker pull ryanmaclean/vibecode-codeserver:web
docker pull ryanmaclean/vibecode-codeserver:latest
```

## Quick Start

### Run Minimal Profile
```bash
docker run -d \
  --name vibecode \
  -p 8765:8765 \
  -e PASSWORD=your-password \
  -v $(pwd)/workspace:/home/coder/workspace \
  ryanmaclean/vibecode-codeserver:minimal
```

### Run Standard Profile (Recommended)
```bash
docker run -d \
  --name vibecode \
  -p 8765:8765 \
  -e PASSWORD=your-password \
  -v $(pwd)/workspace:/home/coder/workspace \
  ryanmaclean/vibecode-codeserver:standard
```

### Run AI Profile
```bash
docker run -d \
  --name vibecode \
  -p 8765:8765 \
  -e PASSWORD=your-password \
  -v $(pwd)/workspace:/home/coder/workspace \
  ryanmaclean/vibecode-codeserver:ai
```

## Comparison Table

| Profile | Size | Extensions | AI Assistants | Use Case |
|---------|------|------------|---------------|----------|
| **Minimal** | ~400MB | 5 | 2 | Testing, CI/CD |
| **Standard** ⭐ | ~700MB | 12 | 4 | General dev |
| **AI** | ~900MB | 15 | 10 | AI development |
| **Web** | ~600MB | 14 | 3 | Web development |
| **Full** | ~1.2GB | 26 | 11 | Power users |

## Building Profiles

To build a specific profile:

```bash
./scripts/build-profiles.sh 1.0.0 standard
```

To build all profiles:

```bash
./scripts/build-profiles.sh 1.0.0 all
```

## Registry Information

### Docker Hub
- **URL**: https://hub.docker.com/r/ryanmaclean/vibecode-codeserver
- **Pull**: `docker pull ryanmaclean/vibecode-codeserver:TAG`

### GitHub Container Registry (GHCR)
- **URL**: https://ghcr.io/ryanmaclean/vibecode-codeserver
- **Pull**: `docker pull ghcr.io/ryanmaclean/vibecode-codeserver:TAG`

## Customization

To add your own extensions to a profile, edit the profile files in `docker/code-server/profiles/`:

- `minimal.txt`
- `standard.txt`
- `ai.txt`
- `web.txt`
- `full.txt`

Then rebuild:

```bash
./scripts/build-profiles.sh 1.0.0 your-profile
```

## License

All extensions are from Open VSX Registry and are legally redistributable. See [DEPLOYMENT_REPORT.md](./DEPLOYMENT_REPORT.md) for details.

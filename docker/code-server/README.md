# VibeCode Custom Code-Server

This directory contains the configuration for the custom VibeCode code-server, which includes pre-installed extensions and configurations for an optimal development experience.

## Pre-installed AI Extensions

This image comes with **18 AI coding assistants** pre-installed (all from Open VSX Registry):

### Official AI Providers (4)
1. **Anthropic Claude Code** - Official Claude AI assistant
2. **OpenAI ChatGPT** - Official ChatGPT/Codex integration
3. **Mistral AI** - Official Mistral AI extension (if available)
4. **TabNine** - AI code completion

### Open-Source AI Assistants (7)
1. **Codeium** - Free AI code completion
2. **Cline** (Claude Dev) - Advanced Claude integration
3. **Kilo Code** - Open-source AI agent (Cline/Roo fork)
4. **Roo Code** - AI coding assistant (Cline fork)
5. **Rubberduck** - Free open-source AI assistant
6. **Continue** - Open-source AI autopilot
7. **Supermaven** - Fast AI autocomplete (1M token context)

### Language Support (4)
1. **Microsoft Python** - Python extension with AI features (MIT)
2. **Clangd** - C/C++ language server

### VibeCode Custom Extensions (3)
1. **VibeCode AI Assistant** - Custom VibeCode features
2. **VibeCode Inline Edit** - In-editor AI editing
3. **VibeCode Codebase Chat** - Chat with your codebase

**Note:** Official AI extensions require API keys or subscriptions. Configure them after first launch.

### Extensions Available for Manual Installation

The following extensions are NOT available on Open VSX and must be installed manually if you have access to the Microsoft Marketplace:

- **GitHub Copilot** - Requires Microsoft Marketplace + paid GitHub subscription
- **Microsoft Pylance** - Advanced Python type checking (Microsoft Marketplace only)
- **Microsoft IntelliCode** - AI-assisted development (Microsoft Marketplace only)
- **Amazon Q Developer** - AWS AI assistant (AWS Marketplace only)
- **Google Cloud Code** - Google Cloud AI features (Google Marketplace only)
- **Azure AI Toolkit** - Azure AI integration (Microsoft Marketplace only)

To install these, you'll need to configure code-server to use the Microsoft Marketplace or install them manually via VSIX files.

### Developer Productivity Tools (MIT/BSD/Apache)
- **Error Lens** - Inline error highlighting
- **Code Spell Checker** - Catch typos
- **TODO Highlight** - Track TODOs
- **TODO Tree** - TODO management
- **Material Icon Theme** - Beautiful icons
- **Indent Rainbow** - Visual indentation
- **Path Intellisense** - Auto-complete paths

### Code Quality & Formatting (MIT)
- **Prettier** - Code formatter
- **Better Comments** - Enhanced comment highlighting
- **Auto Rename Tag** - HTML/XML tag renaming
- **Auto Close Tag** - Auto close HTML tags

### Git Tools (MIT)
- **Git Graph** - Visual git history
- **Git History** - View git log
- **Conventional Commits** - Commit message helper

### Testing & Debugging (MIT)
- **Jest** - Jest test runner
- **Test Explorer UI** - Unified test interface
- **Coverage Gutters** - Display test coverage

### Project Management (MIT)
- **Project Manager** - Manage multiple projects
- **Bookmarks** - Mark lines and jump
- **Live Server** - Local dev server with live reload
- **Import Cost** - Display import sizes

### Additional Language Support (MIT/Apache)
- **YAML** - YAML language support
- **Tailwind CSS IntelliSense** - Tailwind autocomplete

### Utilities (MIT)
- **DotENV** - .env file support
- **EditorConfig** - EditorConfig support
- **Peacock** - Color workspace

### Datadog Integration (Apache 2.0)
- **Datadog for VS Code** - Official Datadog extension
  - Log annotations
  - Code insights
  - Exception replay
  - Static code analysis
  - View in IDE integration
  - MCP server support

### Database Tools (MIT/Apache)
- **SQLTools** - Database management
- **SQLTools PostgreSQL Driver** - pgvector support

### DevOps Tools (Microsoft MIT)
- **Docker** - Container management
- **Kubernetes** - K8s integration
- **REST Client** - API testing (MIT)

### Language Support
- Python (with Pylance and Black formatter)
- TypeScript/JavaScript (with ESLint)
- Go, Rust, Java, C/C++, Bash
- Markdown with linting

### Other Features
- Custom keybindings and settings
- Optimized for Kubernetes deployment
- Secure defaults with non-root user
- Pre-configured LSP servers for all major languages
- Bash, Zsh, and Fish shells pre-installed in the container
- **Trusted domains pre-configured** - No annoying prompts for extension URLs (see [TRUSTED_DOMAINS.md](TRUSTED_DOMAINS.md))
- CLI essentials pre-installed: `eza`, `ripgrep`, `fd`, `fzf`, `bat`, `hyperfine`, `lazygit`, `starship`, `zoxide`

### Kubernetes Tooling Notes

- `kubectl`, `helm`, `kubectx`, and `kubens` are available out of the box.
- Bash, Zsh, and Fish completion scripts for both `kubectl` and `helm` are pre-generated under `/etc/bash_completion.d`, `/usr/share/zsh/site-functions`, and `/etc/fish/completions` respectively.
- All of these tools operate on the active kubeconfig (default: `/home/coder/.kube/config`). No clusters or credentials ship with the container, so `kubectx`/`kubens` will report "no contexts" until you mount or create a kubeconfig with at least one context/namespace. Mount `~/.kube/config`, set `KUBECONFIG`, or copy a context into the workspace before relying on the tooling.

## Building the Image

### Multi-Architecture Build (Recommended)

Build for both ARM64 and AMD64 architectures:

```bash
# Build both architectures locally
./scripts/build-codeserver-multiarch.sh local

# Build and push multi-arch manifest to registry
./scripts/build-codeserver-multiarch.sh push docker.io/youruser

# Export to tarballs for offline distribution
./scripts/build-codeserver-multiarch.sh export ./dist
```

### Single Architecture Build

For local development on your current platform:

```bash
docker build -f docker/code-server/Dockerfile -t vibecode-codeserver:latest .
```

### Security Note

⚠️ **Never include API keys in the Docker image!**

The Dockerfile is configured to skip Datadog Agent installation during build. Configure secrets at runtime:

```bash
docker run -p 8765:8765 \
  -e DD_API_KEY=your_key_here \
  -e PASSWORD=secure_password \
  vibecode-codeserver:latest
```

## Configuring AI API Keys

Provide AI provider credentials via environment variables when you start the container. The extensions check for the following keys:

- `OPENAI_API_KEY` — OpenAI ChatGPT extension and VibeCode inline edits
- `ANTHROPIC_API_KEY` or `CLAUDE_CODE_API_KEY` — Claude Code extension and Claude CLI utilities
- `OPENROUTER_API_KEY` — VibeCode AI Assistant router (OpenRouter-backed models)
- `CODEIUM_API_KEY` (optional) — Team or enterprise Codeium deployments
- `DD_API_KEY`, `DD_SITE`, and optionally `DD_APP_KEY` — Datadog metrics/traces from the IDE

Set only the variables you need; each extension disables itself gracefully when a key is missing.

### Docker Example

```bash
docker run -p 8765:8765 \
  -e PASSWORD=secure_password \
  -e OPENAI_API_KEY=$(op read op://ai/openai/api_key) \
  -e ANTHROPIC_API_KEY=$(op read op://ai/anthropic/api_key) \
  -e OPENROUTER_API_KEY=$(op read op://ai/openrouter/api_key) \
  vibecode-codeserver:latest
```

### Compose / Kubernetes

1. Create a secret that stores the keys, for example in Kubernetes:

   ```bash
   kubectl create secret generic vibecode-codeserver-ai \
     --from-literal=OPENAI_API_KEY=sk-live-*** \
     --from-literal=ANTHROPIC_API_KEY=sk-ant-*** \
     --from-literal=OPENROUTER_API_KEY=or-*** \
     -n vibecode-platform
   ```

2. Reference the secret under the deployment `envFrom`/`env` block (see `k8s/code-server-custom.yaml`). For Docker Compose or NAS stacks, place the real values in a `.env` file and add that file to your secret management tooling instead of committing it to git.

## Kubernetes Deployment

Deploy the custom code-server to your Kubernetes cluster:

```bash
kubectl apply -f k8s/code-server-custom.yaml
```

## Customization

### Adding Extensions

To add more VS Code extensions, update the `Dockerfile` and add them to the list of extensions in the `RUN code-server --install-extension` commands.

### Updating Settings

- `settings.json`: VS Code user settings
- `keybindings.json`: Custom keyboard shortcuts

## Development Workflow

1. Make changes to the Dockerfile or configuration files
2. Build and test locally:
   ```bash
   docker build -t vibecode/code-server:local -f docker/code-server/Dockerfile .
   docker run -p 8765:8765 -v $(pwd):/home/coder/workspace vibecode/code-server:local
   ```
3. Push changes to the repository
4. The CI/CD pipeline will automatically build and deploy the new image

## Security Considerations

- Runs as non-root user
- Uses secure defaults
- Includes only necessary dependencies
- Regular security updates from the base image

## Troubleshooting

### Build Issues

- Ensure Docker is running
- Check for sufficient disk space
- Verify network connectivity to container registries

### Runtime Issues

- Check container logs: `kubectl logs -n vibecode-platform -l app=vibecode-code-server`
- Verify resources are available in the cluster
- Check network policies if having connectivity issues

## License

This project is part of VibeCode and is licensed under the terms of the VibeCode License.

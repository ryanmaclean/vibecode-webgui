# VibeCode Custom Code-Server

This directory contains the configuration for the custom VibeCode code-server, which includes pre-installed extensions and configurations for an optimal development experience.

## Features

### AI Coding Assistants (MIT/Apache Licensed)
- **Continue** - Open-source autopilot (Apache 2.0)
- **Codeium** - Free AI code completion (MIT)
- **VibeCode AI Assistant** - Custom AI integration (MIT)

### Developer Productivity Tools (MIT/BSD/Apache)
- **Error Lens** - Inline error highlighting
- **Code Spell Checker** - Catch typos
- **TODO Highlight** - Track TODOs
- **TODO Tree** - TODO management
- **Material Icon Theme** - Beautiful icons
- **Indent Rainbow** - Visual indentation
- **Path Intellisense** - Auto-complete paths

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

## Building the Image

To build the custom code-server image locally:

```bash
# Make the build script executable
chmod +x ../../scripts/build-code-server.sh

# Build the image
./scripts/build-code-server.sh

# To build and push to a container registry:
# ./scripts/build-code-server.sh --push
```

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
   docker run -p 8080:8080 -v $(pwd):/home/coder/workspace vibecode/code-server:local
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

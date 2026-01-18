# VibeCode Custom Code-Server

This directory contains the configuration for the custom VibeCode code-server, which includes pre-installed extensions and configurations for an optimal development experience.

## Features

- Pre-installed VS Code extensions for web development
- Custom keybindings and settings
- Integration with VibeCode AI Assistant
- Optimized for Kubernetes deployment
- Secure defaults with non-root user

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

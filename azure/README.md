# OpenVSCode Server with Datadog and MCP Services

Production-ready Docker container running OpenVSCode Server 1.95.3 with Datadog monitoring and Model Context Protocol (MCP) servers.

## Features

- **OpenVSCode Server 1.95.3**: Web-based VS Code accessible via browser
- **Datadog Agent**: Full monitoring and observability stack
- **MCP Servers**: Support for Model Context Protocol services
- **Alpine Linux 3.19**: Minimal footprint (target < 500MB)
- **Multi-stage Build**: Optimized for production
- **Non-root User**: Security-hardened (UID 1000)
- **Health Checks**: Built-in container health monitoring
- **Signal Handling**: Proper graceful shutdown with tini

## Quick Start

### 1. Build the Image

```bash
cd azure
docker build -t vibecode/openvscode-server:1.95.3 -f Dockerfile .
```

### 2. Run with Docker Compose

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your Datadog API key (optional)
nano .env

# Start the container
docker-compose up -d

# View logs
docker-compose logs -f
```

### 3. Access OpenVSCode Server

Open your browser and navigate to:
```
http://localhost:3000
```

## Manual Docker Run

```bash
docker run -d \
  --name vibecode-openvscode \
  -p 3000:3000 \
  -e DATADOG_API_KEY=your_api_key_here \
  -v $(pwd)/workspace:/workspace \
  -v vscode-extensions:/home/openvscode/.openvscode-server \
  vibecode/openvscode-server:1.95.3
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VSCODE_PORT` | `3000` | Port for OpenVSCode Server |
| `VSCODE_HOST` | `0.0.0.0` | Host binding address |
| `WORKSPACE_DIR` | `/workspace` | Workspace directory path |
| `NODE_ENV` | `production` | Node.js environment |
| `DATADOG_API_KEY` | - | Datadog API key (optional) |
| `DATADOG_SITE` | `datadoghq.com` | Datadog site URL |
| `TZ` | `UTC` | Container timezone |

### Volumes

| Mount Point | Purpose |
|-------------|---------|
| `/workspace` | Your code workspace |
| `/home/openvscode/.openvscode-server` | Extensions and settings |
| `/opt/mcp-servers` | MCP server scripts |

## MCP Servers

Add custom MCP servers by placing executable scripts in the `mcp-servers/` directory:

```bash
# Create a custom MCP server
cat > azure/mcp-servers/my-server.sh << 'EOF'
#!/bin/bash
echo "Starting My MCP Server on port 8080"
# Your MCP server logic here
node /path/to/mcp-server.js
EOF

chmod +x azure/mcp-servers/my-server.sh
```

All `.sh` files in `/opt/mcp-servers/` will be automatically started on container launch.

## Datadog Integration

### Enable Datadog Monitoring

1. Get your API key from [Datadog](https://app.datadoghq.com/organization-settings/api-keys)
2. Set the `DATADOG_API_KEY` environment variable
3. The agent will automatically start and begin collecting metrics

### Datadog Features

- **Metrics**: System and application metrics
- **Logs**: Container and application logs
- **APM**: Application performance monitoring
- **DogStatsD**: Custom metrics

## Testing

### Build Test

```bash
# Build the image
docker build -t vibecode/openvscode-server:1.95.3 -f azure/Dockerfile azure/

# Check image size
docker images vibecode/openvscode-server:1.95.3
```

### Functionality Test

```bash
# Start container
docker-compose up -d

# Wait for startup
sleep 30

# Test health endpoint
curl -f http://localhost:3000/healthz || echo "Health check failed"

# Test main interface
curl -I http://localhost:3000 | head -1

# View logs
docker-compose logs

# Stop container
docker-compose down
```

### Automated Test Script

```bash
# Run the included test script
bash azure/test-container.sh
```

## Architecture

### Directory Structure

```
/opt/openvscode-server/    # OpenVSCode Server installation
/opt/datadog-agent/        # Datadog agent binary
/opt/mcp-servers/          # MCP server scripts
/opt/startup.sh            # Container startup script
/workspace/                # Default workspace
/home/openvscode/          # User home directory
```

### Startup Sequence

1. **Datadog Agent**: Starts if `DATADOG_API_KEY` is set
2. **MCP Servers**: All executable `.sh` files in `/opt/mcp-servers/`
3. **OpenVSCode Server**: Main VS Code server on port 3000

### Process Tree

```
tini (PID 1)
└── startup.sh
    ├── datadog-agent (if enabled)
    ├── mcp-server-1.sh
    ├── mcp-server-2.sh
    └── openvscode-server (foreground)
```

## Security

- **Non-root User**: Runs as `openvscode` (UID 1000)
- **No New Privileges**: Security option enabled
- **Minimal Base**: Alpine Linux reduces attack surface
- **No Connection Token**: Configure authentication externally (e.g., via reverse proxy)

## Production Deployment

### Reverse Proxy (Recommended)

```nginx
# nginx configuration
server {
    listen 443 ssl http2;
    server_name code.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Azure Container Instances

See the included `appservice.bicep` for Azure deployment configuration.

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: openvscode-server
spec:
  replicas: 1
  selector:
    matchLabels:
      app: openvscode
  template:
    metadata:
      labels:
        app: openvscode
    spec:
      containers:
      - name: openvscode
        image: vibecode/openvscode-server:1.95.3
        ports:
        - containerPort: 3000
        env:
        - name: DATADOG_API_KEY
          valueFrom:
            secretKeyRef:
              name: datadog-secret
              key: api-key
        volumeMounts:
        - name: workspace
          mountPath: /workspace
        resources:
          limits:
            cpu: "2"
            memory: "2Gi"
          requests:
            cpu: "500m"
            memory: "512Mi"
      volumes:
      - name: workspace
        persistentVolumeClaim:
          claimName: workspace-pvc
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs -f

# Check if port 3000 is already in use
lsof -i :3000

# Inspect container
docker inspect vibecode-openvscode
```

### OpenVSCode Server Not Responding

```bash
# Check health status
docker ps --format "table {{.Names}}\t{{.Status}}"

# Test health endpoint
docker exec vibecode-openvscode wget -qO- http://localhost:3000/healthz

# Check processes inside container
docker exec vibecode-openvscode ps aux
```

### Datadog Agent Issues

```bash
# Check if API key is set
docker exec vibecode-openvscode env | grep DATADOG

# Check Datadog logs
docker exec vibecode-openvscode cat /var/log/datadog/agent.log

# Test Datadog connectivity
docker exec vibecode-openvscode curl -v https://api.datadoghq.com
```

### High Memory Usage

```bash
# Check container stats
docker stats vibecode-openvscode

# Adjust memory limits in docker-compose.yml
# deploy.resources.limits.memory: "2G"
```

## Customization

### Pre-install VS Code Extensions

Add to Dockerfile before the final stage:

```dockerfile
# Install extensions
USER openvscode
RUN /opt/openvscode-server/bin/openvscode-server \
    --install-extension dbaeumer.vscode-eslint \
    --install-extension esbenp.prettier-vscode \
    --install-extension ms-python.python
```

### Custom Startup Logic

Edit `/opt/startup.sh` or mount a custom script:

```bash
docker run -v $(pwd)/custom-startup.sh:/opt/startup.sh vibecode/openvscode-server:1.95.3
```

## Performance Tuning

### Resource Limits

Adjust in `docker-compose.yml`:

```yaml
deploy:
  resources:
    limits:
      cpus: '4'      # Increase for better performance
      memory: 4G     # Increase for large projects
```

### Node.js Options

```bash
docker run -e NODE_OPTIONS="--max-old-space-size=4096" vibecode/openvscode-server:1.95.3
```

## Maintenance

### Update OpenVSCode Server

1. Change version in Dockerfile
2. Rebuild image
3. Test in staging
4. Deploy to production

### Backup

```bash
# Backup workspace
docker run --rm -v workspace:/data -v $(pwd):/backup alpine tar czf /backup/workspace-backup.tar.gz /data

# Backup extensions
docker run --rm -v vscode-extensions:/data -v $(pwd):/backup alpine tar czf /backup/extensions-backup.tar.gz /data
```

## License

This Dockerfile configuration is part of the VibeCode project.
OpenVSCode Server is licensed under MIT License.

## Support

For issues and questions:
- GitHub Issues: [Your repository]
- Documentation: [Your docs]
- Slack: [Your Slack channel]

---

**Built with** Alpine Linux, OpenVSCode Server, Datadog, and Node.js

# Zen MCP Server - VSCodium Web Apps Configuration

Integration guide for using Zen MCP Server with web-based VSCodium instances and browser-based code editors.

## Supported Platforms

- **code-server** - VSCode in the browser
- **OpenVSCode Server** - Open source web-based VSCode
- **Gitpod** - Cloud development environments
- **GitHub Codespaces** - GitHub's cloud IDE
- **StackBlitz** - Instant dev environments
- **CodeSandbox** - Online code editor

## Architecture

Web-based MCP servers require a backend proxy since browsers cannot directly spawn processes. This example shows how to configure MCP servers in a web environment.

## Installation Methods

### Method 1: Server-Side MCP (Recommended)

Run MCP servers on the backend where code-server is hosted.

#### 1. Configure MCP on Server

Create `/etc/code-server/mcp.json` or `~/.config/code-server/mcp.json`:

```json
{
  "mcpServers": {
    "zen": {
      "command": "npx",
      "args": ["-y", "@beehiveinnovations/zen-mcp-server"],
      "env": {
        "NODE_ENV": "production"
      }
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    }
  }
}
```

#### 2. Configure code-server

Edit `~/.config/code-server/config.yaml`:

```yaml
bind-addr: 0.0.0.0:8080
auth: password
password: your-secure-password
cert: false
mcp-config: /etc/code-server/mcp.json
```

#### 3. Restart code-server

```bash
sudo systemctl restart code-server
# or
code-server --config ~/.config/code-server/config.yaml
```

### Method 2: MCP Proxy Service

For environments without direct server access, use an MCP proxy.

#### 1. Deploy MCP Proxy

```javascript
// mcp-proxy-server.js
const express = require('express');
const { spawn } = require('child_process');
const app = express();

app.post('/mcp/:server', async (req, res) => {
  const serverName = req.params.server;
  const command = req.body.command;
  
  // Validate and spawn MCP server
  const mcpServers = {
    zen: {
      command: 'npx',
      args: ['-y', '@beehiveinnovations/zen-mcp-server']
    }
  };
  
  const server = mcpServers[serverName];
  if (!server) {
    return res.status(404).json({ error: 'Server not found' });
  }
  
  const proc = spawn(server.command, server.args);
  // Handle communication...
});

app.listen(3001, () => {
  console.log('MCP Proxy running on port 3001');
});
```

#### 2. Configure Web Client

```json
{
  "mcp.proxy": "http://localhost:3001",
  "mcp.servers": {
    "zen": {
      "type": "proxy",
      "endpoint": "/mcp/zen"
    }
  }
}
```

### Method 3: Docker Container with MCP

Use Docker to bundle code-server with MCP servers.

#### Dockerfile

```dockerfile
FROM codercom/code-server:latest

# Install Node.js and npm
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
RUN apt-get install -y nodejs

# Pre-install MCP servers
RUN npm install -g @beehiveinnovations/zen-mcp-server
RUN npm install -g @modelcontextprotocol/server-sequential-thinking

# Copy MCP configuration
COPY mcp.json /home/coder/.config/code-server/mcp.json

# Expose port
EXPOSE 8080

# Start code-server with MCP support
CMD ["code-server", "--bind-addr", "0.0.0.0:8080", "--auth", "none"]
```

#### docker-compose.yml

```yaml
version: '3.8'
services:
  code-server:
    build: .
    ports:
      - "8080:8080"
    volumes:
      - ./workspace:/home/coder/workspace
      - ./mcp.json:/home/coder/.config/code-server/mcp.json
    environment:
      - NODE_ENV=production
      - DD_AGENT_HOST=datadog-agent
      - DD_TRACE_AGENT_PORT=8126
```

## Usage in Web Environment

### Browser-Based Chat

Once configured, use the AI chat panel in your web IDE:

```
@zen start focus --duration 25m
```

```
@zen schedule break --in 45m
```

```
@zen stats today
```

### Sample Workflows

#### 1. Remote Development Session

```
@zen start remote-work --duration 120m

Help me set up this development environment and implement the authentication module.
```

#### 2. Pair Programming

```
@zen start pair-programming --duration 60m

Let's review this pull request together and suggest improvements.
```

#### 3. Code Review Session

```
@zen mindful-review --file src/api/routes.ts

Perform a thorough security and quality review of this API code.
```

## Configuration Examples

### Basic Web Configuration

```json
{
  "mcpServers": {
    "zen": {
      "command": "npx",
      "args": ["-y", "@beehiveinnovations/zen-mcp-server"]
    }
  }
}
```

### With Datadog Tracing

```json
{
  "mcpServers": {
    "zen": {
      "command": "npx",
      "args": ["-y", "@beehiveinnovations/zen-mcp-server"],
      "env": {
        "DD_AGENT_HOST": "datadog-agent",
        "DD_TRACE_AGENT_PORT": "8126",
        "DD_ENV": "production",
        "DD_SERVICE": "mcp-zen-web",
        "DD_VERSION": "1.0.0"
      }
    }
  }
}
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: code-server-with-mcp
spec:
  replicas: 1
  selector:
    matchLabels:
      app: code-server
  template:
    metadata:
      labels:
        app: code-server
    spec:
      containers:
      - name: code-server
        image: your-registry/code-server-mcp:latest
        ports:
        - containerPort: 8080
        env:
        - name: NODE_ENV
          value: "production"
        - name: DD_AGENT_HOST
          value: "datadog-agent.monitoring.svc.cluster.local"
        - name: DD_TRACE_AGENT_PORT
          value: "8126"
        volumeMounts:
        - name: mcp-config
          mountPath: /home/coder/.config/code-server/mcp.json
          subPath: mcp.json
      volumes:
      - name: mcp-config
        configMap:
          name: mcp-config
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: mcp-config
data:
  mcp.json: |
    {
      "mcpServers": {
        "zen": {
          "command": "npx",
          "args": ["-y", "@beehiveinnovations/zen-mcp-server"]
        }
      }
    }
```

## Security Considerations

### Authentication

Always use authentication for web-based code-server:

```yaml
# config.yaml
auth: password
password: ${CODE_SERVER_PASSWORD}
# or
auth: github
```

### Network Security

```yaml
# Use TLS/SSL
cert: /path/to/cert.pem
cert-key: /path/to/key.pem

# Restrict access
bind-addr: 127.0.0.1:8080  # localhost only
# or use reverse proxy with authentication
```

### MCP Server Sandboxing

```json
{
  "mcpServers": {
    "zen": {
      "command": "npx",
      "args": ["-y", "@beehiveinnovations/zen-mcp-server"],
      "sandbox": {
        "enabled": true,
        "allowedCommands": ["zen"],
        "maxMemory": "256MB",
        "timeout": 30000
      }
    }
  }
}
```

## Troubleshooting

### MCP Server Not Starting

Check server logs:
```bash
journalctl -u code-server -f
# or
docker logs code-server-container
```

### Permission Issues

Ensure the code-server user can execute npx:
```bash
sudo -u coder npx -y @beehiveinnovations/zen-mcp-server --version
```

### Network Connectivity

Test MCP proxy endpoint:
```bash
curl -X POST http://localhost:3001/mcp/zen \
  -H "Content-Type: application/json" \
  -d '{"command": "status"}'
```

### Browser Console Errors

Open browser DevTools (F12) and check:
- Console tab for JavaScript errors
- Network tab for failed requests
- Application tab for service worker issues

## Performance Optimization

### Caching MCP Servers

Pre-install MCP servers in Docker image:
```dockerfile
RUN npm install -g @beehiveinnovations/zen-mcp-server
RUN npm install -g @modelcontextprotocol/server-sequential-thinking
```

### Resource Limits

```yaml
# docker-compose.yml
services:
  code-server:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
```

### Connection Pooling

For high-traffic environments, use connection pooling:
```javascript
// mcp-proxy with connection pool
const mcpPool = new Map();

app.post('/mcp/:server', async (req, res) => {
  const serverName = req.params.server;
  
  if (!mcpPool.has(serverName)) {
    mcpPool.set(serverName, createMCPConnection(serverName));
  }
  
  const connection = mcpPool.get(serverName);
  // Use pooled connection...
});
```

## Resources

- [code-server Documentation](https://coder.com/docs/code-server)
- [OpenVSCode Server](https://github.com/gitpod-io/openvscode-server)
- [Zen MCP Server](https://github.com/BeehiveInnovations/zen-mcp-server)
- [Docker Configuration Examples](./docker/)
- [Kubernetes Manifests](./kubernetes/)

## Example Files

- [Dockerfile](./docker/Dockerfile)
- [docker-compose.yml](./docker/docker-compose.yml)
- [kubernetes-deployment.yaml](./kubernetes/deployment.yaml)
- [mcp-proxy-server.js](./proxy/mcp-proxy-server.js)

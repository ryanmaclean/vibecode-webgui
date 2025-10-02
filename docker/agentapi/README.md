# AgentAPI Container

HTTP API server for controlling terminal-based AI coding agents (Aider, Goose, Cline).

## Overview

AgentAPI provides a RESTful HTTP interface to programmatically control AI coding agents that normally run in terminals. It enables:

- Starting agents with specific tasks and files
- Streaming agent output in real-time
- Stopping and managing agent lifecycle
- Monitoring agent health and metrics

## Supported Agents

- **Aider** - AI pair programming with Git integration
- **Goose** - Block's extensible AI agent with MCP support
- **Cline** - Terminal-based coding assistant

## Quick Start

### Build Image

```bash
docker build -t vibecode-agentapi:latest .
```

### Run Standalone

```bash
docker run -d \
  --name agentapi \
  -p 3284:3284 \
  -v $(pwd)/workspace:/home/coder/workspace \
  -e AGENTAPI_HOST=0.0.0.0 \
  -e AGENTAPI_PORT=3284 \
  vibecode-agentapi:latest
```

### Run with Docker Compose

```bash
docker-compose -f ../docker-compose.agentapi.yml up -d
```

## API Endpoints

### Health Check

```bash
curl http://localhost:3284/health
```

### List Agents

```bash
curl http://localhost:3284/v1/agents
```

### Start Agent

```bash
curl -X POST http://localhost:3284/v1/agents/start \
  -H "Content-Type: application/json" \
  -d '{
    "agent_type": "aider",
    "workspace": "/home/coder/workspace/my-project",
    "files": ["src/main.py"],
    "model": "claude-3-5-sonnet",
    "task": "Add error handling to the login function"
  }'
```

### Get Agent Status

```bash
curl http://localhost:3284/v1/agents/{agent_id}/status
```

### Stream Agent Output

```bash
curl -N http://localhost:3284/v1/agents/{agent_id}/stream
```

### Stop Agent

```bash
curl -X POST http://localhost:3284/v1/agents/{agent_id}/stop
```

### Prometheus Metrics

```bash
curl http://localhost:3284/metrics
```

## Configuration

### Environment Variables

- `AGENTAPI_HOST` - Host to bind to (default: 0.0.0.0)
- `AGENTAPI_PORT` - Port to bind to (default: 3284)
- `AGENTAPI_TERMINAL_DIR` - Terminal directory path (default: /tmp/terminals)
- `AGENTAPI_MAX_CONCURRENT_AGENTS` - Max concurrent agents (default: 5)
- `AGENTAPI_AGENT_TIMEOUT` - Agent timeout in seconds (default: 300)
- `AGENTAPI_LOG_LEVEL` - Log level (default: info)
- `AGENTAPI_ALLOWED_ORIGINS` - CORS allowed origins (default: *)

### Config File

Place `config.yaml` at `/home/coder/.agentapi/config.yaml`:

```yaml
host: 0.0.0.0
port: 3284
terminal_dir: /tmp/terminals
max_concurrent_agents: 5
agent_timeout: 300
log_level: info
allowed_origins:
  - http://localhost:8765
```

## Health Monitoring

### Liveness Check

```bash
/home/coder/.agentapi/health-check.sh
```

Checks:
- HTTP server responsiveness
- Terminal directory accessibility
- Agent process count
- Zombie process detection
- Memory and disk usage

### Metrics

Prometheus metrics available at `/metrics`:

- `agentapi_agents_active` - Current active agents
- `agentapi_agents_total` - Total agents started
- `agentapi_agent_failures_total` - Total agent failures
- `agentapi_http_requests_total` - Total HTTP requests
- `agentapi_terminals_active` - Active terminal sessions

## Kubernetes Deployment

See `/k8s/code-server-agentapi.yaml` for full Kubernetes manifest with:

- ConfigMap for configuration
- Deployment with sidecar pattern
- Service for ClusterIP access
- PersistentVolumeClaim for workspace storage

Deploy:

```bash
kubectl apply -f k8s/code-server-agentapi.yaml
```

## Architecture

AgentAPI runs as a sidecar container alongside code-server:

```
┌─────────────────────────────────────┐
│ Pod: vibecode-workspace             │
│                                     │
│  ┌────────────┐  ┌───────────────┐│
│  │ code-server│  │   agentapi    ││
│  │  (IDE)     │  │ (Agent Ctrl)  ││
│  │            │  │               ││
│  │ :8765      │  │ :3284         ││
│  └────────────┘  └───────────────┘│
│         │              │           │
│         └──────┬───────┘           │
│                │                   │
│         /tmp/terminals             │
│         (shared volume)            │
└─────────────────────────────────────┘
```

## Development

### Local Testing

```bash
# Install dependencies
pip install -r requirements.txt

# Run server
python server.py --host 127.0.0.1 --port 3284 --terminal-dir /tmp/terminals
```

### Testing Endpoints

```bash
# Test health
curl http://localhost:3284/health

# Start test agent
curl -X POST http://localhost:3284/v1/agents/start \
  -H "Content-Type: application/json" \
  -d '{"agent_type":"aider","workspace":"/tmp","task":"help"}'

# Check status
curl http://localhost:3284/v1/agents
```

## Security Considerations

- Runs as non-root user (UID 1000)
- Drops all capabilities
- Read-only workspace access (configurable)
- CORS origin restrictions
- Rate limiting recommended for production
- API authentication should be added for external access

## Troubleshooting

### Agent fails to start

Check agent installation:
```bash
docker exec agentapi aider --version
docker exec agentapi goose --version
```

### Health check fails

View logs:
```bash
docker logs agentapi
kubectl logs deployment/code-server-workspace -c agentapi
```

Run health check manually:
```bash
docker exec agentapi /home/coder/.agentapi/health-check.sh
```

### High resource usage

Check active agents:
```bash
curl http://localhost:3284/v1/agents
```

View metrics:
```bash
curl http://localhost:3284/metrics
```

## License

See main repository LICENSE file.

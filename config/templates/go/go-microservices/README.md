# Go Microservices Starter Template

This template provides a production-ready Go microservices application with built-in monitoring, health checks, and Docker support. It demonstrates modern Go development practices and infrastructure patterns for building scalable microservices.

## Features

- **HTTP REST API**: Simple HTTP server using Go's standard `net/http` library
- **Health Checks**: `/health` and `/ready` endpoints for container orchestration
- **Metrics**: Prometheus metrics endpoint for monitoring
- **Structured Logging**: JSON-formatted logs with log levels
- **Docker Support**: Multi-stage Dockerfile for optimized production images
- **Docker Compose**: Complete local development stack with monitoring
- **Graceful Shutdown**: Proper signal handling for clean container restarts
- **Hot Reload**: Air for automatic recompilation during development

## Architecture

The template includes:

1. **Go Service**: Main microservice with RESTful endpoints
2. **Prometheus**: Metrics collection and monitoring
3. **Grafana**: Metrics visualization and dashboards
4. **Redis**: Optional caching layer (commented out by default)
5. **PostgreSQL**: Optional database (commented out by default)

## Prerequisites

- Go 1.21+ (for local development)
- Docker and Docker Compose
- Make (optional, for convenience commands)

## Quick Start

1.  **Clone the repository and navigate to this directory.**

2.  **Configure environment variables:**
    ```bash
    cp .env.example .env
    # Edit .env with your configuration
    ```

3.  **Start the development environment:**
    ```bash
    docker-compose up
    ```

4.  **Access the services:**
    - Application: http://localhost:8080
    - Health check: http://localhost:8080/health
    - Metrics: http://localhost:8080/metrics
    - Prometheus: http://localhost:9090
    - Grafana: http://localhost:3000 (admin/admin)

## Local Development (without Docker)

1.  **Install dependencies:**
    ```bash
    go mod download
    ```

2.  **Run the service:**
    ```bash
    go run main.go
    ```

3.  **Install Air for hot reload (optional):**
    ```bash
    go install github.com/cosmtrek/air@latest
    air
    ```

## API Endpoints

- `GET /` - Welcome message
- `GET /health` - Health check endpoint
- `GET /ready` - Readiness probe
- `GET /metrics` - Prometheus metrics
- `GET /api/v1/status` - Service status information

## Monitoring

### Prometheus Metrics

The service exposes the following metrics:

- `http_requests_total` - Total HTTP requests by method and path
- `http_request_duration_seconds` - HTTP request duration histogram
- `go_*` - Standard Go runtime metrics

### Grafana Dashboards

Access Grafana at http://localhost:3000 (default credentials: admin/admin)

Pre-configured dashboards include:
- Go application metrics
- HTTP request rates and latencies
- Resource utilization

## Production Deployment

1.  **Build the Docker image:**
    ```bash
    docker build -t go-microservice:latest .
    ```

2.  **Run in production mode:**
    ```bash
    docker run -p 8080:8080 \
      -e ENVIRONMENT=production \
      -e LOG_LEVEL=info \
      go-microservice:latest
    ```

3.  **Deploy to Kubernetes:**
    ```bash
    # Add Kubernetes manifests as needed
    kubectl apply -f k8s/
    ```

## Configuration

Environment variables (see `.env.example`):

- `PORT` - HTTP server port (default: 8080)
- `ENVIRONMENT` - Environment name (development/staging/production)
- `LOG_LEVEL` - Logging level (debug/info/warn/error)
- `SERVICE_NAME` - Service identifier for logging
- `SHUTDOWN_TIMEOUT` - Graceful shutdown timeout in seconds

## Testing

```bash
# Run tests
go test ./...

# Run tests with coverage
go test -cover ./...

# Run tests with race detection
go test -race ./...
```

## Best Practices

This template follows Go best practices:

- **Error Handling**: Proper error wrapping and logging
- **Context Usage**: Request context propagation
- **Graceful Shutdown**: Clean resource cleanup
- **Structured Logging**: JSON logs for production
- **Metrics**: Prometheus instrumentation
- **Health Checks**: Kubernetes-compatible probes
- **Security**: No hardcoded credentials, environment-based config

## Project Structure

```
.
├── main.go              # Application entry point
├── go.mod               # Go module definition
├── Dockerfile           # Multi-stage Docker build
├── docker-compose.yml   # Local development stack
├── .env.example         # Environment variables template
└── README.md           # This file
```

## Common Tasks

```bash
# Format code
go fmt ./...

# Run linter
golangci-lint run

# Build binary
go build -o bin/service main.go

# Update dependencies
go get -u ./...
go mod tidy

# View logs
docker-compose logs -f go-service

# Restart service
docker-compose restart go-service
```

## Troubleshooting

**Service won't start:**
- Check if port 8080 is already in use: `lsof -i :8080`
- Verify environment variables in `.env`
- Check logs: `docker-compose logs go-service`

**Can't connect to dependencies:**
- Ensure all services are running: `docker-compose ps`
- Check network connectivity: `docker-compose exec go-service ping redis`

**High memory usage:**
- Adjust `GOMAXPROCS` environment variable
- Review goroutine usage and ensure proper cleanup
- Check for memory leaks using pprof

## License

MIT License - See LICENSE file for details

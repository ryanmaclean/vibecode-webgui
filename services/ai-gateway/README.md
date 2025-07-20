# VibeCode AI Gateway

A production-ready AI gateway service that provides intelligent routing, caching, rate limiting, and cost optimization for multiple AI providers through OpenRouter integration.

## Features

### 🔀 Intelligent Model Routing
- **Multi-Provider Support**: Access 100+ AI models from leading providers
- **Project Generation**: Specialized routing for Lovable/Replit/Bolt.diy-style project creation
- **Automatic Fallback**: Intelligent fallback to healthy models when primary models fail
- **Performance Monitoring**: Real-time tracking of model latency and success rates
- **Cost Optimization**: Smart model recommendations based on cost and performance

### 🚀 Enterprise-Grade Performance
- **Request Caching**: Redis-based response caching for identical requests
- **Rate Limiting**: Configurable rate limiting per user/API key
- **Connection Pooling**: Optimized HTTP connections to external services
- **Streaming Support**: Real-time streaming responses for chat completions

### 📊 Comprehensive Analytics
- **Usage Tracking**: Detailed usage statistics per user, model, and time period
- **Cost Analysis**: Real-time cost tracking and budget management
- **Performance Metrics**: Prometheus-compatible metrics endpoint
- **Health Monitoring**: Comprehensive health checks and service monitoring

### 🔒 Security & Authentication
- **JWT Authentication**: Secure token-based authentication
- **API Key Support**: Alternative API key authentication
- **Role-Based Access**: Granular permissions and role management
- **Request Validation**: Comprehensive input validation and sanitization

## Quick Start

### Prerequisites
- Node.js 18+
- Redis 6+
- OpenRouter API key

### Installation

1. **Clone and setup**
```bash
cd services/ai-gateway
npm install
```

2. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start with Docker Compose**
```bash
docker-compose up -d
```

4. **Or start locally**
```bash
npm run dev
```

The gateway will be available at `http://localhost:3001`

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENROUTER_API_KEY` | OpenRouter API key (required) | - |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `JWT_SECRET` | JWT signing secret (required) | - |
| `RATE_LIMIT_REQUESTS` | Requests per window | `100` |
| `DEFAULT_MODEL` | Default AI model | `anthropic/claude-3-sonnet-20240229` |

See `.env.example` for complete configuration options.

### Authentication

#### API Key Authentication
```bash
curl -H "X-API-Key: your-api-key" \
     http://localhost:3001/api/v1/models
```

#### JWT Authentication
```bash
curl -H "Authorization: Bearer your-jwt-token" \
     http://localhost:3001/api/v1/models
```

## API Reference

### Chat Completions

**POST** `/api/v1/chat/completions`

OpenAI-compatible chat completions with multi-provider support.

```json
{
  "model": "anthropic/claude-3-sonnet-20240229",
  "messages": [
    {"role": "user", "content": "Hello, how are you?"}
  ],
  "max_tokens": 1000,
  "temperature": 0.7
}
```

### Streaming Chat Completions

**POST** `/api/v1/chat/completions/stream`

Real-time streaming responses for chat completions.

### Model Management

**GET** `/api/v1/models`
- List all available models with filters

**GET** `/api/v1/models/{modelId}`
- Get specific model information and metrics

**POST** `/api/v1/models/recommend`
- Get model recommendations based on criteria

### Analytics

**GET** `/api/v1/usage`
- Usage statistics and analytics

**GET** `/api/v1/usage/costs`
- Cost analysis and breakdown

### Health & Monitoring

**GET** `/health`
- Basic health check

**GET** `/health/detailed`
- Detailed health status

**GET** `/metrics`
- Prometheus-compatible metrics

## Model Recommendation

The gateway provides intelligent model recommendations based on:

```json
{
  "task": "code",
  "max_cost": 0.01,
  "min_performance": 0.95,
  "preferred_providers": ["anthropic", "openai"],
  "exclude_models": ["gpt-3.5-turbo"]
}
```

Response includes confidence scores, cost efficiency, and reasoning:

```json
{
  "recommendations": [
    {
      "model": "anthropic/claude-3-sonnet-20240229",
      "reason": "Optimized for code generation, High reliability, Cost-effective",
      "confidence": 0.92,
      "costEfficiency": 0.85,
      "performanceScore": 0.96
    }
  ]
}
```

## Caching Strategy

- **Cache Key**: SHA-256 hash of request parameters + user ID
- **TTL**: Configurable, default 1 hour
- **Storage**: Redis with automatic cleanup
- **Bypass**: Streaming requests always bypass cache

## Rate Limiting

- **Default**: 100 requests per 15 minutes per user
- **Sliding Window**: Time-based sliding window
- **Headers**: Standard rate limit headers in responses
- **Exemptions**: Health checks and metrics endpoints excluded

## Monitoring

### Prometheus Metrics

Available at `/metrics` endpoint:

- `vibecode_ai_gateway_uptime_seconds`
- `vibecode_ai_gateway_memory_usage_bytes`
- `vibecode_ai_gateway_model_latency_ms`
- `vibecode_ai_gateway_model_success_rate`
- `vibecode_ai_gateway_model_requests_total`

### Health Checks

- **Basic**: `/health` - Service availability
- **Detailed**: `/health/detailed` - Component status
- **Readiness**: `/health/ready` - Kubernetes readiness probe
- **Liveness**: `/health/live` - Kubernetes liveness probe

## Performance Optimization

### Caching
- Response caching with Redis
- Intelligent cache invalidation
- Configurable TTL per request type

### Connection Management
- HTTP connection pooling
- Timeout configuration
- Retry logic with exponential backoff

### Model Selection
- Automatic unhealthy model detection
- Intelligent fallback routing
- Performance-based recommendations

## Error Handling

Comprehensive error handling with standardized responses:

```json
{
  "error": "Model not found",
  "code": "MODEL_NOT_FOUND",
  "requestId": "req_123456789",
  "timestamp": "2025-07-11T02:30:00.000Z"
}
```

Error codes include:
- `VALIDATION_ERROR` - Invalid request parameters
- `AUTHENTICATION_ERROR` - Authentication required
- `RATE_LIMIT_EXCEEDED` - Rate limit exceeded
- `MODEL_NOT_FOUND` - Requested model unavailable
- `EXTERNAL_SERVICE_ERROR` - OpenRouter service error

## Development

### Local Development
```bash
npm run dev          # Start with hot reload
npm run build        # Build TypeScript
npm run test         # Run tests
npm run lint         # Run ESLint
```

### Docker Development
```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### Testing
```bash
npm test             # Unit tests
npm run test:watch   # Watch mode
```

## Deployment

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-gateway
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ai-gateway
  template:
    metadata:
      labels:
        app: ai-gateway
    spec:
      containers:
      - name: ai-gateway
        image: vibecode/ai-gateway:latest
        ports:
        - containerPort: 3001
        env:
        - name: OPENROUTER_API_KEY
          valueFrom:
            secretKeyRef:
              name: ai-gateway-secrets
              key: openrouter-api-key
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3001
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3001
```

### Docker Production
```bash
docker build -t vibecode/ai-gateway:latest .
docker run -d \
  --name ai-gateway \
  -p 3001:3001 \
  -e OPENROUTER_API_KEY=your_key \
  vibecode/ai-gateway:latest
```

## Security Considerations

- **Secrets Management**: Use external secret stores in production
- **Network Security**: Deploy behind reverse proxy/load balancer
- **Rate Limiting**: Configure appropriate limits for your use case
- **Monitoring**: Enable request logging and alerting
- **Updates**: Regularly update dependencies and base images

## Troubleshooting

### Common Issues

1. **Redis Connection Issues**
   - Check Redis host and port configuration
   - Verify network connectivity
   - Check Redis authentication if enabled

2. **OpenRouter API Errors**
   - Verify API key is correct and active
   - Check account credits and rate limits
   - Review request parameters

3. **Model Not Found**
   - Refresh model registry: `POST /api/v1/models/refresh`
   - Check model ID spelling and availability

### Logs

```bash
# Docker logs
docker logs ai-gateway

# Local logs
tail -f logs/combined.log
tail -f logs/error.log
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- [GitHub Issues](https://github.com/vibecode/vibecode-webgui/issues)
- [Documentation](https://docs.vibecode.dev)
- [Community Discord](https://discord.gg/vibecode)

---

**Built with ❤️ by the VibeCode Team**

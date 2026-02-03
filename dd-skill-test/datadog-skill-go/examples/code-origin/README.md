# Code Origin Examples

Example configurations for enabling Code Origin in various languages and frameworks.

---

## Quick Start

### 1. Enable Code Origin

**All languages**:
```bash
export DD_CODE_ORIGIN_FOR_SPANS_ENABLED=true
```

### 2. Run Your Application

The tracer will automatically capture file/line/function for service entry spans.

### 3. View in CLI

```bash
dd apm --from 1h --code-origin
```

---

## Examples by Language

### Go (net/http)

**File**: `go-http-server.go`

```go
package main

import (
    "fmt"
    "log"
    "net/http"
    "os"

    httptrace "gopkg.in/DataDog/dd-trace-go.v1/contrib/net/http"
    "gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
)

func main() {
    // Start tracer with Code Origin enabled
    tracer.Start(
        tracer.WithService("go-web-server"),
        tracer.WithEnv(os.Getenv("DD_ENV")),
        tracer.WithCodeOriginForSpans(true), // Enable Code Origin
    )
    defer tracer.Stop()

    // Wrap handlers with tracing middleware
    mux := httptrace.NewServeMux()

    // This handler will have code origin: file=main.go, line=28, func=handleUsers
    mux.HandleFunc("/users", handleUsers)

    // This handler will have code origin: file=main.go, line=35, func=handleOrders
    mux.HandleFunc("/orders", handleOrders)

    log.Println("Server starting on :8080")
    log.Fatal(http.ListenAndServe(":8080", mux))
}

func handleUsers(w http.ResponseWriter, r *http.Request) {
    // Code Origin will point to this line (28)
    span, _ := tracer.StartSpanFromContext(r.Context(), "handle.users")
    defer span.Finish()

    fmt.Fprintf(w, "Users endpoint")
}

func handleOrders(w http.ResponseWriter, r *http.Request) {
    // Code Origin will point to this line (35)
    span, _ := tracer.StartSpanFromContext(r.Context(), "handle.orders")
    defer span.Finish()

    fmt.Fprintf(w, "Orders endpoint")
}
```

**Run**:
```bash
export DD_CODE_ORIGIN_FOR_SPANS_ENABLED=true
go run go-http-server.go
```

---

### Python (Flask)

**File**: `flask_app.py`

```python
from flask import Flask
from ddtrace import tracer, config

# Enable Code Origin
config.code_origin_for_spans_enabled = True

app = Flask(__name__)

@app.route('/users')
def users():
    # Code Origin: file=flask_app.py, line=12, func=users
    return {'users': ['alice', 'bob']}

@app.route('/orders')
def orders():
    # Code Origin: file=flask_app.py, line=17, func=orders
    return {'orders': [1, 2, 3]}

if __name__ == '__main__':
    app.run(port=8080)
```

**Run**:
```bash
export DD_CODE_ORIGIN_FOR_SPANS_ENABLED=true
ddtrace-run python flask_app.py
```

---

### Node.js (Express)

**File**: `express-server.js`

```javascript
// Initialize tracer first
require('dd-trace').init({
  service: 'node-web-server',
  env: process.env.DD_ENV || 'development',
  codeOriginForSpansEnabled: true  // Enable Code Origin
});

const express = require('express');
const app = express();

// This handler will have code origin: file=express-server.js, line=14
app.get('/users', (req, res) => {
  res.json({ users: ['alice', 'bob'] });
});

// This handler will have code origin: file=express-server.js, line=19
app.get('/orders', (req, res) => {
  res.json({ orders: [1, 2, 3] });
});

app.listen(8080, () => {
  console.log('Server running on port 8080');
});
```

**Run**:
```bash
export DD_CODE_ORIGIN_FOR_SPANS_ENABLED=true
node express-server.js
```

**TypeScript with Source Maps**:
```bash
export DD_CODE_ORIGIN_FOR_SPANS_ENABLED=true
node --enable-source-maps -r dd-trace/init dist/server.js
```

---

### Java (Spring Boot)

**File**: `UserController.java`

```java
package com.example.demo;

import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api")
public class UserController {

    // Code Origin: file=UserController.java, line=12, func=getUsers
    @GetMapping("/users")
    public List<String> getUsers() {
        return List.of("alice", "bob");
    }

    // Code Origin: file=UserController.java, line=18, func=getOrders
    @GetMapping("/orders")
    public List<Integer> getOrders() {
        return List.of(1, 2, 3);
    }
}
```

**application.properties**:
```properties
# Enable Code Origin
dd.code.origin.for.spans.enabled=true

# Datadog settings
dd.service=java-web-server
dd.env=production
```

**Run**:
```bash
java -javaagent:dd-java-agent.jar \
  -Ddd.code.origin.for.spans.enabled=true \
  -jar target/demo-0.0.1-SNAPSHOT.jar
```

---

### .NET (ASP.NET Core)

**File**: `UsersController.cs`

```csharp
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;

namespace WebApi.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class UsersController : ControllerBase
    {
        // Code Origin: file=UsersController.cs, line=13, func=Get
        [HttpGet]
        public IEnumerable<string> Get()
        {
            return new[] { "alice", "bob" };
        }

        // Code Origin: file=UsersController.cs, line=20, func=GetById
        [HttpGet("{id}")]
        public string GetById(int id)
        {
            return $"User {id}";
        }
    }
}
```

**appsettings.json**:
```json
{
  "DD_CODE_ORIGIN_FOR_SPANS_ENABLED": "true",
  "DD_SERVICE": "dotnet-web-api",
  "DD_ENV": "production"
}
```

**Run**:
```bash
export DD_CODE_ORIGIN_FOR_SPANS_ENABLED=true
dotnet run
```

---

### Ruby (Rails)

**File**: `config/initializers/datadog.rb`

```ruby
Datadog.configure do |c|
  # Enable Code Origin
  c.code_origin_for_spans_enabled = true

  c.service = 'rails-api'
  c.env = ENV['DD_ENV'] || 'development'
end
```

**File**: `app/controllers/users_controller.rb`

```ruby
class UsersController < ApplicationController
  # Code Origin: file=users_controller.rb, line=3, func=index
  def index
    render json: { users: ['alice', 'bob'] }
  end

  # Code Origin: file=users_controller.rb, line=8, func=show
  def show
    render json: { user: params[:id] }
  end
end
```

**Run**:
```bash
export DD_CODE_ORIGIN_FOR_SPANS_ENABLED=true
rails server
```

---

## Docker Examples

### Dockerfile with Code Origin

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY . .
RUN go build -o server main.go

FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/server .

# Set Code Origin environment variable
ENV DD_CODE_ORIGIN_FOR_SPANS_ENABLED=true
ENV DD_SERVICE=my-service
ENV DD_ENV=production

EXPOSE 8080
CMD ["./server"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  web:
    build: .
    ports:
      - "8080:8080"
    environment:
      # Enable Code Origin
      DD_CODE_ORIGIN_FOR_SPANS_ENABLED: "true"
      DD_SERVICE: "web-api"
      DD_ENV: "production"
      DD_VERSION: "${GIT_SHA}"

      # Datadog Agent
      DD_AGENT_HOST: "datadog-agent"
      DD_API_KEY: "${DD_API_KEY}"

  datadog-agent:
    image: datadog/agent:latest
    environment:
      DD_API_KEY: "${DD_API_KEY}"
      DD_SITE: "datadoghq.com"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /proc/:/host/proc/:ro
      - /sys/fs/cgroup/:/host/sys/fs/cgroup:ro
```

---

## Kubernetes Examples

### Deployment with Code Origin

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web-api
  template:
    metadata:
      labels:
        app: web-api
    spec:
      containers:
      - name: web
        image: myregistry/web-api:latest
        env:
        # Enable Code Origin
        - name: DD_CODE_ORIGIN_FOR_SPANS_ENABLED
          value: "true"

        # Datadog Configuration
        - name: DD_SERVICE
          value: "web-api"
        - name: DD_ENV
          value: "production"
        - name: DD_VERSION
          value: "1.0.0"  # From CI/CD

        # Datadog Agent
        - name: DD_AGENT_HOST
          valueFrom:
            fieldRef:
              fieldPath: status.hostIP

        ports:
        - containerPort: 8080
```

### Using Admission Controller

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-api
  labels:
    tags.datadoghq.com/service: "web-api"
    tags.datadoghq.com/env: "production"
    tags.datadoghq.com/version: "1.0.0"
spec:
  template:
    metadata:
      labels:
        admission.datadoghq.com/enabled: "true"
    spec:
      containers:
      - name: web
        image: myregistry/web-api:latest
        # Admission Controller auto-injects DD_CODE_ORIGIN_FOR_SPANS_ENABLED
```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Deploy with Code Origin

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build Docker Image
        run: |
          docker build \
            --build-arg DD_CODE_ORIGIN_FOR_SPANS_ENABLED=true \
            --build-arg DD_VERSION=${{ github.sha }} \
            -t myapp:latest .

      - name: Deploy to Kubernetes
        run: |
          kubectl set env deployment/web \
            DD_CODE_ORIGIN_FOR_SPANS_ENABLED=true \
            DD_VERSION=${{ github.sha }}
```

### GitLab CI

```yaml
deploy:
  stage: deploy
  script:
    - |
      kubectl set env deployment/web \
        DD_CODE_ORIGIN_FOR_SPANS_ENABLED=true \
        DD_VERSION=$CI_COMMIT_SHA \
        DD_GIT_REPOSITORY_URL=$CI_PROJECT_URL \
        DD_GIT_COMMIT_SHA=$CI_COMMIT_SHA
```

---

## Testing Code Origin

### Local Test Script

```bash
#!/bin/bash
# test-code-origin.sh

echo "Starting application with Code Origin..."

# Enable Code Origin
export DD_CODE_ORIGIN_FOR_SPANS_ENABLED=true
export DD_SERVICE="test-service"
export DD_ENV="development"

# Start application in background
./your-app &
APP_PID=$!

# Wait for startup
sleep 5

# Generate test traffic
echo "Generating test traffic..."
curl http://localhost:8080/users
curl http://localhost:8080/orders

# Wait for traces to be sent
sleep 10

# View traces with CLI
echo "Viewing traces with Code Origin..."
dd apm --service test-service --from 5m --code-origin

# Cleanup
kill $APP_PID
```

---

## Troubleshooting Examples

### Check if Code Origin is Working

```bash
#!/bin/bash
# check-code-origin.sh

# Fetch recent trace
TRACE_ID=$(dd apm --from 5m --service my-service --format json | jq -r '.[0].trace_id')

# Check for code origin tags
dd apm --trace-id $TRACE_ID --format json | jq '.spans[] | {
  operation: .operation_name,
  file: .meta["code.filepath"],
  line: .meta["code.lineno"],
  function: .meta["code.function"]
}'
```

**Expected Output**:
```json
{
  "operation": "http.request",
  "file": "src/handlers.go",
  "line": "42",
  "function": "HandleRequest"
}
```

### Verify Environment Variables

```bash
#!/bin/bash
# verify-env.sh

echo "Checking Code Origin configuration..."

# Check environment variable
if [ "$DD_CODE_ORIGIN_FOR_SPANS_ENABLED" = "true" ]; then
    echo "✓ DD_CODE_ORIGIN_FOR_SPANS_ENABLED is set"
else
    echo "✗ DD_CODE_ORIGIN_FOR_SPANS_ENABLED is not set"
    exit 1
fi

# Check tracer version (example for Go)
if command -v go &> /dev/null; then
    GO_VERSION=$(go version)
    echo "✓ Go version: $GO_VERSION"
fi

# Check if service is running
if curl -s http://localhost:8080/health > /dev/null; then
    echo "✓ Service is running"
else
    echo "✗ Service is not running"
    exit 1
fi

echo "All checks passed!"
```

---

## Performance Testing

### Load Test with Code Origin

```bash
#!/bin/bash
# load-test-code-origin.sh

# Enable Code Origin
export DD_CODE_ORIGIN_FOR_SPANS_ENABLED=true

# Start application
./your-app &
APP_PID=$!

# Wait for startup
sleep 5

# Run load test
echo "Running load test..."
for i in {1..1000}; do
    curl -s http://localhost:8080/users > /dev/null
done

# Wait for traces
sleep 30

# Check performance impact
echo "Analyzing performance..."
dd apm --from 5m --service my-service --format json | jq '{
  avg_duration: ([.[].duration] | add / length),
  count: length,
  with_code_origin: ([.[].spans[] | select(.meta["code.filepath"] != null)] | length)
}'

# Cleanup
kill $APP_PID
```

---

## Resources

See the main [Code Origin documentation](../../docs/features/CODE-ORIGIN.md) for:
- Complete setup guides
- Language-specific details
- CLI usage
- Troubleshooting
- FAQ

---

**Created**: January 22, 2026
**Examples**: Go, Python, Node.js, Java, .NET, Ruby
**Deployment**: Docker, Kubernetes, CI/CD

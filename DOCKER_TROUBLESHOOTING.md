# Docker Troubleshooting Guide - VibeCode Unified VM

## Table of Contents
1. [Connection Issues](#connection-issues)
2. [Container Issues](#container-issues)
3. [Image Issues](#image-issues)
4. [Network Issues](#network-issues)
5. [Performance Issues](#performance-issues)
6. [Storage Issues](#storage-issues)
7. [Security Issues](#security-issues)
8. [Advanced Debugging](#advanced-debugging)

---

## Connection Issues

### Cannot connect to Docker daemon

**Symptom:**
```
Cannot connect to the Docker daemon at tcp://localhost:2375. Is the docker daemon running?
```

**Diagnosis Steps:**

1. **Check if DOCKER_HOST is set:**
   ```bash
   echo $DOCKER_HOST
   ```
   Should output: `tcp://localhost:2375`

   If not set:
   ```bash
   export DOCKER_HOST=tcp://localhost:2375
   ```

2. **Check if port 2375 is accessible:**
   ```bash
   nc -z localhost 2375 && echo "Port accessible" || echo "Port not accessible"
   ```

3. **Check if VM is running:**
   ```bash
   ps aux | grep UnifiedServicesVibeCode | grep -v grep
   ```

4. **Check if other VM services are accessible:**
   ```bash
   nc -z localhost 8080 && echo "OpenVSCode accessible"
   nc -z localhost 6379 && echo "Valkey accessible"
   nc -z localhost 5432 && echo "PostgreSQL accessible"
   ```

**Solutions:**

- **If VM not running:** Launch UnifiedServicesVibeCodeApp
- **If other services accessible but Docker not:** SSH into VM and check Docker logs
  ```bash
  ssh root@localhost -p 2222  # password: vibecode
  tail -50 /tmp/docker.log
  ```
- **If no services accessible:** VM may not have booted. Wait 30-60 seconds and try again.

### Connection refused

**Symptom:**
```
dial tcp 127.0.0.1:2375: connect: connection refused
```

**Possible Causes:**
1. Docker daemon not running in VM
2. Port forwarding not configured
3. Docker daemon failed to start

**Solutions:**

1. **SSH into VM and check Docker process:**
   ```bash
   ssh root@localhost -p 2222
   ps aux | grep dockerd
   ```

2. **Check Docker daemon status:**
   ```bash
   ssh root@localhost -p 2222 "cat /tmp/docker.log"
   ```

3. **Try restarting Docker manually:**
   ```bash
   ssh root@localhost -p 2222
   pkill dockerd
   pkill containerd
   sleep 2
   containerd --config /etc/containerd/config.toml > /tmp/containerd.log 2>&1 &
   sleep 2
   dockerd --config-file=/etc/docker/daemon.json > /tmp/docker.log 2>&1 &
   ```

### Connection timeout

**Symptom:**
```
timeout: failed to connect to Docker daemon
```

**Solutions:**
1. Increase timeout in Docker client configuration
2. Check VM resource usage (may be overloaded)
3. Check network connectivity

---

## Container Issues

### Container fails to start

**Symptom:**
```
Error response from daemon: OCI runtime create failed
```

**Diagnosis:**
```bash
# Check container logs
docker logs <container-id>

# Inspect container
docker inspect <container-id>

# Check system logs
docker events --since 5m
```

**Common Causes:**
1. **Insufficient memory:** Increase VM memory allocation
2. **Port already in use:** Change port mapping
3. **Invalid command:** Check container CMD/ENTRYPOINT
4. **Missing dependencies:** Check base image

**Solutions:**
```bash
# Check resource usage
docker stats

# Try running with more verbose output
docker run --rm <image> --help

# Try running interactively
docker run -it --rm <image> sh
```

### Container exits immediately

**Symptom:**
```
Container status: Exited (0) or Exited (1)
```

**Diagnosis:**
```bash
# View container logs
docker logs <container-name>

# Check exit code
docker inspect <container-name> --format='{{.State.ExitCode}}'

# View last command
docker inspect <container-name> --format='{{.Config.Cmd}}'
```

**Common Causes:**
1. **No foreground process:** Container needs a process that doesn't exit
2. **Command error:** Check if command succeeded
3. **Configuration error:** Check environment variables, volumes

**Solutions:**
```bash
# Run with interactive TTY to see what happens
docker run -it --rm <image> sh

# Keep container running with tail -f
docker run -d <image> tail -f /dev/null

# Check if image works on its own
docker run --rm <image>
```

### Cannot stop container

**Symptom:**
```
Container won't stop after docker stop command
```

**Solutions:**
```bash
# Try force stop
docker stop --time 30 <container-name>

# Force kill
docker kill <container-name>

# If still stuck, SSH to VM and kill process
ssh root@localhost -p 2222
ps aux | grep <container-name>
kill -9 <PID>
```

---

## Image Issues

### Cannot pull image

**Symptom:**
```
Error response from daemon: Get https://registry-1.docker.io/v2/: net/http: TLS handshake timeout
```

**Diagnosis:**
```bash
# Test network connectivity
ssh root@localhost -p 2222
ping -c 3 8.8.8.8
ping -c 3 registry-1.docker.io
```

**Solutions:**

1. **Check DNS:**
   ```bash
   ssh root@localhost -p 2222
   cat /etc/resolv.conf
   ```

2. **Try with explicit registry:**
   ```bash
   docker pull docker.io/library/alpine:latest
   ```

3. **Use a mirror or proxy:**
   Create `/etc/docker/daemon.json` with registry mirrors

4. **Try smaller image:**
   ```bash
   docker pull busybox:latest
   ```

### Image build fails

**Symptom:**
```
Error building image: <various errors>
```

**Diagnosis:**
```bash
# Build with verbose output
docker build --progress=plain --no-cache -t myimage .

# Check Dockerfile syntax
docker build --check -t myimage .
```

**Common Issues:**
1. **COPY/ADD fails:** Check source paths exist
2. **RUN fails:** Check command works in container
3. **Network issues:** Check internet connectivity
4. **Build context too large:** Use .dockerignore

**Solutions:**
```bash
# Create .dockerignore
cat > .dockerignore << 'EOF'
.git
node_modules
*.log
.DS_Store
EOF

# Test commands interactively
docker run -it --rm alpine:latest sh
# Then try running your commands

# Use multi-stage build to reduce size
```

### Image too large

**Symptoms:**
- Slow pull/push times
- High disk usage
- Out of disk space

**Solutions:**

1. **Use Alpine-based images:**
   ```dockerfile
   FROM node:alpine
   # instead of
   # FROM node:latest
   ```

2. **Multi-stage builds:**
   ```dockerfile
   FROM golang:alpine AS builder
   WORKDIR /app
   COPY . .
   RUN go build -o main .

   FROM alpine:latest
   COPY --from=builder /app/main /app/main
   CMD ["/app/main"]
   ```

3. **Combine RUN commands:**
   ```dockerfile
   RUN apk add --no-cache curl git \
       && curl -o /tmp/file.tar.gz https://... \
       && tar -xzf /tmp/file.tar.gz \
       && rm /tmp/file.tar.gz
   ```

4. **Clean up in same layer:**
   ```dockerfile
   RUN apt-get update && apt-get install -y \
       package1 \
       package2 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
   ```

---

## Network Issues

### Cannot access container from host

**Symptom:**
```
curl localhost:8080
curl: (7) Failed to connect to localhost port 8080: Connection refused
```

**Diagnosis:**
```bash
# Check if port is mapped
docker port <container-name>

# Check if container is listening
docker exec <container-name> netstat -tlnp

# Check container networking
docker inspect <container-name> --format='{{.NetworkSettings.IPAddress}}'
```

**Solutions:**

1. **Ensure port is published:**
   ```bash
   docker run -d -p 8080:80 nginx:alpine
   # Host port first, then container port
   ```

2. **Use correct binding:**
   ```bash
   # Listen on all interfaces inside container
   docker run -d -p 8080:80 nginx:alpine
   # Nginx should listen on 0.0.0.0:80, not 127.0.0.1:80
   ```

3. **Check for port conflicts:**
   ```bash
   lsof -i :8080
   ```

### Containers cannot communicate

**Symptom:**
```
Container A cannot reach Container B
```

**Diagnosis:**
```bash
# Check networks
docker network ls
docker network inspect bridge

# Check container connectivity
docker exec container-a ping container-b
```

**Solutions:**

1. **Use same network:**
   ```bash
   # Create custom network
   docker network create my-network

   # Run containers on same network
   docker run -d --name container-a --network my-network alpine:latest
   docker run -d --name container-b --network my-network alpine:latest

   # Now they can communicate by name
   docker exec container-a ping container-b
   ```

2. **Use links (legacy):**
   ```bash
   docker run -d --name db postgres:alpine
   docker run -d --link db:database web-app:latest
   ```

3. **Use host network (not recommended):**
   ```bash
   docker run -d --network host nginx:alpine
   ```

### DNS resolution fails

**Symptom:**
```
docker exec container ping google.com
ping: bad address 'google.com'
```

**Solutions:**

1. **Check DNS in container:**
   ```bash
   docker exec container cat /etc/resolv.conf
   ```

2. **Specify DNS servers:**
   ```bash
   docker run --dns 8.8.8.8 --dns 8.8.4.4 alpine:latest
   ```

3. **Configure daemon DNS:**
   Edit `/etc/docker/daemon.json` in VM:
   ```json
   {
     "dns": ["8.8.8.8", "8.8.4.4"]
   }
   ```

---

## Performance Issues

### Slow container startup

**Symptoms:**
- Containers take long time to start
- High CPU during startup

**Diagnosis:**
```bash
# Check container logs
docker logs <container-name>

# Check resource usage
docker stats

# Check Docker events
docker events
```

**Solutions:**

1. **Use smaller images:**
   ```bash
   docker pull alpine:latest  # 5 MB
   # instead of
   docker pull ubuntu:latest  # 77 MB
   ```

2. **Pre-pull images:**
   ```bash
   docker pull nginx:alpine
   docker pull postgres:alpine
   # Then run containers
   ```

3. **Use volume mounts instead of COPY:**
   ```bash
   docker run -v $(pwd):/app myimage:latest
   ```

### High CPU usage

**Diagnosis:**
```bash
# Check container stats
docker stats

# Check processes in container
docker exec <container-name> top
```

**Solutions:**

1. **Limit CPU:**
   ```bash
   docker run -d --cpus="1.0" nginx:alpine
   ```

2. **Use CPU shares:**
   ```bash
   docker run -d --cpu-shares=512 nginx:alpine
   ```

3. **Identify culprit:**
   ```bash
   docker exec <container-name> ps aux --sort=-%cpu | head -10
   ```

### High memory usage

**Diagnosis:**
```bash
# Check memory usage
docker stats --no-stream

# Check container processes
docker exec <container-name> ps aux --sort=-%mem | head -10
```

**Solutions:**

1. **Limit memory:**
   ```bash
   docker run -d --memory="512m" nginx:alpine
   ```

2. **Set swap limit:**
   ```bash
   docker run -d --memory="512m" --memory-swap="1g" nginx:alpine
   ```

3. **Monitor for leaks:**
   ```bash
   docker stats --format "table {{.Container}}\t{{.MemUsage}}"
   ```

---

## Storage Issues

### Out of disk space

**Symptom:**
```
Error response from daemon: mkdir /var/lib/docker: no space left on device
```

**Diagnosis:**
```bash
# Check Docker disk usage
docker system df

# Check VM disk usage
ssh root@localhost -p 2222 "df -h"
```

**Solutions:**

1. **Clean up unused resources:**
   ```bash
   # Remove stopped containers
   docker container prune -f

   # Remove unused images
   docker image prune -a -f

   # Remove unused volumes
   docker volume prune -f

   # Remove everything
   docker system prune -a --volumes -f
   ```

2. **Check large images:**
   ```bash
   docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | sort -k 3 -h
   ```

3. **Remove specific items:**
   ```bash
   # Remove specific container
   docker rm <container-id>

   # Remove specific image
   docker rmi <image-id>

   # Remove specific volume
   docker volume rm <volume-name>
   ```

### Volume issues

**Symptom:**
```
Error mounting volume / Permission denied
```

**Solutions:**

1. **Check volume exists:**
   ```bash
   docker volume ls
   docker volume inspect <volume-name>
   ```

2. **Fix permissions:**
   ```bash
   # Run container as root
   docker run --user root -v myvolume:/data alpine:latest

   # Or fix permissions in volume
   docker run --rm -v myvolume:/data alpine:latest chmod -R 777 /data
   ```

3. **Recreate volume:**
   ```bash
   docker volume rm <volume-name>
   docker volume create <volume-name>
   ```

---

## Security Issues

### Warning: Unencrypted connection

**Issue:**
Port 2375 is unencrypted and insecure.

**Risk Level:**
- ⚠️ **MEDIUM** for local development
- 🔴 **CRITICAL** if exposed to network

**Solutions:**

1. **Enable TLS (Recommended for production):**

   Generate certificates:
   ```bash
   # On macOS host
   mkdir -p ~/.docker/certs

   # Generate CA
   openssl genrsa -out ~/.docker/certs/ca-key.pem 4096
   openssl req -new -x509 -days 365 -key ~/.docker/certs/ca-key.pem -sha256 -out ~/.docker/certs/ca.pem

   # Generate server cert
   openssl genrsa -out ~/.docker/certs/server-key.pem 4096
   openssl req -subj "/CN=localhost" -sha256 -new -key ~/.docker/certs/server-key.pem -out ~/.docker/certs/server.csr

   # Sign server cert
   echo "subjectAltName = DNS:localhost,IP:127.0.0.1" > ~/.docker/certs/extfile.cnf
   echo "extendedKeyUsage = serverAuth" >> ~/.docker/certs/extfile.cnf

   openssl x509 -req -days 365 -sha256 -in ~/.docker/certs/server.csr -CA ~/.docker/certs/ca.pem -CAkey ~/.docker/certs/ca-key.pem -CAcreateserial -out ~/.docker/certs/server-cert.pem -extfile ~/.docker/certs/extfile.cnf

   # Generate client cert
   openssl genrsa -out ~/.docker/certs/key.pem 4096
   openssl req -subj '/CN=client' -new -key ~/.docker/certs/key.pem -out ~/.docker/certs/client.csr

   echo "extendedKeyUsage = clientAuth" > ~/.docker/certs/extfile-client.cnf
   openssl x509 -req -days 365 -sha256 -in ~/.docker/certs/client.csr -CA ~/.docker/certs/ca.pem -CAkey ~/.docker/certs/ca-key.pem -CAcreateserial -out ~/.docker/certs/cert.pem -extfile ~/.docker/certs/extfile-client.cnf
   ```

   Copy certs to VM:
   ```bash
   scp -P 2222 ~/.docker/certs/ca.pem ~/.docker/certs/server-cert.pem ~/.docker/certs/server-key.pem root@localhost:/etc/docker/
   ```

   Update daemon config in VM:
   ```json
   {
     "hosts": ["unix:///var/run/docker.sock", "tcp://0.0.0.0:2376"],
     "tls": true,
     "tlsverify": true,
     "tlscacert": "/etc/docker/ca.pem",
     "tlscert": "/etc/docker/server-cert.pem",
     "tlskey": "/etc/docker/server-key.pem"
   }
   ```

   Use on host:
   ```bash
   export DOCKER_HOST=tcp://localhost:2376
   export DOCKER_TLS_VERIFY=1
   export DOCKER_CERT_PATH=~/.docker/certs
   docker info
   ```

2. **Use SSH tunnel:**
   ```bash
   # Forward Docker over SSH
   ssh -L 2375:localhost:2375 root@localhost -p 2222 -N

   # In another terminal
   export DOCKER_HOST=tcp://localhost:2375
   docker info
   ```

3. **Firewall rules:**
   Ensure port 2375 is not accessible from external network.

### Container security best practices

1. **Don't run as root:**
   ```dockerfile
   FROM alpine:latest
   RUN adduser -D appuser
   USER appuser
   ```

2. **Read-only filesystem:**
   ```bash
   docker run --read-only -v /tmp --tmpfs /tmp nginx:alpine
   ```

3. **Drop capabilities:**
   ```bash
   docker run --cap-drop=ALL --cap-add=NET_BIND_SERVICE nginx:alpine
   ```

4. **Use secrets:**
   ```bash
   echo "mypassword" | docker secret create db_password -
   docker service create --secret db_password myapp:latest
   ```

---

## Advanced Debugging

### Enable debug logging

**In VM:**
```bash
ssh root@localhost -p 2222

# Stop Docker
pkill dockerd

# Start with debug
dockerd --config-file=/etc/docker/daemon.json --debug > /tmp/docker-debug.log 2>&1 &

# View logs
tail -f /tmp/docker-debug.log
```

### Inspect Docker internals

```bash
# Check Docker info
docker info

# Check system-wide information
docker system info

# Check events
docker events

# Check daemon logs
ssh root@localhost -p 2222 "cat /tmp/docker.log"
```

### Network debugging

```bash
# Inside container
docker run -it --rm alpine:latest sh
apk add --no-cache curl netcat-openbsd tcpdump
netstat -tlnp

# From host
docker exec <container> netstat -tlnp
docker exec <container> ss -tlnp
```

### Performance profiling

```bash
# Container stats
docker stats --no-stream

# Top processes in container
docker top <container>

# Resource limits
docker inspect <container> --format='{{.HostConfig.Memory}}'
docker inspect <container> --format='{{.HostConfig.CpuShares}}'
```

### Rescue stuck Docker daemon

```bash
ssh root@localhost -p 2222

# Kill all Docker processes
pkill -9 dockerd
pkill -9 containerd
pkill -9 docker-proxy

# Clean up
rm -f /var/run/docker.sock
rm -f /run/containerd/containerd.sock

# Restart
containerd --config /etc/containerd/config.toml > /tmp/containerd.log 2>&1 &
sleep 2
dockerd --config-file=/etc/docker/daemon.json > /tmp/docker.log 2>&1 &
```

---

## Common Error Messages

### "OCI runtime create failed"
**Solution:** Check container logs, inspect config, verify image compatibility

### "driver failed programming external connectivity"
**Solution:** Port already in use, change port mapping or stop conflicting service

### "No space left on device"
**Solution:** Run `docker system prune -a --volumes`

### "permission denied while trying to connect to the Docker daemon socket"
**Solution:** Not applicable in this setup (using TCP, not socket from host)

### "manifest unknown"
**Solution:** Image name/tag incorrect or doesn't exist on registry

### "error creating overlay mount"
**Solution:** Overlay filesystem issue, may need to recreate container

---

## Getting More Help

### Check logs
```bash
# Docker daemon logs
ssh root@localhost -p 2222 "cat /tmp/docker.log"

# Containerd logs
ssh root@localhost -p 2222 "cat /tmp/containerd.log"

# Container logs
docker logs <container-name>

# Follow logs
docker logs -f <container-name>
```

### Useful commands
```bash
# System information
docker info
docker version
docker system df

# Inspect resources
docker inspect <container/image/volume/network>

# Events
docker events --since 5m

# Processes
docker ps -a
docker top <container>
```

### Resources
- Docker documentation: https://docs.docker.com/
- Docker forums: https://forums.docker.com/
- Stack Overflow: https://stackoverflow.com/questions/tagged/docker
- Docker GitHub issues: https://github.com/moby/moby/issues

---

## Summary Checklist

When troubleshooting, check these in order:

- [ ] Is DOCKER_HOST set correctly? (`echo $DOCKER_HOST`)
- [ ] Is VM running? (`ps aux | grep UnifiedServicesVibeCode`)
- [ ] Is Docker port accessible? (`nc -z localhost 2375`)
- [ ] Can Docker client connect? (`docker version`)
- [ ] Are there any errors in logs? (`ssh root@localhost -p 2222 "cat /tmp/docker.log"`)
- [ ] Is there enough disk space? (`docker system df`)
- [ ] Are there resource constraints? (`docker stats`)
- [ ] Is the image/container correct? (`docker inspect`)
- [ ] Are there network issues? (`docker network inspect bridge`)
- [ ] Have you tried restarting? (VM and/or Docker daemon)

If all else fails, try:
```bash
# Clean slate
docker system prune -a --volumes -f
# Restart VM
pkill -f UnifiedServicesVibeCode
open UnifiedServicesVibeCodeApp.app
```

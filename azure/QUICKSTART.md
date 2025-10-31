# Quick Start Guide - OpenVSCode Server

## 🚀 60-Second Setup

```bash
# 1. Navigate to azure directory
cd azure

# 2. Build the image (5-10 minutes first time)
docker build -t vibecode/openvscode-server:1.95.3 -f Dockerfile .

# 3. Run the container
docker run -d -p 3000:3000 --name vscode vibecode/openvscode-server:1.95.3

# 4. Open in browser
open http://localhost:3000
```

## 📋 Pre-flight Checklist

- [ ] Docker installed and running
- [ ] Port 3000 available
- [ ] 2GB free disk space
- [ ] Internet connection for downloads

## 🎯 What You Get

✅ **OpenVSCode Server 1.95.3** - Full VS Code in browser
✅ **Datadog Agent** - Production monitoring (optional)
✅ **MCP Support** - Model Context Protocol servers
✅ **Alpine Linux** - Minimal ~500MB image
✅ **Non-root User** - Security hardened
✅ **Health Checks** - Auto-healing containers

## 🛠️ Common Commands

### Start/Stop
```bash
# Start
docker start vscode

# Stop
docker stop vscode

# Restart
docker restart vscode

# Remove
docker rm -f vscode
```

### Logs
```bash
# Follow logs
docker logs -f vscode

# Last 100 lines
docker logs --tail 100 vscode
```

### Enter Container
```bash
# As openvscode user
docker exec -it vscode /bin/bash

# As root
docker exec -it -u root vscode /bin/bash
```

## 🔧 With Docker Compose

```bash
# Setup
cp .env.example .env

# Start
docker-compose up -d

# Logs
docker-compose logs -f

# Stop
docker-compose down
```

## 🧪 Testing

```bash
# Validate Dockerfile structure
bash validate-dockerfile.sh

# Full test suite
bash test-container.sh

# Manual health check
curl http://localhost:3000/healthz
```

## 📊 With Datadog

```bash
# Get API key from https://app.datadoghq.com
# Then run with:
docker run -d \
  -p 3000:3000 \
  -e DATADOG_API_KEY=your_key_here \
  --name vscode \
  vibecode/openvscode-server:1.95.3
```

## 🗂️ Persistent Workspace

```bash
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/workspace:/workspace \
  -v vscode-data:/home/openvscode/.openvscode-server \
  --name vscode \
  vibecode/openvscode-server:1.95.3
```

## 🔐 Security Notes

- Container runs as non-root user (UID 1000)
- No connection token by default (use reverse proxy for auth)
- Minimal Alpine Linux base
- Regular security updates recommended

## 📦 Image Specs

| Property | Value |
|----------|-------|
| Base Image | Alpine Linux 3.19 |
| OpenVSCode | 1.95.3 |
| Node.js | 20 LTS |
| Python | 3.11 |
| Size | ~450-500MB |
| Port | 3000 |
| User | openvscode (UID 1000) |

## 🐛 Troubleshooting

### Port already in use
```bash
# Find what's using port 3000
lsof -i :3000

# Use different port
docker run -d -p 3001:3000 vibecode/openvscode-server:1.95.3
```

### Container exits immediately
```bash
# Check logs
docker logs vscode

# Run in foreground
docker run --rm -it -p 3000:3000 vibecode/openvscode-server:1.95.3
```

### Can't access from browser
```bash
# Check if running
docker ps | grep vscode

# Check health
docker inspect vscode | grep -A5 Health

# Test from host
curl -I http://localhost:3000
```

## 📚 More Help

- **Full Documentation**: See README.md
- **Build Guide**: See BUILD.md
- **Test Script**: `bash test-container.sh`
- **Validation**: `bash validate-dockerfile.sh`

## 🎓 Next Steps

1. ✅ Get it running (you're here!)
2. 📝 Configure workspace volumes
3. 🔌 Add MCP servers
4. 📊 Enable Datadog monitoring
5. 🌐 Setup reverse proxy with SSL
6. 🚀 Deploy to production

## 💡 Pro Tips

```bash
# Auto-restart on failure
docker run -d --restart=unless-stopped -p 3000:3000 vibecode/openvscode-server:1.95.3

# Resource limits
docker run -d --cpus=2 --memory=2g -p 3000:3000 vibecode/openvscode-server:1.95.3

# Mount SSH keys for git
docker run -d -v ~/.ssh:/home/openvscode/.ssh:ro -p 3000:3000 vibecode/openvscode-server:1.95.3

# Custom startup script
docker run -d -v $(pwd)/my-startup.sh:/opt/startup.sh -p 3000:3000 vibecode/openvscode-server:1.95.3
```

---

**Ready to build?** → `docker build -t vibecode/openvscode-server:1.95.3 -f Dockerfile .`

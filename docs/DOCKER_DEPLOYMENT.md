# Docker Deployment Guide

Complete deployment instructions for VibeCode across all platforms.

## Quick Start

```bash
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/vibecode" \
  -e NEXTAUTH_SECRET="your-secret-here" \
  --name vibecode \
  vibecode/webgui:latest
```

## Platform-Specific Instructions

### 🍎 macOS

#### Prerequisites
```bash
# Install Docker Desktop
brew install --cask docker

# Or download from: https://www.docker.com/products/docker-desktop
```

#### Run VibeCode
```bash
# Pull latest image
docker pull vibecode/webgui:latest

# Run with environment variables
docker run -d \
  -p 3000:3000 \
  -v ~/vibecode-data:/data \
  -e DATABASE_URL="postgresql://localhost:5432/vibecode" \
  -e NEXTAUTH_URL="http://localhost:3000" \
  -e NEXTAUTH_SECRET=$(openssl rand -base64 32) \
  --name vibecode \
  vibecode/webgui:latest

# Access at http://localhost:3000
```

#### Apple Silicon (M1/M2/M3)
```bash
# Use ARM64 image
docker run -d \
  --platform linux/arm64 \
  -p 3000:3000 \
  vibecode/webgui:latest-arm64
```

---

### 🐧 Linux

#### Prerequisites
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y docker.io docker-compose

# Fedora/RHEL
sudo dnf install -y docker docker-compose

# Arch
sudo pacman -S docker docker-compose

# Start Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

#### Run VibeCode
```bash
docker run -d \
  -p 3000:3000 \
  -v /var/lib/vibecode:/data \
  -e DATABASE_URL="postgresql://localhost:5432/vibecode" \
  --restart unless-stopped \
  --name vibecode \
  vibecode/webgui:latest
```

#### Systemd Service
```bash
# Create service file
sudo tee /etc/systemd/system/vibecode.service <<EOF
[Unit]
Description=VibeCode Container
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/bin/docker start vibecode
ExecStop=/usr/bin/docker stop vibecode
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl enable vibecode
sudo systemctl start vibecode
```

---

### 🪟 Windows

#### Prerequisites
1. Download Docker Desktop: https://www.docker.com/products/docker-desktop
2. Install WSL2: `wsl --install`
3. Enable Hyper-V in BIOS

#### PowerShell
```powershell
# Pull image
docker pull vibecode/webgui:latest

# Run container
docker run -d `
  -p 3000:3000 `
  -v C:\vibecode-data:/data `
  -e DATABASE_URL="postgresql://localhost:5432/vibecode" `
  --name vibecode `
  vibecode/webgui:latest

# Access at http://localhost:3000
```

#### Windows Server
```powershell
# Install Docker
Install-Module -Name DockerMsftProvider -Force
Install-Package -Name docker -ProviderName DockerMsftProvider -Force
Restart-Computer

# Run VibeCode
docker run -d `
  -p 3000:3000 `
  --restart unless-stopped `
  vibecode/webgui:latest
```

---

### 📦 QNAP NAS

#### Container Station

1. **Open Container Station**
   - Go to App Center → Install "Container Station"

2. **Create Container**
   - Click "Create" → "Create Application"
   - Name: `vibecode`
   - Image: `vibecode/webgui:latest`

3. **Configuration**
   ```yaml
   version: '3.8'
   services:
     vibecode:
       image: vibecode/webgui:latest
       container_name: vibecode
       ports:
         - "3000:3000"
       volumes:
         - /share/Container/vibecode:/data
       environment:
         - DATABASE_URL=postgresql://admin:password@postgres:5432/vibecode
         - NEXTAUTH_URL=http://qnap-ip:3000
       restart: unless-stopped
   ```

4. **Access**
   - URL: `http://[QNAP-IP]:3000`

#### Command Line (SSH)
```bash
# SSH into QNAP
ssh admin@qnap-ip

# Pull and run
docker run -d \
  -p 3000:3000 \
  -v /share/Container/vibecode:/data \
  --restart unless-stopped \
  vibecode/webgui:latest
```

---

### 🔵 Synology NAS

#### Docker Package

1. **Install Docker**
   - Package Center → Search "Docker" → Install

2. **Download Image**
   - Docker → Registry → Search "vibecode/webgui" → Download

3. **Create Container**
   - Image → Select vibecode/webgui → Launch
   - Container Name: `vibecode`
   - Enable auto-restart

4. **Port Settings**
   - Local Port: `3000` → Container Port: `3000`

5. **Volume Settings**
   - Add Folder: `/docker/vibecode` → Mount path: `/data`

6. **Environment Variables**
   ```
   DATABASE_URL=postgresql://user:pass@postgres:5432/vibecode
   NEXTAUTH_URL=http://synology-ip:3000
   NEXTAUTH_SECRET=your-secret-here
   ```

#### DSM 7.x Task Scheduler
```bash
# Create scheduled task
# Control Panel → Task Scheduler → Create → User-defined script

# Script:
docker start vibecode || docker run -d \
  -p 3000:3000 \
  -v /volume1/docker/vibecode:/data \
  --restart unless-stopped \
  --name vibecode \
  vibecode/webgui:latest
```

---

### 🟢 Asustor NAS

#### App Central

1. **Install Docker CE**
   - App Central → Search "Docker CE" → Install

2. **Pull Image**
   ```bash
   # SSH into Asustor
   ssh admin@asustor-ip
   
   # Pull image
   docker pull vibecode/webgui:latest
   ```

3. **Create Container**
   ```bash
   docker run -d \
     -p 3000:3000 \
     -v /volume1/Docker/vibecode:/data \
     -e DATABASE_URL="postgresql://localhost:5432/vibecode" \
     --restart unless-stopped \
     --name vibecode \
     vibecode/webgui:latest
   ```

4. **Access**
   - URL: `http://[ASUSTOR-IP]:3000`

---

### 🐳 Docker Compose

#### Basic Setup
```yaml
# docker-compose.yml
version: '3.8'

services:
  vibecode:
    image: vibecode/webgui:latest
    container_name: vibecode
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/vibecode
      - NEXTAUTH_URL=http://localhost:3000
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - DD_API_KEY=${DD_API_KEY}
      - DD_SITE=datadoghq.com
    volumes:
      - vibecode-data:/data
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: pgvector/pgvector:pg16
    container_name: vibecode-db
    environment:
      - POSTGRES_DB=vibecode
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  vibecode-data:
  postgres-data:
```

#### Run
```bash
# Start
docker-compose up -d

# View logs
docker-compose logs -f vibecode

# Stop
docker-compose down

# Update
docker-compose pull
docker-compose up -d
```

#### Production Setup
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  vibecode:
    image: vibecode/webgui:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@db:5432/vibecode
      - NEXTAUTH_URL=https://vibecode.yourdomain.com
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - DD_API_KEY=${DD_API_KEY}
      - DD_SITE=datadoghq.com
      - DD_SERVICE=vibecode
      - DD_ENV=production
    volumes:
      - /var/lib/vibecode:/data
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  db:
    image: pgvector/pgvector:pg16
    environment:
      - POSTGRES_DB=vibecode
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - /var/lib/postgresql/data:/var/lib/postgresql/data
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - vibecode
    restart: unless-stopped
```

---

### ☸️ Kubernetes (KinD)

#### Install KinD
```bash
# macOS
brew install kind

# Linux
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind

# Windows (PowerShell)
curl.exe -Lo kind-windows-amd64.exe https://kind.sigs.k8s.io/dl/v0.20.0/kind-windows-amd64
Move-Item .\kind-windows-amd64.exe c:\windows\system32\kind.exe
```

#### Create Cluster
```bash
# Create cluster
kind create cluster --name vibecode

# Verify
kubectl cluster-info --context kind-vibecode
```

#### Deploy VibeCode
```yaml
# vibecode-kind.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: vibecode

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: vibecode-config
  namespace: vibecode
data:
  NEXTAUTH_URL: "http://localhost:3000"
  DD_SITE: "datadoghq.com"

---
apiVersion: v1
kind: Secret
metadata:
  name: vibecode-secrets
  namespace: vibecode
type: Opaque
stringData:
  DATABASE_URL: "postgresql://postgres:password@postgres:5432/vibecode"
  NEXTAUTH_SECRET: "your-secret-here"
  DD_API_KEY: "your-dd-api-key"

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vibecode
  namespace: vibecode
spec:
  replicas: 2
  selector:
    matchLabels:
      app: vibecode
  template:
    metadata:
      labels:
        app: vibecode
    spec:
      containers:
      - name: vibecode
        image: vibecode/webgui:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: vibecode-config
        - secretRef:
            name: vibecode-secrets
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: vibecode
  namespace: vibecode
spec:
  selector:
    app: vibecode
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

#### Apply
```bash
# Deploy
kubectl apply -f vibecode-kind.yaml

# Check status
kubectl get pods -n vibecode
kubectl get svc -n vibecode

# Port forward
kubectl port-forward -n vibecode svc/vibecode 3000:80

# Access at http://localhost:3000
```

---

### ☸️ Kubernetes (Production)

#### Helm Chart
```bash
# Add repo
helm repo add vibecode https://charts.vibecode.dev
helm repo update

# Install
helm install vibecode vibecode/vibecode \
  --namespace vibecode \
  --create-namespace \
  --set image.tag=latest \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=vibecode.yourdomain.com \
  --set postgresql.enabled=true

# Upgrade
helm upgrade vibecode vibecode/vibecode \
  --namespace vibecode \
  --reuse-values

# Uninstall
helm uninstall vibecode --namespace vibecode
```

#### Manual Deployment
```yaml
# vibecode-k8s.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: vibecode-production

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vibecode
  namespace: vibecode-production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: vibecode
  template:
    metadata:
      labels:
        app: vibecode
        version: v1
    spec:
      containers:
      - name: vibecode
        image: vibecode/webgui:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: vibecode-secrets
              key: database-url
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"

---
apiVersion: v1
kind: Service
metadata:
  name: vibecode
  namespace: vibecode-production
spec:
  selector:
    app: vibecode
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP

---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: vibecode
  namespace: vibecode-production
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - vibecode.yourdomain.com
    secretName: vibecode-tls
  rules:
  - host: vibecode.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: vibecode
            port:
              number: 80
```

---

## Environment Variables

### Required
```bash
DATABASE_URL="postgresql://user:pass@host:5432/vibecode"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
```

### Optional
```bash
# Datadog
DD_API_KEY="your-datadog-api-key"
DD_SITE="datadoghq.com"
DD_SERVICE="vibecode"
DD_ENV="production"

# AI Providers
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
GOOGLE_AI_API_KEY="..."

# OAuth
GITHUB_CLIENT_ID="..."
GITHUB_CLIENT_SECRET="..."
```

---

## Troubleshooting

### Container won't start
```bash
# Check logs
docker logs vibecode

# Check if port is in use
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows
```

### Database connection issues
```bash
# Test connection
docker exec -it vibecode-db psql -U postgres -d vibecode

# Check network
docker network inspect bridge
```

### Permission issues (NAS)
```bash
# Fix permissions
chmod -R 755 /share/Container/vibecode
chown -R admin:administrators /share/Container/vibecode
```

---

## Next Steps

- [Production Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Kubernetes Deployment](./azure-aks-deployment.md)
- [Monitoring Setup](./postgres-datadog-monitoring.md)
- [Backup & Recovery](./BACKUP_GUIDE.md)

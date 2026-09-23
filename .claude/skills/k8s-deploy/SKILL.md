---
name: k8s-deploy
description: Helm and Kubernetes deployment operations for ACR/AKS production, KIND local development, and resource management. Use for deploying charts, managing pods/services, configuring ingress, and troubleshooting K8s workloads.
---

# Kubernetes Deployment Skill

Comprehensive Helm and Kubernetes deployment automation for production (ACR/AKS) and local development (KIND).

## Project Resources

- **Helm Charts**: `deploy/helm/` - Production-ready Helm charts
- **Infrastructure**: `infra/tundra-dome/` - KIND cluster and Datadog integration
- **Deployment Scripts**: `infra/tundra-dome/deploy.sh` - Automated KIND deployment

## Quick Reference

### Helm Chart Deployment

#### Deploy to AKS (Production)

```bash
# Login to Azure and ACR
az login
az acr login --name vibecodeacr

# Deploy with Helm
helm upgrade --install vibecode-webgui deploy/helm/vibecode-webgui \
  --namespace production \
  --create-namespace \
  --set image.repository=vibecodeacr.azurecr.io/vibecode-webgui \
  --set image.tag=1.5.0 \
  --set environment=production

# Deploy with custom values file
helm upgrade --install vibecode-webgui deploy/helm/vibecode-webgui \
  -f deploy/helm/vibecode-webgui/values-production.yaml \
  --namespace production
```

#### Push Chart to ACR

```bash
# Package and push Helm chart to ACR
helm package deploy/helm/vibecode-webgui
helm push vibecode-webgui-1.0.0.tgz oci://vibecodeacr.azurecr.io/helm

# Pull chart from ACR
helm pull oci://vibecodeacr.azurecr.io/helm/vibecode-webgui --version 1.0.0
```

#### Template and Dry-Run

```bash
# Render templates locally (debug)
helm template vibecode-webgui deploy/helm/vibecode-webgui \
  --namespace production \
  --debug

# Dry-run against cluster
helm upgrade --install vibecode-webgui deploy/helm/vibecode-webgui \
  --namespace production \
  --dry-run
```

### KIND Local Development

#### Create KIND Cluster

```bash
# Using deploy script (recommended)
cd infra/tundra-dome && ./deploy.sh

# Manual creation with config
kind create cluster --config infra/tundra-dome/kind-config.yaml

# Quick cluster with port mappings
cat <<EOF | kind create cluster --config=-
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: dev-cluster
nodes:
  - role: control-plane
  - role: worker
    extraPortMappings:
      - containerPort: 30080
        hostPort: 8080
        protocol: TCP
EOF
```

#### Load Local Images to KIND

```bash
# Build and load image to KIND
docker build -t myapp:latest .
kind load docker-image myapp:latest --name tundra-dome

# Verify loaded images
docker exec -it tundra-dome-control-plane crictl images
```

#### KIND Cluster Management

```bash
# List clusters
kind get clusters

# Delete cluster
kind delete cluster --name tundra-dome

# Get kubeconfig
kind get kubeconfig --name tundra-dome > ~/.kube/kind-config
```

### Kubernetes Resource Management

#### Namespace Operations

```bash
# Create namespace with labels
kubectl create namespace production --dry-run=client -o yaml | kubectl apply -f -
kubectl label namespace production env=production team=vibecode --overwrite

# List namespaces with labels
kubectl get namespaces --show-labels
```

#### Deployment Operations

```bash
# Scale deployment
kubectl scale deployment vibecode-webgui --replicas=5 -n production

# Rollout status
kubectl rollout status deployment/vibecode-webgui -n production

# Rollback deployment
kubectl rollout undo deployment/vibecode-webgui -n production
kubectl rollout undo deployment/vibecode-webgui -n production --to-revision=2

# Restart deployment (triggers rolling update)
kubectl rollout restart deployment/vibecode-webgui -n production
```

#### Pod Management

```bash
# List pods with labels
kubectl get pods -n production -l app=vibecode-webgui -o wide

# Describe pod for events
kubectl describe pod <pod-name> -n production

# Get pod logs
kubectl logs -f <pod-name> -n production
kubectl logs -f deployment/vibecode-webgui -n production --all-containers

# Execute into pod
kubectl exec -it <pod-name> -n production -- /bin/sh

# Port forward to pod
kubectl port-forward pod/<pod-name> 8080:3000 -n production
kubectl port-forward svc/vibecode-webgui 8080:80 -n production
```

### ConfigMaps and Secrets

#### ConfigMap Operations

```bash
# Create ConfigMap from literal values
kubectl create configmap app-config \
  --from-literal=NODE_ENV=production \
  --from-literal=LOG_LEVEL=info \
  -n production

# Create ConfigMap from file
kubectl create configmap nginx-config \
  --from-file=nginx.conf \
  -n production

# Create ConfigMap from directory
kubectl create configmap app-configs \
  --from-file=config/ \
  -n production

# View ConfigMap
kubectl get configmap app-config -n production -o yaml
```

#### Secret Operations

```bash
# Create Secret from literal values
kubectl create secret generic db-credentials \
  --from-literal=username=admin \
  --from-literal=password=secret123 \
  -n production

# Create Secret from file
kubectl create secret generic tls-cert \
  --from-file=tls.crt=./cert.pem \
  --from-file=tls.key=./key.pem \
  -n production

# Create Docker registry secret
kubectl create secret docker-registry acr-secret \
  --docker-server=vibecodeacr.azurecr.io \
  --docker-username=service-principal-id \
  --docker-password=service-principal-secret \
  -n production

# Decode secret value
kubectl get secret db-credentials -n production -o jsonpath='{.data.password}' | base64 -d
```

### Ingress Configuration

#### NGINX Ingress

```bash
# Install NGINX Ingress Controller
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace

# Create Ingress resource
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: vibecode-webgui
  namespace: production
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - app.vibecode.dev
      secretName: vibecode-webgui-tls
  rules:
    - host: app.vibecode.dev
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: vibecode-webgui
                port:
                  number: 80
EOF
```

#### Cert-Manager for TLS

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.0/cert-manager.yaml

# Create ClusterIssuer for Let's Encrypt
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@vibecode.dev
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
EOF
```

### Datadog Integration in Kubernetes

#### Deploy Datadog Agent

```bash
# Add Datadog Helm repo
helm repo add datadog https://helm.datadoghq.com
helm repo update

# Install Datadog Agent
helm install datadog datadog/datadog \
  --namespace datadog \
  --create-namespace \
  --set datadog.apiKey=$DD_API_KEY \
  --set datadog.site=datadoghq.com \
  --set datadog.clusterName=tundra-dome \
  --set datadog.apm.portEnabled=true \
  --set datadog.logs.enabled=true \
  --set datadog.logs.containerCollectAll=true

# Or use values file
helm install datadog datadog/datadog \
  -f infra/tundra-dome/datadog.yaml \
  --namespace datadog
```

#### Application Annotations for Datadog

```yaml
# Pod annotations for log collection and APM
metadata:
  annotations:
    ad.datadoghq.com/vibecode-webgui.logs: '[{"source":"nodejs","service":"vibecode-webgui"}]'
    ad.datadoghq.com/vibecode-webgui.tags: '{"env":"production","team":"vibecode"}'
```

#### Datadog Environment Variables

```yaml
# Add to deployment container spec
env:
  - name: DD_AGENT_HOST
    valueFrom:
      fieldRef:
        fieldPath: status.hostIP
  - name: DD_SERVICE
    value: "vibecode-webgui"
  - name: DD_ENV
    value: "production"
  - name: DD_VERSION
    value: "1.5.0"
  - name: DD_LOGS_INJECTION
    value: "true"
  - name: DD_TRACE_ENABLED
    value: "true"
  - name: DD_PROFILING_ENABLED
    value: "true"
```

### Troubleshooting Pods

#### Pod Status Investigation

```bash
# Get detailed pod status
kubectl get pods -n production -o wide
kubectl describe pod <pod-name> -n production

# Check events
kubectl get events -n production --sort-by='.lastTimestamp'
kubectl get events -n production --field-selector involvedObject.name=<pod-name>

# Check resource usage
kubectl top pods -n production
kubectl top nodes
```

#### Common Pod Issues

```bash
# CrashLoopBackOff - check logs
kubectl logs <pod-name> -n production --previous
kubectl describe pod <pod-name> -n production | grep -A 20 "Events:"

# ImagePullBackOff - check image and secrets
kubectl describe pod <pod-name> -n production | grep -A 5 "Events:"
kubectl get secret acr-secret -n production

# Pending - check resources and node selector
kubectl describe pod <pod-name> -n production | grep -A 10 "Events:"
kubectl get nodes -o wide
kubectl describe node <node-name> | grep -A 10 "Allocated resources"

# OOMKilled - check memory limits
kubectl describe pod <pod-name> -n production | grep -A 5 "Last State:"
kubectl top pod <pod-name> -n production --containers
```

#### Debug Pods

```bash
# Run debug pod in namespace
kubectl run debug --rm -it --image=busybox -n production -- /bin/sh

# Run debug pod with network tools
kubectl run netshoot --rm -it --image=nicolaka/netshoot -n production -- /bin/bash

# Copy files from pod
kubectl cp production/<pod-name>:/app/logs/error.log ./error.log

# Attach to running container
kubectl attach <pod-name> -n production -c <container-name> -it
```

#### Network Troubleshooting

```bash
# Test DNS resolution
kubectl run dns-test --rm -it --image=busybox -n production -- nslookup kubernetes.default

# Test service connectivity
kubectl run curl-test --rm -it --image=curlimages/curl -n production -- curl -v http://vibecode-webgui:80

# Check endpoints
kubectl get endpoints vibecode-webgui -n production
kubectl describe svc vibecode-webgui -n production
```

### Useful Helm Commands

```bash
# List releases
helm list -n production
helm list --all-namespaces

# Get release history
helm history vibecode-webgui -n production

# Get release values
helm get values vibecode-webgui -n production
helm get values vibecode-webgui -n production --all

# Get release manifest
helm get manifest vibecode-webgui -n production

# Uninstall release
helm uninstall vibecode-webgui -n production

# Lint chart
helm lint deploy/helm/vibecode-webgui

# Show chart info
helm show chart deploy/helm/vibecode-webgui
helm show values deploy/helm/vibecode-webgui
```

### Resource Cleanup

```bash
# Delete all pods in error state
kubectl delete pods -n production --field-selector=status.phase=Failed

# Delete evicted pods
kubectl get pods -n production | grep Evicted | awk '{print $1}' | xargs kubectl delete pod -n production

# Force delete stuck pod
kubectl delete pod <pod-name> -n production --grace-period=0 --force

# Delete all resources in namespace
kubectl delete all --all -n test-namespace

# Delete namespace and all contents
kubectl delete namespace test-namespace
```

## Values File Reference

Based on `deploy/helm/vibecode-webgui/values.yaml`:

```yaml
# Key configuration sections
image:
  repository: vibecodeacr.azurecr.io/vibecode-webgui
  tag: "latest"
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 80
  targetPort: 3000

ingress:
  enabled: true
  className: "nginx"
  hosts:
    - host: app.vibecode.dev
      paths:
        - path: /
          pathType: Prefix

deployment:
  replicaCount: 2
  resources:
    requests:
      memory: "512Mi"
      cpu: "250m"
    limits:
      memory: "2Gi"
      cpu: "1000m"

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10

monitoring:
  datadog:
    enabled: true
    tags:
      - "service:vibecode-webgui"
```

## Prerequisites

- kubectl configured with cluster access
- Helm 3.x installed
- Docker running (for KIND)
- KIND installed (for local development)
- Azure CLI (for ACR/AKS operations)

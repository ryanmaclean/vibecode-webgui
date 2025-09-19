#!/usr/bin/env bash
# AKS Application Deployment - Deploy VibeCode WebGUI to AKS
set -euo pipefail

# Source common configuration
CLUSTER_NAME=${CLUSTER_NAME:-vibecode-aks}
RESOURCE_GROUP=${RESOURCE_GROUP:-vibecode-rg}
ACR_NAME=${ACR_NAME:-vibecodecr}
NAMESPACE=${NAMESPACE:-vibecode-platform}
IMAGE_TAG=${IMAGE_TAG:-latest}
LOCATION=${LOCATION:-eastus2}

log() {
  printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"
}

error() {
  printf '[%s] ERROR: %s\n' "$(date +%H:%M:%S)" "$*" >&2
  exit 1
}

log "deploying VibeCode WebGUI application to AKS"

# Ensure namespace exists
log "ensuring namespace $NAMESPACE exists"
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

# Create application secrets
log "creating application secrets"
kubectl -n "$NAMESPACE" create secret generic vibecode-secrets \
  --from-literal=DATABASE_URL="${DATABASE_URL:-postgresql://postgres:${POSTGRES_PASSWORD:-changeme}@postgresql:5432/vibecode}" \
  --from-literal=NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-$(openssl rand -base64 32)}" \
  --from-literal=NODE_ENV="${NODE_ENV:-production}" \
  --from-literal=DD_API_KEY="${DD_API_KEY:-}" \
  --from-literal=DD_APP_KEY="${DD_APP_KEY:-}" \
  --from-literal=OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-}" \
  --dry-run=client -o yaml | kubectl apply -f -

# Check if Helm chart exists
CHART_PATH="charts/vibecode"
if [ ! -d "$CHART_PATH" ]; then
  log "creating basic Helm chart structure"
  mkdir -p "$CHART_PATH/templates"
  
  # Create basic Chart.yaml
  cat > "$CHART_PATH/Chart.yaml" << EOF
apiVersion: v2
name: vibecode
description: VibeCode WebGUI - AI-Powered Development Platform
type: application
version: 1.0.0
appVersion: "1.0.0"
EOF

  # Create basic values.yaml
  cat > "$CHART_PATH/values.yaml" << EOF
image:
  repository: ${ACR_NAME}.azurecr.io/vibecode-webgui
  tag: ${IMAGE_TAG}
  pullPolicy: IfNotPresent

replicaCount: 2

service:
  type: ClusterIP
  port: 80
  targetPort: 3000

ingress:
  enabled: true
  className: nginx
  hostname: vibecode.${LOCATION}.cloudapp.azure.com
  
resources:
  limits:
    cpu: 1000m
    memory: 2Gi
  requests:
    cpu: 500m
    memory: 1Gi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

postgresql:
  enabled: false  # Using external PostgreSQL

env:
  NODE_ENV: production
EOF

  # Create basic deployment template
  cat > "$CHART_PATH/templates/deployment.yaml" << 'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "vibecode.fullname" . }}
  labels:
    app.kubernetes.io/name: vibecode
    app.kubernetes.io/instance: {{ .Release.Name }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      app.kubernetes.io/name: vibecode
      app.kubernetes.io/instance: {{ .Release.Name }}
  template:
    metadata:
      labels:
        app.kubernetes.io/name: vibecode
        app.kubernetes.io/instance: {{ .Release.Name }}
    spec:
      containers:
        - name: vibecode
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: 3000
              protocol: TCP
          env:
            - name: NODE_ENV
              value: {{ .Values.env.NODE_ENV | quote }}
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: vibecode-secrets
                  key: DATABASE_URL
            - name: NEXTAUTH_SECRET
              valueFrom:
                secretKeyRef:
                  name: vibecode-secrets
                  key: NEXTAUTH_SECRET
          livenessProbe:
            httpGet:
              path: /api/health
              port: http
            initialDelaySeconds: 60
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /api/health
              port: http
            initialDelaySeconds: 30
            periodSeconds: 10
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
EOF

  # Create basic service template
  cat > "$CHART_PATH/templates/service.yaml" << 'EOF'
apiVersion: v1
kind: Service
metadata:
  name: {{ include "vibecode.fullname" . }}
  labels:
    app.kubernetes.io/name: vibecode
    app.kubernetes.io/instance: {{ .Release.Name }}
spec:
  type: {{ .Values.service.type }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: {{ .Values.service.targetPort }}
      protocol: TCP
      name: http
  selector:
    app.kubernetes.io/name: vibecode
    app.kubernetes.io/instance: {{ .Release.Name }}
EOF

  # Create helpers template
  cat > "$CHART_PATH/templates/_helpers.tpl" << 'EOF'
{{- define "vibecode.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}
EOF

  log "created basic Helm chart structure"
fi

# Build and push image to ACR if Dockerfile exists
if [ -f "Dockerfile.production" ] && command -v docker >/dev/null 2>&1; then
  log "building and pushing application image"
  
  # Build image
  docker build -f Dockerfile.production -t "$ACR_NAME.azurecr.io/vibecode-webgui:$IMAGE_TAG" .
  
  # Push to ACR
  docker push "$ACR_NAME.azurecr.io/vibecode-webgui:$IMAGE_TAG"
  
  log "✅ Image pushed to ACR: $ACR_NAME.azurecr.io/vibecode-webgui:$IMAGE_TAG"
else
  log "⚠️ Skipping image build (Dockerfile.production not found or Docker not available)"
fi

# Deploy application using Helm
log "deploying application with Helm"
helm upgrade --install vibecode-app "$CHART_PATH" \
  --namespace "$NAMESPACE" \
  --set image.repository="$ACR_NAME.azurecr.io/vibecode-webgui" \
  --set image.tag="$IMAGE_TAG" \
  --set ingress.hostname="vibecode.${LOCATION}.cloudapp.azure.com" \
  --wait --timeout=600s

# Wait for deployment to be ready
log "waiting for application deployment to be ready"
kubectl -n "$NAMESPACE" rollout status deployment/vibecode-app --timeout=600s

# Get deployment status
log "checking deployment status"
kubectl -n "$NAMESPACE" get pods -l app.kubernetes.io/name=vibecode -o wide
kubectl -n "$NAMESPACE" get services -l app.kubernetes.io/name=vibecode

# Get ingress information
if kubectl -n "$NAMESPACE" get ingress >/dev/null 2>&1; then
  log "ingress configuration:"
  kubectl -n "$NAMESPACE" get ingress
fi

log "✅ VibeCode WebGUI application deployment complete!"
log ""
log "📊 Application Summary:"
log "  Namespace: $NAMESPACE"
log "  Image: $ACR_NAME.azurecr.io/vibecode-webgui:$IMAGE_TAG"
log "  Hostname: vibecode.${LOCATION}.cloudapp.azure.com"
log ""
log "🔍 Access Application:"
log "  External: https://vibecode.${LOCATION}.cloudapp.azure.com (after DNS setup)"
log "  Port-forward: kubectl -n $NAMESPACE port-forward svc/vibecode-app 3000:80"
log "  Logs: kubectl -n $NAMESPACE logs -f deployment/vibecode-app"
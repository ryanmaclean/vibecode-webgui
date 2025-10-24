#!/usr/bin/env bash
set -euo pipefail

# OpenTofu-First AKS Deployment
# Uses existing OpenTofu infrastructure definitions with minimal bash orchestration

TOFU_DIR=${TOFU_DIR:-tofu}
ENV_FILE=${ENV_FILE:-.env.aks}
WORKSPACE=${WORKSPACE:-default}

log() {
  printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"
}

error() {
  printf '[%s] ERROR: %s\n' "$(date +%H:%M:%S)" "$*" >&2
  exit 1
}

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    error "Missing dependency: $1"
  fi
}

log "validating OpenTofu-first AKS deployment"
require tofu
require kubectl
require helm
require az

# Load environment configuration
if [ -f "$ENV_FILE" ]; then
  log "loading environment from $ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
else
  log "creating default environment file: $ENV_FILE"
  cat > "$ENV_FILE" <<EOF
# OpenTofu Variables
TF_VAR_project_name=vibecode
TF_VAR_environment=dev
TF_VAR_location=East US 2
TF_VAR_resource_group_name=vibecode-rg

# Datadog Configuration
TF_VAR_datadog_api_key=your-datadog-api-key
TF_VAR_datadog_app_key=your-datadog-app-key

# PostgreSQL Configuration
TF_VAR_postgresql_admin_password=\$(openssl rand -base64 32)

# Application Configuration
TF_VAR_app_image_tag=latest
TF_VAR_ingress_hostname=vibecode.eastus2.cloudapp.azure.com

# Azure Container Registry
TF_VAR_acr_name=vibecodecr
EOF
  error "Please configure $ENV_FILE with your values and run again"
fi

# Validate required variables
required_vars=(
  "TF_VAR_datadog_api_key"
  "TF_VAR_resource_group_name"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var:-}" ]; then
    error "$var is required but not set in $ENV_FILE"
  fi
done

# Change to OpenTofu directory
cd "$TOFU_DIR"

# Initialize OpenTofu
log "initializing OpenTofu"
tofu init

# Create workspace if it doesn't exist
if ! tofu workspace list | grep -q "$WORKSPACE"; then
  log "creating OpenTofu workspace: $WORKSPACE"
  tofu workspace new "$WORKSPACE"
else
  log "selecting OpenTofu workspace: $WORKSPACE"
  tofu workspace select "$WORKSPACE"
fi

# Plan deployment
log "planning OpenTofu deployment"
tofu plan -out=tfplan

# Apply deployment
log "applying OpenTofu deployment"
tofu apply tfplan

# Get outputs for kubectl configuration
log "retrieving OpenTofu outputs"
CLUSTER_NAME=$(tofu output -raw aks_cluster_name)
RESOURCE_GROUP=$(tofu output -raw resource_group_name)
ACR_NAME=$(tofu output -raw acr_name)
KUBE_CONFIG_RAW=$(tofu output -raw aks_kube_config_raw)

# Configure kubectl using OpenTofu output
log "configuring kubectl from OpenTofu output"
mkdir -p ~/.kube
printf "%s" "$KUBE_CONFIG_RAW" > ~/.kube/config-aks
export KUBECONFIG=~/.kube/config-aks

# Verify cluster connectivity
log "verifying AKS cluster connectivity"
kubectl cluster-info

# Check if Datadog is deployed via OpenTofu
log "checking Datadog deployment status"
if kubectl get namespace vibecode-platform >/dev/null 2>&1; then
  log "✅ Application namespace exists (Datadog resources expected here via OpenTofu)"

  # Wait for Datadog agents to be ready
  log "waiting for Datadog agents to be ready"
  kubectl -n vibecode-platform rollout status daemonset/datadog-agent --timeout=300s || true
  kubectl -n vibecode-platform rollout status deployment/datadog-cluster-agent --timeout=300s || true
else
  log "⚠️  Namespace vibecode-platform not found - check OpenTofu namespace creation"
fi

# Check if PostgreSQL is deployed via OpenTofu
log "checking PostgreSQL deployment status"
if kubectl get namespace vibecode-platform >/dev/null 2>&1; then
  log "✅ Application namespace exists (deployed via OpenTofu)"
  
  # Wait for PostgreSQL to be ready
  log "waiting for PostgreSQL to be ready"
  kubectl -n vibecode-platform rollout status deployment/postgres --timeout=600s || true
  
  # Verify pgvector extension
  verify_pgvector_extension
else
  log "⚠️  Application namespace not found - check OpenTofu PostgreSQL configuration"
fi

# Build and push application image if needed
build_and_push_image

# Deploy application using Helm (not in OpenTofu for easier updates)
deploy_application_helm

log "✅ OpenTofu-first AKS deployment complete!"
log ""
log "📊 Deployment Summary:"
log "  Cluster: $CLUSTER_NAME"
log "  Resource Group: $RESOURCE_GROUP"
log "  ACR: $ACR_NAME"
log "  Namespace: vibecode-platform"
log ""
log "🔍 Useful Commands:"
log "  kubectl get pods -n vibecode-platform"
log "  kubectl get pods -n datadog"
log "  kubectl logs -f deployment/vibecode-app -n vibecode-platform"

verify_pgvector_extension() {
  log "verifying pgvector extension"
  
  # Get PostgreSQL pod
  local pod_name
  pod_name=$(kubectl -n vibecode-platform get pods -l app=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
  
  if [ -n "$pod_name" ]; then
    # Test pgvector extension
    local extension_check
    extension_check=$(kubectl -n vibecode-platform exec "$pod_name" -- psql -U vibecode -d vibecode -t -c "SELECT extname FROM pg_extension WHERE extname='vector';" 2>/dev/null | tr -d ' ' || echo "")
    
    if [ "$extension_check" = "vector" ]; then
      log "✅ pgvector extension verified"
    else
      log "⚠️  pgvector extension not found"
    fi
  else
    log "⚠️  PostgreSQL pod not found"
  fi
}

build_and_push_image() {
  log "building and pushing application image"
  
  # Return to project root
  cd ..
  
  if [ -f "docker/Dockerfile" ]; then
    local image_tag="${TF_VAR_app_image_tag:-latest}"
    local full_image="$ACR_NAME.azurecr.io/vibecode-webgui:$image_tag"
    
    log "building image: $full_image"
    docker build -f docker/Dockerfile --target production -t "$full_image" .
    
    log "pushing to ACR: $full_image"
    az acr login --name "$ACR_NAME"
    docker push "$full_image"
    
    log "✅ Image pushed: $full_image"
  else
    log "⚠️  docker/Dockerfile not found, skipping image build"
  fi
}

deploy_application_helm() {
  log "deploying application with Helm"
  
  # Create Helm chart if it doesn't exist
  if [ ! -d "charts/vibecode" ]; then
    log "creating Helm chart"
    mkdir -p charts/vibecode/templates
    create_helm_chart
  fi
  
  # Deploy with Helm
  local image_tag="${TF_VAR_app_image_tag:-latest}"
  local ingress_hostname="${TF_VAR_ingress_hostname:-vibecode.eastus2.cloudapp.azure.com}"
  
  helm upgrade --install vibecode-app charts/vibecode \
    --namespace vibecode-platform \
    --set image.repository="$ACR_NAME.azurecr.io/vibecode-webgui" \
    --set image.tag="$image_tag" \
    --set ingress.hostname="$ingress_hostname" \
    --set datadog.enabled=true \
    --set datadog.env="${TF_VAR_environment:-dev}" \
    --set datadog.service="vibecode-webgui" \
    --set datadog.version="$image_tag" \
    --wait --timeout=600s
  
  log "✅ Application deployed with Helm"
}

create_helm_chart() {
  log "creating production Helm chart"
  
  # Chart.yaml
  cat > charts/vibecode/Chart.yaml <<EOF
apiVersion: v2
name: vibecode
description: VibeCode WebGUI - AI-Powered Development Platform with pgvector + Datadog
type: application
version: 1.0.0
appVersion: "1.0.0"
keywords:
  - ai
  - development
  - pgvector
  - datadog
home: https://github.com/ryanmaclean/vibecode-webgui
maintainers:
  - name: VibeCode Team
EOF

  # Values.yaml with production defaults
  cat > charts/vibecode/values.yaml <<EOF
# VibeCode Production Configuration
image:
  repository: ""  # Set via --set
  tag: "latest"
  pullPolicy: IfNotPresent

replicaCount: 3

service:
  type: ClusterIP
  port: 80
  targetPort: 3000

ingress:
  enabled: true
  className: nginx
  hostname: ""  # Set via --set
  tls:
    enabled: true
    secretName: vibecode-tls

resources:
  limits:
    cpu: 2000m
    memory: 4Gi
  requests:
    cpu: 500m
    memory: 1Gi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 20
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

# Datadog configuration
datadog:
  enabled: true
  env: "production"
  service: "vibecode-webgui"
  version: "latest"
  dynamicInstrumentation: true
  profiling: true
  logsInjection: true
  site: "datadoghq.com"
  llmObsEnabled: "1"
  llmObsAgentless: "1"
  mlApp: "vibecode-ai"

# Security context
securityContext:
  runAsNonRoot: true
  runAsUser: 1001
  fsGroup: 1001

# Node selection
nodeSelector:
  kubernetes.io/os: linux

# Tolerations for spot instances
tolerations:
  - key: "kubernetes.azure.com/scalesetpriority"
    operator: "Equal"
    value: "spot"
    effect: "NoSchedule"

# Pod disruption budget
podDisruptionBudget:
  enabled: true
  minAvailable: 2

# Health checks
healthCheck:
  enabled: true
  path: /api/health
  initialDelaySeconds: 30
  periodSeconds: 30
  timeoutSeconds: 10
  readinessInitialDelaySeconds: 10
  readinessPeriodSeconds: 10
  readinessTimeoutSeconds: 5
EOF

  # Deployment template with Datadog annotations
  cat > charts/vibecode/templates/deployment.yaml <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "vibecode.fullname" . }}
  labels:
    {{- include "vibecode.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "vibecode.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "vibecode.selectorLabels" . | nindent 8 }}
      annotations:
        {{- if .Values.datadog.enabled }}
        ad.datadoghq.com/vibecode.logs: |
          [{
            "source": "nodejs",
            "service": "{{ .Values.datadog.service }}",
            "log_processing_rules": [{
              "type": "multi_line",
              "name": "log_start_with_date",
              "pattern": "\\d{4}-\\d{2}-\\d{2}"
            }]
          }]
        ad.datadoghq.com/vibecode.check_names: |
          ["http_check"]
        ad.datadoghq.com/vibecode.init_configs: |
          [{}]
        ad.datadoghq.com/vibecode.instances: |
          [{
            "name": "vibecode-health-check",
            "url": "http://%%host%%:3000{{ .Values.healthCheck.path }}",
            "timeout": {{ .Values.healthCheck.timeoutSeconds }}
          }]
        {{- end }}
    spec:
      {{- with .Values.nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.tolerations }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      securityContext:
        {{- toYaml .Values.securityContext | nindent 8 }}
      containers:
        - name: vibecode
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.service.targetPort }}
              protocol: TCP
          env:
            - name: NODE_ENV
              value: "production"
            - name: PORT
              value: "{{ .Values.service.targetPort }}"
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
            {{- if .Values.datadog.enabled }}
            - name: DD_ENV
              value: {{ .Values.datadog.env | quote }}
            - name: DD_SERVICE
              value: {{ .Values.datadog.service | quote }}
            - name: DD_VERSION
              value: {{ .Values.datadog.version | quote }}
            - name: DD_DYNAMIC_INSTRUMENTATION_ENABLED
              value: {{ .Values.datadog.dynamicInstrumentation | quote }}
            - name: DD_PROFILING_ENABLED
              value: {{ .Values.datadog.profiling | quote }}
            - name: DD_LOGS_INJECTION
              value: {{ .Values.datadog.logsInjection | quote }}
            - name: DD_SITE
              value: {{ .Values.datadog.site | quote }}
            - name: DD_TRACE_ENABLED
              value: "true"
            - name: DD_RUNTIME_METRICS_ENABLED
              value: "true"
            - name: DD_SOURCE_MAP_PATH
              value: "/app/source-maps"
            - name: DD_LLMOBS_ENABLED
              value: {{ .Values.datadog.llmObsEnabled | quote }}
            - name: DD_LLMOBS_AGENTLESS_ENABLED
              value: {{ .Values.datadog.llmObsAgentless | quote }}
            - name: DD_LLMOBS_ML_APP
              value: {{ .Values.datadog.mlApp | quote }}
            {{- end }}
          {{- if .Values.healthCheck.enabled }}
          livenessProbe:
            httpGet:
              path: {{ .Values.healthCheck.path }}
              port: http
            initialDelaySeconds: {{ .Values.healthCheck.initialDelaySeconds }}
            periodSeconds: {{ .Values.healthCheck.periodSeconds }}
            timeoutSeconds: {{ .Values.healthCheck.timeoutSeconds }}
          readinessProbe:
            httpGet:
              path: {{ .Values.healthCheck.path }}
              port: http
            initialDelaySeconds: {{ .Values.healthCheck.readinessInitialDelaySeconds }}
            periodSeconds: {{ .Values.healthCheck.readinessPeriodSeconds }}
            timeoutSeconds: {{ .Values.healthCheck.readinessTimeoutSeconds }}
          {{- end }}
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          volumeMounts:
            - name: source-maps
              mountPath: /app/source-maps
              readOnly: true
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: source-maps
          emptyDir: {}
        - name: tmp
          emptyDir: {}
EOF

  # Service template
  cat > charts/vibecode/templates/service.yaml <<'EOF'
apiVersion: v1
kind: Service
metadata:
  name: {{ include "vibecode.fullname" . }}
  labels:
    {{- include "vibecode.labels" . | nindent 4 }}
spec:
  type: {{ .Values.service.type }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: {{ .Values.service.targetPort }}
      protocol: TCP
      name: http
  selector:
    {{- include "vibecode.selectorLabels" . | nindent 4 }}
EOF

  # HPA template
  cat > charts/vibecode/templates/hpa.yaml <<'EOF'
{{- if .Values.autoscaling.enabled }}
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ include "vibecode.fullname" . }}-hpa
  labels:
    {{- include "vibecode.labels" . | nindent 4 }}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ include "vibecode.fullname" . }}
  minReplicas: {{ .Values.autoscaling.minReplicas }}
  maxReplicas: {{ .Values.autoscaling.maxReplicas }}
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: {{ .Values.autoscaling.targetCPUUtilizationPercentage }}
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: {{ .Values.autoscaling.targetMemoryUtilizationPercentage }}
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 30
      - type: Pods
        value: 2
        periodSeconds: 30
      selectPolicy: Max
{{- end }}
EOF

  # Ingress template
  cat > charts/vibecode/templates/ingress.yaml <<'EOF'
{{- if .Values.ingress.enabled }}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "vibecode.fullname" . }}-ingress
  labels:
    {{- include "vibecode.labels" . | nindent 4 }}
  annotations:
    kubernetes.io/ingress.class: {{ .Values.ingress.className }}
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    {{- if .Values.ingress.tls.enabled }}
    cert-manager.io/cluster-issuer: letsencrypt-prod
    {{- end }}
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "600"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "600"
spec:
  {{- if .Values.ingress.tls.enabled }}
  tls:
    - hosts:
        - {{ .Values.ingress.hostname }}
      secretName: {{ .Values.ingress.tls.secretName }}
  {{- end }}
  rules:
    - host: {{ .Values.ingress.hostname }}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: {{ include "vibecode.fullname" . }}
                port:
                  number: {{ .Values.service.port }}
{{- end }}
EOF

  # PDB template
  cat > charts/vibecode/templates/pdb.yaml <<'EOF'
{{- if .Values.podDisruptionBudget.enabled }}
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: {{ include "vibecode.fullname" . }}-pdb
  labels:
    {{- include "vibecode.labels" . | nindent 4 }}
spec:
  minAvailable: {{ .Values.podDisruptionBudget.minAvailable }}
  selector:
    matchLabels:
      {{- include "vibecode.selectorLabels" . | nindent 6 }}
{{- end }}
EOF

  # Helpers template
  cat > charts/vibecode/templates/_helpers.tpl <<'EOF'
{{- define "vibecode.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

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

{{- define "vibecode.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "vibecode.labels" -}}
helm.sh/chart: {{ include "vibecode.chart" . }}
{{ include "vibecode.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "vibecode.selectorLabels" -}}
app.kubernetes.io/name: {{ include "vibecode.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
EOF

  log "✅ Production Helm chart created"
}

# Change back to original directory on exit
trap 'cd ..' EXIT

# Run main deployment
main() {
  log "starting OpenTofu-first AKS deployment"
  # All the work is done in the main script body
}

main "$@"

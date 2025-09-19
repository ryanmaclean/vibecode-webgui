#!/usr/bin/env bash
set -euo pipefail

# VibeCode Application deployment for AKS
# Builds container images, pushes to ACR, and deploys with source maps + dynamic instrumentation

NAMESPACE=${NAMESPACE:-vibecode-platform}
ACR_NAME=${ACR_NAME:-vibecodecr}
APP_VERSION=${APP_VERSION:-$(git rev-parse --short HEAD 2>/dev/null || echo "latest")}

log() {
  printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"
}

error() {
  printf '[%s] ERROR: %s\n' "$(date +%H:%M:%S)" "$*" >&2
  exit 1
}

# Load credentials if available
if [ -f .aks-postgres-credentials ]; then
  # shellcheck disable=SC1091
  source .aks-postgres-credentials
fi

build_and_push_images() {
  log "building and pushing container images to ACR"
  
  local app_image="${ACR_NAME}.azurecr.io/vibecode-webgui:${APP_VERSION}"
  
  log "building application image with source maps"
  docker build -f Dockerfile.aks -t "$app_image" .
  
  log "pushing image to ACR"
  docker push "$app_image"
  
  log "image pushed: $app_image"
  echo "$app_image" > .aks-image-tag
}

create_vibecode_aks_manifests() {
  local app_image="$1"
  
  log "creating VibeCode AKS deployment manifests"
  
  mkdir -p k8s
  
  cat > k8s/vibecode-aks-deployment.yaml <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: vibecode-secrets
  namespace: $NAMESPACE
type: Opaque
stringData:
  NODE_ENV: production
  DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD:-password}@postgresql:5432/vibecode
  NEXTAUTH_SECRET: ${NEXTAUTH_SECRET:-$(openssl rand -base64 32)}
  NEXTAUTH_URL: ${NEXTAUTH_URL:-https://vibecode.example.com}
  DD_API_KEY: ${DD_API_KEY:-}
  DD_APP_KEY: ${DD_APP_KEY:-}
  DD_SITE: ${DD_SITE:-datadoghq.com}
  DD_ENV: production
  DD_SERVICE: vibecode-webgui
  DD_VERSION: $APP_VERSION
  OPENROUTER_API_KEY: ${OPENROUTER_API_KEY:-}
  AZURE_OPENAI_API_KEY: ${AZURE_OPENAI_API_KEY:-}
  AZURE_OPENAI_ENDPOINT: ${AZURE_OPENAI_ENDPOINT:-}
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vibecode-webgui
  namespace: $NAMESPACE
  labels:
    app: vibecode-webgui
    version: $APP_VERSION
spec:
  replicas: 3
  selector:
    matchLabels:
      app: vibecode-webgui
  template:
    metadata:
      labels:
        app: vibecode-webgui
        version: $APP_VERSION
      annotations:
        ad.datadoghq.com/vibecode-webgui.logs: |
          [{"source": "nodejs", "service": "vibecode-webgui", "log_processing_rules": [{"type": "multi_line", "name": "log_start_with_date", "pattern": "\\d{4}-\\d{2}-\\d{2}"}]}]
        ad.datadoghq.com/vibecode-webgui.check_names: |
          ["http_check"]
        ad.datadoghq.com/vibecode-webgui.init_configs: |
          [{}]
        ad.datadoghq.com/vibecode-webgui.instances: |
          [{"name": "vibecode-webgui-health", "url": "http://%%host%%:3000/api/health", "timeout": 5}]
    spec:
      containers:
      - name: vibecode-webgui
        image: $app_image
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: PORT
          value: "3000"
        - name: NODE_ENV
          valueFrom:
            secretKeyRef:
              name: vibecode-secrets
              key: NODE_ENV
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
        - name: NEXTAUTH_URL
          valueFrom:
            secretKeyRef:
              name: vibecode-secrets
              key: NEXTAUTH_URL
        - name: DD_API_KEY
          valueFrom:
            secretKeyRef:
              name: vibecode-secrets
              key: DD_API_KEY
        - name: DD_APP_KEY
          valueFrom:
            secretKeyRef:
              name: vibecode-secrets
              key: DD_APP_KEY
        - name: DD_SITE
          valueFrom:
            secretKeyRef:
              name: vibecode-secrets
              key: DD_SITE
        - name: DD_ENV
          valueFrom:
            secretKeyRef:
              name: vibecode-secrets
              key: DD_ENV
        - name: DD_SERVICE
          valueFrom:
            secretKeyRef:
              name: vibecode-secrets
              key: DD_SERVICE
        - name: DD_VERSION
          valueFrom:
            secretKeyRef:
              name: vibecode-secrets
              key: DD_VERSION
        # Dynamic Instrumentation and APM
        - name: DD_DYNAMIC_INSTRUMENTATION_ENABLED
          value: "true"
        - name: DD_PROFILING_ENABLED
          value: "true"
        - name: DD_LOGS_INJECTION
          value: "true"
        - name: DD_TRACE_ENABLED
          value: "true"
        - name: DD_RUNTIME_METRICS_ENABLED
          value: "true"
        # Source maps for Dynamic Instrumentation
        - name: DD_SOURCE_MAP_PATH
          value: "/app/source-maps"
        - name: DD_UPLOAD_SOURCE_MAPS
          value: "true"
        - name: OPENROUTER_API_KEY
          valueFrom:
            secretKeyRef:
              name: vibecode-secrets
              key: OPENROUTER_API_KEY
        - name: AZURE_OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: vibecode-secrets
              key: AZURE_OPENAI_API_KEY
        - name: AZURE_OPENAI_ENDPOINT
          valueFrom:
            secretKeyRef:
              name: vibecode-secrets
              key: AZURE_OPENAI_ENDPOINT
        resources:
          requests:
            cpu: 500m
            memory: 1Gi
          limits:
            cpu: 2000m
            memory: 4Gi
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 30
          timeoutSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 5
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
      nodeSelector:
        kubernetes.io/os: linux
      tolerations:
      - key: kubernetes.azure.com/scalesetpriority
        operator: Equal
        value: spot
        effect: NoSchedule
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
---
apiVersion: v1
kind: Service
metadata:
  name: vibecode-webgui
  namespace: $NAMESPACE
  labels:
    app: vibecode-webgui
spec:
  ports:
  - port: 80
    targetPort: 3000
    name: http
  selector:
    app: vibecode-webgui
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: vibecode-webgui
  namespace: $NAMESPACE
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "600"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "600"
spec:
  tls:
  - hosts:
    - ${INGRESS_HOST:-vibecode.example.com}
    secretName: vibecode-tls
  rules:
  - host: ${INGRESS_HOST:-vibecode.example.com}
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: vibecode-webgui
            port:
              number: 80
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: vibecode-webgui-hpa
  namespace: $NAMESPACE
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: vibecode-webgui
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
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
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: vibecode-webgui-pdb
  namespace: $NAMESPACE
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: vibecode-webgui
EOF
  
  log "VibeCode AKS deployment manifests created"
}

deploy_vibecode_app() {
  log "deploying VibeCode application to AKS"
  
  local app_image
  if [ -f .aks-image-tag ]; then
    app_image=$(cat .aks-image-tag)
  else
    app_image="${ACR_NAME}.azurecr.io/vibecode-webgui:${APP_VERSION}"
  fi
  
  # Create application manifests
  create_vibecode_aks_manifests "$app_image"
  
  log "applying VibeCode application manifests"
  kubectl apply -f k8s/vibecode-aks-deployment.yaml
  
  log "waiting for application deployment"
  kubectl -n "$NAMESPACE" rollout status deployment/vibecode-webgui --timeout=600s
  
  # Run database migrations
  run_database_migrations
  
  log "VibeCode application deployment complete"
  
  # Display deployment info
  display_deployment_info
}

run_database_migrations() {
  log "running database migrations"
  
  # Create migration job
  cat > k8s/migration-job.yaml <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: vibecode-migrations-$(date +%s)
  namespace: $NAMESPACE
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: migrations
        image: $(cat .aks-image-tag)
        command: ["npm", "run", "db:migrate"]
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: vibecode-secrets
              key: DATABASE_URL
      nodeSelector:
        kubernetes.io/os: linux
  backoffLimit: 3
EOF
  
  kubectl apply -f k8s/migration-job.yaml
  
  # Wait for migration to complete
  local job_name
  job_name=$(kubectl get jobs -n "$NAMESPACE" -o name | grep migrations | head -1 | cut -d/ -f2)
  
  if [ -n "$job_name" ]; then
    kubectl wait --for=condition=complete job/"$job_name" -n "$NAMESPACE" --timeout=300s
    log "database migrations completed successfully"
  else
    log "warning: migration job not found, skipping"
  fi
}

display_deployment_info() {
  log "deployment information"
  
  echo ""
  echo "📊 Deployment Summary:"
  echo "  Application: vibecode-webgui"
  echo "  Version: $APP_VERSION"
  echo "  Namespace: $NAMESPACE"
  echo "  Image: $(cat .aks-image-tag 2>/dev/null || echo 'N/A')"
  echo ""
  
  echo "🔍 Useful Commands:"
  echo "  kubectl get pods -n $NAMESPACE"
  echo "  kubectl logs -f deployment/vibecode-webgui -n $NAMESPACE"
  echo "  kubectl exec -it deployment/vibecode-webgui -n $NAMESPACE -- /bin/sh"
  echo ""
  
  echo "📋 Service Information:"
  kubectl get services -n "$NAMESPACE" | grep vibecode-webgui || true
  echo ""
  
  echo "🌐 Ingress Information:"
  kubectl get ingress -n "$NAMESPACE" | grep vibecode-webgui || true
  echo ""
  
  echo "📈 HPA Status:"
  kubectl get hpa -n "$NAMESPACE" | grep vibecode-webgui || true
  echo ""
  
  # Check if ingress host is configured
  local ingress_host
  ingress_host=$(kubectl get ingress vibecode-webgui -n "$NAMESPACE" -o jsonpath='{.spec.rules[0].host}' 2>/dev/null || echo "")
  
  if [ -n "$ingress_host" ] && [ "$ingress_host" != "vibecode.example.com" ]; then
    echo "🚀 Application should be available at: https://$ingress_host"
  else
    echo "⚠️  Configure DNS for your ingress host and update INGRESS_HOST in .env.aks"
  fi
}

# Main execution
main() {
  log "starting VibeCode application deployment to AKS"
  
  build_and_push_images
  deploy_vibecode_app
  
  log "VibeCode application deployment completed successfully!"
}

# Run main function
main "$@"

#!/bin/bash

# Real Workspace Provisioning Script
# Creates actual code-server instances in Kubernetes

set -e

WORKSPACE_ID=$1
USER_ID=$2
PROJECT_NAME=${3:-"default-project"}
NAMESPACE="vibecode"

if [ -z "$WORKSPACE_ID" ] || [ -z "$USER_ID" ]; then
    echo "Usage: $0 <workspace-id> <user-id> [project-name]"
    exit 1
fi

echo "🚀 Provisioning real workspace: $WORKSPACE_ID"
echo "👤 User: $USER_ID"
echo "📁 Project: $PROJECT_NAME"

# Generate unique names
DEPLOYMENT_NAME="code-server-$WORKSPACE_ID"
SERVICE_NAME="code-server-$WORKSPACE_ID-svc"

echo "📝 Creating Kubernetes manifests..."

# Create deployment manifest
cat > "/tmp/$DEPLOYMENT_NAME.yaml" << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: $DEPLOYMENT_NAME
  namespace: $NAMESPACE
  labels:
    app: code-server
    workspace-id: "$WORKSPACE_ID"
    user-id: "$USER_ID"
    project: "$PROJECT_NAME"
spec:
  replicas: 1
  selector:
    matchLabels:
      app: code-server
      workspace-id: "$WORKSPACE_ID"
  template:
    metadata:
      labels:
        app: code-server
        workspace-id: "$WORKSPACE_ID"
        user-id: "$USER_ID"
        project: "$PROJECT_NAME"
    spec:
      securityContext:
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
      containers:
      - name: code-server
        image: codercom/code-server:4.101.2
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 8080
          name: http
        args:
        - --auth=none
        - --disable-telemetry
        - --disable-update-check
        - --proxy-domain=localhost
        - /home/coder/workspace
        env:
        - name: PASSWORD
          value: ""
        - name: SHELL
          value: "/bin/bash"
        - name: HOME
          value: "/home/coder"
        - name: WORKSPACE_ID
          value: "$WORKSPACE_ID"
        - name: USER_ID
          value: "$USER_ID"
        - name: PROJECT_NAME
          value: "$PROJECT_NAME"
        volumeMounts:
        - name: workspace
          mountPath: /home/coder/workspace
        - name: config
          mountPath: /home/coder/.config/code-server
        - name: vscode-settings
          mountPath: /home/coder/.local/share/code-server/User/settings.json
          subPath: settings.json
        - name: vscode-settings
          mountPath: /home/coder/.local/share/code-server/User/keybindings.json
          subPath: keybindings.json
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
      volumes:
      - name: workspace
        persistentVolumeClaim:
          claimName: workspace-$WORKSPACE_ID
      - name: config
        configMap:
          name: code-server-config
      - name: vscode-settings
        configMap:
          name: code-server-config
---
apiVersion: v1
kind: Service
metadata:
  name: $SERVICE_NAME
  namespace: $NAMESPACE
  labels:
    app: code-server
    workspace-id: "$WORKSPACE_ID"
spec:
  type: ClusterIP
  ports:
    - port: 8080
      targetPort: 8080
      protocol: TCP
      name: http
  selector:
    app: code-server
    workspace-id: "$WORKSPACE_ID"
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: workspace-$WORKSPACE_ID
  namespace: $NAMESPACE
  labels:
    workspace-id: "$WORKSPACE_ID"
    user-id: "$USER_ID"
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
EOF

echo "☸️  Deploying to Kubernetes..."

# Deploy to Kubernetes
kubectl apply -f "/tmp/$DEPLOYMENT_NAME.yaml"

echo "⏳ Waiting for deployment to be ready..."

# Wait for deployment to be ready
kubectl wait --for=condition=available --timeout=300s deployment/$DEPLOYMENT_NAME -n $NAMESPACE

echo "🔍 Getting service details..."

# Get service IP
SERVICE_IP=$(kubectl get svc $SERVICE_NAME -n $NAMESPACE -o jsonpath='{.spec.clusterIP}')

echo "✅ Workspace provisioned successfully!"
echo "📊 Details:"
echo "   Deployment: $DEPLOYMENT_NAME"
echo "   Service: $SERVICE_NAME"
echo "   Internal URL: http://$SERVICE_IP:8080"
echo "   Workspace ID: $WORKSPACE_ID"
echo "   User ID: $USER_ID"

# Create workspace info file
cat > "/tmp/workspace-$WORKSPACE_ID-info.json" << EOF
{
  "workspaceId": "$WORKSPACE_ID",
  "userId": "$USER_ID",
  "projectName": "$PROJECT_NAME",
  "deploymentName": "$DEPLOYMENT_NAME",
  "serviceName": "$SERVICE_NAME",
  "internalUrl": "http://$SERVICE_IP:8080",
  "status": "ready",
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo "📄 Workspace info saved to: /tmp/workspace-$WORKSPACE_ID-info.json"

# Cleanup temp files
rm "/tmp/$DEPLOYMENT_NAME.yaml"

echo "🎉 Workspace $WORKSPACE_ID is ready for $USER_ID!"
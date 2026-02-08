#!/bin/bash
set -e

# Tundra Dome Automated KIND Deployment
# Usage: ./deploy.sh [hostname-prefix]
#
# This script deploys a complete Tundra Dome environment to a KIND cluster
# including PostgreSQL, Kafka, Airflow, and Datadog monitoring.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

PREFIX="${1:-$(hostname | cut -d. -f1)}"
CLUSTER_NAME="tundra-dome"
DD_API_KEY="${DD_API_KEY:-c04039be840f88be08fb15e81f9b3e61}"
DD_CLUSTER_NAME="${PREFIX}-tundra-dome"

echo "=== Tundra Dome Deployment for ${PREFIX} ==="
echo "Cluster: ${CLUSTER_NAME}"
echo "DD Cluster Name: ${DD_CLUSTER_NAME}"
echo "Project Dir: ${PROJECT_DIR}"

# Find binaries
KUBECTL=$(which kubectl 2>/dev/null || echo "/opt/homebrew/bin/kubectl")
KIND=$(which kind 2>/dev/null || echo "/opt/homebrew/bin/kind")
HELM=$(which helm 2>/dev/null || echo "/opt/homebrew/bin/helm")

# Ensure Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "Starting Colima..."
    colima start --cpu 4 --memory 8 2>/dev/null || true
    sleep 5
fi

echo ""
echo "=== Step 1: Delete existing cluster ==="
$KIND delete cluster --name $CLUSTER_NAME 2>/dev/null || echo "No existing cluster"
sleep 2

echo ""
echo "=== Step 2: Create KIND cluster ==="
$KIND create cluster --name $CLUSTER_NAME --wait 2m

echo ""
echo "=== Step 3: Create namespace and secrets ==="
$KUBECTL create namespace tundra-dome --context kind-${CLUSTER_NAME}
$KUBECTL create secret generic tundra-dome-secrets \
    --from-literal=DD_API_KEY="${DD_API_KEY}" \
    --from-literal=DD_SITE="datadoghq.com" \
    -n tundra-dome --context kind-${CLUSTER_NAME}

echo ""
echo "=== Step 4: Deploy PostgreSQL ==="
cat <<'EOF' | $KUBECTL apply -n tundra-dome --context kind-${CLUSTER_NAME} -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_USER
          value: airflow
        - name: POSTGRES_PASSWORD
          value: airflow
        - name: POSTGRES_DB
          value: airflow
---
apiVersion: v1
kind: Service
metadata:
  name: postgres-service
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
EOF

echo ""
echo "=== Step 5: Deploy Kafka (apache/kafka:3.9.0) ==="
cat <<'EOF' | $KUBECTL apply -n tundra-dome --context kind-${CLUSTER_NAME} -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kafka
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kafka
  template:
    metadata:
      labels:
        app: kafka
    spec:
      containers:
      - name: kafka
        image: apache/kafka:3.9.0
        ports:
        - containerPort: 9092
        env:
        - name: KAFKA_NODE_ID
          value: "1"
        - name: KAFKA_PROCESS_ROLES
          value: broker,controller
        - name: KAFKA_LISTENERS
          value: PLAINTEXT://:9092,CONTROLLER://:9093
        - name: KAFKA_ADVERTISED_LISTENERS
          value: PLAINTEXT://kafka-service:9092
        - name: KAFKA_CONTROLLER_LISTENER_NAMES
          value: CONTROLLER
        - name: KAFKA_LISTENER_SECURITY_PROTOCOL_MAP
          value: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
        - name: KAFKA_CONTROLLER_QUORUM_VOTERS
          value: 1@localhost:9093
        - name: KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR
          value: "1"
        - name: KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR
          value: "1"
        - name: KAFKA_TRANSACTION_STATE_LOG_MIN_ISR
          value: "1"
        - name: KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS
          value: "0"
        - name: CLUSTER_ID
          value: "MkU3OEVBNTcwNTJENDM2Qk"
---
apiVersion: v1
kind: Service
metadata:
  name: kafka-service
spec:
  selector:
    app: kafka
  ports:
  - name: kafka
    port: 9092
    targetPort: 9092
EOF

echo ""
echo "=== Step 6: Deploy Airflow DAGs ConfigMap ==="
cat <<'EOF' | $KUBECTL apply -n tundra-dome --context kind-${CLUSTER_NAME} -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: airflow-dags
data:
  tundra_simple_test.py: |
    from datetime import datetime
    from airflow import DAG
    from airflow.operators.bash import BashOperator

    with DAG(
        dag_id="tundra_simple_test",
        schedule="*/5 * * * *",
        start_date=datetime(2026, 1, 1),
        catchup=False,
        tags=["tundra"],
    ) as dag:
        task1 = BashOperator(
            task_id="hello_tundra",
            bash_command="echo 'Hello from Tundra Dome!'",
        )
        task2 = BashOperator(
            task_id="check_env",
            bash_command="echo 'Cluster: ${HOSTNAME}'",
        )
        task1 >> task2
EOF

echo ""
echo "=== Step 7: Wait for PostgreSQL ==="
$KUBECTL wait --for=condition=ready pod -l app=postgres -n tundra-dome --timeout=120s --context kind-${CLUSTER_NAME}

echo ""
echo "=== Step 8: Deploy Airflow Scheduler ==="
cat <<EOF | $KUBECTL apply -n tundra-dome --context kind-${CLUSTER_NAME} -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: airflow-scheduler
spec:
  replicas: 1
  selector:
    matchLabels:
      app: airflow-scheduler
  template:
    metadata:
      labels:
        app: airflow-scheduler
    spec:
      initContainers:
      - name: wait-postgres
        image: busybox
        command: ['sh', '-c', 'until nc -z postgres-service 5432; do echo waiting for postgres; sleep 2; done']
      - name: init-db
        image: apache/airflow:2.11.0
        command: ['airflow', 'db', 'init']
        env:
        - name: AIRFLOW__DATABASE__SQL_ALCHEMY_CONN
          value: postgresql://airflow:airflow@postgres-service:5432/airflow
        - name: AIRFLOW__CORE__EXECUTOR
          value: LocalExecutor
      - name: copy-dags
        image: busybox
        command: ['sh', '-c', 'cp /dags-cm/*.py /opt/airflow/dags/']
        volumeMounts:
        - name: dags-cm
          mountPath: /dags-cm
        - name: dags
          mountPath: /opt/airflow/dags
      containers:
      - name: scheduler
        image: apache/airflow:2.11.0
        command: ['airflow', 'scheduler']
        env:
        - name: AIRFLOW__DATABASE__SQL_ALCHEMY_CONN
          value: postgresql://airflow:airflow@postgres-service:5432/airflow
        - name: AIRFLOW__CORE__EXECUTOR
          value: LocalExecutor
        - name: AIRFLOW__CORE__LOAD_EXAMPLES
          value: "false"
        - name: AIRFLOW__SCHEDULER__DAG_DIR_LIST_INTERVAL
          value: "30"
        - name: DD_SERVICE
          value: airflow-scheduler
        - name: DD_ENV
          value: ${PREFIX}
        - name: DD_API_KEY
          valueFrom:
            secretKeyRef:
              name: tundra-dome-secrets
              key: DD_API_KEY
        - name: DD_SITE
          value: datadoghq.com
        volumeMounts:
        - name: dags
          mountPath: /opt/airflow/dags
      volumes:
      - name: dags-cm
        configMap:
          name: airflow-dags
      - name: dags
        emptyDir: {}
EOF

echo ""
echo "=== Step 9: Wait for Kafka ==="
$KUBECTL wait --for=condition=ready pod -l app=kafka -n tundra-dome --timeout=180s --context kind-${CLUSTER_NAME}

echo ""
echo "=== Step 10: Create Kafka topics ==="
$KUBECTL exec -n tundra-dome deploy/kafka --context kind-${CLUSTER_NAME} -- \
    /opt/kafka/bin/kafka-topics.sh --create --if-not-exists \
    --topic tundra-events --partitions 3 --replication-factor 1 \
    --bootstrap-server localhost:9092 2>/dev/null || true

echo ""
echo "=== Step 11: Deploy Datadog ==="
$HELM repo add datadog https://helm.datadoghq.com 2>/dev/null || true
$HELM repo update datadog

$KUBECTL create namespace datadog --context kind-${CLUSTER_NAME} 2>/dev/null || true

# Generate Helm values
HELM_VALUES="${PROJECT_DIR}/helm-values/dd-values-${PREFIX}.yaml"
cat > "$HELM_VALUES" <<DDEOF
datadog:
  apiKey: "${DD_API_KEY}"
  site: datadoghq.com
  clusterName: ${DD_CLUSTER_NAME}
  apm:
    portEnabled: true
  logs:
    enabled: true
    containerCollectAll: true
  kubelet:
    tlsVerify: false
agents:
  containers:
    agent:
      env:
        - name: DD_HOSTNAME
          valueFrom:
            fieldRef:
              fieldPath: spec.nodeName
clusterAgent:
  enabled: true
DDEOF

$HELM upgrade --install datadog-agent datadog/datadog \
    -f "$HELM_VALUES" \
    -n datadog --kube-context kind-${CLUSTER_NAME}

echo ""
echo "=== Step 12: Wait for pods ==="
sleep 30
$KUBECTL get pods -A --context kind-${CLUSTER_NAME}

echo ""
echo "=== Step 13: Trigger initial DAG run ==="
sleep 15
$KUBECTL exec -n tundra-dome deploy/airflow-scheduler --context kind-${CLUSTER_NAME} -- \
    airflow dags unpause tundra_simple_test 2>/dev/null || true
$KUBECTL exec -n tundra-dome deploy/airflow-scheduler --context kind-${CLUSTER_NAME} -- \
    airflow dags trigger tundra_simple_test 2>/dev/null || true

echo ""
echo "=== Deployment complete for ${PREFIX} ==="
echo "DD Cluster Name: ${DD_CLUSTER_NAME}"
echo "Helm Values: ${HELM_VALUES}"

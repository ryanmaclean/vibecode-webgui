#!/bin/bash
# Tundra Dome Airflow Entrypoint
# Handles state persistence and DAG management

set -e

AIRFLOW_HOME="${AIRFLOW_HOME:-/opt/airflow}"
DAGS_FOLDER="${AIRFLOW__CORE__DAGS_FOLDER:-$AIRFLOW_HOME/dags}"

echo "[entrypoint] Airflow home: $AIRFLOW_HOME"
echo "[entrypoint] DAGs folder: $DAGS_FOLDER"

# Ensure directories exist
mkdir -p "$AIRFLOW_HOME/logs" "$AIRFLOW_HOME/dags"

# Copy DAGs from mounted ConfigMap if available
if [ -d "/dags-src" ] && [ "$(ls -A /dags-src/*.py 2>/dev/null)" ]; then
    echo "[entrypoint] Copying DAGs from ConfigMap..."
    cp /dags-src/*.py "$DAGS_FOLDER/" 2>/dev/null || true
    echo "[entrypoint] DAGs copied: $(ls $DAGS_FOLDER/*.py 2>/dev/null | wc -l) files"
fi

# Initialize database if needed (for persistent SQLite)
if [ ! -f "$AIRFLOW_HOME/airflow.db" ]; then
    echo "[entrypoint] Initializing Airflow database..."
    airflow db migrate
fi

# Restore DAG states from persistent config if available
if [ -f "$AIRFLOW_HOME/dag-states.json" ]; then
    echo "[entrypoint] Restoring DAG states from persistent config..."
    python3 << 'EOF'
import json
import subprocess
import os

states_file = os.path.join(os.environ.get('AIRFLOW_HOME', '/opt/airflow'), 'dag-states.json')
if os.path.exists(states_file):
    with open(states_file, 'r') as f:
        states = json.load(f)
    for dag_id, is_paused in states.items():
        if not is_paused:
            print(f"[entrypoint] Unpausing DAG: {dag_id}")
            subprocess.run(['airflow', 'dags', 'unpause', dag_id], capture_output=True)
EOF
fi

# Save DAG states periodically in background
(
    while true; do
        sleep 300  # Every 5 minutes
        python3 << 'EOF' 2>/dev/null || true
import json
import sqlite3
import os

AIRFLOW_HOME = os.environ.get('AIRFLOW_HOME', '/opt/airflow')
db_path = os.path.join(AIRFLOW_HOME, 'airflow.db')
states_file = os.path.join(AIRFLOW_HOME, 'dag-states.json')

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.execute("SELECT dag_id, is_paused FROM dag WHERE is_paused IS NOT NULL")
    states = {row[0]: bool(row[1]) for row in cursor.fetchall()}
    conn.close()
    with open(states_file, 'w') as f:
        json.dump(states, f)
    print(f"[state-saver] Saved {len(states)} DAG states")
EOF
    done
) &

echo "[entrypoint] Starting Airflow with command: $@"
exec airflow "$@"

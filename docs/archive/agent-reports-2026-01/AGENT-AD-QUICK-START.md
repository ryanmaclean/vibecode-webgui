# Agent AD: Data Pipeline Quick Start Guide

**Agent ID**: AD (Data Pipeline Architect)
**Version**: 1.0
**Last Updated**: 2026-01-05

---

## Overview

This quick start guide will help you get the data pipeline infrastructure up and running in minutes.

---

## Prerequisites

- Docker installed and running
- PostgreSQL 16 running (from existing infrastructure)
- Valkey running (from existing infrastructure)
- 16GB RAM minimum
- 50GB free disk space

---

## Quick Start (Docker Compose)

### 1. Start the Data Pipeline Stack

```bash
cd /Users/ryan.maclean/vibecode-webgui

# Start all services
docker-compose -f docker-compose-data-pipeline.yml up -d

# Check service status
docker-compose -f docker-compose-data-pipeline.yml ps
```

### 2. Access Services

**Airflow Web UI**:
- URL: http://localhost:8080
- Username: `admin`
- Password: `admin`

**MinIO Console**:
- URL: http://localhost:9001
- Username: `minioadmin`
- Password: `minioadmin`

**Kafka UI** (optional):
- URL: http://localhost:8000

### 3. Initialize Data Lake

```bash
# Create MinIO buckets
docker exec -it minio mc alias set local http://localhost:9000 minioadmin minioadmin
docker exec -it minio mc mb local/bronze
docker exec -it minio mc mb local/silver
docker exec -it minio mc mb local/gold

# Verify buckets
docker exec -it minio mc ls local/
```

### 4. Create Kafka Topics

```bash
# Enter Kafka container
docker exec -it redpanda rpk topic create events \
  --partitions 12 \
  --replicas 1

docker exec -it redpanda rpk topic create cdc.public.users \
  --partitions 6 \
  --replicas 1

# List topics
docker exec -it redpanda rpk topic list
```

### 5. Deploy Sample DAGs

```bash
# Copy sample DAGs to Airflow
cp airflow/dags/*.py /opt/airflow/dags/

# Verify DAGs loaded (check Airflow UI)
# DAGs should appear within 30 seconds
```

### 6. Configure Debezium CDC

```bash
# Enable logical replication in PostgreSQL
psql -U postgres -c "ALTER SYSTEM SET wal_level = 'logical';"
psql -U postgres -c "SELECT pg_reload_conf();"

# Create replication user
psql -U postgres << EOF
CREATE USER debezium WITH REPLICATION PASSWORD 'debezium';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO debezium;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO debezium;
EOF

# Deploy CDC connector
curl -X POST http://localhost:8083/connectors \
  -H "Content-Type: application/json" \
  -d @kafka/connectors/postgres-cdc-connector.json

# Check connector status
curl http://localhost:8083/connectors/postgres-cdc-connector/status | jq
```

### 7. Initialize dbt

```bash
# Enter Airflow container
docker exec -it airflow-webserver bash

# Initialize dbt
cd /opt/dbt
dbt deps
dbt debug
dbt run --models +staging
dbt test

# Generate documentation
dbt docs generate
dbt docs serve --port 8081
```

### 8. Configure Great Expectations

```bash
# Initialize Great Expectations
docker exec -it airflow-webserver bash
cd /opt/great-expectations

# Run data profiling
great_expectations suite new

# Run validation
great_expectations checkpoint run users_checkpoint

# View data docs
great_expectations docs build
```

---

## VM-Based Deployment (Alternative)

### 1. Build the Data Pipeline Image

```bash
cd /Users/ryan.maclean/vibecode-webgui/azure

# Build the image
./data-pipeline-setup.sh

# This will create: data-pipeline.cpio.gz (~2-3GB)
```

### 2. Boot the VM

```bash
# Create boot script
cat > scripts/boot-data-pipeline.sh << 'EOF'
#!/bin/bash
vfkit \
  --cpus 8 \
  --memory 16384 \
  --kernel ~/.vfkit/vms/vibecode-data-pipeline/kernel/vmlinux \
  --initrd ~/.vfkit/vms/vibecode-data-pipeline/data-pipeline.cpio.gz \
  --device virtio-net,nat,mac=52:54:00:12:34:80 \
  --device virtio-fs,sharedDir=/data,mountTag=hostshare \
  --device virtio-rng
EOF

chmod +x scripts/boot-data-pipeline.sh

# Boot the VM
./scripts/boot-data-pipeline.sh
```

### 3. Access Services (VM)

The VM will display the IP address on boot. Services are available at:

- Airflow: `http://<VM_IP>:8080`
- MinIO: `http://<VM_IP>:9000`
- Kafka: `kafka://<VM_IP>:9092`
- PostgreSQL: `postgresql://<VM_IP>:5432`

---

## Verify Installation

### Check Service Health

```bash
# Check Airflow
curl http://localhost:8080/health

# Check MinIO
mc admin info local

# Check Kafka
rpk cluster info

# Check PostgreSQL
psql -U postgres -c "SELECT version();"
```

### Run Test Pipeline

```bash
# Trigger test DAG in Airflow
curl -X POST http://localhost:8080/api/v1/dags/batch_etl_pipeline/dagRuns \
  -H "Content-Type: application/json" \
  -u admin:admin \
  -d '{}'

# Monitor progress
# Open Airflow UI and check DAG runs
```

---

## Common Operations

### 1. Create a New DAG

```python
# /opt/airflow/dags/my_pipeline.py
from datetime import datetime
from airflow import DAG
from airflow.operators.bash import BashOperator

with DAG(
    'my_pipeline',
    start_date=datetime(2026, 1, 1),
    schedule_interval='@daily',
    catchup=False
) as dag:

    task1 = BashOperator(
        task_id='extract_data',
        bash_command='echo "Extracting data..."'
    )

    task2 = BashOperator(
        task_id='transform_data',
        bash_command='echo "Transforming data..."'
    )

    task1 >> task2
```

### 2. Produce Events to Kafka

```python
from kafka import KafkaProducer
import json

producer = KafkaProducer(
    bootstrap_servers=['localhost:9092'],
    value_serializer=lambda v: json.dumps(v).encode('utf-8')
)

# Send event
event = {
    'user_id': 12345,
    'event_type': 'page_view',
    'event_timestamp': '2026-01-05T10:30:00Z',
    'page_url': '/products/123'
}

producer.send('events', value=event)
producer.flush()
```

### 3. Query Data Lake with DuckDB

```python
import duckdb

# Connect to DuckDB
con = duckdb.connect()

# Query Parquet files in MinIO
result = con.execute("""
    SELECT
        user_id,
        COUNT(*) AS event_count
    FROM read_parquet('s3://bronze/events/**/*.parquet')
    WHERE event_timestamp >= '2026-01-05'
    GROUP BY user_id
    ORDER BY event_count DESC
    LIMIT 10
""").fetchdf()

print(result)
```

### 4. Run dbt Model

```bash
# Run specific model
dbt run --models stg_users

# Run all staging models
dbt run --models staging.*

# Run marts and dependencies
dbt run --models +marts

# Test models
dbt test --models marts.*
```

### 5. Validate Data Quality

```python
import great_expectations as gx

# Load context
context = gx.get_context()

# Run checkpoint
result = context.run_checkpoint(checkpoint_name="users_checkpoint")

# Check results
if result["success"]:
    print("Validation passed!")
else:
    print("Validation failed!")
    print(result)
```

---

## Monitoring & Troubleshooting

### View Logs

```bash
# Airflow logs
docker logs airflow-webserver
docker logs airflow-scheduler

# Kafka logs
docker logs redpanda

# MinIO logs
docker logs minio

# PostgreSQL logs
docker logs postgres
```

### Check Resource Usage

```bash
# Docker stats
docker stats

# Disk usage
df -h

# MinIO storage usage
mc admin info local
```

### Common Issues

**Issue**: Airflow DAGs not appearing
- **Solution**: Check `/opt/airflow/dags` directory permissions
- **Solution**: Verify Python syntax in DAG files

**Issue**: Kafka consumer lag high
- **Solution**: Scale up consumer group instances
- **Solution**: Increase partition count for topic

**Issue**: dbt models failing
- **Solution**: Check database connection in `profiles.yml`
- **Solution**: Verify source data exists

**Issue**: Great Expectations validation failing
- **Solution**: Review expectation suite configuration
- **Solution**: Check data quality issues in source data

---

## Performance Tuning

### Airflow

```python
# airflow.cfg
[core]
parallelism = 32
dag_concurrency = 16
max_active_runs_per_dag = 16

[scheduler]
scheduler_heartbeat_sec = 5
min_file_process_interval = 30
```

### Kafka

```bash
# Increase partitions for high-throughput topics
rpk topic alter-config events --set partition.count=24

# Enable compression
rpk topic alter-config events --set compression.type=lz4
```

### dbt

```yaml
# dbt_project.yml
models:
  vibecode_analytics:
    marts:
      +materialized: table
      +indexes:
        - columns: [user_id]
          type: btree
```

---

## Next Steps

1. **Deploy Production DAGs**: Move sample DAGs to production
2. **Configure Alerts**: Set up Slack/email alerts for failures
3. **Enable Monitoring**: Deploy Prometheus + Grafana dashboards
4. **Implement Data Governance**: Set up data catalog and lineage
5. **Scale Infrastructure**: Add more workers and increase resources

---

## Reference Links

- [Airflow Documentation](https://airflow.apache.org/docs/)
- [Kafka Documentation](https://kafka.apache.org/documentation/)
- [dbt Documentation](https://docs.getdbt.com/)
- [Great Expectations Docs](https://docs.greatexpectations.io/)
- [MinIO Documentation](https://min.io/docs/)

---

**Support**: For issues, check logs or consult the AGENT-AD-DATA-PIPELINE-ARCHITECTURE.md document.

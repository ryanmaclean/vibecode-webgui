# Agent AD: Data Pipeline and ETL Infrastructure Architecture

**Agent ID**: AD (Data Pipeline Architect)
**Mission**: Build enterprise-grade data pipeline infrastructure for ETL, streaming, and batch processing
**Status**: Operational
**Date**: 2026-01-05

---

## Executive Summary

This document outlines the comprehensive data pipeline and ETL infrastructure for the Vibecode platform. The architecture integrates Apache Airflow for orchestration, Kafka/Redpanda for streaming, dbt for transformations, Debezium for CDC, MinIO for object storage, and Great Expectations for data quality.

### Key Capabilities

- **Workflow Orchestration**: Apache Airflow with 100+ built-in operators
- **Stream Processing**: Kafka/Redpanda with sub-second latency
- **Data Transformations**: dbt for SQL-based transformations
- **Change Data Capture**: Debezium for real-time database replication
- **Object Storage**: MinIO S3-compatible storage for data lakes
- **Data Quality**: Great Expectations for validation and profiling
- **Query Engine**: DuckDB for fast analytical queries

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA PIPELINE PLATFORM                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐      ┌──────────────────┐                  │
│  │   Data Sources   │      │  Stream Sources  │                  │
│  ├──────────────────┤      ├──────────────────┤                  │
│  │ • PostgreSQL     │      │ • Kafka Topics   │                  │
│  │ • Valkey         │      │ • CDC Streams    │                  │
│  │ • APIs           │      │ • Event Logs     │                  │
│  │ • Files (CSV/    │      │ • Webhooks       │                  │
│  │   JSON/Parquet)  │      │                  │                  │
│  └────────┬─────────┘      └────────┬─────────┘                  │
│           │                         │                             │
│           ├─────────────────────────┘                             │
│           │                                                        │
│  ┌────────▼───────────────────────────────────────────────────┐  │
│  │              INGESTION LAYER                               │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │                                                             │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌─────────────┐ │  │
│  │  │  Kafka Connect │  │   Airbyte      │  │  Singer.io  │ │  │
│  │  │                │  │                │  │   Taps      │ │  │
│  │  │ • JDBC Source  │  │ • 300+ Connec  │  │             │ │  │
│  │  │ • Debezium CDC │  │ • ELT Pipeline │  │ • REST APIs │ │  │
│  │  │ • File Source  │  │ • Incremental  │  │ • Databases │ │  │
│  │  │ • S3 Sink      │  │   Sync         │  │ • SaaS      │ │  │
│  │  └────────────────┘  └────────────────┘  └─────────────┘ │  │
│  │                                                             │  │
│  └────────┬────────────────────────────────────────────────────┘  │
│           │                                                        │
│  ┌────────▼───────────────────────────────────────────────────┐  │
│  │              STREAMING LAYER                               │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │                                                             │  │
│  │  ┌────────────────────────────────────────────────────┐   │  │
│  │  │  Kafka / Redpanda Cluster                          │   │  │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │   │  │
│  │  │  │   Broker 1   │  │   Broker 2   │  │ Broker 3 │ │   │  │
│  │  │  │              │  │              │  │          │ │   │  │
│  │  │  │ • Topics     │  │ • Topics     │  │ • Topics │ │   │  │
│  │  │  │ • Partitions │  │ • Partitions │  │ • Parts  │ │   │  │
│  │  │  │ • Replication│  │ • Replication│  │ • Replic │ │   │  │
│  │  │  └──────────────┘  └──────────────┘  └──────────┘ │   │  │
│  │  │                                                     │   │  │
│  │  │  ┌──────────────────────────────────────────────┐ │   │  │
│  │  │  │       Schema Registry (Avro/Protobuf)        │ │   │  │
│  │  │  │  • Schema Evolution                           │ │   │  │
│  │  │  │  • Compatibility Checks                       │ │   │  │
│  │  │  │  • Version Management                         │ │   │  │
│  │  │  └──────────────────────────────────────────────┘ │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  │                                                             │  │
│  │  ┌────────────────────────────────────────────────────┐   │  │
│  │  │  Stream Processing (Kafka Streams / Flink)         │   │  │
│  │  │  • Real-time Aggregations                          │   │  │
│  │  │  • Windowing Operations                            │   │  │
│  │  │  • Stream Joins                                    │   │  │
│  │  │  • Event-Time Processing                           │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  │                                                             │  │
│  └────────┬────────────────────────────────────────────────────┘  │
│           │                                                        │
│  ┌────────▼───────────────────────────────────────────────────┐  │
│  │              STORAGE LAYER                                 │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │                                                             │  │
│  │  ┌───────────────────────┐  ┌────────────────────────────┐│  │
│  │  │ MinIO Object Storage  │  │ PostgreSQL (Warehouse)     ││  │
│  │  │                       │  │                            ││  │
│  │  │ • Raw Data (Bronze)   │  │ • Dimensional Models       ││  │
│  │  │ • Processed (Silver)  │  │ • Fact Tables              ││  │
│  │  │ • Curated (Gold)      │  │ • Aggregate Tables         ││  │
│  │  │ • Parquet Files       │  │ • Materialized Views       ││  │
│  │  │ • Partitioned         │  │                            ││  │
│  │  │ • Compressed          │  │                            ││  │
│  │  └───────────────────────┘  └────────────────────────────┘│  │
│  │                                                             │  │
│  └────────┬────────────────────────────────────────────────────┘  │
│           │                                                        │
│  ┌────────▼───────────────────────────────────────────────────┐  │
│  │              TRANSFORMATION LAYER                          │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │                                                             │  │
│  │  ┌────────────────────────────────────────────────────┐   │  │
│  │  │  dbt (Data Build Tool)                             │   │  │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │   │  │
│  │  │  │   Staging    │  │ Intermediate │  │   Mart   │ │   │  │
│  │  │  │    Models    │  │    Models    │  │  Models  │ │   │  │
│  │  │  │              │  │              │  │          │ │   │  │
│  │  │  │ • Source     │  │ • Business   │  │ • KPIs   │ │   │  │
│  │  │  │   Cleaning   │  │   Logic      │  │ • Dash   │ │   │  │
│  │  │  │ • Type Cast  │  │ • Joins      │  │ • Report │ │   │  │
│  │  │  │ • Dedup      │  │ • Filters    │  │          │ │   │  │
│  │  │  └──────────────┘  └──────────────┘  └──────────┘ │   │  │
│  │  │                                                     │   │  │
│  │  │  Features:                                          │   │  │
│  │  │  • SQL-based transformations                        │   │  │
│  │  │  • Version control & testing                        │   │  │
│  │  │  • Documentation generation                         │   │  │
│  │  │  • Lineage tracking                                 │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  │                                                             │  │
│  └────────┬────────────────────────────────────────────────────┘  │
│           │                                                        │
│  ┌────────▼───────────────────────────────────────────────────┐  │
│  │              ORCHESTRATION LAYER                           │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │                                                             │  │
│  │  ┌────────────────────────────────────────────────────┐   │  │
│  │  │  Apache Airflow                                    │   │  │
│  │  │                                                     │   │  │
│  │  │  ┌─────────────────┐    ┌─────────────────┐       │   │  │
│  │  │  │   Scheduler     │    │   Webserver     │       │   │  │
│  │  │  │                 │    │                 │       │   │  │
│  │  │  │ • DAG Parsing   │    │ • UI Dashboard  │       │   │  │
│  │  │  │ • Task Queue    │    │ • API Server    │       │   │  │
│  │  │  │ • Execution     │    │ • Auth/RBAC     │       │   │  │
│  │  │  │ • Monitoring    │    │ • Logs View     │       │   │  │
│  │  │  └─────────────────┘    └─────────────────┘       │   │  │
│  │  │                                                     │   │  │
│  │  │  ┌─────────────────────────────────────────────┐  │   │  │
│  │  │  │   Worker Nodes (Celery/Kubernetes)         │  │   │  │
│  │  │  │   • Parallel Execution                      │  │   │  │
│  │  │  │   • Auto-scaling                            │  │   │  │
│  │  │  │   • Task Isolation                          │  │   │  │
│  │  │  └─────────────────────────────────────────────┘  │   │  │
│  │  │                                                     │   │  │
│  │  │  ┌─────────────────────────────────────────────┐  │   │  │
│  │  │  │   Metadata Database (PostgreSQL)            │  │   │  │
│  │  │  │   • DAG Runs                                │  │   │  │
│  │  │  │   • Task Instances                          │  │   │  │
│  │  │  │   • Logs & Metrics                          │  │   │  │
│  │  │  └─────────────────────────────────────────────┘  │   │  │
│  │  │                                                     │   │  │
│  │  │  DAG Types:                                         │   │  │
│  │  │  • ETL Pipelines                                    │   │  │
│  │  │  • Data Quality Checks                              │   │  │
│  │  │  • ML Model Training                                │   │  │
│  │  │  • Report Generation                                │   │  │
│  │  │  • Data Backfills                                   │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  │                                                             │  │
│  └────────┬────────────────────────────────────────────────────┘  │
│           │                                                        │
│  ┌────────▼───────────────────────────────────────────────────┐  │
│  │              DATA QUALITY LAYER                            │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │                                                             │  │
│  │  ┌────────────────────────────────────────────────────┐   │  │
│  │  │  Great Expectations                                │   │  │
│  │  │                                                     │   │  │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │   │  │
│  │  │  │ Expectations │  │  Validation  │  │   Data   │ │   │  │
│  │  │  │    Suites    │  │   Results    │  │   Docs   │ │   │  │
│  │  │  │              │  │              │  │          │ │   │  │
│  │  │  │ • Schema     │  │ • Pass/Fail  │  │ • Auto   │ │   │  │
│  │  │  │ • Nulls      │  │ • Metrics    │  │   Gen    │ │   │  │
│  │  │  │ • Ranges     │  │ • Alerts     │  │ • HTML   │ │   │  │
│  │  │  │ • Patterns   │  │ • Trends     │  │          │ │   │  │
│  │  │  └──────────────┘  └──────────────┘  └──────────┘ │   │  │
│  │  │                                                     │   │  │
│  │  │  Features:                                          │   │  │
│  │  │  • 50+ built-in expectations                        │   │  │
│  │  │  • Custom expectations support                      │   │  │
│  │  │  • Data profiling                                   │   │  │
│  │  │  • Anomaly detection                                │   │  │
│  │  │  • Data lineage tracking                            │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  │                                                             │  │
│  └────────┬────────────────────────────────────────────────────┘  │
│           │                                                        │
│  ┌────────▼───────────────────────────────────────────────────┐  │
│  │              QUERY & ANALYTICS LAYER                       │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │                                                             │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌─────────────┐ │  │
│  │  │    DuckDB      │  │     Presto     │  │    Trino    │ │  │
│  │  │                │  │                │  │             │ │  │
│  │  │ • In-Process   │  │ • Distributed  │  │ • Fast SQL  │ │  │
│  │  │ • Parquet      │  │ • Multi-Source │  │ • Federated │ │  │
│  │  │ • Fast OLAP    │  │ • SQL Engine   │  │ • Queries   │ │  │
│  │  │ • Python API   │  │                │  │             │ │  │
│  │  └────────────────┘  └────────────────┘  └─────────────┘ │  │
│  │                                                             │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │              MONITORING & OBSERVABILITY                     │  │
│  ├─────────────────────────────────────────────────────────────┤  │
│  │                                                             │  │
│  │  • Prometheus metrics collection                           │  │
│  │  • Grafana dashboards                                      │  │
│  │  • Datadog APM integration                                 │  │
│  │  • OpenTelemetry traces                                    │  │
│  │  • Data lineage visualization                              │  │
│  │  • SLA monitoring                                          │  │
│  │  • Alert management                                        │  │
│  │                                                             │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Specifications

### 1. Apache Airflow (Workflow Orchestration)

**Purpose**: Centralized workflow orchestration and scheduling

**Features**:
- **DAG-based workflow definition**: Python-based directed acyclic graphs
- **Rich operator library**: 100+ built-in operators (Postgres, S3, Kafka, etc.)
- **Scheduling**: Cron-based and event-driven scheduling
- **Monitoring**: Web UI with task status, logs, and metrics
- **Parallel execution**: Multi-worker support with Celery or Kubernetes
- **Retry logic**: Automatic retries with exponential backoff
- **SLA tracking**: Monitor and alert on SLA violations

**Components**:
- **Webserver**: UI and REST API (port 8080)
- **Scheduler**: DAG parsing and task scheduling
- **Workers**: Task execution (Celery-based)
- **Metadata DB**: PostgreSQL for state management
- **Executor**: LocalExecutor, CeleryExecutor, or KubernetesExecutor

**Configuration**:
```python
# airflow.cfg key settings
[core]
executor = CeleryExecutor
parallelism = 32
dag_concurrency = 16
max_active_runs_per_dag = 16

[scheduler]
scheduler_heartbeat_sec = 5
parsing_processes = 4
catchup_by_default = False

[webserver]
web_server_port = 8080
workers = 4
worker_refresh_interval = 30

[celery]
worker_concurrency = 16
broker_url = redis://localhost:6379/0
result_backend = redis://localhost:6379/0
```

### 2. Kafka/Redpanda (Stream Processing)

**Purpose**: Distributed event streaming platform

**Kafka vs Redpanda**:
- **Kafka**: Battle-tested, massive ecosystem, JVM-based
- **Redpanda**: Kafka-compatible API, C++ native, lower latency, simpler ops

**Features**:
- **High throughput**: Millions of messages per second
- **Low latency**: Sub-millisecond p99 (Redpanda)
- **Durability**: Replication and persistence
- **Scalability**: Horizontal scaling with partitions
- **Schema evolution**: Avro/Protobuf schema registry

**Components**:
- **Brokers**: 3-node cluster (port 9092)
- **Zookeeper**: Metadata management (Kafka only, port 2181)
- **Schema Registry**: Schema management (port 8081)
- **Kafka Connect**: Source/sink connectors (port 8083)
- **ksqlDB**: Stream processing SQL (optional, port 8088)

**Topic Design**:
```yaml
topics:
  raw_events:
    partitions: 12
    replication_factor: 3
    retention_ms: 604800000  # 7 days
    compression: lz4

  user_events:
    partitions: 6
    replication_factor: 3
    retention_ms: 2592000000  # 30 days

  aggregated_metrics:
    partitions: 3
    replication_factor: 3
    retention_ms: -1  # infinite
    compaction: true  # log compaction enabled
```

### 3. dbt (Data Build Tool)

**Purpose**: SQL-based data transformation framework

**Features**:
- **Modular SQL**: Reusable models and macros
- **Testing**: Built-in data quality tests
- **Documentation**: Auto-generated data catalog
- **Lineage**: DAG visualization of dependencies
- **Version control**: Git-based workflow
- **Incremental models**: Process only new data

**Project Structure**:
```
dbt/
├── models/
│   ├── staging/          # Raw data cleaning
│   │   ├── stg_users.sql
│   │   └── stg_events.sql
│   ├── intermediate/     # Business logic
│   │   ├── int_user_sessions.sql
│   │   └── int_event_metrics.sql
│   └── marts/            # Final data products
│       ├── fct_user_activity.sql
│       └── dim_users.sql
├── tests/                # Custom tests
├── macros/               # Reusable SQL macros
├── snapshots/            # SCD Type 2 tables
├── seeds/                # CSV reference data
└── dbt_project.yml       # Project configuration
```

**Model Example**:
```sql
-- models/marts/fct_user_activity.sql
{{
  config(
    materialized='incremental',
    unique_key='activity_id',
    on_schema_change='append_new_columns'
  )
}}

WITH user_events AS (
    SELECT * FROM {{ ref('stg_events') }}
    {% if is_incremental() %}
    WHERE event_timestamp > (SELECT MAX(event_timestamp) FROM {{ this }})
    {% endif %}
),

aggregated AS (
    SELECT
        user_id,
        DATE_TRUNC('day', event_timestamp) AS activity_date,
        COUNT(*) AS event_count,
        COUNT(DISTINCT session_id) AS session_count
    FROM user_events
    GROUP BY 1, 2
)

SELECT
    {{ dbt_utils.surrogate_key(['user_id', 'activity_date']) }} AS activity_id,
    *
FROM aggregated
```

### 4. Debezium (Change Data Capture)

**Purpose**: Real-time database change streaming

**Features**:
- **Low latency CDC**: Capture changes in <1 second
- **Multiple databases**: Postgres, MySQL, MongoDB, Oracle, SQL Server
- **At-least-once delivery**: No data loss
- **Schema evolution**: Handle DDL changes
- **Snapshots**: Initial full table capture

**Architecture**:
- **Source connector**: Read DB transaction logs
- **Kafka topic**: Stream changes as events
- **Sink connector**: Write to target systems

**PostgreSQL CDC Setup**:
```yaml
# debezium-postgres-connector.json
{
  "name": "postgres-cdc-connector",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "database.hostname": "localhost",
    "database.port": "5432",
    "database.user": "debezium",
    "database.password": "debezium",
    "database.dbname": "production",
    "database.server.name": "postgres-server",
    "table.include.list": "public.users,public.events,public.orders",
    "plugin.name": "pgoutput",
    "publication.autocreate.mode": "filtered",
    "slot.name": "debezium_slot",
    "snapshot.mode": "initial",
    "transforms": "unwrap",
    "transforms.unwrap.type": "io.debezium.transforms.ExtractNewRecordState",
    "transforms.unwrap.drop.tombstones": "false",
    "key.converter": "org.apache.kafka.connect.json.JsonConverter",
    "value.converter": "org.apache.kafka.connect.json.JsonConverter",
    "topic.prefix": "cdc"
  }
}
```

**CDC Event Format**:
```json
{
  "before": null,
  "after": {
    "id": 12345,
    "email": "user@example.com",
    "created_at": "2026-01-05T10:30:00Z"
  },
  "source": {
    "version": "2.5.0.Final",
    "connector": "postgresql",
    "name": "postgres-server",
    "ts_ms": 1704450600000,
    "db": "production",
    "schema": "public",
    "table": "users",
    "txId": 12345,
    "lsn": 123456789
  },
  "op": "c",  // c=create, u=update, d=delete
  "ts_ms": 1704450600123
}
```

### 5. MinIO (Object Storage)

**Purpose**: S3-compatible object storage for data lakes

**Features**:
- **S3 API compatibility**: Drop-in replacement for AWS S3
- **High performance**: Optimized for modern hardware
- **Erasure coding**: Data protection and availability
- **Multi-tenancy**: Bucket policies and IAM
- **Versioning**: Object versioning support
- **Lifecycle policies**: Automatic data archival

**Data Lake Architecture**:
```
MinIO Buckets:
├── bronze/              # Raw data (immutable)
│   ├── events/
│   │   └── year=2026/month=01/day=05/
│   │       └── events-20260105-123456.parquet
│   └── logs/
│       └── year=2026/month=01/day=05/
│           └── logs-20260105-123456.json.gz
│
├── silver/              # Cleaned & validated
│   ├── users/
│   │   └── partition_date=2026-01-05/
│   │       └── users.parquet
│   └── events/
│       └── partition_date=2026-01-05/
│           └── events.parquet
│
└── gold/                # Aggregated & curated
    ├── user_metrics/
    │   └── date=2026-01-05/
    │       └── metrics.parquet
    └── reports/
        └── daily_summary_20260105.parquet
```

**Bucket Configuration**:
```yaml
# minio-policy.json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::bronze/*",
        "arn:aws:s3:::silver/*",
        "arn:aws:s3:::gold/*"
      ]
    }
  ]
}
```

### 6. Great Expectations (Data Quality)

**Purpose**: Data validation and profiling framework

**Features**:
- **50+ built-in expectations**: Schema, nulls, ranges, patterns
- **Custom expectations**: Extend with Python
- **Data profiling**: Auto-generate expectations
- **Validation results**: HTML/JSON reports
- **Integration**: Works with Airflow, dbt, Spark
- **Alerting**: Slack, email, PagerDuty integration

**Expectations Suite Example**:
```python
# expectations/user_data_suite.json
{
  "expectation_suite_name": "user_data_suite",
  "expectations": [
    {
      "expectation_type": "expect_table_row_count_to_be_between",
      "kwargs": {
        "min_value": 1000,
        "max_value": 1000000
      }
    },
    {
      "expectation_type": "expect_column_values_to_not_be_null",
      "kwargs": {
        "column": "user_id"
      }
    },
    {
      "expectation_type": "expect_column_values_to_be_unique",
      "kwargs": {
        "column": "email"
      }
    },
    {
      "expectation_type": "expect_column_values_to_match_regex",
      "kwargs": {
        "column": "email",
        "regex": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
      }
    },
    {
      "expectation_type": "expect_column_values_to_be_between",
      "kwargs": {
        "column": "age",
        "min_value": 18,
        "max_value": 120
      }
    },
    {
      "expectation_type": "expect_column_values_to_be_in_set",
      "kwargs": {
        "column": "status",
        "value_set": ["active", "inactive", "suspended"]
      }
    }
  ]
}
```

**Validation Script**:
```python
# scripts/validate_data.py
import great_expectations as gx

# Initialize context
context = gx.get_context()

# Create checkpoint
checkpoint = context.add_checkpoint(
    name="user_data_checkpoint",
    validations=[
        {
            "batch_request": {
                "datasource_name": "postgres_datasource",
                "data_connector_name": "default_inferred_data_connector",
                "data_asset_name": "users"
            },
            "expectation_suite_name": "user_data_suite"
        }
    ]
)

# Run validation
result = checkpoint.run()

# Check results
if not result["success"]:
    print("Validation failed!")
    print(result)
    raise Exception("Data quality check failed")
```

### 7. DuckDB (Query Engine)

**Purpose**: Fast analytical query engine for data lakes

**Features**:
- **In-process SQL**: No separate server needed
- **Parquet native**: Direct query on Parquet files
- **S3 support**: Query MinIO/S3 directly
- **Fast aggregations**: Columnar execution
- **Python/R API**: Easy integration
- **OLAP optimized**: Complex analytical queries

**Query Examples**:
```sql
-- Query Parquet files directly from MinIO
SELECT
    user_id,
    COUNT(*) AS event_count,
    DATE_TRUNC('hour', event_timestamp) AS hour
FROM read_parquet('s3://bronze/events/year=2026/month=01/*/*.parquet')
WHERE event_timestamp >= '2026-01-05'::TIMESTAMP
GROUP BY user_id, hour
ORDER BY event_count DESC
LIMIT 100;

-- Join across multiple data sources
SELECT
    u.user_id,
    u.email,
    COUNT(e.event_id) AS total_events
FROM read_parquet('s3://silver/users/*.parquet') u
LEFT JOIN read_parquet('s3://silver/events/*.parquet') e
    ON u.user_id = e.user_id
GROUP BY u.user_id, u.email
HAVING COUNT(e.event_id) > 1000;

-- Window functions for analytics
SELECT
    user_id,
    event_timestamp,
    event_type,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY event_timestamp) AS event_sequence,
    LAG(event_timestamp) OVER (PARTITION BY user_id ORDER BY event_timestamp) AS prev_event_time
FROM read_parquet('s3://silver/events/*.parquet')
WHERE event_timestamp >= CURRENT_DATE - INTERVAL 7 DAYS;
```

---

## Data Pipeline Patterns

### Pattern 1: Batch ETL Pipeline

**Use Case**: Nightly data warehouse refresh

**Flow**:
```
PostgreSQL → Airbyte → MinIO (Bronze) → dbt → PostgreSQL (Warehouse) → Validation
```

**Airflow DAG**:
```python
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.bash import BashOperator
from datetime import datetime, timedelta

with DAG(
    'batch_etl_pipeline',
    schedule_interval='0 2 * * *',  # 2 AM daily
    start_date=datetime(2026, 1, 1),
    catchup=False,
    max_active_runs=1,
    default_args={
        'retries': 3,
        'retry_delay': timedelta(minutes=5)
    }
) as dag:

    # Extract from source databases
    extract_users = PythonOperator(
        task_id='extract_users',
        python_callable=extract_users_func
    )

    # Load to MinIO bronze layer
    load_to_bronze = PythonOperator(
        task_id='load_to_bronze',
        python_callable=load_to_minio_func
    )

    # Run dbt transformations
    dbt_run = BashOperator(
        task_id='dbt_run',
        bash_command='cd /opt/dbt && dbt run --models +marts'
    )

    # Validate data quality
    validate = PythonOperator(
        task_id='validate_data',
        python_callable=run_great_expectations_func
    )

    # Refresh materialized views
    refresh_views = BashOperator(
        task_id='refresh_views',
        bash_command='psql -c "REFRESH MATERIALIZED VIEW CONCURRENTLY user_metrics_mv"'
    )

    extract_users >> load_to_bronze >> dbt_run >> validate >> refresh_views
```

### Pattern 2: Real-Time CDC Pipeline

**Use Case**: Live data replication for analytics

**Flow**:
```
PostgreSQL (Source) → Debezium → Kafka → Stream Processing → PostgreSQL (Target)
```

**Components**:
1. **Debezium connector**: Captures changes from source DB
2. **Kafka topic**: Buffers change events
3. **Stream processor**: Transforms and enriches events
4. **Sink connector**: Writes to target DB

### Pattern 3: Event-Driven Pipeline

**Use Case**: Real-time event processing and aggregation

**Flow**:
```
API Events → Kafka → Stream Processor → Aggregations → MinIO + PostgreSQL
```

**Kafka Streams Example**:
```python
from kafka import KafkaConsumer, KafkaProducer
import json
from collections import defaultdict
from datetime import datetime, timedelta

# Consumer for raw events
consumer = KafkaConsumer(
    'raw_events',
    bootstrap_servers=['localhost:9092'],
    value_deserializer=lambda m: json.loads(m.decode('utf-8')),
    group_id='event_aggregator'
)

# Producer for aggregated metrics
producer = KafkaProducer(
    bootstrap_servers=['localhost:9092'],
    value_serializer=lambda m: json.dumps(m).encode('utf-8')
)

# In-memory aggregation (use Flink for production)
window_data = defaultdict(lambda: defaultdict(int))

for message in consumer:
    event = message.value
    user_id = event['user_id']
    event_type = event['event_type']

    # 1-minute tumbling window
    window_key = datetime.now().replace(second=0, microsecond=0)

    window_data[window_key][f"{user_id}:{event_type}"] += 1

    # Emit aggregated metrics every minute
    if len(window_data) > 1:
        old_window = min(window_data.keys())
        metrics = window_data.pop(old_window)

        for key, count in metrics.items():
            user_id, event_type = key.split(':')
            producer.send('aggregated_metrics', {
                'user_id': user_id,
                'event_type': event_type,
                'count': count,
                'window_start': old_window.isoformat()
            })
```

### Pattern 4: Data Lake Ingestion

**Use Case**: Bulk data import to data lake

**Flow**:
```
CSV/JSON Files → Airbyte → MinIO (Bronze) → Validation → Silver Layer
```

**Airflow DAG**:
```python
from airflow import DAG
from airflow.providers.amazon.aws.transfers.local_to_s3 import LocalFilesystemToS3Operator
from airflow.operators.python import PythonOperator
import pyarrow.parquet as pq
import pandas as pd

with DAG('data_lake_ingestion', schedule_interval='@hourly') as dag:

    # Upload raw files to bronze
    upload_to_bronze = LocalFilesystemToS3Operator(
        task_id='upload_to_bronze',
        filename='/data/raw/events_{{ ds }}.csv',
        dest_key='bronze/events/year={{ execution_date.year }}/month={{ execution_date.month }}/day={{ execution_date.day }}/events_{{ ts_nodash }}.csv',
        dest_bucket='data-lake',
        aws_conn_id='minio_conn'
    )

    # Convert to Parquet and validate
    def convert_and_validate(**context):
        # Read CSV
        df = pd.read_csv(f"/data/raw/events_{context['ds']}.csv")

        # Validate schema
        assert 'user_id' in df.columns
        assert 'event_timestamp' in df.columns

        # Convert to Parquet
        output_path = f"/tmp/events_{context['ts_nodash']}.parquet"
        df.to_parquet(output_path, compression='snappy', index=False)

        return output_path

    convert = PythonOperator(
        task_id='convert_to_parquet',
        python_callable=convert_and_validate,
        provide_context=True
    )

    # Upload Parquet to silver
    upload_to_silver = LocalFilesystemToS3Operator(
        task_id='upload_to_silver',
        filename='/tmp/events_{{ ts_nodash }}.parquet',
        dest_key='silver/events/partition_date={{ ds }}/events.parquet',
        dest_bucket='data-lake',
        aws_conn_id='minio_conn'
    )

    upload_to_bronze >> convert >> upload_to_silver
```

---

## Deployment Architecture

### Containerized Deployment (Docker Compose)

```yaml
# docker-compose.yml
version: '3.8'

services:
  # Apache Airflow
  airflow-webserver:
    image: apache/airflow:2.8.0
    ports:
      - "8080:8080"
    environment:
      - AIRFLOW__CORE__EXECUTOR=CeleryExecutor
      - AIRFLOW__DATABASE__SQL_ALCHEMY_CONN=postgresql+psycopg2://airflow:airflow@postgres:5432/airflow
      - AIRFLOW__CELERY__BROKER_URL=redis://valkey:6379/0
      - AIRFLOW__CELERY__RESULT_BACKEND=db+postgresql://airflow:airflow@postgres:5432/airflow
    volumes:
      - ./airflow/dags:/opt/airflow/dags
      - ./airflow/logs:/opt/airflow/logs
      - ./airflow/plugins:/opt/airflow/plugins
    depends_on:
      - postgres
      - valkey
    command: webserver

  airflow-scheduler:
    image: apache/airflow:2.8.0
    environment:
      - AIRFLOW__CORE__EXECUTOR=CeleryExecutor
      - AIRFLOW__DATABASE__SQL_ALCHEMY_CONN=postgresql+psycopg2://airflow:airflow@postgres:5432/airflow
      - AIRFLOW__CELERY__BROKER_URL=redis://valkey:6379/0
    volumes:
      - ./airflow/dags:/opt/airflow/dags
      - ./airflow/logs:/opt/airflow/logs
      - ./airflow/plugins:/opt/airflow/plugins
    depends_on:
      - postgres
      - valkey
    command: scheduler

  airflow-worker:
    image: apache/airflow:2.8.0
    environment:
      - AIRFLOW__CORE__EXECUTOR=CeleryExecutor
      - AIRFLOW__DATABASE__SQL_ALCHEMY_CONN=postgresql+psycopg2://airflow:airflow@postgres:5432/airflow
      - AIRFLOW__CELERY__BROKER_URL=redis://valkey:6379/0
    volumes:
      - ./airflow/dags:/opt/airflow/dags
      - ./airflow/logs:/opt/airflow/logs
      - ./airflow/plugins:/opt/airflow/plugins
    depends_on:
      - postgres
      - valkey
    command: celery worker

  # Redpanda (Kafka-compatible)
  redpanda:
    image: docker.redpanda.com/redpandadata/redpanda:v23.3.4
    ports:
      - "9092:9092"
      - "8081:8081"  # Schema Registry
      - "9644:9644"  # Admin API
    command:
      - redpanda
      - start
      - --overprovisioned
      - --smp 1
      - --memory 1G
      - --reserve-memory 0M
      - --node-id 0
      - --check=false
      - --kafka-addr PLAINTEXT://0.0.0.0:9092
      - --advertise-kafka-addr PLAINTEXT://localhost:9092

  # Kafka Connect
  kafka-connect:
    image: debezium/connect:2.5
    ports:
      - "8083:8083"
    environment:
      - BOOTSTRAP_SERVERS=redpanda:9092
      - GROUP_ID=kafka-connect
      - CONFIG_STORAGE_TOPIC=connect-configs
      - OFFSET_STORAGE_TOPIC=connect-offsets
      - STATUS_STORAGE_TOPIC=connect-status
    depends_on:
      - redpanda

  # MinIO (S3-compatible storage)
  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      - MINIO_ROOT_USER=minioadmin
      - MINIO_ROOT_PASSWORD=minioadmin
    volumes:
      - minio-data:/data
    command: server /data --console-address ":9001"

  # PostgreSQL (used by Airflow and data warehouse)
  postgres:
    image: postgres:16
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=airflow
    volumes:
      - postgres-data:/var/lib/postgresql/data

  # Valkey (Redis-compatible)
  valkey:
    image: valkey/valkey:8
    ports:
      - "6379:6379"

volumes:
  minio-data:
  postgres-data:
```

### VM-based Deployment

For integration with existing Vibecode infrastructure:

```bash
# Build unified data pipeline image
./azure/data-pipeline-setup.sh

# Boot with vfkit
vfkit \
  --cpus 8 \
  --memory 16384 \
  --kernel ~/.vibecode/vms/vibecode-data-pipeline/kernel/vmlinux \
  --initrd ~/.vibecode/vms/vibecode-data-pipeline/data-pipeline.cpio.gz \
  --device virtio-net,nat,mac=52:54:00:12:34:80 \
  --device virtio-fs,sharedDir=/data,mountTag=hostshare \
  --device virtio-rng
```

---

## Security & Access Control

### Authentication

1. **Airflow**: RBAC with roles (Admin, Op, Viewer, User)
2. **Kafka**: SASL/SCRAM authentication
3. **MinIO**: IAM users and policies
4. **PostgreSQL**: Role-based access

### Encryption

- **In-transit**: TLS 1.3 for all network communication
- **At-rest**: AES-256 encryption for MinIO buckets
- **Secrets**: HashiCorp Vault or AWS Secrets Manager

### Network Segmentation

```
Internet → Load Balancer → Airflow Web UI (Auth)
                         ↓
Internal Network → Kafka/Redpanda → MinIO
                 ↓
         PostgreSQL (private subnet)
```

---

## Monitoring & Observability

### Metrics Collection

**Prometheus exporters**:
- Airflow metrics (scheduler, DAG runs, task duration)
- Kafka metrics (throughput, lag, partition distribution)
- PostgreSQL metrics (connections, queries, replication lag)
- dbt metrics (model runtime, test failures)

**Grafana dashboards**:
- Pipeline health overview
- Data freshness SLAs
- Resource utilization
- Data quality trends

### Alerting Rules

```yaml
# prometheus-alerts.yml
groups:
  - name: data_pipeline_alerts
    rules:
      - alert: DAGFailureRate
        expr: rate(airflow_dag_run_status{status="failed"}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High DAG failure rate"
          description: "{{ $value }} DAG runs failing per second"

      - alert: KafkaConsumerLag
        expr: kafka_consumergroup_lag > 100000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Kafka consumer lag high"
          description: "Consumer {{ $labels.consumergroup }} has {{ $value }} lagging messages"

      - alert: DataQualityFailure
        expr: great_expectations_validation_success == 0
        labels:
          severity: critical
        annotations:
          summary: "Data quality validation failed"
          description: "Expectation suite {{ $labels.suite_name }} failed"
```

---

## Performance Optimization

### Airflow Tuning

1. **Parallelism**: Increase `parallelism` and `dag_concurrency`
2. **Scheduler**: Use `SchedulerJob` with multiple parsing processes
3. **Database**: Use connection pooling, optimize indexes
4. **Workers**: Scale horizontally with Celery or Kubernetes

### Kafka Tuning

1. **Partitions**: More partitions = more parallelism (12-24 per topic)
2. **Replication**: 3x replication for production
3. **Compression**: Use lz4 or snappy
4. **Batching**: Increase `batch.size` and `linger.ms`

### dbt Optimization

1. **Incremental models**: Process only new data
2. **Materialization**: Use tables for frequently queried models
3. **Partitioning**: Partition large tables by date
4. **Macros**: Reuse SQL logic to reduce compilation time

---

## Disaster Recovery

### Backup Strategy

1. **Airflow metadata**: Daily PostgreSQL backups
2. **Kafka data**: Replicate to secondary cluster
3. **MinIO data**: S3 replication to another region
4. **dbt models**: Git repository (already versioned)

### Recovery Procedures

1. **Airflow**: Restore PostgreSQL from backup, restart services
2. **Kafka**: Failover to secondary cluster
3. **MinIO**: Restore from replicated bucket
4. **Data lineage**: Replay Kafka topics from earliest offset

---

## Cost Optimization

### Storage Tiering

- **Hot data**: MinIO SSDs (last 7 days)
- **Warm data**: MinIO HDDs (8-90 days)
- **Cold data**: Archive to S3 Glacier (>90 days)

### Compute Optimization

- **Auto-scaling**: Scale Airflow workers based on queue depth
- **Spot instances**: Use for non-critical batch jobs
- **Right-sizing**: Monitor resource usage and adjust

---

## Migration Strategy

### Phase 1: Foundation (Week 1-2)
- Deploy PostgreSQL and Valkey
- Set up MinIO object storage
- Install Apache Airflow

### Phase 2: Streaming (Week 3-4)
- Deploy Kafka/Redpanda cluster
- Configure Debezium connectors
- Set up schema registry

### Phase 3: Transformations (Week 5-6)
- Initialize dbt project
- Migrate existing SQL to dbt models
- Set up CI/CD for dbt

### Phase 4: Quality (Week 7-8)
- Implement Great Expectations
- Create expectation suites
- Integrate with Airflow DAGs

### Phase 5: Production (Week 9-10)
- Performance tuning
- Security hardening
- Documentation and training

---

## Success Metrics

### Operational Metrics
- **Pipeline reliability**: 99.9% success rate
- **Data freshness**: <1 hour lag for critical data
- **Query performance**: p95 < 5 seconds
- **Resource utilization**: 70-80% average

### Business Metrics
- **Time to insight**: Reduce by 50%
- **Data quality issues**: Detect 95% automatically
- **Developer productivity**: 3x faster pipeline development
- **Cost efficiency**: 30% reduction in infrastructure costs

---

## Appendix

### Technology Stack Summary

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Orchestration | Apache Airflow | 2.8+ | Workflow scheduling |
| Streaming | Kafka/Redpanda | 3.6+/23.3+ | Event streaming |
| CDC | Debezium | 2.5+ | Change data capture |
| Transformations | dbt | 1.7+ | SQL transformations |
| Object Storage | MinIO | Latest | S3-compatible storage |
| Data Quality | Great Expectations | 0.18+ | Validation framework |
| Query Engine | DuckDB | 0.10+ | OLAP queries |
| Message Queue | Valkey | 8+ | Task queue (Celery) |
| Data Warehouse | PostgreSQL | 16+ | Relational storage |

### Reference Links

- Apache Airflow: https://airflow.apache.org/
- Kafka: https://kafka.apache.org/
- Redpanda: https://redpanda.com/
- dbt: https://www.getdbt.com/
- Debezium: https://debezium.io/
- MinIO: https://min.io/
- Great Expectations: https://greatexpectations.io/
- DuckDB: https://duckdb.org/

---

**Document Version**: 1.0
**Last Updated**: 2026-01-05
**Author**: Agent AD (Data Pipeline Architect)

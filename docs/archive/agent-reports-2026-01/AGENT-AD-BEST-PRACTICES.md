# Agent AD: Data Pipeline Best Practices

**Agent ID**: AD (Data Pipeline Architect)
**Version**: 1.0
**Last Updated**: 2026-01-05

---

## Table of Contents

1. [Airflow Best Practices](#airflow-best-practices)
2. [Kafka Best Practices](#kafka-best-practices)
3. [dbt Best Practices](#dbt-best-practices)
4. [CDC Best Practices](#cdc-best-practices)
5. [Data Lake Best Practices](#data-lake-best-practices)
6. [Data Quality Best Practices](#data-quality-best-practices)
7. [Performance Optimization](#performance-optimization)
8. [Security Best Practices](#security-best-practices)
9. [Monitoring & Observability](#monitoring--observability)
10. [Disaster Recovery](#disaster-recovery)

---

## Airflow Best Practices

### DAG Design

**1. Keep DAGs Simple and Focused**
```python
# Good: Single responsibility
with DAG('process_user_data', ...) as dag:
    extract >> transform >> load

# Bad: Too many unrelated tasks
with DAG('do_everything', ...) as dag:
    user_etl >> product_etl >> ml_training >> report_generation
```

**2. Use Task Groups for Organization**
```python
from airflow.utils.task_group import TaskGroup

with DAG('etl_pipeline', ...) as dag:
    with TaskGroup('extract') as extract:
        extract_users = PythonOperator(...)
        extract_events = PythonOperator(...)

    with TaskGroup('transform') as transform:
        transform_users = PythonOperator(...)
        transform_events = PythonOperator(...)

    extract >> transform
```

**3. Use XCom Sparingly**
```python
# Good: Pass small metadata
def extract_data(**context):
    # Extract data
    context['ti'].xcom_push(key='row_count', value=1000)

# Bad: Passing large datasets
def extract_data(**context):
    df = pd.read_csv('huge_file.csv')  # 10GB
    context['ti'].xcom_push(key='data', value=df)  # Don't do this!
```

**4. Set Proper Timeouts and Retries**
```python
default_args = {
    'retries': 3,
    'retry_delay': timedelta(minutes=5),
    'retry_exponential_backoff': True,
    'max_retry_delay': timedelta(minutes=30),
    'execution_timeout': timedelta(hours=2),
    'email_on_failure': True,
    'email_on_retry': False,
}
```

**5. Use Sensors Wisely**
```python
# Good: Use mode='reschedule' for long waits
wait_for_file = FileSensor(
    task_id='wait_for_file',
    filepath='/data/input.csv',
    poke_interval=60,
    timeout=3600,
    mode='reschedule'  # Frees up worker slot
)

# Bad: mode='poke' for long waits (blocks worker)
```

**6. Implement Idempotency**
```python
# Good: Idempotent operation
def load_data(**context):
    ds = context['ds']

    # Delete existing data for date
    cursor.execute(f"DELETE FROM events WHERE date = '{ds}'")

    # Load new data
    cursor.execute(f"INSERT INTO events SELECT * FROM staging WHERE date = '{ds}'")

# Bad: Non-idempotent (accumulates duplicates)
def load_data(**context):
    cursor.execute("INSERT INTO events SELECT * FROM staging")
```

### Performance

**7. Use Connection Pooling**
```python
# airflow.cfg
[core]
sql_alchemy_pool_size = 20
sql_alchemy_pool_recycle = 3600
sql_alchemy_max_overflow = 10
```

**8. Optimize DAG Parsing**
```python
# Good: Define variables outside DAG
DEFAULT_ARGS = {...}
SCHEDULE = '@daily'

with DAG('my_dag', default_args=DEFAULT_ARGS, schedule_interval=SCHEDULE) as dag:
    ...

# Bad: Complex logic during parsing
with DAG('my_dag', ...) as dag:
    # This runs during every DAG parse!
    df = pd.read_csv('large_file.csv')
    for row in df.itertuples():
        PythonOperator(task_id=f'task_{row.id}', ...)
```

**9. Use Dynamic Task Mapping (Airflow 2.3+)**
```python
# Good: Dynamic task mapping
@task
def process_item(item):
    return f"Processed {item}"

with DAG('dynamic_pipeline', ...) as dag:
    items = ['a', 'b', 'c', 'd']
    process_item.expand(item=items)
```

### Testing

**10. Write Unit Tests for Tasks**
```python
# tests/dags/test_my_dag.py
import pytest
from airflow.models import DagBag

def test_dag_loaded():
    dagbag = DagBag()
    dag = dagbag.get_dag('my_dag')
    assert dag is not None
    assert len(dag.tasks) == 5

def test_task_dependencies():
    dagbag = DagBag()
    dag = dagbag.get_dag('my_dag')

    extract = dag.get_task('extract')
    transform = dag.get_task('transform')

    assert extract in transform.upstream_list
```

---

## Kafka Best Practices

### Topic Design

**1. Choose Partition Count Carefully**
```bash
# Good: Enough partitions for parallelism
rpk topic create events \
  --partitions 24 \
  --replicas 3

# Formula: partitions = max(producers, consumers) * scaling_factor
# Typical: 12-24 partitions for high-throughput topics
```

**2. Use Appropriate Retention**
```bash
# Good: Time-based retention
rpk topic alter-config events \
  --set retention.ms=604800000  # 7 days

# Good: Size-based retention
rpk topic alter-config events \
  --set retention.bytes=10737418240  # 10GB
```

**3. Enable Compression**
```bash
# Good: Use compression
rpk topic alter-config events \
  --set compression.type=lz4  # or snappy

# Comparison:
# - lz4: Fastest, good compression (~2x)
# - snappy: Fast, decent compression (~1.5x)
# - gzip: Slower, best compression (~3x)
```

### Producer Best Practices

**4. Use Appropriate Acknowledgment Level**
```python
# Good: For critical data (no data loss)
producer = KafkaProducer(
    bootstrap_servers=['localhost:9092'],
    acks='all',  # Wait for all replicas
    retries=3,
    max_in_flight_requests_per_connection=1  # Ordering guarantee
)

# Good: For high-throughput non-critical data
producer = KafkaProducer(
    bootstrap_servers=['localhost:9092'],
    acks=1,  # Wait for leader only
    compression_type='lz4',
    batch_size=32768,
    linger_ms=10
)
```

**5. Batch Messages**
```python
# Good: Batch for throughput
producer = KafkaProducer(
    batch_size=32768,  # 32KB
    linger_ms=10,      # Wait up to 10ms to fill batch
)

# Send messages (they'll be batched automatically)
for event in events:
    producer.send('events', value=event)

producer.flush()  # Ensure all sent
```

**6. Use Message Keys for Ordering**
```python
# Good: Key ensures same user's events go to same partition
producer.send(
    'events',
    key=str(user_id).encode('utf-8'),
    value=json.dumps(event).encode('utf-8')
)
```

### Consumer Best Practices

**7. Use Consumer Groups**
```python
# Good: Consumer group for parallel processing
consumer = KafkaConsumer(
    'events',
    bootstrap_servers=['localhost:9092'],
    group_id='event-processor-group',
    enable_auto_commit=False,  # Manual commit for exactly-once
    max_poll_records=1000
)

for message in consumer:
    process(message.value)
    consumer.commit()  # Commit after successful processing
```

**8. Handle Rebalancing**
```python
from kafka import KafkaConsumer, TopicPartition

def on_assign(consumer, partitions):
    print(f"Partitions assigned: {partitions}")
    # Seek to specific offset if needed
    for partition in partitions:
        # Example: Seek to beginning for replay
        consumer.seek_to_beginning(partition)

consumer = KafkaConsumer(
    'events',
    group_id='processor',
    on_assign=on_assign
)
```

**9. Monitor Consumer Lag**
```python
# Check lag regularly
def check_consumer_lag():
    consumer = KafkaConsumer(
        bootstrap_servers=['localhost:9092'],
        group_id='event-processor-group',
        enable_auto_commit=False
    )

    partitions = consumer.partitions_for_topic('events')

    for partition_id in partitions:
        tp = TopicPartition('events', partition_id)
        consumer.assign([tp])
        consumer.seek_to_end(tp)
        end_offset = consumer.position(tp)

        committed = consumer.committed(tp)
        lag = end_offset - (committed or 0)

        if lag > 100000:
            alert(f"High lag on partition {partition_id}: {lag}")
```

---

## dbt Best Practices

### Project Structure

**10. Follow the Medallion Architecture**
```
dbt/models/
├── staging/          # Bronze → Silver (cleaning)
│   ├── stg_users.sql
│   └── stg_events.sql
├── intermediate/     # Silver → Silver (business logic)
│   ├── int_user_sessions.sql
│   └── int_event_metrics.sql
└── marts/            # Silver → Gold (final products)
    ├── fct_user_activity.sql
    └── dim_users.sql
```

**11. Use Incremental Models**
```sql
{{
    config(
        materialized='incremental',
        unique_key='event_id',
        on_schema_change='append_new_columns'
    )
}}

WITH new_events AS (
    SELECT * FROM {{ source('bronze', 'events') }}
    {% if is_incremental() %}
    WHERE event_timestamp > (SELECT MAX(event_timestamp) FROM {{ this }})
    {% endif %}
)

SELECT * FROM new_events
```

**12. Write Tests**
```yaml
# models/staging/schema.yml
version: 2

models:
  - name: stg_users
    description: Cleaned user data
    columns:
      - name: user_id
        description: Primary key
        tests:
          - unique
          - not_null
      - name: email
        description: User email
        tests:
          - unique
          - not_null
          - dbt_expectations.expect_column_values_to_match_regex:
              regex: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
      - name: status
        description: User status
        tests:
          - accepted_values:
              values: ['active', 'inactive', 'suspended']
```

**13. Use Macros for Reusability**
```sql
-- macros/generate_schema_name.sql
{% macro generate_schema_name(custom_schema_name, node) -%}
    {%- set default_schema = target.schema -%}
    {%- if custom_schema_name is none -%}
        {{ default_schema }}
    {%- else -%}
        {{ default_schema }}_{{ custom_schema_name | trim }}
    {%- endif -%}
{%- endmacro %}

-- macros/cents_to_dollars.sql
{% macro cents_to_dollars(column_name, decimal_places=2) -%}
    ROUND({{ column_name }} / 100.0, {{ decimal_places }})
{%- endmacro %}

-- Usage in model
SELECT
    order_id,
    {{ cents_to_dollars('amount_cents') }} AS amount_dollars
FROM orders
```

**14. Document Models**
```yaml
# models/marts/schema.yml
version: 2

models:
  - name: fct_user_activity
    description: |
      Daily user activity metrics aggregated from events.

      This fact table contains:
      - Event counts per user per day
      - Session metrics (duration, count)
      - Engagement levels
      - Conversion flags

      Updated: Daily at 2 AM via Airflow DAG
      Owner: Data Engineering Team
    columns:
      - name: activity_id
        description: Surrogate key (user_id + activity_date)
      - name: user_id
        description: Foreign key to dim_users
      - name: activity_date
        description: Date of activity
      - name: total_events
        description: Total events for user on date
```

**15. Use Snapshots for SCD Type 2**
```sql
-- snapshots/users_snapshot.sql
{% snapshot users_snapshot %}

{{
    config(
      target_schema='snapshots',
      unique_key='user_id',
      strategy='timestamp',
      updated_at='updated_at',
    )
}}

SELECT * FROM {{ source('bronze', 'users') }}

{% endsnapshot %}
```

---

## CDC Best Practices

### Debezium Configuration

**16. Use Appropriate Snapshot Mode**
```json
{
  "snapshot.mode": "initial",
  "snapshot.locking.mode": "minimal",
  "snapshot.fetch.size": 10000
}
```

Snapshot modes:
- `initial`: Full snapshot on first run
- `when_needed`: Snapshot if no offset exists
- `never`: Skip snapshot, start from current position
- `schema_only`: Capture schema only

**17. Configure Heartbeats**
```json
{
  "heartbeat.interval.ms": "10000",
  "heartbeat.action.query": "UPDATE debezium_heartbeat SET last_update=NOW() WHERE id=1"
}
```

**18. Handle Schema Evolution**
```json
{
  "schema.history.internal.kafka.topic": "schema-changes.vibecode",
  "include.schema.changes": "true",
  "schema.name.adjustment.mode": "avro"
}
```

**19. Monitor Replication Lag**
```sql
-- Check PostgreSQL replication slot lag
SELECT
    slot_name,
    pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn)) AS lag_size
FROM pg_replication_slots
WHERE slot_name = 'debezium_slot';
```

---

## Data Lake Best Practices

### Storage Organization

**20. Use Partitioning**
```
s3://bronze/events/
  year=2026/
    month=01/
      day=05/
        events-20260105-123456.parquet
        events-20260105-123457.parquet
```

**21. Choose Appropriate File Format**
```python
# Good: Parquet for analytics
df.to_parquet(
    's3://silver/users/users.parquet',
    compression='snappy',
    index=False,
    partition_cols=['signup_date']
)

# When to use:
# - Parquet: Columnar, great for analytics, efficient compression
# - Avro: Row-based, good for streaming, schema evolution
# - CSV: Human-readable, simple, but slow and large
```

**22. Implement Data Lifecycle**
```python
# MinIO lifecycle policy
mc ilm add local/bronze \
  --expiry-days 30 \
  --transition-days 7 \
  --storage-class WARM

# Lifecycle tiers:
# - Hot (0-7 days): SSD, fast access
# - Warm (8-90 days): HDD, slower access
# - Cold (>90 days): Archive, rare access
```

**23. Use Compression**
```python
# Comparison of compression algorithms:
algorithms = {
    'snappy': {'speed': 'fast', 'ratio': 'good', 'cpu': 'low'},
    'gzip': {'speed': 'slow', 'ratio': 'best', 'cpu': 'high'},
    'lz4': {'speed': 'fastest', 'ratio': 'moderate', 'cpu': 'very low'},
    'zstd': {'speed': 'fast', 'ratio': 'excellent', 'cpu': 'moderate'}
}

# Recommendation: snappy for most workloads
```

---

## Data Quality Best Practices

### Great Expectations

**24. Start with Profile-Generated Expectations**
```python
import great_expectations as gx

context = gx.get_context()

# Auto-generate expectations from data profile
validator = context.sources.pandas_default.read_dataframe(df)
validator.expect_table_row_count_to_be_between(min_value=1000)
validator.expect_column_values_to_not_be_null('user_id')

# Save suite
validator.save_expectation_suite()
```

**25. Test at Multiple Levels**
```python
# Schema-level tests
expect_table_columns_to_match_ordered_list()
expect_table_column_count_to_equal()

# Column-level tests
expect_column_values_to_not_be_null()
expect_column_values_to_be_unique()
expect_column_values_to_be_in_set()

# Row-level tests
expect_column_pair_values_A_to_be_greater_than_B()

# Aggregate tests
expect_column_mean_to_be_between()
expect_table_row_count_to_be_between()
```

**26. Monitor Data Drift**
```python
# Compare distributions over time
def check_data_drift():
    # Today's data
    today_validator = context.get_validator(
        batch_request=today_batch_request
    )

    # Yesterday's data
    yesterday_validator = context.get_validator(
        batch_request=yesterday_batch_request
    )

    # Compare distributions
    today_mean = today_validator.expect_column_mean_to_be_between('value', 90, 110)
    yesterday_mean = yesterday_validator.expect_column_mean_to_be_between('value', 90, 110)

    drift = abs(today_mean - yesterday_mean)
    if drift > 10:
        alert("Significant data drift detected!")
```

---

## Performance Optimization

### Query Optimization

**27. Use Appropriate Indexes**
```sql
-- For frequent lookups
CREATE INDEX idx_events_user_id ON events(user_id);

-- For time-series queries
CREATE INDEX idx_events_timestamp ON events(event_timestamp DESC);

-- For composite queries
CREATE INDEX idx_events_user_timestamp ON events(user_id, event_timestamp);

-- Partial index for frequent filters
CREATE INDEX idx_active_users ON users(user_id) WHERE status = 'active';
```

**28. Partition Large Tables**
```sql
-- Range partitioning by date
CREATE TABLE events (
    event_id BIGINT,
    user_id BIGINT,
    event_timestamp TIMESTAMP,
    ...
) PARTITION BY RANGE (event_timestamp);

CREATE TABLE events_2026_01 PARTITION OF events
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE events_2026_02 PARTITION OF events
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
```

**29. Use Materialized Views**
```sql
-- Create materialized view
CREATE MATERIALIZED VIEW user_metrics_mv AS
SELECT
    user_id,
    COUNT(*) AS event_count,
    MAX(event_timestamp) AS last_event
FROM events
GROUP BY user_id;

-- Create index on MV
CREATE INDEX idx_user_metrics_mv_user_id ON user_metrics_mv(user_id);

-- Refresh regularly (via Airflow)
REFRESH MATERIALIZED VIEW CONCURRENTLY user_metrics_mv;
```

### Resource Optimization

**30. Right-Size Resources**
```yaml
# Airflow worker resources
resources:
  requests:
    cpu: "2"
    memory: "4Gi"
  limits:
    cpu: "4"
    memory: "8Gi"

# Kafka broker resources
resources:
  requests:
    cpu: "4"
    memory: "16Gi"
  limits:
    cpu: "8"
    memory: "32Gi"
```

---

## Security Best Practices

**31. Use Secrets Management**
```python
# Good: Use Airflow connections
from airflow.hooks.base import BaseHook

conn = BaseHook.get_connection('postgres_prod')
password = conn.password

# Bad: Hardcoded credentials
password = 'super_secret_password'  # Don't do this!
```

**32. Implement Row-Level Security**
```sql
-- Enable RLS
ALTER TABLE sensitive_data ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY tenant_isolation ON sensitive_data
    FOR ALL
    TO data_analyst
    USING (tenant_id = current_setting('app.current_tenant')::INT);
```

**33. Encrypt Data at Rest**
```bash
# MinIO encryption
mc encrypt set local/sensitive-bucket \
  --algorithm=AES256
```

**34. Use TLS for All Connections**
```python
# Kafka with TLS
producer = KafkaProducer(
    bootstrap_servers=['localhost:9093'],
    security_protocol='SSL',
    ssl_cafile='/path/to/ca-cert',
    ssl_certfile='/path/to/client-cert',
    ssl_keyfile='/path/to/client-key'
)
```

---

## Monitoring & Observability

**35. Export Metrics to Prometheus**
```python
# Airflow metrics
from prometheus_client import Counter, Histogram

dag_run_duration = Histogram(
    'airflow_dag_run_duration_seconds',
    'DAG run duration in seconds',
    ['dag_id', 'status']
)

task_failures = Counter(
    'airflow_task_failures_total',
    'Total task failures',
    ['dag_id', 'task_id']
)
```

**36. Implement Data Lineage**
```yaml
# dbt exposures for lineage
version: 2

exposures:
  - name: user_dashboard
    type: dashboard
    maturity: high
    url: https://dashboard.example.com/users
    description: User activity dashboard
    depends_on:
      - ref('fct_user_activity')
      - ref('dim_users')
    owner:
      name: Analytics Team
      email: analytics@example.com
```

**37. Set Up Alerting**
```yaml
# Prometheus alert rules
groups:
  - name: data_pipeline
    rules:
      - alert: AirflowDAGFailure
        expr: rate(airflow_dag_run_status{status="failed"}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High DAG failure rate"

      - alert: KafkaConsumerLag
        expr: kafka_consumergroup_lag > 100000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Kafka consumer lag high"
```

---

## Disaster Recovery

**38. Regular Backups**
```bash
# PostgreSQL backup
pg_dump -U postgres vibecode | gzip > backup_$(date +%Y%m%d).sql.gz

# MinIO backup (replication)
mc mirror local/bronze remote/bronze

# Kafka topic backup
kafka-mirror-maker.sh \
  --consumer.config consumer.properties \
  --producer.config producer.properties
```

**39. Test Recovery Procedures**
```bash
# Test restore
gunzip -c backup_20260105.sql.gz | psql -U postgres vibecode_test

# Verify data
psql -U postgres vibecode_test -c "SELECT COUNT(*) FROM users;"
```

**40. Document Runbooks**
```markdown
# Incident: Airflow scheduler not responding

## Symptoms
- DAGs not scheduling
- UI shows scheduler heartbeat missing

## Diagnosis
1. Check scheduler logs: `docker logs airflow-scheduler`
2. Check database connection: `airflow db check`
3. Check worker availability: `airflow celery inspect active`

## Resolution
1. Restart scheduler: `docker restart airflow-scheduler`
2. If database issue: `airflow db reset` (CAUTION)
3. If worker issue: scale workers
```

---

## Summary

These best practices cover the essential aspects of building and maintaining a production-grade data pipeline:

1. **Airflow**: Design idempotent DAGs, optimize performance, write tests
2. **Kafka**: Choose appropriate configurations, monitor lag, handle failures
3. **dbt**: Follow medallion architecture, use incremental models, document thoroughly
4. **CDC**: Configure snapshots appropriately, monitor replication lag
5. **Data Lake**: Partition data, use compression, implement lifecycle policies
6. **Data Quality**: Test at multiple levels, monitor drift, automate validation
7. **Performance**: Index appropriately, partition large tables, right-size resources
8. **Security**: Use secrets management, encrypt data, implement access controls
9. **Monitoring**: Export metrics, implement lineage, set up alerting
10. **DR**: Regular backups, test recovery, document procedures

Following these practices will ensure your data pipeline is reliable, performant, secure, and maintainable.

---

**Document Version**: 1.0
**Last Updated**: 2026-01-05
**Author**: Agent AD (Data Pipeline Architect)

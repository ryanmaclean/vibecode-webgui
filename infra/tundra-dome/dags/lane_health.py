"""
Lane Health DAG - Monitors lane metrics and alerts on issues

This DAG acts as the "Overseer" - monitoring lane health metrics
and producing alerts to the mayor-commands topic when issues arise.
"""

from datetime import datetime, timedelta
import json
import os

from airflow import DAG
from airflow.operators.python import PythonOperator

KAFKA_BOOTSTRAP = os.environ.get('KAFKA_BROKERS', 'kafka-service:9092')

default_args = {
    'owner': 'tundra-dome',
    'depends_on_past': False,
    'email_on_failure': False,
    'retries': 1,
    'retry_delay': timedelta(seconds=30),
}


def get_lane_status(**context):
    """Query Lane CRs from Kubernetes API."""
    from kubernetes import client, config

    try:
        config.load_incluster_config()
    except config.ConfigException:
        config.load_kube_config()

    api = client.CustomObjectsApi()

    lanes = api.list_namespaced_custom_object(
        group='tundra.dome',
        version='v1',
        namespace='tundra-dome',
        plural='lanes',
    )

    lane_status = []
    for lane in lanes.get('items', []):
        name = lane['metadata']['name']
        spec = lane.get('spec', {})
        status = lane.get('status', {})

        lane_data = {
            'name': name,
            'priority': spec.get('priority', 'unknown'),
            'kafka_topic': spec.get('kafkaTopic', ''),
            'quotas': spec.get('quotas', {}),
            'sla': spec.get('sla', {}),
            'phase': status.get('phase', 'unknown'),
            'queue_depth': status.get('queueDepth', 0),
            'in_progress': status.get('inProgress', 0),
            'processed_total': status.get('processedTotal', 0),
            'processed_last_hour': status.get('processedLastHour', 0),
            'sla_compliance': status.get('slaCompliance', 100.0),
            'last_updated': status.get('lastUpdated', ''),
        }
        lane_status.append(lane_data)

    context['ti'].xcom_push(key='lane_status', value=lane_status)
    print(f"Fetched status for {len(lane_status)} lanes")
    return lane_status


def check_lane_health(**context):
    """Analyze lane health and produce alerts."""
    from confluent_kafka import Producer

    lane_status = context['ti'].xcom_pull(key='lane_status', task_ids='get_lane_status') or []

    alerts = []

    for lane in lane_status:
        name = lane['name']
        quotas = lane['quotas']

        # Check queue depth vs max
        max_queue = quotas.get('maxQueueDepth', float('inf'))
        queue_depth = lane['queue_depth']
        if queue_depth > max_queue * 0.8:
            alerts.append({
                'type': 'queue_warning',
                'lane': name,
                'severity': 'warning' if queue_depth <= max_queue else 'critical',
                'message': f"Lane {name} queue at {queue_depth}/{max_queue} ({queue_depth/max_queue*100:.0f}%)",
                'queue_depth': queue_depth,
                'max_queue': max_queue,
            })

        # Check concurrent vs max
        max_concurrent = quotas.get('maxConcurrent', float('inf'))
        in_progress = lane['in_progress']
        if in_progress > max_concurrent * 0.9:
            alerts.append({
                'type': 'concurrency_warning',
                'lane': name,
                'severity': 'warning' if in_progress <= max_concurrent else 'critical',
                'message': f"Lane {name} concurrency at {in_progress}/{max_concurrent}",
                'in_progress': in_progress,
                'max_concurrent': max_concurrent,
            })

        # Check SLA compliance
        sla_compliance = lane['sla_compliance']
        if sla_compliance < 95:
            alerts.append({
                'type': 'sla_breach',
                'lane': name,
                'severity': 'critical' if sla_compliance < 90 else 'warning',
                'message': f"Lane {name} SLA compliance at {sla_compliance:.1f}%",
                'sla_compliance': sla_compliance,
            })

        # Check if lane is in bad state
        if lane['phase'] in ['OverQuota', 'Degraded', 'Failed']:
            alerts.append({
                'type': 'lane_state',
                'lane': name,
                'severity': 'critical',
                'message': f"Lane {name} in {lane['phase']} state",
                'phase': lane['phase'],
            })

    # Produce alerts to Kafka
    if alerts:
        producer = Producer({
            'bootstrap.servers': KAFKA_BOOTSTRAP,
            'client.id': 'airflow-lane-health',
        })

        for alert in alerts:
            message = {
                'event': f"lane.{alert['type']}",
                'lane': alert['lane'],
                'severity': alert['severity'],
                'message': alert['message'],
                'details': alert,
                'timestamp': datetime.utcnow().isoformat(),
            }

            producer.produce(
                topic='tundra-mayor-commands',
                key=f"alert-{alert['lane']}-{alert['type']}",
                value=json.dumps(message),
            )

        producer.flush(timeout=10)
        print(f"Produced {len(alerts)} alerts")

    context['ti'].xcom_push(key='alerts', value=alerts)
    return alerts


def emit_metrics(**context):
    """Emit lane metrics to Kafka for dashboards."""
    from confluent_kafka import Producer

    lane_status = context['ti'].xcom_pull(key='lane_status', task_ids='get_lane_status') or []

    producer = Producer({
        'bootstrap.servers': KAFKA_BOOTSTRAP,
        'client.id': 'airflow-lane-metrics',
    })

    for lane in lane_status:
        metrics = {
            'event': 'lane.metrics',
            'lane': lane['name'],
            'priority': lane['priority'],
            'queue_depth': lane['queue_depth'],
            'in_progress': lane['in_progress'],
            'processed_total': lane['processed_total'],
            'processed_last_hour': lane['processed_last_hour'],
            'sla_compliance': lane['sla_compliance'],
            'timestamp': datetime.utcnow().isoformat(),
        }

        producer.produce(
            topic='tundra-metrics-kpi',
            key=f"lane-{lane['name']}",
            value=json.dumps(metrics),
        )

    producer.flush(timeout=10)
    print(f"Emitted metrics for {len(lane_status)} lanes")


with DAG(
    'lane_health',
    default_args=default_args,
    description='Monitor lane health and emit alerts',
    schedule_interval=timedelta(minutes=1),
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=['tundra-dome', 'monitoring', 'lanes'],
) as dag:

    get_status = PythonOperator(
        task_id='get_lane_status',
        python_callable=get_lane_status,
    )

    check_health = PythonOperator(
        task_id='check_lane_health',
        python_callable=check_lane_health,
    )

    emit = PythonOperator(
        task_id='emit_metrics',
        python_callable=emit_metrics,
    )

    get_status >> [check_health, emit]

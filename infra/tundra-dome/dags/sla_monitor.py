"""
SLA Monitor DAG - Monitors bead age and triggers escalations

This DAG checks for beads that are approaching or exceeding their
lane's SLA limits and triggers escalation to higher priority lanes.
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


def parse_duration(duration_str):
    """Parse duration string like '30m', '4h', '24h' to minutes."""
    if not duration_str:
        return float('inf')

    duration_str = duration_str.strip().lower()

    if duration_str.endswith('m'):
        return int(duration_str[:-1])
    elif duration_str.endswith('h'):
        return int(duration_str[:-1]) * 60
    elif duration_str.endswith('d'):
        return int(duration_str[:-1]) * 60 * 24
    else:
        return int(duration_str)


def get_lane_slas(**context):
    """Get SLA configuration for all lanes."""
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

    lane_slas = {}
    for lane in lanes.get('items', []):
        name = lane['metadata']['name']
        spec = lane.get('spec', {})
        sla = spec.get('sla', {})
        escalation = spec.get('escalation', {})

        lane_slas[name] = {
            'priority': spec.get('priority', 'standard'),
            'max_processing_time': parse_duration(sla.get('maxProcessingTime', '')),
            'max_queue_time': parse_duration(sla.get('maxQueueTime', '')),
            'escalation_enabled': escalation.get('enabled', False),
            'escalation_target': escalation.get('targetLane', ''),
            'escalation_trigger': parse_duration(escalation.get('triggerAfter', '')),
            'notify_roles': escalation.get('notifyRoles', []),
        }

    context['ti'].xcom_push(key='lane_slas', value=lane_slas)
    return lane_slas


def get_pending_beads(**context):
    """Get all pending beads and their ages."""
    from kubernetes import client, config

    try:
        config.load_incluster_config()
    except config.ConfigException:
        config.load_kube_config()

    api = client.CustomObjectsApi()

    beads = api.list_namespaced_custom_object(
        group='tundra.dome',
        version='v1',
        namespace='tundra-dome',
        plural='beads',
    )

    pending_beads = []
    now = datetime.utcnow()

    for bead in beads.get('items', []):
        status = bead.get('status', {})
        phase = status.get('phase', 'pending')

        # Only check pending and processing beads
        if phase not in ['pending', 'processing', 'Pending', 'Processing']:
            continue

        name = bead['metadata']['name']
        created = bead['metadata'].get('creationTimestamp', '')
        spec = bead.get('spec', {})
        lane = spec.get('lane', 'standard')

        # Calculate age in minutes
        if created:
            try:
                created_dt = datetime.fromisoformat(created.replace('Z', '+00:00'))
                age_minutes = (now.replace(tzinfo=created_dt.tzinfo) - created_dt).total_seconds() / 60
            except Exception:
                age_minutes = 0
        else:
            age_minutes = 0

        pending_beads.append({
            'name': name,
            'lane': lane,
            'phase': phase,
            'age_minutes': age_minutes,
            'created': created,
            'source': spec.get('source', 'unknown'),
            'escalated_from': bead['metadata'].get('labels', {}).get('tundra.dome/escalated-from', ''),
        })

    context['ti'].xcom_push(key='pending_beads', value=pending_beads)
    print(f"Found {len(pending_beads)} pending/processing beads")
    return pending_beads


def check_sla_violations(**context):
    """Check for SLA violations and escalations needed."""
    lane_slas = context['ti'].xcom_pull(key='lane_slas', task_ids='get_lane_slas') or {}
    pending_beads = context['ti'].xcom_pull(key='pending_beads', task_ids='get_pending_beads') or []

    violations = []
    escalations = []

    for bead in pending_beads:
        lane = bead['lane']
        age = bead['age_minutes']

        if lane not in lane_slas:
            continue

        sla = lane_slas[lane]

        # Check queue time SLA
        max_queue = sla['max_queue_time']
        if bead['phase'] in ['pending', 'Pending'] and age > max_queue:
            violations.append({
                'bead': bead['name'],
                'lane': lane,
                'type': 'queue_time_exceeded',
                'age_minutes': age,
                'max_minutes': max_queue,
                'severity': 'critical',
            })

        # Check if escalation is needed
        if sla['escalation_enabled'] and not bead['escalated_from']:
            trigger = sla['escalation_trigger']
            if age > trigger and sla['escalation_target']:
                escalations.append({
                    'bead': bead['name'],
                    'from_lane': lane,
                    'to_lane': sla['escalation_target'],
                    'age_minutes': age,
                    'trigger_minutes': trigger,
                    'notify_roles': sla['notify_roles'],
                })

        # Warning for approaching SLA
        elif age > max_queue * 0.8:
            violations.append({
                'bead': bead['name'],
                'lane': lane,
                'type': 'queue_time_warning',
                'age_minutes': age,
                'max_minutes': max_queue,
                'severity': 'warning',
            })

    context['ti'].xcom_push(key='violations', value=violations)
    context['ti'].xcom_push(key='escalations', value=escalations)

    print(f"Found {len(violations)} SLA violations, {len(escalations)} escalations needed")
    return {'violations': len(violations), 'escalations': len(escalations)}


def trigger_escalations(**context):
    """Trigger escalations for stale beads."""
    from confluent_kafka import Producer

    escalations = context['ti'].xcom_pull(key='escalations', task_ids='check_sla_violations') or []

    if not escalations:
        print("No escalations needed")
        return

    producer = Producer({
        'bootstrap.servers': KAFKA_BOOTSTRAP,
        'client.id': 'airflow-sla-monitor',
    })

    for escalation in escalations:
        # Send escalation command
        command = {
            'event': 'bead.escalate',
            'bead': escalation['bead'],
            'from_lane': escalation['from_lane'],
            'to_lane': escalation['to_lane'],
            'reason': f"Exceeded {escalation['trigger_minutes']}m threshold (age: {escalation['age_minutes']:.0f}m)",
            'timestamp': datetime.utcnow().isoformat(),
        }

        producer.produce(
            topic='tundra-beads-escalated',
            key=escalation['bead'],
            value=json.dumps(command),
        )

        # Notify relevant roles
        if escalation['notify_roles']:
            notification = {
                'event': 'notification.escalation',
                'bead': escalation['bead'],
                'from_lane': escalation['from_lane'],
                'to_lane': escalation['to_lane'],
                'roles': escalation['notify_roles'],
                'message': f"Bead {escalation['bead']} escalated from {escalation['from_lane']} to {escalation['to_lane']}",
                'timestamp': datetime.utcnow().isoformat(),
            }

            for role in escalation['notify_roles']:
                producer.produce(
                    topic=f"tundra-{role}-commands",
                    key=f"escalation-{escalation['bead']}",
                    value=json.dumps(notification),
                )

    producer.flush(timeout=10)
    print(f"Triggered {len(escalations)} escalations")


def emit_sla_alerts(**context):
    """Emit SLA violation alerts."""
    from confluent_kafka import Producer

    violations = context['ti'].xcom_pull(key='violations', task_ids='check_sla_violations') or []

    if not violations:
        return

    producer = Producer({
        'bootstrap.servers': KAFKA_BOOTSTRAP,
        'client.id': 'airflow-sla-monitor',
    })

    for violation in violations:
        alert = {
            'event': f"sla.{violation['type']}",
            'bead': violation['bead'],
            'lane': violation['lane'],
            'severity': violation['severity'],
            'age_minutes': violation['age_minutes'],
            'max_minutes': violation['max_minutes'],
            'message': f"Bead {violation['bead']} in {violation['lane']}: {violation['type']} ({violation['age_minutes']:.0f}m / {violation['max_minutes']}m)",
            'timestamp': datetime.utcnow().isoformat(),
        }

        producer.produce(
            topic='tundra-mayor-commands',
            key=f"sla-{violation['bead']}",
            value=json.dumps(alert),
        )

    producer.flush(timeout=10)
    print(f"Emitted {len(violations)} SLA alerts")


with DAG(
    'sla_monitor',
    default_args=default_args,
    description='Monitor bead SLAs and trigger escalations',
    schedule_interval=timedelta(minutes=1),
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=['tundra-dome', 'sla', 'escalation'],
) as dag:

    get_slas = PythonOperator(
        task_id='get_lane_slas',
        python_callable=get_lane_slas,
    )

    get_beads = PythonOperator(
        task_id='get_pending_beads',
        python_callable=get_pending_beads,
    )

    check_violations = PythonOperator(
        task_id='check_sla_violations',
        python_callable=check_sla_violations,
    )

    escalate = PythonOperator(
        task_id='trigger_escalations',
        python_callable=trigger_escalations,
    )

    emit_alerts = PythonOperator(
        task_id='emit_sla_alerts',
        python_callable=emit_sla_alerts,
    )

    [get_slas, get_beads] >> check_violations >> [escalate, emit_alerts]

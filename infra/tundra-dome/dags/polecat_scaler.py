"""
Polecat Scaler DAG - Auto-scales polecats based on lane queue depth

This DAG monitors lane queue depths and polecat capacity,
scaling polecats up/down to meet demand.
"""

from datetime import datetime, timedelta
import json
import os

from airflow import DAG
from airflow.operators.python import PythonOperator

KAFKA_BOOTSTRAP = os.environ.get('KAFKA_BROKERS', 'kafka-service:9092')

# Scaling configuration
MIN_REPLICAS = 1
MAX_REPLICAS = 5
SCALE_UP_THRESHOLD = 0.7   # Scale up when queue > 70% of capacity
SCALE_DOWN_THRESHOLD = 0.3  # Scale down when queue < 30% of capacity
COOLDOWN_MINUTES = 5        # Minimum time between scaling actions

default_args = {
    'owner': 'tundra-dome',
    'depends_on_past': False,
    'email_on_failure': False,
    'retries': 1,
    'retry_delay': timedelta(seconds=30),
}


def get_polecat_status(**context):
    """Query Polecat CRs from Kubernetes API."""
    from kubernetes import client, config

    try:
        config.load_incluster_config()
    except config.ConfigException:
        config.load_kube_config()

    api = client.CustomObjectsApi()

    polecats = api.list_namespaced_custom_object(
        group='tundra.dome',
        version='v1',
        namespace='tundra-dome',
        plural='polecats',
    )

    polecat_status = []
    for polecat in polecats.get('items', []):
        name = polecat['metadata']['name']
        spec = polecat.get('spec', {})
        status = polecat.get('status', {})

        polecat_data = {
            'name': name,
            'role': spec.get('role', 'polecat'),
            'lanes': spec.get('lanes', []),
            'replicas': spec.get('replicas', 1),
            'concurrency': spec.get('concurrency', 1),
            'ready_replicas': status.get('readyReplicas', 0),
            'beads_processed': status.get('beadsProcessed', 0),
            'beads_in_progress': status.get('beadsInProgress', 0),
            'phase': status.get('phase', 'unknown'),
            'last_heartbeat': status.get('lastHeartbeat', ''),
        }
        polecat_status.append(polecat_data)

    context['ti'].xcom_push(key='polecat_status', value=polecat_status)
    print(f"Fetched status for {len(polecat_status)} polecats")
    return polecat_status


def get_lane_queues(**context):
    """Get queue depths for all lanes."""
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

    lane_queues = {}
    for lane in lanes.get('items', []):
        name = lane['metadata']['name']
        status = lane.get('status', {})
        quotas = lane.get('spec', {}).get('quotas', {})

        lane_queues[name] = {
            'queue_depth': status.get('queueDepth', 0),
            'in_progress': status.get('inProgress', 0),
            'max_queue': quotas.get('maxQueueDepth', 100),
            'max_concurrent': quotas.get('maxConcurrent', 10),
        }

    context['ti'].xcom_push(key='lane_queues', value=lane_queues)
    return lane_queues


def calculate_scaling(**context):
    """Determine scaling actions needed."""
    polecat_status = context['ti'].xcom_pull(key='polecat_status', task_ids='get_polecat_status') or []
    lane_queues = context['ti'].xcom_pull(key='lane_queues', task_ids='get_lane_queues') or {}

    scaling_actions = []

    # Group polecats by the lanes they service
    lane_polecats = {}
    for polecat in polecat_status:
        # Only scale worker polecats, not special roles
        if polecat['role'] != 'polecat':
            continue

        for lane in polecat['lanes']:
            if lane not in lane_polecats:
                lane_polecats[lane] = []
            lane_polecats[lane].append(polecat)

    # For each lane, determine if we need to scale
    for lane_name, polecats in lane_polecats.items():
        if lane_name not in lane_queues:
            continue

        queue_info = lane_queues[lane_name]
        queue_depth = queue_info['queue_depth']
        max_queue = queue_info['max_queue']
        queue_ratio = queue_depth / max_queue if max_queue > 0 else 0

        # Calculate total capacity
        total_replicas = sum(p['replicas'] for p in polecats)
        total_ready = sum(p['ready_replicas'] for p in polecats)
        total_concurrency = sum(p['replicas'] * p['concurrency'] for p in polecats)

        print(f"Lane {lane_name}: queue={queue_depth}/{max_queue} ({queue_ratio:.0%}), "
              f"polecats={total_ready}/{total_replicas}, capacity={total_concurrency}")

        # Determine scaling action
        if queue_ratio > SCALE_UP_THRESHOLD and total_replicas < MAX_REPLICAS * len(polecats):
            # Scale up - add 1 replica to each polecat servicing this lane
            for polecat in polecats:
                if polecat['replicas'] < MAX_REPLICAS:
                    scaling_actions.append({
                        'action': 'scale_up',
                        'polecat': polecat['name'],
                        'lane': lane_name,
                        'current_replicas': polecat['replicas'],
                        'target_replicas': min(polecat['replicas'] + 1, MAX_REPLICAS),
                        'reason': f"Queue at {queue_ratio:.0%} capacity",
                    })

        elif queue_ratio < SCALE_DOWN_THRESHOLD and total_replicas > MIN_REPLICAS * len(polecats):
            # Scale down - remove 1 replica from each polecat
            for polecat in polecats:
                if polecat['replicas'] > MIN_REPLICAS:
                    scaling_actions.append({
                        'action': 'scale_down',
                        'polecat': polecat['name'],
                        'lane': lane_name,
                        'current_replicas': polecat['replicas'],
                        'target_replicas': max(polecat['replicas'] - 1, MIN_REPLICAS),
                        'reason': f"Queue at {queue_ratio:.0%} capacity",
                    })

    context['ti'].xcom_push(key='scaling_actions', value=scaling_actions)
    print(f"Calculated {len(scaling_actions)} scaling actions")
    return scaling_actions


def apply_scaling(**context):
    """Apply scaling actions to polecat CRs."""
    from kubernetes import client, config
    from confluent_kafka import Producer

    scaling_actions = context['ti'].xcom_pull(key='scaling_actions', task_ids='calculate_scaling') or []

    if not scaling_actions:
        print("No scaling actions to apply")
        return

    try:
        config.load_incluster_config()
    except config.ConfigException:
        config.load_kube_config()

    api = client.CustomObjectsApi()

    producer = Producer({
        'bootstrap.servers': KAFKA_BOOTSTRAP,
        'client.id': 'airflow-polecat-scaler',
    })

    applied = 0
    for action in scaling_actions:
        polecat_name = action['polecat']
        target_replicas = action['target_replicas']

        try:
            # Patch the polecat CR
            patch = {
                'spec': {
                    'replicas': target_replicas
                }
            }

            api.patch_namespaced_custom_object(
                group='tundra.dome',
                version='v1',
                namespace='tundra-dome',
                plural='polecats',
                name=polecat_name,
                body=patch,
            )

            print(f"Scaled {polecat_name}: {action['current_replicas']} -> {target_replicas}")
            applied += 1

            # Emit scaling event
            event = {
                'event': f"polecat.{action['action']}",
                'polecat': polecat_name,
                'lane': action['lane'],
                'previous_replicas': action['current_replicas'],
                'new_replicas': target_replicas,
                'reason': action['reason'],
                'timestamp': datetime.utcnow().isoformat(),
            }

            producer.produce(
                topic='tundra-polecat-commands',
                key=f"scale-{polecat_name}",
                value=json.dumps(event),
            )

        except Exception as e:
            print(f"Failed to scale {polecat_name}: {e}")

    producer.flush(timeout=10)
    print(f"Applied {applied}/{len(scaling_actions)} scaling actions")


with DAG(
    'polecat_scaler',
    default_args=default_args,
    description='Auto-scale polecats based on lane queue depth',
    schedule_interval=timedelta(minutes=2),
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=['tundra-dome', 'scaling', 'polecats'],
) as dag:

    get_polecats = PythonOperator(
        task_id='get_polecat_status',
        python_callable=get_polecat_status,
    )

    get_queues = PythonOperator(
        task_id='get_lane_queues',
        python_callable=get_lane_queues,
    )

    calculate = PythonOperator(
        task_id='calculate_scaling',
        python_callable=calculate_scaling,
    )

    apply = PythonOperator(
        task_id='apply_scaling',
        python_callable=apply_scaling,
    )

    [get_polecats, get_queues] >> calculate >> apply

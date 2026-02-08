"""
GitHub Sync DAG - Polls GitHub for issues and PRs, creates beads

This DAG supplements webhooks by polling GitHub API at regular intervals
to catch any missed events and sync state with Gitea mirror.
"""

from datetime import datetime, timedelta
import json
import os

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.providers.apache.kafka.operators.produce import ProduceToTopicOperator

# Configuration
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN', '')
GITHUB_ORG = os.environ.get('GITHUB_ORG', 'anthropics')
GITHUB_REPOS = os.environ.get('GITHUB_REPOS', 'claude-code').split(',')
KAFKA_BOOTSTRAP = os.environ.get('KAFKA_BROKERS', 'kafka-service:9092')

default_args = {
    'owner': 'tundra-dome',
    'depends_on_past': False,
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 2,
    'retry_delay': timedelta(minutes=1),
}


def fetch_github_issues(**context):
    """Fetch open issues from GitHub repos."""
    import requests

    if not GITHUB_TOKEN:
        print("No GITHUB_TOKEN set, skipping GitHub sync")
        return []

    headers = {
        'Authorization': f'token {GITHUB_TOKEN}',
        'Accept': 'application/vnd.github.v3+json',
    }

    all_issues = []

    for repo in GITHUB_REPOS:
        repo = repo.strip()
        if not repo:
            continue

        url = f'https://api.github.com/repos/{GITHUB_ORG}/{repo}/issues'
        params = {
            'state': 'open',
            'per_page': 50,
            'sort': 'updated',
            'direction': 'desc',
        }

        try:
            response = requests.get(url, headers=headers, params=params, timeout=30)
            response.raise_for_status()
            issues = response.json()

            for issue in issues:
                # Skip pull requests (they have a 'pull_request' key)
                if 'pull_request' in issue:
                    continue

                # Determine priority/lane based on labels
                labels = [l['name'].lower() for l in issue.get('labels', [])]
                if any(l in labels for l in ['critical', 'urgent', 'p0', 'security']):
                    lane = 'critical'
                elif any(l in labels for l in ['experimental', 'spike', 'research']):
                    lane = 'experimental'
                else:
                    lane = 'standard'

                all_issues.append({
                    'id': f"github-issue-{repo}-{issue['number']}",
                    'event': 'bead.lifecycle',
                    'stage': 'created',
                    'lane': lane,
                    'source': 'github',
                    'github_event': 'issues',
                    'repo': f'{GITHUB_ORG}/{repo}',
                    'issue_number': issue['number'],
                    'title': issue['title'],
                    'url': issue['html_url'],
                    'author': issue['user']['login'],
                    'labels': labels,
                    'created_at': issue['created_at'],
                    'updated_at': issue['updated_at'],
                    'timestamp': datetime.utcnow().isoformat(),
                })

            print(f"Fetched {len(issues)} issues from {GITHUB_ORG}/{repo}")

        except requests.RequestException as e:
            print(f"Error fetching issues from {GITHUB_ORG}/{repo}: {e}")

    context['ti'].xcom_push(key='issues', value=all_issues)
    return all_issues


def fetch_github_prs(**context):
    """Fetch open PRs from GitHub repos."""
    import requests

    if not GITHUB_TOKEN:
        return []

    headers = {
        'Authorization': f'token {GITHUB_TOKEN}',
        'Accept': 'application/vnd.github.v3+json',
    }

    all_prs = []

    for repo in GITHUB_REPOS:
        repo = repo.strip()
        if not repo:
            continue

        url = f'https://api.github.com/repos/{GITHUB_ORG}/{repo}/pulls'
        params = {
            'state': 'open',
            'per_page': 50,
            'sort': 'updated',
            'direction': 'desc',
        }

        try:
            response = requests.get(url, headers=headers, params=params, timeout=30)
            response.raise_for_status()
            prs = response.json()

            for pr in prs:
                labels = [l['name'].lower() for l in pr.get('labels', [])]

                # PRs to main/master are higher priority
                base_branch = pr.get('base', {}).get('ref', '')
                if base_branch in ['main', 'master'] or any(l in labels for l in ['critical', 'urgent']):
                    lane = 'critical'
                elif any(l in labels for l in ['experimental', 'draft']):
                    lane = 'experimental'
                else:
                    lane = 'standard'

                all_prs.append({
                    'id': f"github-pr-{repo}-{pr['number']}",
                    'event': 'bead.lifecycle',
                    'stage': 'created',
                    'lane': lane,
                    'source': 'github',
                    'github_event': 'pull_request',
                    'repo': f'{GITHUB_ORG}/{repo}',
                    'pr_number': pr['number'],
                    'title': pr['title'],
                    'url': pr['html_url'],
                    'author': pr['user']['login'],
                    'labels': labels,
                    'base_branch': base_branch,
                    'head_branch': pr.get('head', {}).get('ref', ''),
                    'draft': pr.get('draft', False),
                    'created_at': pr['created_at'],
                    'updated_at': pr['updated_at'],
                    'timestamp': datetime.utcnow().isoformat(),
                })

            print(f"Fetched {len(prs)} PRs from {GITHUB_ORG}/{repo}")

        except requests.RequestException as e:
            print(f"Error fetching PRs from {GITHUB_ORG}/{repo}: {e}")

    context['ti'].xcom_push(key='prs', value=all_prs)
    return all_prs


def produce_beads(**context):
    """Produce beads to Kafka."""
    from confluent_kafka import Producer

    issues = context['ti'].xcom_pull(key='issues', task_ids='fetch_issues') or []
    prs = context['ti'].xcom_pull(key='prs', task_ids='fetch_prs') or []

    all_beads = issues + prs

    if not all_beads:
        print("No beads to produce")
        return

    producer = Producer({
        'bootstrap.servers': KAFKA_BOOTSTRAP,
        'client.id': 'airflow-github-sync',
    })

    produced = 0
    for bead in all_beads:
        try:
            producer.produce(
                topic='tundra-work-intake',
                key=bead['id'],
                value=json.dumps(bead),
            )
            produced += 1
        except Exception as e:
            print(f"Error producing bead {bead['id']}: {e}")

    producer.flush(timeout=30)
    print(f"Produced {produced} beads to Kafka")


with DAG(
    'github_sync',
    default_args=default_args,
    description='Poll GitHub for issues and PRs, create beads',
    schedule_interval=timedelta(minutes=5),
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=['tundra-dome', 'github', 'sync'],
) as dag:

    fetch_issues = PythonOperator(
        task_id='fetch_issues',
        python_callable=fetch_github_issues,
    )

    fetch_prs = PythonOperator(
        task_id='fetch_prs',
        python_callable=fetch_github_prs,
    )

    produce = PythonOperator(
        task_id='produce_beads',
        python_callable=produce_beads,
    )

    [fetch_issues, fetch_prs] >> produce

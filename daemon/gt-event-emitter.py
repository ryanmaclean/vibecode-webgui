#!/usr/bin/env python3
import json
import os
import socket
import time
import urllib.request
import uuid
from pathlib import Path

EVENTS_PATH = os.environ.get('GT_EVENTS_PATH', '/Users/studio/gt/.events.jsonl')
STATE_PATH = os.environ.get('GT_EVENTS_STATE', '/Users/studio/gt/daemon/gt-event-emitter.state.json')
DD_SITE = os.environ.get('DD_SITE', 'datadoghq.com')
DD_API_KEY = os.environ.get('DD_API_KEY')
OPENLINEAGE_URL = os.environ.get('OPENLINEAGE_URL', '').strip()
OPENLINEAGE_ENDPOINT = os.environ.get('OPENLINEAGE_ENDPOINT', 'api/v1/lineage').lstrip('/')
OPENLINEAGE_PRODUCER = os.environ.get('OPENLINEAGE_PRODUCER', 'gastown/gt-event-emitter')
OPENLINEAGE_NAMESPACE = os.environ.get('OPENLINEAGE_NAMESPACE', 'gastown')
SERVICES = [s.strip() for s in os.environ.get('EMIT_SERVICES', 'gastown,openclaw').split(',') if s.strip()]
RIG_DEFAULT = os.environ.get('EMIT_RIG', 'mbp_m1')
ENV = os.environ.get('EMIT_ENV', 'local')
HOST = os.environ.get('EMIT_HOST', socket.gethostname())
SOURCE = os.environ.get('EMIT_SOURCE', 'gt-event-emitter')
COMPONENT = os.environ.get('EMIT_COMPONENT', 'gt-event-emitter')
SCHEMA_NAME = os.environ.get('EMIT_SCHEMA_NAME', 'gastown.beads')
SCHEMA_VERSION = os.environ.get('EMIT_SCHEMA_VERSION', '1')
SCHEMA_STATUS = os.environ.get('EMIT_SCHEMA_STATUS', 'ok')

if not DD_API_KEY:
    raise SystemExit('DD_API_KEY not set')

state_file = Path(STATE_PATH)
state = {"offset": 0}
if state_file.exists():
    try:
        state = json.loads(state_file.read_text())
    except Exception:
        state = {"offset": 0}


def save_state(offset: int) -> None:
    state_file.write_text(json.dumps({"offset": offset}))


def infer_rig(actor: str, payload: dict) -> str:
    rig = payload.get('rig') or payload.get('rig_name')
    if rig and isinstance(rig, str):
        return rig
    if '/' in actor:
        return actor.split('/')[0]
    # sling target may include rig
    target = payload.get('target') or ''
    if isinstance(target, str) and '/' in target:
        return target.split('/')[0]
    return RIG_DEFAULT


def infer_role(actor: str) -> str:
    if actor == 'mayor':
        return 'mayor'
    if actor == 'deacon':
        return 'deacon'
    if actor == 'refinery':
        return 'refinery'
    if actor == 'overseer':
        return 'overseer'
    if '/crew/' in actor:
        return 'crew'
    if '/witness' in actor or actor.endswith('/witness'):
        return 'witness'
    if '/polecats/' in actor:
        return 'polecat'
    # fallback: if actor has rig/name, treat as polecat-like
    if '/' in actor:
        return 'polecat'
    return 'unknown'


def stage_for_event(evt_type: str) -> str:
    if evt_type == 'hook':
        return 'hooked'
    if evt_type == 'sling':
        return 'in_progress'
    if evt_type == 'done':
        return 'completed'
    if evt_type == 'escalation_sent':
        return 'escalated'
    return ''


def counter_for_event(evt_type: str) -> str:
    if evt_type == 'hook':
        return 'beads.hooked'
    if evt_type == 'sling':
        return 'beads.in_progress'
    if evt_type == 'done':
        return 'beads.completed'
    if evt_type == 'escalation_sent':
        return 'beads.escalated'
    if evt_type == 'mail':
        return 'mail.sent'
    if evt_type == 'nudge':
        return 'nudges.sent'
    return ''


def emit_logs(payloads):
    if not payloads:
        return
    url = f"https://http-intake.logs.{DD_SITE}/api/v2/logs"
    data = json.dumps(payloads).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            'DD-API-KEY': DD_API_KEY,
            'Content-Type': 'application/json'
        },
        method='POST'
    )
    for attempt in range(3):  # simple retry to avoid crashing on transient network errors
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                resp.read()
            return
        except Exception:
            # Broken pipe or transient network failure; back off and retry
            time.sleep(1 + attempt * 0.5)
            continue


def openlineage_url() -> str:
    if OPENLINEAGE_URL:
        return f"{OPENLINEAGE_URL.rstrip('/')}/{OPENLINEAGE_ENDPOINT}"
    return f"https://data-obs-intake.{DD_SITE}/api/v1/lineage"


def emit_openlineage(payloads):
    if not payloads:
        return
    url = openlineage_url()
    headers = {'Content-Type': 'application/json'}
    if not OPENLINEAGE_URL and DD_API_KEY:
        headers['Authorization'] = f"Bearer {DD_API_KEY}"
    for payload in payloads:
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers=headers, method='POST')
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=10) as resp:
                    resp.read()
                break
            except Exception:
                time.sleep(1 + attempt * 0.5)
                continue


def openlineage_event_for(evt_type: str) -> str:
    if evt_type == 'hook':
        return 'START'
    if evt_type == 'done':
        return 'COMPLETE'
    if evt_type == 'escalation_sent':
        return 'FAIL'
    return ''


with open(EVENTS_PATH, 'r', encoding='utf-8') as f:
    f.seek(state.get('offset', 0))
    lines = f.read().splitlines()
    offset = f.tell()

payloads = []
ol_payloads = []
for line in lines:
    if not line.strip():
        continue
    try:
        evt = json.loads(line)
    except Exception:
        continue
    evt_type = evt.get('type')
    actor = evt.get('actor') or ''
    payload = evt.get('payload') or {}
    rig = infer_rig(actor, payload)
    role = infer_role(actor)
    stage = stage_for_event(evt_type)
    counter = counter_for_event(evt_type)
    ol_event_type = openlineage_event_for(evt_type)
    bead_id = payload.get('bead')

    # emit role_activity for any event
    for service in SERVICES:
        payloads.append({
            'ddsource': SOURCE,
            'service': service,
            'host': HOST,
            'message': 'role_activity',
            'timestamp': evt.get('ts') or time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            'role': role,
            'rig': rig,
            'component': COMPONENT,
            'env': ENV,
            'event_type': 'role_activity',
            'schema_name': SCHEMA_NAME,
            'schema_version': SCHEMA_VERSION,
            'schema_status': SCHEMA_STATUS
        })
        if stage:
            payloads.append({
                'ddsource': SOURCE,
                'service': service,
                'host': HOST,
                'message': 'bead_provenance',
                'timestamp': evt.get('ts') or time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                'stage': stage,
                'rig': rig,
                'role': role,
                'component': COMPONENT,
                'env': ENV,
                'event_type': 'bead_provenance',
                'schema_name': SCHEMA_NAME,
                'schema_version': SCHEMA_VERSION,
                'schema_status': SCHEMA_STATUS
            })
        if counter:
            payloads.append({
                'ddsource': SOURCE,
                'service': service,
                'host': HOST,
                'message': counter,
                'timestamp': evt.get('ts') or time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                'counter': counter,
                'rig': rig,
                'role': role,
                'stage': stage,
                'component': COMPONENT,
                'env': ENV,
                'event_type': counter,
                'schema_name': SCHEMA_NAME,
                'schema_version': SCHEMA_VERSION,
                'schema_status': SCHEMA_STATUS
            })

    if ol_event_type and bead_id:
        run_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{OPENLINEAGE_NAMESPACE}:{rig}:{bead_id}"))
        ol_payloads.append({
            'eventType': ol_event_type,
            'eventTime': evt.get('ts') or time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            'run': {'runId': run_id},
            'job': {'namespace': OPENLINEAGE_NAMESPACE, 'name': str(bead_id)},
            'producer': OPENLINEAGE_PRODUCER
        })

# send in batches
if payloads:
    emit_logs(payloads)
if ol_payloads:
    emit_openlineage(ol_payloads)

save_state(offset)

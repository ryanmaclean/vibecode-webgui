#!/usr/bin/env python3
import os
import json
import time
import socket
import urllib.request

def getenv(name, default=None):
    val = os.environ.get(name)
    return val if val else default

DD_SITE = getenv('DD_SITE', 'datadoghq.com')
DD_API_KEY = getenv('DD_API_KEY')
if not DD_API_KEY:
    raise SystemExit('DD_API_KEY not set')

HOST = getenv('EMIT_HOST', socket.gethostname())
ROLE = getenv('EMIT_ROLE', 'deacon')
STAGE = getenv('EMIT_STAGE', 'created')
RIG = getenv('EMIT_RIG', 'mbp_m1')
ENV = getenv('EMIT_ENV', 'local')
SERVICES = [s.strip() for s in getenv('EMIT_SERVICES', 'gastown,openclaw').split(',') if s.strip()]
SOURCE = getenv('EMIT_SOURCE', 'emit-role-metrics')
COMPONENT = getenv('EMIT_COMPONENT', 'emit-role-metrics')

now = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

payload = []
for service in SERVICES:
    payload.append({
        'ddsource': SOURCE,
        'service': service,
        'host': HOST,
        'message': 'role_activity',
        'timestamp': now,
        'role': ROLE,
        'rig': RIG,
        'component': COMPONENT,
        'env': ENV,
        'event_type': 'role_activity',
    })
    payload.append({
        'ddsource': SOURCE,
        'service': service,
        'host': HOST,
        'message': 'bead_provenance',
        'timestamp': now,
        'stage': STAGE,
        'rig': RIG,
        'component': COMPONENT,
        'env': ENV,
        'event_type': 'bead_provenance',
    })

url = f"https://http-intake.logs.{DD_SITE}/api/v2/logs"
req = urllib.request.Request(
    url,
    data=json.dumps(payload).encode('utf-8'),
    headers={'DD-API-KEY': DD_API_KEY, 'Content-Type': 'application/json'},
    method='POST',
)

with urllib.request.urlopen(req, timeout=10) as resp:
    resp.read()

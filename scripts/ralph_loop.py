#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "ralph-loop"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "scripts"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation

"""
Ralph Loop - Gas Town Health Monitor
Monitors VM, gateway, and remote Gas Town status.

Test Isolation: This script auto-checks dependencies and provides
clear instructions if they're missing. For CI, ensure scripts/requirements.txt
is installed first: pip install -r scripts/requirements.txt
"""
try:
    import os as _os; _c = __import__('ddtrace').config; _s = _os.path.basename(__file__).replace('.py',''); _c.service = _s; _c.requests.service = _s; __import__('ddtrace').patch_all()
except: pass


# -- VibeCode Telemetry --
import sys
import os

# Initialize log aggregation
log_agg = get_log_aggregation()

try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), './')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

import sys
import logging
import subprocess

# Test isolation: Check and report missing dependencies
REQUIRED_PACKAGES = ['requests']
_missing_deps = []
for _pkg in REQUIRED_PACKAGES:
    try:
        __import__(_pkg)
    except ImportError:
        _missing_deps.append(_pkg)

if _missing_deps:
    print(f"⚠️  Missing dependencies: {', '.join(_missing_deps)}")
    print(f"   Install with: pip install -r scripts/requirements.txt")
    print(f"   Or: pip install {' '.join(_missing_deps)}")
    if os.environ.get('RALPH_LOOP_STRICT', '').lower() in ('1', 'true', 'yes'):
        sys.exit(1)  # Fail fast in strict mode (for CI)

logging.basicConfig(level=logging.INFO, format='%(asctime)s [RALPH-LOOP] %(message)s')
logger = logging.getLogger()

REMOTE_HOST = "mbp-m1.local"
# OpenClaw Gateway usually runs on 18789
GATEWAY_URL = "http://localhost:18789/health"

def check_local_gateway():
    try:
        import requests
        resp = requests.get(GATEWAY_URL, timeout=2)
        if resp.status_code == 200:
            return True
        logger.warning(f"⚠️  Gateway returned status: {resp.status_code}")
        return False
    except ImportError:
        logger.error("❌ Gateway Check Skipped: 'requests' module not found. Run 'pip install requests'.")
        return False
    except Exception as e:
        # Check if it's a connection error (requests might not be imported if ImportError was raised, 
        # but here we are in the generic catch, so we need to be careful not to reference requests if not imported)
        logger.error(f"❌ Gateway Check Failed: {e}")
        return False

def check_remote_gastown():
    # Ping check
    try:
        res = subprocess.run(["ping", "-c", "1", "-W", "1", REMOTE_HOST], capture_output=True)
        return res.returncode == 0
    except Exception:
        return False

def check_vm():
    # Check if vfkit process is running
    try:
        res = subprocess.run(["pgrep", "-f", "vfkit"], capture_output=True)
        return res.returncode == 0
    except Exception:
        return False

def run_loop():
    logger.info("🔄 Ralph Loop Cycle Starting...")
    
    # Check 1: VM Status
    vm_status = check_vm()
    if vm_status:
        logger.info("✅ VM: Running (vfkit process found)")
    else:
        logger.warning("⚠️  VM: Stopped (vfkit process not found)")

    # Check 2: Local Gateway (The Critical Path)
    gateway_status = check_local_gateway()
    if gateway_status:
        logger.info("✅ Local Gas Town (OpenClaw): Active & Healthy")
    else:
        logger.error("❌ Local Gas Town: Unreachable")

    # Check 3: Remote Gas Town (Legacy)
    remote_status = check_remote_gastown()
    if remote_status:
        logger.info(f"✅ Remote Gas Town ({REMOTE_HOST}): Reachable")
    else:
        logger.warning(f"⚠️  Remote Gas Town ({REMOTE_HOST}): Unreachable")

    # Summary Decision
    if not gateway_status and not vm_status:
        logger.critical("🚨 SYSTEM DOWN: Start the backend with 'python3 scripts/launch_ubuntu_vm.py'")

    logger.info("🏁 Loop Cycle Complete")

if __name__ == "__main__":
    run_loop()
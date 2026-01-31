#!/usr/bin/env python3
import time
import sys
import logging
import subprocess
# requests imported lazily to allow script to run (with failures) even if deps missing

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

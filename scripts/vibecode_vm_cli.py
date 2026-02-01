#!/usr/bin/env python3
# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

import sys
import subprocess
import os
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format='%(asctime)s [VIBECODE-VM-CLI] %(message)s')
logger = logging.getLogger()

SCRIPTS_DIR = Path(__file__).resolve().parent
LAUNCH_VM_SCRIPT = SCRIPTS_DIR / "launch_ubuntu_vm.py"
RALPH_LOOP_SCRIPT = SCRIPTS_DIR / "ralph_loop.py"

def run_script(script_path, *args):
    cmd = [sys.executable, str(script_path)] + list(args)
    logger.info(f"Executing: {' '.join(cmd)}")
    try:
        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError as e:
        logger.error(f"Script {script_path.name} failed with exit code {e.returncode}")
        sys.exit(e.returncode)

def main():
    if len(sys.argv) < 2:
        print("Usage: vibecode-vm [start|stop|status] [args...]")
        sys.exit(1)

    command = sys.argv[1]
    extra_args = sys.argv[2:]

    if command == "start":
        logger.info("🚀 Starting VibeCode VM...")
        run_script(LAUNCH_VM_SCRIPT, *extra_args)
    elif command == "stop":
        logger.info("🛑 Stopping VibeCode VM...")
        # For vfkit, stopping means killing the process.
        # This is a simplification; a more robust solution would track PIDs.
        try:
            subprocess.run(["pkill", "-f", "vfkit"], check=True)
            logger.info("✅ vfkit process terminated.")
        except subprocess.CalledProcessError:
            logger.info("ℹ️  VM was not running (vfkit process not found)")
    elif command == "status":
        logger.info("🔍 Checking VibeCode VM Status...")
        run_script(RALPH_LOOP_SCRIPT, *extra_args)
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)

if __name__ == "__main__":
    main()

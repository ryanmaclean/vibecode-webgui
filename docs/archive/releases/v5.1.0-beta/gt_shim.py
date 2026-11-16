#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), './')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

import sys
import logging

# This shim allows legacy 'gt' commands to map to OpenClaw
logging.basicConfig(format='[GT-SHIM] %(message)s')
logger = logging.getLogger()

def main():
    args = sys.argv[1:]
    if not args:
        print("Gas Town Shim (Powered by OpenClaw)")
        return

    cmd = args[0]
    if cmd == "status":
        # Call Ralph Loop
        import subprocess
        subprocess.run(["python3", "scripts/ralph_loop.py"])
    elif cmd == "up":
        print("Starting OpenClaw VM...")
        subprocess.run(["python3", "scripts/launch_ubuntu_vm.py"])
    else:
        print(f"Unknown legacy command: {cmd}. Try 'status' or 'up'.")

if __name__ == "__main__":
    main()
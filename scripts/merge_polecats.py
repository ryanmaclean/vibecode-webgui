
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


# Post-Merge Validation (Ralph Loop)
print("\n=== Running Ralph Loop Validation ===")
import subprocess
subprocess.run(["python3", "scripts/ralph_loop.py"])
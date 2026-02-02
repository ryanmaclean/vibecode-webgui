<<<<<<< HEAD

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

"""Utility scripts for the VibeCode workspace."""
=======
"""Utility scripts for the VibeCode workspace."""

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed

>>>>>>> 5146aef79 (feat(scripts): add Datadog APM tracing to all 195 Python scripts)

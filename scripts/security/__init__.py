
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

"""
Security Scripts Package

Python implementations of VibeCode security scripts.

Modules:
    setup: Security setup and provisioning (namespaces, secrets, environment files)
    test: Security testing suite
    monitoring: Continuous security monitoring
    updates: Security patch automation
    audit: Security audit scanning
    scan: API key and secrets scanning
"""

from . import setup
from . import test
from . import monitoring
from . import updates
from . import audit
from . import scan

__all__ = [
    "setup",
    "test",
    "monitoring",
    "updates",
    "audit",
    "scan",
]
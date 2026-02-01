
# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
Kubernetes Scripts Package

Python implementations of Kubernetes deployment and testing scripts.

Modules:
    agentapi: AgentAPI deployment and testing
    skywalking: SkyWalking deployment and verification
    cloud_workspaces: Cloud workspace smoke tests
"""

from . import agentapi
from . import skywalking
from . import cloud_workspaces

__all__ = [
    "agentapi",
    "skywalking",
    "cloud_workspaces",
]

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

"""Pydantic AI CLI Coding Agent"""

from .coding_agent import CodingAgent
from .config import AgentConfig

__all__ = ['CodingAgent', 'AgentConfig']
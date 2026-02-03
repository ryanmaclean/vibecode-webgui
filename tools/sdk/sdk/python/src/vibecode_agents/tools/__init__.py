
# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
Tool registration and decorator system for VibeCode Agents

Provides decorators for registering custom tools that agents can use.
"""

from vibecode_agents.tools.decorators import Tool, tool
from vibecode_agents.tools.registry import ToolRegistry

__all__ = ["Tool", "tool", "ToolRegistry"]
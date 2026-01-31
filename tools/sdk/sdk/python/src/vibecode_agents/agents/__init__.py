
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
Pre-built agent examples for common use cases

Production-ready agent implementations demonstrating SDK capabilities.
"""

from vibecode_agents.agents.code_review import CodeReviewAgent
from vibecode_agents.agents.documentation import DocumentationAgent
from vibecode_agents.agents.testing import TestingAgent

__all__ = ["CodeReviewAgent", "DocumentationAgent", "TestingAgent"]
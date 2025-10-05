"""
Tool registration and decorator system for VibeCode Agents

Provides decorators for registering custom tools that agents can use.
"""

from vibecode_agents.tools.decorators import Tool, tool
from vibecode_agents.tools.registry import ToolRegistry

__all__ = ["Tool", "tool", "ToolRegistry"]

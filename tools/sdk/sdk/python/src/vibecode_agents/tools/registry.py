
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
Global tool registry for agent capability management

Provides centralized tool registration, discovery, and lifecycle management.
"""

import logging
from typing import Any, Dict, List, Optional

from vibecode_agents.tools.decorators import Tool

logger = logging.getLogger(__name__)


class ToolRegistry:
    """
    Global registry for agent tools

    Manages tool registration, discovery, and schema generation.
    Thread-safe singleton implementation.

    Example:
        >>> registry = get_registry()
        >>> registry.register(my_tool)
        >>> tools = registry.get_all_tools()
        >>> schema = registry.to_openapi_schema()
    """

    _instance: Optional["ToolRegistry"] = None

    def __new__(cls) -> "ToolRegistry":
        """Singleton pattern implementation"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._tools: Dict[str, Tool] = {}
            cls._instance._tags: Dict[str, List[str]] = {}
        return cls._instance

    def register(self, tool: Tool) -> None:
        """
        Register a tool in the global registry

        Args:
            tool: Tool instance to register

        Raises:
            ValueError: Tool name already registered
        """
        if tool.name in self._tools:
            logger.warning(f"Tool {tool.name} already registered, overwriting")

        self._tools[tool.name] = tool

        # Index by tags
        for tag in tool.tags:
            if tag not in self._tags:
                self._tags[tag] = []
            if tool.name not in self._tags[tag]:
                self._tags[tag].append(tool.name)

        logger.debug(f"Registered tool: {tool.name}")

    def unregister(self, name: str) -> None:
        """
        Unregister a tool from the registry

        Args:
            name: Tool name to unregister
        """
        if name in self._tools:
            tool = self._tools[name]
            del self._tools[name]

            # Remove from tag index
            for tag in tool.tags:
                if tag in self._tags and name in self._tags[tag]:
                    self._tags[tag].remove(name)

            logger.debug(f"Unregistered tool: {name}")

    def get_tool(self, name: str) -> Optional[Tool]:
        """
        Get tool by name

        Args:
            name: Tool name

        Returns:
            Tool instance or None if not found
        """
        return self._tools.get(name)

    def get_all_tools(self) -> Dict[str, Tool]:
        """
        Get all registered tools

        Returns:
            Dict mapping tool names to Tool instances
        """
        return self._tools.copy()

    def get_tools_by_tag(self, tag: str) -> List[Tool]:
        """
        Get tools with specific tag

        Args:
            tag: Tag to filter by

        Returns:
            List of Tool instances with the tag
        """
        tool_names = self._tags.get(tag, [])
        return [self._tools[name] for name in tool_names if name in self._tools]

    def list_tool_names(self) -> List[str]:
        """
        Get list of all registered tool names

        Returns:
            List of tool names
        """
        return list(self._tools.keys())

    def list_tags(self) -> List[str]:
        """
        Get list of all tags

        Returns:
            List of tag names
        """
        return list(self._tags.keys())

    def to_openapi_schema(self) -> List[Dict[str, Any]]:
        """
        Generate OpenAPI-compatible schema for all tools

        Returns:
            List of tool schemas for agent registration
        """
        return [tool.to_schema() for tool in self._tools.values()]

    def clear(self) -> None:
        """Clear all registered tools (useful for testing)"""
        self._tools.clear()
        self._tags.clear()
        logger.debug("Cleared tool registry")

    def __len__(self) -> int:
        """Get number of registered tools"""
        return len(self._tools)

    def __contains__(self, name: str) -> bool:
        """Check if tool is registered"""
        return name in self._tools


def get_registry() -> ToolRegistry:
    """
    Get global tool registry instance

    Returns:
        Singleton ToolRegistry instance
    """
    return ToolRegistry()
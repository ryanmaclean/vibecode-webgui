
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
Tool decorators for agent capability extension

Provides production-ready decorators for tool registration with
automatic parameter validation and documentation generation.
"""

import inspect
import logging
from functools import wraps
from typing import Any, Callable, Dict, List, Optional, TypeVar, get_type_hints

from pydantic import BaseModel, Field, create_model

logger = logging.getLogger(__name__)

F = TypeVar("F", bound=Callable[..., Any])


class Tool:
    """
    Tool definition for agent capabilities

    Wraps a function with metadata for agent tool registration.
    Provides automatic parameter validation and schema generation.

    Example:
        >>> @tool(name="search_code", description="Search codebase")
        ... async def search_code(query: str, file_pattern: str = "*.py") -> List[str]:
        ...     # Implementation
        ...     return results
    """

    def __init__(
        self,
        func: Callable[..., Any],
        name: str,
        description: str,
        parameters: Optional[Dict[str, Any]] = None,
        returns: Optional[Dict[str, Any]] = None,
        examples: Optional[List[str]] = None,
        tags: Optional[List[str]] = None,
    ):
        """
        Initialize Tool wrapper

        Args:
            func: Function to wrap
            name: Tool name (must be unique)
            description: Human-readable tool description
            parameters: Parameter schema (auto-generated if None)
            returns: Return value schema (auto-generated if None)
            examples: Usage examples
            tags: Categorization tags
        """
        self.func = func
        self.name = name
        self.description = description
        self.parameters = parameters or self._extract_parameters()
        self.returns = returns or self._extract_returns()
        self.examples = examples or []
        self.tags = tags or []
        self.is_async = inspect.iscoroutinefunction(func)

        # Create Pydantic model for validation
        self.validator = self._create_validator()

    def _extract_parameters(self) -> Dict[str, Any]:
        """Extract parameter schema from function signature"""
        sig = inspect.signature(self.func)
        type_hints = get_type_hints(self.func)
        parameters = {}

        for param_name, param in sig.parameters.items():
            if param_name == "self":
                continue

            param_type = type_hints.get(param_name, str)
            param_schema = {
                "type": self._python_type_to_json_type(param_type),
                "description": f"Parameter {param_name}",
            }

            if param.default != inspect.Parameter.empty:
                param_schema["default"] = param.default
            else:
                param_schema["required"] = True

            parameters[param_name] = param_schema

        return parameters

    def _extract_returns(self) -> Dict[str, Any]:
        """Extract return value schema from type hints"""
        type_hints = get_type_hints(self.func)
        return_type = type_hints.get("return", Any)

        return {
            "type": self._python_type_to_json_type(return_type),
            "description": "Function return value",
        }

    def _python_type_to_json_type(self, python_type: Any) -> str:
        """Convert Python type to JSON schema type"""
        type_mapping = {
            str: "string",
            int: "integer",
            float: "number",
            bool: "boolean",
            list: "array",
            dict: "object",
            List: "array",
            Dict: "object",
        }

        # Handle generic types
        origin = getattr(python_type, "__origin__", None)
        if origin:
            return type_mapping.get(origin, "string")

        return type_mapping.get(python_type, "string")

    def _create_validator(self) -> type[BaseModel]:
        """Create Pydantic model for parameter validation"""
        fields = {}
        sig = inspect.signature(self.func)
        type_hints = get_type_hints(self.func)

        for param_name, param in sig.parameters.items():
            if param_name == "self":
                continue

            param_type = type_hints.get(param_name, str)
            default = ... if param.default == inspect.Parameter.empty else param.default

            fields[param_name] = (param_type, Field(default, description=f"Parameter {param_name}"))

        return create_model(f"{self.name}Params", **fields)  # type: ignore

    def validate(self, **kwargs: Any) -> Dict[str, Any]:
        """
        Validate parameters against schema

        Args:
            **kwargs: Parameters to validate

        Returns:
            Validated parameters dict

        Raises:
            ValidationError: Invalid parameters
        """
        validated = self.validator(**kwargs)
        return validated.model_dump()

    async def execute(self, **kwargs: Any) -> Any:
        """
        Execute tool with validated parameters

        Args:
            **kwargs: Tool parameters

        Returns:
            Tool execution result

        Raises:
            ValidationError: Invalid parameters
            Exception: Tool execution failed
        """
        validated_params = self.validate(**kwargs)

        try:
            if self.is_async:
                return await self.func(**validated_params)
            else:
                return self.func(**validated_params)
        except Exception as e:
            logger.error(f"Tool {self.name} execution failed: {e}")
            raise

    def to_schema(self) -> Dict[str, Any]:
        """
        Generate OpenAPI-compatible tool schema

        Returns:
            Dict representing tool schema for agent registration
        """
        return {
            "name": self.name,
            "description": self.description,
            "parameters": {
                "type": "object",
                "properties": self.parameters,
                "required": [
                    name
                    for name, schema in self.parameters.items()
                    if schema.get("required", False)
                ],
            },
            "returns": self.returns,
            "examples": self.examples,
            "tags": self.tags,
        }

    def __call__(self, *args: Any, **kwargs: Any) -> Any:
        """Allow tool to be called directly"""
        return self.func(*args, **kwargs)


def tool(
    name: Optional[str] = None,
    description: Optional[str] = None,
    parameters: Optional[Dict[str, Any]] = None,
    returns: Optional[Dict[str, Any]] = None,
    examples: Optional[List[str]] = None,
    tags: Optional[List[str]] = None,
) -> Callable[[F], Tool]:
    """
    Decorator to register a function as an agent tool

    Automatically extracts parameter schemas from type hints and
    creates validation models for runtime safety.

    Args:
        name: Tool name (defaults to function name)
        description: Human-readable description (defaults to docstring)
        parameters: Custom parameter schema (auto-generated if None)
        returns: Custom return schema (auto-generated if None)
        examples: Usage examples
        tags: Categorization tags

    Returns:
        Decorator function

    Example:
        >>> @tool(
        ...     name="code_search",
        ...     description="Search codebase for patterns",
        ...     tags=["search", "code"]
        ... )
        ... async def search_code(
        ...     query: str,
        ...     file_pattern: str = "*.py",
        ...     max_results: int = 10
        ... ) -> List[str]:
        ...     '''Search for code patterns in files'''
        ...     results = []
        ...     # Implementation
        ...     return results
    """

    def decorator(func: F) -> Tool:
        tool_name = name or func.__name__
        tool_description = description or inspect.getdoc(func) or "No description provided"

        tool_obj = Tool(
            func=func,
            name=tool_name,
            description=tool_description,
            parameters=parameters,
            returns=returns,
            examples=examples,
            tags=tags,
        )

        # Register tool in global registry
        from vibecode_agents.tools.registry import get_registry

        registry = get_registry()
        registry.register(tool_obj)

        logger.info(f"Registered tool: {tool_name}")

        return tool_obj

    return decorator
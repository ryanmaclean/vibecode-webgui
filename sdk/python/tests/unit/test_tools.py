"""
Unit tests for tool registration system

Tests decorator functionality and registry management.
"""

import pytest
from typing import List

from vibecode_agents.tools import Tool, tool, ToolRegistry, get_registry


@pytest.mark.unit
class TestToolDecorator:
    """Test tool decorator functionality"""

    def test_basic_tool_creation(self) -> None:
        """Test basic tool creation with decorator"""

        @tool(name="test_tool", description="A test tool")
        def test_func(param: str) -> str:
            return param

        assert isinstance(test_func, Tool)
        assert test_func.name == "test_tool"
        assert test_func.description == "A test tool"

    def test_tool_with_defaults(self) -> None:
        """Test tool creation with default parameters"""

        @tool()
        def my_function(x: int, y: int = 10) -> int:
            """Add two numbers"""
            return x + y

        assert my_function.name == "my_function"
        assert "Add two numbers" in my_function.description

    def test_tool_parameter_extraction(self) -> None:
        """Test automatic parameter extraction"""

        @tool()
        def func_with_params(
            required: str, optional: int = 5, flag: bool = False
        ) -> List[str]:
            return []

        params = func_with_params.parameters
        assert "required" in params
        assert "optional" in params
        assert "flag" in params
        assert params["optional"]["default"] == 5

    def test_async_tool(self) -> None:
        """Test async tool creation"""

        @tool()
        async def async_func(x: int) -> int:
            return x * 2

        assert async_func.is_async is True

    def test_sync_tool(self) -> None:
        """Test sync tool creation"""

        @tool()
        def sync_func(x: int) -> int:
            return x * 2

        assert async_func.is_async is False

    @pytest.mark.asyncio
    async def test_tool_execution(self) -> None:
        """Test tool execution"""

        @tool()
        async def multiply(x: int, y: int) -> int:
            return x * y

        result = await multiply.execute(x=3, y=4)
        assert result == 12

    def test_tool_validation(self) -> None:
        """Test parameter validation"""

        @tool()
        def add(x: int, y: int) -> int:
            return x + y

        # Valid parameters
        validated = add.validate(x=1, y=2)
        assert validated == {"x": 1, "y": 2}

        # Invalid parameters should raise
        with pytest.raises(Exception):  # Pydantic ValidationError
            add.validate(x="invalid")

    def test_tool_schema_generation(self) -> None:
        """Test OpenAPI schema generation"""

        @tool(
            name="search",
            description="Search function",
            tags=["search", "query"],
        )
        def search(query: str, limit: int = 10) -> List[str]:
            return []

        schema = search.to_schema()

        assert schema["name"] == "search"
        assert schema["description"] == "Search function"
        assert schema["tags"] == ["search", "query"]
        assert "parameters" in schema
        assert schema["parameters"]["type"] == "object"


@pytest.mark.unit
class TestToolRegistry:
    """Test tool registry functionality"""

    def setup_method(self) -> None:
        """Clear registry before each test"""
        registry = get_registry()
        registry.clear()

    def test_registry_singleton(self) -> None:
        """Test registry is singleton"""
        registry1 = get_registry()
        registry2 = get_registry()
        assert registry1 is registry2

    def test_tool_registration(self) -> None:
        """Test tool gets registered"""

        @tool(name="test_reg")
        def test_func() -> None:
            pass

        registry = get_registry()
        assert "test_reg" in registry
        assert registry.get_tool("test_reg") is not None

    def test_get_all_tools(self) -> None:
        """Test getting all registered tools"""

        @tool(name="tool1")
        def func1() -> None:
            pass

        @tool(name="tool2")
        def func2() -> None:
            pass

        registry = get_registry()
        tools = registry.get_all_tools()

        assert len(tools) == 2
        assert "tool1" in tools
        assert "tool2" in tools

    def test_tool_unregistration(self) -> None:
        """Test tool unregistration"""

        @tool(name="temp_tool")
        def temp_func() -> None:
            pass

        registry = get_registry()
        assert "temp_tool" in registry

        registry.unregister("temp_tool")
        assert "temp_tool" not in registry

    def test_get_tools_by_tag(self) -> None:
        """Test filtering tools by tag"""

        @tool(name="search1", tags=["search"])
        def func1() -> None:
            pass

        @tool(name="search2", tags=["search", "advanced"])
        def func2() -> None:
            pass

        @tool(name="other", tags=["other"])
        def func3() -> None:
            pass

        registry = get_registry()
        search_tools = registry.get_tools_by_tag("search")

        assert len(search_tools) == 2
        assert all(tool.name.startswith("search") for tool in search_tools)

    def test_list_tool_names(self) -> None:
        """Test listing all tool names"""

        @tool(name="alpha")
        def func1() -> None:
            pass

        @tool(name="beta")
        def func2() -> None:
            pass

        registry = get_registry()
        names = registry.list_tool_names()

        assert "alpha" in names
        assert "beta" in names

    def test_list_tags(self) -> None:
        """Test listing all tags"""

        @tool(tags=["tag1"])
        def func1() -> None:
            pass

        @tool(tags=["tag2"])
        def func2() -> None:
            pass

        registry = get_registry()
        tags = registry.list_tags()

        assert "tag1" in tags
        assert "tag2" in tags

    def test_openapi_schema(self) -> None:
        """Test OpenAPI schema generation for all tools"""

        @tool(name="func1", description="First function")
        def func1(x: int) -> int:
            return x

        @tool(name="func2", description="Second function")
        def func2(y: str) -> str:
            return y

        registry = get_registry()
        schema = registry.to_openapi_schema()

        assert len(schema) == 2
        assert all("name" in tool for tool in schema)
        assert all("description" in tool for tool in schema)

    def test_registry_len(self) -> None:
        """Test registry length"""

        @tool()
        def func1() -> None:
            pass

        @tool()
        def func2() -> None:
            pass

        registry = get_registry()
        assert len(registry) == 2

    def test_registry_clear(self) -> None:
        """Test registry clear"""

        @tool()
        def func() -> None:
            pass

        registry = get_registry()
        assert len(registry) > 0

        registry.clear()
        assert len(registry) == 0


@pytest.mark.unit
class TestToolExamples:
    """Test realistic tool examples"""

    def setup_method(self) -> None:
        """Clear registry before each test"""
        get_registry().clear()

    def test_file_search_tool(self) -> None:
        """Test file search tool example"""

        @tool(
            name="search_files",
            description="Search for files matching pattern",
            tags=["search", "files"],
        )
        async def search_files(
            pattern: str, directory: str = ".", recursive: bool = True
        ) -> List[str]:
            """Search for files matching glob pattern"""
            return []

        assert search_files.name == "search_files"
        assert search_files.is_async is True

        schema = search_files.to_schema()
        assert schema["parameters"]["properties"]["pattern"]["required"] is True
        assert schema["parameters"]["properties"]["recursive"]["default"] is True

    def test_code_analysis_tool(self) -> None:
        """Test code analysis tool example"""

        @tool(
            name="analyze_complexity",
            description="Analyze code complexity metrics",
            tags=["analysis", "metrics"],
        )
        def analyze_complexity(file_path: str, threshold: int = 10) -> dict:
            """Calculate cyclomatic complexity"""
            return {"complexity": 0, "threshold": threshold}

        result = analyze_complexity("test.py", threshold=15)
        assert result["threshold"] == 15

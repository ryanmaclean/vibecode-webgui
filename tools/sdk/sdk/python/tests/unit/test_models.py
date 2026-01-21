"""
Unit tests for data models

Tests Pydantic model validation and serialization.
"""

import pytest
from datetime import datetime
from pydantic import ValidationError

from vibecode_agents.models import (
    AgentType,
    AgentStatus,
    ModelType,
    StartAgentRequest,
    AgentResponse,
    AgentStatusResponse,
    ListAgentsQuery,
    isValidAgentId,
    isValidWorkspacePath,
    isValidTask,
    isValidMessage,
)


@pytest.mark.unit
class TestStartAgentRequest:
    """Test StartAgentRequest validation"""

    def test_valid_request(self) -> None:
        """Test valid request creation"""
        request = StartAgentRequest(
            agent_type=AgentType.AIDER,
            workspace="/home/coder/workspace/project",
            model=ModelType.CLAUDE_3_5_SONNET,
            task="Add type hints to all functions in the codebase",
        )

        assert request.agent_type == AgentType.AIDER
        assert request.workspace.startswith("/home/coder/workspace")
        assert len(request.task) >= 10

    def test_invalid_workspace(self) -> None:
        """Test workspace path validation"""
        with pytest.raises(ValidationError):
            StartAgentRequest(
                agent_type=AgentType.AIDER,
                workspace="/invalid/path",
                model=ModelType.CLAUDE_3_5_SONNET,
                task="Add type hints",
            )

    def test_task_too_short(self) -> None:
        """Test task minimum length validation"""
        with pytest.raises(ValidationError):
            StartAgentRequest(
                agent_type=AgentType.AIDER,
                workspace="/home/coder/workspace",
                model=ModelType.CLAUDE_3_5_SONNET,
                task="short",
            )

    def test_task_too_long(self) -> None:
        """Test task maximum length validation"""
        with pytest.raises(ValidationError):
            StartAgentRequest(
                agent_type=AgentType.AIDER,
                workspace="/home/coder/workspace",
                model=ModelType.CLAUDE_3_5_SONNET,
                task="x" * 2001,
            )

    def test_optional_files(self) -> None:
        """Test optional files parameter"""
        request = StartAgentRequest(
            agent_type=AgentType.AIDER,
            workspace="/home/coder/workspace",
            model=ModelType.CLAUDE_3_5_SONNET,
            task="Add type hints",
            files=["src/main.py", "src/utils.py"],
        )

        assert request.files == ["src/main.py", "src/utils.py"]

    def test_optional_metadata(self) -> None:
        """Test optional metadata parameter"""
        request = StartAgentRequest(
            agent_type=AgentType.AIDER,
            workspace="/home/coder/workspace",
            model=ModelType.CLAUDE_3_5_SONNET,
            task="Add type hints",
            metadata={"priority": "high", "user_id": "123"},
        )

        assert request.metadata == {"priority": "high", "user_id": "123"}


@pytest.mark.unit
class TestAgentResponse:
    """Test AgentResponse model"""

    def test_valid_response(self) -> None:
        """Test valid response parsing"""
        response = AgentResponse(
            agent_id="aider-12345678",
            status=AgentStatus.RUNNING,
            terminal_id="term-87654321",
            created_at=datetime.now(),
        )

        assert response.agent_id == "aider-12345678"
        assert response.status == AgentStatus.RUNNING

    def test_invalid_agent_id_format(self) -> None:
        """Test agent ID format validation"""
        with pytest.raises(ValidationError):
            AgentResponse(
                agent_id="invalid-id",
                status=AgentStatus.RUNNING,
                terminal_id="term-87654321",
                created_at=datetime.now(),
            )


@pytest.mark.unit
class TestListAgentsQuery:
    """Test ListAgentsQuery validation"""

    def test_default_pagination(self) -> None:
        """Test default pagination values"""
        query = ListAgentsQuery()

        assert query.page == 1
        assert query.limit == 50

    def test_custom_pagination(self) -> None:
        """Test custom pagination values"""
        query = ListAgentsQuery(page=2, limit=25)

        assert query.page == 2
        assert query.limit == 25

    def test_page_minimum(self) -> None:
        """Test page minimum validation"""
        with pytest.raises(ValidationError):
            ListAgentsQuery(page=0)

    def test_limit_maximum(self) -> None:
        """Test limit maximum validation"""
        with pytest.raises(ValidationError):
            ListAgentsQuery(limit=101)

    def test_optional_filters(self) -> None:
        """Test optional filter parameters"""
        query = ListAgentsQuery(
            status=AgentStatus.RUNNING,
            agent_type=AgentType.AIDER,
        )

        assert query.status == AgentStatus.RUNNING
        assert query.agent_type == AgentType.AIDER


@pytest.mark.unit
class TestValidationHelpers:
    """Test validation helper functions"""

    def test_valid_agent_id(self) -> None:
        """Test valid agent ID validation"""
        assert isValidAgentId("aider-12345678") is True
        assert isValidAgentId("goose-abcdef01") is True
        assert isValidAgentId("cline-98765432") is True

    def test_invalid_agent_id(self) -> None:
        """Test invalid agent ID validation"""
        assert isValidAgentId("invalid-id") is False
        assert isValidAgentId("aider-short") is False
        assert isValidAgentId("unknown-12345678") is False

    def test_valid_workspace_path(self) -> None:
        """Test valid workspace path validation"""
        assert isValidWorkspacePath("/home/coder/workspace") is True
        assert isValidWorkspacePath("/home/coder/workspace/project") is True

    def test_invalid_workspace_path(self) -> None:
        """Test invalid workspace path validation"""
        assert isValidWorkspacePath("/invalid/path") is False
        assert isValidWorkspacePath("/home/user/workspace") is False

    def test_valid_task(self) -> None:
        """Test valid task validation"""
        assert isValidTask("Add type hints to functions") is True
        assert isValidTask("x" * 100) is True

    def test_invalid_task(self) -> None:
        """Test invalid task validation"""
        assert isValidTask("short") is False
        assert isValidTask("x" * 2001) is False

    def test_valid_message(self) -> None:
        """Test valid message validation"""
        assert isValidMessage("Hello") is True
        assert isValidMessage("x" * 1000) is True

    def test_invalid_message(self) -> None:
        """Test invalid message validation"""
        assert isValidMessage("") is False
        assert isValidMessage("x" * 5001) is False

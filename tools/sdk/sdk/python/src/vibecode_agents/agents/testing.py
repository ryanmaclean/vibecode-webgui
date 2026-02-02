
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
Testing Agent

Automated test generation and maintenance with support for
unit tests, integration tests, and test coverage analysis.
"""

import logging
from pathlib import Path
from typing import Dict, List, Optional

from vibecode_agents.client import AgentClient
from vibecode_agents.models import AgentType, ModelType, StartAgentRequest
from vibecode_agents.tools import tool

logger = logging.getLogger(__name__)


class TestingAgent:
    """
    Automated test generation and maintenance agent

    Capabilities:
    - Generate unit tests for functions and classes
    - Create integration tests for APIs
    - Generate property-based tests
    - Analyze and improve test coverage
    - Fix failing tests
    - Generate test fixtures and mocks

    Example:
        >>> agent = TestingAgent(client)
        >>> tests = await agent.generate_tests(
        ...     workspace="/home/coder/workspace",
        ...     files=["src/api/auth.py"],
        ...     test_type="unit",
        ...     coverage_target=95
        ... )
    """

    def __init__(
        self,
        client: AgentClient,
        model: ModelType = ModelType.CLAUDE_3_5_SONNET,
    ):
        """
        Initialize Testing Agent

        Args:
            client: AgentClient instance
            model: LLM model to use for test generation
        """
        self.client = client
        self.model = model

    async def generate_tests(
        self,
        workspace: str,
        files: List[str],
        test_type: str = "unit",
        framework: str = "pytest",
        coverage_target: int = 95,
    ) -> Dict[str, any]:
        """
        Generate tests for code files

        Args:
            workspace: Absolute workspace path
            files: List of files to test
            test_type: Type of tests (unit, integration, e2e)
            framework: Test framework (pytest, unittest, jest)
            coverage_target: Target coverage percentage

        Returns:
            Dict containing generated tests and coverage report
        """
        task = self._build_test_task(files, test_type, framework, coverage_target)

        logger.info(f"Generating {test_type} tests for {len(files)} files")

        request = StartAgentRequest(
            agent_type=AgentType.AIDER,
            workspace=workspace,
            files=files,
            model=self.model,
            task=task,
            metadata={
                "agent_type": "testing",
                "test_type": test_type,
                "framework": framework,
                "coverage_target": coverage_target,
            },
        )

        agent = await self.client.start_agent(request)
        logger.info(f"Testing agent started: {agent.agent_id}")

        test_output = []
        async with self.client.stream_events(agent.agent_id) as stream:
            async for event in stream:
                if event.event.value == "output":
                    test_output.append(event.data.get("line", ""))

        return {
            "agent_id": agent.agent_id,
            "status": "completed",
            "test_type": test_type,
            "framework": framework,
            "files_tested": files,
            "output": test_output,
        }

    async def improve_coverage(
        self,
        workspace: str,
        files: List[str],
        current_coverage: Optional[float] = None,
        target_coverage: float = 95.0,
    ) -> Dict[str, any]:
        """
        Generate tests to improve coverage

        Args:
            workspace: Absolute workspace path
            files: List of files needing coverage
            current_coverage: Current coverage percentage
            target_coverage: Target coverage percentage

        Returns:
            Dict containing new tests and coverage improvement
        """
        coverage_info = f"Current: {current_coverage}%" if current_coverage else "Unknown"

        task = f"""Improve test coverage to {target_coverage}%

Current coverage: {coverage_info}
Target coverage: {target_coverage}%

Files to cover: {', '.join(files)}

Requirements:
1. Analyze existing tests to identify gaps
2. Generate tests for uncovered code paths
3. Include edge cases and error conditions
4. Test boundary conditions
5. Add property-based tests for complex logic
6. Ensure tests are independent and isolated
7. Use appropriate fixtures and mocks
8. Follow testing best practices

Coverage Goals:
- Branch coverage: {target_coverage}%
- Line coverage: {target_coverage}%
- Function coverage: 100%
- Edge cases: All critical paths

Test Quality:
- Fast execution (<100ms per test)
- Clear test names describing behavior
- Comprehensive assertions
- Proper setup and teardown
- No flaky tests
"""

        request = StartAgentRequest(
            agent_type=AgentType.AIDER,
            workspace=workspace,
            files=files,
            model=self.model,
            task=task,
            metadata={
                "agent_type": "coverage_improvement",
                "current_coverage": current_coverage,
                "target_coverage": target_coverage,
            },
        )

        agent = await self.client.start_agent(request)
        logger.info(f"Coverage improvement agent started: {agent.agent_id}")

        new_tests = []
        async with self.client.stream_events(agent.agent_id) as stream:
            async for event in stream:
                if event.event.value == "output":
                    new_tests.append(event.data.get("line", ""))

        return {
            "agent_id": agent.agent_id,
            "status": "completed",
            "current_coverage": current_coverage,
            "target_coverage": target_coverage,
            "new_tests": new_tests,
        }

    async def fix_failing_tests(
        self,
        workspace: str,
        test_files: List[str],
        error_output: Optional[str] = None,
    ) -> Dict[str, any]:
        """
        Fix failing tests based on error output

        Args:
            workspace: Absolute workspace path
            test_files: List of failing test files
            error_output: Test failure output

        Returns:
            Dict containing test fixes
        """
        error_context = f"\n\nError Output:\n{error_output}" if error_output else ""

        task = f"""Fix failing tests in: {', '.join(test_files)}

Analyze test failures and fix the issues.{error_context}

Steps:
1. Identify root cause of failures
2. Determine if issue is in test or source code
3. Fix the appropriate code
4. Ensure tests are deterministic
5. Update mocks/fixtures if needed
6. Verify fixes don't break other tests

Testing Principles:
- Tests should be reliable and deterministic
- Avoid timing-dependent assertions
- Use proper mocks for external dependencies
- Ensure proper test isolation
- Fix root cause, not symptoms
"""

        request = StartAgentRequest(
            agent_type=AgentType.AIDER,
            workspace=workspace,
            files=test_files,
            model=self.model,
            task=task,
            metadata={
                "agent_type": "test_fixing",
                "has_error_output": error_output is not None,
            },
        )

        agent = await self.client.start_agent(request)
        logger.info(f"Test fixing agent started: {agent.agent_id}")

        fixes = []
        async with self.client.stream_events(agent.agent_id) as stream:
            async for event in stream:
                if event.event.value == "output":
                    fixes.append(event.data.get("line", ""))

        return {
            "agent_id": agent.agent_id,
            "status": "completed",
            "test_files": test_files,
            "fixes": fixes,
        }

    def _build_test_task(
        self,
        files: List[str],
        test_type: str,
        framework: str,
        coverage_target: int,
    ) -> str:
        """Build comprehensive test generation task"""
        return f"""Generate comprehensive {test_type} tests using {framework}

Files to test: {', '.join(files)}
Coverage Target: {coverage_target}%

Test Requirements:

1. TEST STRUCTURE
   - Organize tests by feature/module
   - Use descriptive test names (test_should_do_x_when_y)
   - Group related tests in classes
   - Follow AAA pattern (Arrange, Act, Assert)

2. TEST COVERAGE
   - Cover all public functions and methods
   - Test happy path scenarios
   - Test error conditions and exceptions
   - Test edge cases and boundary conditions
   - Test input validation
   - Achieve {coverage_target}% coverage

3. TEST QUALITY
   - Fast execution (<100ms per test)
   - Independent tests (no shared state)
   - Deterministic results (no flaky tests)
   - Clear, comprehensive assertions
   - Proper error messages on failure
   - Use fixtures for common setup

4. MOCKING AND FIXTURES
   - Mock external dependencies
   - Create reusable fixtures
   - Use dependency injection
   - Isolate unit tests from I/O
   - Mock HTTP requests and databases

5. ASSERTIONS
   - Test return values
   - Verify state changes
   - Check exception types and messages
   - Validate side effects
   - Use appropriate assertion methods

6. DOCUMENTATION
   - Docstrings explaining test purpose
   - Comments for complex test logic
   - Document test data choices
   - Explain fixture purposes

Framework: {framework}
Test Type: {test_type}
Coverage Goal: {coverage_target}%

Generate complete, runnable tests with all necessary imports and fixtures.
"""


@tool(
    name="analyze_test_coverage",
    description="Analyze test coverage for files",
    tags=["testing", "coverage"],
)
async def analyze_test_coverage(
    workspace: str = "/home/coder/workspace",
    files: Optional[List[str]] = None,
) -> Dict[str, any]:
    """
    Analyze test coverage metrics

    Args:
        workspace: Workspace root directory
        files: Optional list of files to analyze

    Returns:
        Dict containing coverage analysis
    """
    # Simplified example - real implementation would run coverage tools
    return {
        "workspace": workspace,
        "total_coverage": 0.0,
        "branch_coverage": 0.0,
        "line_coverage": 0.0,
        "uncovered_lines": [],
        "files": files or [],
    }


@tool(
    name="generate_test_fixtures",
    description="Generate test fixtures for tests",
    tags=["testing", "fixtures"],
)
async def generate_test_fixtures(
    test_type: str,
    data_models: List[str],
    workspace: str = "/home/coder/workspace",
) -> Dict[str, any]:
    """
    Generate test fixtures for given models

    Args:
        test_type: Type of tests (unit, integration)
        data_models: List of model names
        workspace: Workspace root directory

    Returns:
        Dict containing generated fixtures
    """
    # Simplified example
    return {
        "test_type": test_type,
        "models": data_models,
        "fixtures": [],
    }


@tool(
    name="run_mutation_tests",
    description="Run mutation testing for code quality",
    tags=["testing", "mutation"],
)
async def run_mutation_tests(
    files: List[str],
    workspace: str = "/home/coder/workspace",
) -> Dict[str, any]:
    """
    Run mutation testing to verify test quality

    Args:
        files: Files to run mutation tests on
        workspace: Workspace root directory

    Returns:
        Dict containing mutation test results
    """
    # Simplified example - real implementation would use mutmut or similar
    return {
        "files": files,
        "mutation_score": 0.0,
        "mutants_killed": 0,
        "mutants_survived": 0,
        "total_mutants": 0,
    }
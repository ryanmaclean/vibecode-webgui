"""
Code Review Agent

Automated code review agent with security, performance,
and quality analysis capabilities.
"""

import logging
from pathlib import Path
from typing import Dict, List, Optional

from vibecode_agents.client import AgentClient
from vibecode_agents.models import AgentType, ModelType, StartAgentRequest
from vibecode_agents.tools import tool

logger = logging.getLogger(__name__)


class CodeReviewAgent:
    """
    Automated code review agent

    Provides comprehensive code analysis including:
    - Security vulnerability detection (OWASP compliance)
    - Performance optimization suggestions
    - Code quality and maintainability checks
    - Best practices enforcement

    Example:
        >>> agent = CodeReviewAgent(client)
        >>> report = await agent.review_files(
        ...     workspace="/home/coder/workspace",
        ...     files=["src/api/auth.py", "src/models/user.py"]
        ... )
    """

    def __init__(
        self,
        client: AgentClient,
        model: ModelType = ModelType.CLAUDE_3_5_SONNET,
    ):
        """
        Initialize Code Review Agent

        Args:
            client: AgentClient instance
            model: LLM model to use for reviews
        """
        self.client = client
        self.model = model

    async def review_files(
        self,
        workspace: str,
        files: List[str],
        focus: Optional[List[str]] = None,
    ) -> Dict[str, any]:
        """
        Review code files for issues and improvements

        Args:
            workspace: Absolute workspace path
            files: List of files to review (relative to workspace)
            focus: Optional focus areas (security, performance, quality)

        Returns:
            Dict containing review report with findings
        """
        focus_areas = focus or ["security", "performance", "quality"]
        task = self._build_review_task(files, focus_areas)

        logger.info(f"Starting code review for {len(files)} files")

        request = StartAgentRequest(
            agent_type=AgentType.AIDER,
            workspace=workspace,
            files=files,
            model=self.model,
            task=task,
            metadata={
                "agent_type": "code_review",
                "focus_areas": focus_areas,
                "file_count": len(files),
            },
        )

        agent = await self.client.start_agent(request)
        logger.info(f"Code review agent started: {agent.agent_id}")

        # Collect review findings
        findings = []
        async with self.client.stream_events(agent.agent_id) as stream:
            async for event in stream:
                if event.event.value == "output":
                    findings.append(event.data.get("line", ""))

        return {
            "agent_id": agent.agent_id,
            "status": "completed",
            "files_reviewed": files,
            "focus_areas": focus_areas,
            "findings": findings,
        }

    async def review_pull_request(
        self,
        workspace: str,
        pr_diff: str,
        target_branch: str = "main",
    ) -> Dict[str, any]:
        """
        Review pull request changes

        Args:
            workspace: Absolute workspace path
            pr_diff: Git diff content
            target_branch: Target branch for PR

        Returns:
            Dict containing PR review with inline comments
        """
        task = f"""Review this pull request for merge into {target_branch}.

Analyze:
1. Security vulnerabilities and OWASP compliance
2. Performance implications
3. Code quality and maintainability
4. Breaking changes
5. Test coverage

Provide inline comments with:
- Severity (critical/high/medium/low)
- Description of issue
- Suggested fix

PR Diff:
{pr_diff}
"""

        request = StartAgentRequest(
            agent_type=AgentType.AIDER,
            workspace=workspace,
            model=self.model,
            task=task,
            metadata={
                "agent_type": "pr_review",
                "target_branch": target_branch,
            },
        )

        agent = await self.client.start_agent(request)
        logger.info(f"PR review agent started: {agent.agent_id}")

        comments = []
        async with self.client.stream_events(agent.agent_id) as stream:
            async for event in stream:
                if event.event.value == "output":
                    comments.append(event.data.get("line", ""))

        return {
            "agent_id": agent.agent_id,
            "status": "completed",
            "target_branch": target_branch,
            "comments": comments,
        }

    def _build_review_task(self, files: List[str], focus_areas: List[str]) -> str:
        """Build comprehensive review task description"""
        focus_desc = ", ".join(focus_areas)

        return f"""Perform comprehensive code review focusing on: {focus_desc}

Files to review: {', '.join(files)}

Analysis Requirements:

1. SECURITY ANALYSIS
   - Check for OWASP Top 10 vulnerabilities
   - Identify insecure dependencies
   - Review authentication/authorization logic
   - Check for injection vulnerabilities (SQL, XSS, etc.)
   - Validate input sanitization
   - Review secret management

2. PERFORMANCE ANALYSIS
   - Identify N+1 query patterns
   - Check algorithm complexity (O(n²) or worse)
   - Review memory usage patterns
   - Identify unnecessary computations
   - Check caching opportunities
   - Review database query efficiency

3. CODE QUALITY ANALYSIS
   - Check adherence to SOLID principles
   - Review error handling completeness
   - Validate type safety and null checks
   - Check code duplication (DRY violations)
   - Review function complexity
   - Validate documentation quality

4. BEST PRACTICES
   - Language-specific best practices
   - Framework convention adherence
   - Test coverage adequacy
   - Logging and monitoring

For each issue found, provide:
- File and line number
- Severity (critical/high/medium/low)
- Description of issue
- Code snippet showing the problem
- Recommended fix with code example
- Rationale for the change

Format output as structured JSON for automated processing.
"""


@tool(
    name="analyze_security",
    description="Analyze code for security vulnerabilities",
    tags=["security", "code-review"],
)
async def analyze_security(
    file_path: str,
    workspace: str = "/home/coder/workspace",
) -> Dict[str, any]:
    """
    Analyze file for security vulnerabilities

    Args:
        file_path: Path to file (relative to workspace)
        workspace: Workspace root directory

    Returns:
        Dict containing security analysis results
    """
    full_path = Path(workspace) / file_path

    if not full_path.exists():
        return {"error": f"File not found: {file_path}"}

    # Read file content
    content = full_path.read_text()

    # Security checks (simplified for example)
    findings = []

    # Check for hardcoded secrets
    if any(pattern in content.lower() for pattern in ["password", "api_key", "secret"]):
        findings.append({
            "severity": "high",
            "type": "hardcoded_secret",
            "description": "Potential hardcoded secret detected",
            "line": 0,
        })

    # Check for SQL injection vulnerability
    if "execute(" in content and any(op in content for op in ["+", "f\"{", "%s"]):
        findings.append({
            "severity": "critical",
            "type": "sql_injection",
            "description": "Potential SQL injection vulnerability",
            "line": 0,
        })

    return {
        "file": file_path,
        "findings": findings,
        "scan_date": "2025-10-02",
    }


@tool(
    name="check_performance",
    description="Analyze code for performance issues",
    tags=["performance", "code-review"],
)
async def check_performance(
    file_path: str,
    workspace: str = "/home/coder/workspace",
) -> Dict[str, any]:
    """
    Analyze file for performance issues

    Args:
        file_path: Path to file (relative to workspace)
        workspace: Workspace root directory

    Returns:
        Dict containing performance analysis results
    """
    full_path = Path(workspace) / file_path

    if not full_path.exists():
        return {"error": f"File not found: {file_path}"}

    content = full_path.read_text()
    findings = []

    # Check for nested loops (O(n²))
    if content.count("for ") > 1 or content.count("while ") > 1:
        findings.append({
            "severity": "medium",
            "type": "nested_loop",
            "description": "Nested loops detected - potential O(n²) complexity",
            "line": 0,
        })

    # Check for repeated database calls
    if content.count("query(") > 5:
        findings.append({
            "severity": "high",
            "type": "n_plus_one",
            "description": "Multiple database queries - potential N+1 problem",
            "line": 0,
        })

    return {
        "file": file_path,
        "findings": findings,
        "scan_date": "2025-10-02",
    }

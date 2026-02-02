
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
Documentation Agent

Automated documentation generation with support for
docstrings, README files, API docs, and architecture diagrams.
"""

import logging
from pathlib import Path
from typing import Dict, List, Optional

from vibecode_agents.client import AgentClient
from vibecode_agents.models import AgentType, ModelType, StartAgentRequest
from vibecode_agents.tools import tool

logger = logging.getLogger(__name__)


class DocumentationAgent:
    """
    Automated documentation generation agent

    Capabilities:
    - Generate/update docstrings for functions and classes
    - Create comprehensive README files
    - Generate API documentation
    - Create architecture diagrams
    - Document configuration and setup

    Example:
        >>> agent = DocumentationAgent(client)
        >>> docs = await agent.generate_docs(
        ...     workspace="/home/coder/workspace",
        ...     files=["src/api/routes.py"],
        ...     doc_type="api"
        ... )
    """

    def __init__(
        self,
        client: AgentClient,
        model: ModelType = ModelType.CLAUDE_3_5_SONNET,
    ):
        """
        Initialize Documentation Agent

        Args:
            client: AgentClient instance
            model: LLM model to use for documentation
        """
        self.client = client
        self.model = model

    async def generate_docs(
        self,
        workspace: str,
        files: List[str],
        doc_type: str = "comprehensive",
        output_format: str = "markdown",
    ) -> Dict[str, any]:
        """
        Generate documentation for code files

        Args:
            workspace: Absolute workspace path
            files: List of files to document
            doc_type: Type of docs (comprehensive, api, internal, quickstart)
            output_format: Output format (markdown, html, rst)

        Returns:
            Dict containing generated documentation
        """
        task = self._build_doc_task(files, doc_type, output_format)

        logger.info(f"Generating {doc_type} documentation for {len(files)} files")

        request = StartAgentRequest(
            agent_type=AgentType.AIDER,
            workspace=workspace,
            files=files,
            model=self.model,
            task=task,
            metadata={
                "agent_type": "documentation",
                "doc_type": doc_type,
                "output_format": output_format,
            },
        )

        agent = await self.client.start_agent(request)
        logger.info(f"Documentation agent started: {agent.agent_id}")

        content = []
        async with self.client.stream_events(agent.agent_id) as stream:
            async for event in stream:
                if event.event.value == "output":
                    content.append(event.data.get("line", ""))

        return {
            "agent_id": agent.agent_id,
            "status": "completed",
            "doc_type": doc_type,
            "format": output_format,
            "content": "\n".join(content),
        }

    async def update_docstrings(
        self,
        workspace: str,
        files: List[str],
        style: str = "google",
    ) -> Dict[str, any]:
        """
        Add or update function/class docstrings

        Args:
            workspace: Absolute workspace path
            files: List of Python files to process
            style: Docstring style (google, numpy, sphinx)

        Returns:
            Dict containing update summary
        """
        task = f"""Add or update docstrings for all functions and classes using {style} style.

Files to process: {', '.join(files)}

Requirements:
1. Add docstrings to all public functions and classes
2. Include parameter descriptions with types
3. Document return values
4. Add usage examples for complex functions
5. Document exceptions that can be raised
6. Follow {style} docstring conventions
7. Keep existing docstrings if they meet quality standards

Format: {style} style docstrings
Quality: Must include types, descriptions, and examples
"""

        request = StartAgentRequest(
            agent_type=AgentType.AIDER,
            workspace=workspace,
            files=files,
            model=self.model,
            task=task,
            metadata={
                "agent_type": "docstring_update",
                "style": style,
            },
        )

        agent = await self.client.start_agent(request)
        logger.info(f"Docstring update agent started: {agent.agent_id}")

        updates = []
        async with self.client.stream_events(agent.agent_id) as stream:
            async for event in stream:
                if event.event.value == "output":
                    updates.append(event.data.get("line", ""))

        return {
            "agent_id": agent.agent_id,
            "status": "completed",
            "files_processed": files,
            "style": style,
            "updates": updates,
        }

    async def generate_readme(
        self,
        workspace: str,
        project_name: str,
        include_sections: Optional[List[str]] = None,
    ) -> Dict[str, any]:
        """
        Generate comprehensive README.md

        Args:
            workspace: Absolute workspace path
            project_name: Project name
            include_sections: Sections to include

        Returns:
            Dict containing README content
        """
        sections = include_sections or [
            "overview",
            "features",
            "installation",
            "quickstart",
            "usage",
            "api",
            "contributing",
            "license",
        ]

        task = f"""Generate comprehensive README.md for {project_name}

Analyze the codebase and create a professional README with these sections:

{chr(10).join(f"- {section.title()}" for section in sections)}

Requirements:
1. Clear, concise writing
2. Code examples with syntax highlighting
3. Installation instructions for multiple platforms
4. Quickstart guide with minimal example
5. API documentation overview
6. Contributing guidelines
7. Badge placeholders for CI/CD status
8. Table of contents
9. Project structure visualization
10. Links to detailed documentation

Style: Professional, developer-friendly, comprehensive
Format: Markdown with proper formatting
"""

        request = StartAgentRequest(
            agent_type=AgentType.AIDER,
            workspace=workspace,
            model=self.model,
            task=task,
            metadata={
                "agent_type": "readme_generation",
                "project": project_name,
                "sections": sections,
            },
        )

        agent = await self.client.start_agent(request)
        logger.info(f"README generation agent started: {agent.agent_id}")

        readme_lines = []
        async with self.client.stream_events(agent.agent_id) as stream:
            async for event in stream:
                if event.event.value == "output":
                    readme_lines.append(event.data.get("line", ""))

        return {
            "agent_id": agent.agent_id,
            "status": "completed",
            "project": project_name,
            "content": "\n".join(readme_lines),
        }

    def _build_doc_task(
        self,
        files: List[str],
        doc_type: str,
        output_format: str,
    ) -> str:
        """Build documentation generation task"""
        return f"""Generate {doc_type} documentation in {output_format} format.

Files to document: {', '.join(files)}

Documentation Requirements:

1. STRUCTURE
   - Clear hierarchy with headings
   - Table of contents for long documents
   - Cross-references between related sections
   - Logical flow from basic to advanced topics

2. CONTENT
   - Overview and purpose for each component
   - Parameter descriptions with types
   - Return value documentation
   - Exception documentation
   - Usage examples with real code
   - Edge cases and gotchas
   - Performance considerations

3. CODE EXAMPLES
   - Syntax highlighted code blocks
   - Complete, runnable examples
   - Comments explaining key concepts
   - Multiple examples showing different use cases
   - Error handling examples

4. QUALITY
   - Clear, concise writing
   - Consistent terminology
   - Proper grammar and spelling
   - Professional tone
   - Accessible to target audience

5. FORMAT
   - {output_format} formatting
   - Proper escaping and syntax
   - Internal links for navigation
   - External links to references
   - Badges and metadata

Output Format: {output_format}
Documentation Type: {doc_type}
Target Audience: Developers using this codebase
"""


@tool(
    name="extract_api_spec",
    description="Extract API specification from code",
    tags=["documentation", "api"],
)
async def extract_api_spec(
    file_path: str,
    workspace: str = "/home/coder/workspace",
) -> Dict[str, any]:
    """
    Extract API endpoints and parameters from code

    Args:
        file_path: Path to API file
        workspace: Workspace root directory

    Returns:
        Dict containing API specification
    """
    full_path = Path(workspace) / file_path

    if not full_path.exists():
        return {"error": f"File not found: {file_path}"}

    # This is a simplified example
    # Real implementation would parse AST and extract route definitions
    return {
        "file": file_path,
        "endpoints": [],
        "models": [],
        "format": "openapi-3.0",
    }


@tool(
    name="generate_changelog",
    description="Generate CHANGELOG from git commits",
    tags=["documentation", "git"],
)
async def generate_changelog(
    workspace: str = "/home/coder/workspace",
    from_version: Optional[str] = None,
    to_version: str = "HEAD",
) -> Dict[str, any]:
    """
    Generate CHANGELOG from commit history

    Args:
        workspace: Workspace root directory
        from_version: Starting version/tag
        to_version: Ending version/tag

    Returns:
        Dict containing changelog content
    """
    # Simplified example - real implementation would use gitpython
    return {
        "version_range": f"{from_version}..{to_version}",
        "changelog": "",
        "format": "markdown",
    }
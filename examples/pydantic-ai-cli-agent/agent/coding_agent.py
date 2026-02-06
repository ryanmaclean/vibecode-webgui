
# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""Main coding agent implementation using Pydantic AI"""

import os
from pathlib import Path
from typing import AsyncIterator, Dict, Any, Optional

from pydantic_ai import Agent, RunContext

from .config import AgentConfig
from .tools import (
    read_file,
    write_file,
    list_files,
    search_files,
    delete_file,
    run_command,
)
from .prompts import SYSTEM_PROMPT


class CodingAgent:
    """AI Coding Agent with file system access"""
    
    def __init__(self, config: AgentConfig):
        self.config = config
        self.context_dir = Path(config.context_dir)
        self.total_actions = 0
        self.last_action: Optional[str] = None
        
        # Initialize Pydantic AI agent
        model_name = f"{config.provider}:{config.model}"
        self.agent = Agent(
            model_name,
            system_prompt=SYSTEM_PROMPT,
            deps_type=Path,  # Pass context directory as dependency
        )
        
        # Register tools
        self._register_tools()
    
    def _register_tools(self):
        """Register all available tools"""
        
        @self.agent.tool
        async def read_file_tool(ctx: RunContext[Path], file_path: str) -> str:
            """Read contents of a file"""
            full_path = ctx.deps / file_path
            return await read_file(full_path)
        
        @self.agent.tool
        async def write_file_tool(
            ctx: RunContext[Path],
            file_path: str,
            content: str
        ) -> str:
            """Write or update a file"""
            full_path = ctx.deps / file_path
            return await write_file(full_path, content)
        
        @self.agent.tool
        async def list_files_tool(
            ctx: RunContext[Path],
            directory: str = "."
        ) -> str:
            """List files in a directory"""
            full_path = ctx.deps / directory
            return await list_files(full_path)
        
        @self.agent.tool
        async def search_files_tool(
            ctx: RunContext[Path],
            pattern: str
        ) -> str:
            """Search for files matching pattern"""
            return await search_files(ctx.deps, pattern)
        
        @self.agent.tool
        async def delete_file_tool(
            ctx: RunContext[Path],
            file_path: str
        ) -> str:
            """Delete a file (requires approval)"""
            full_path = ctx.deps / file_path
            return await delete_file(full_path)
        
        @self.agent.tool
        async def run_command_tool(
            ctx: RunContext[Path],
            command: str
        ) -> str:
            """Run a shell command in the workspace"""
            return await run_command(command, cwd=ctx.deps)
    
    async def run_stream(self, task: str) -> AsyncIterator[Dict[str, Any]]:
        """Run agent with streaming output"""
        try:
            # Yield thought
            yield {
                'type': 'thought',
                'content': 'Analyzing task...'
            }
            
            # Run agent
            async with self.agent.run_stream(
                task,
                deps=self.context_dir
            ) as stream:
                async for chunk in stream:
                    # Stream different types of output
                    if hasattr(chunk, 'tool_name'):
                        self.total_actions += 1
                        self.last_action = chunk.tool_name
                        yield {
                            'type': 'action',
                            'content': f"Using tool: {chunk.tool_name}"
                        }
                    elif hasattr(chunk, 'content'):
                        yield {
                            'type': 'result',
                            'content': chunk.content
                        }
            
        except Exception as e:
            yield {
                'type': 'error',
                'content': str(e)
            }
    
    async def run(self, task: str) -> str:
        """Run agent and return final result"""
        result = await self.agent.run(task, deps=self.context_dir)
        return result.data
    
    async def get_status(self) -> Dict[str, Any]:
        """Get agent status"""
        return {
            'provider': self.config.provider,
            'model': self.config.model,
            'context_dir': str(self.context_dir),
            'mcp_enabled': self.config.mcp_enabled,
            'total_actions': self.total_actions,
            'last_action': self.last_action,
        }
    
    def set_context(self, path: str):
        """Change working directory context"""
        self.context_dir = Path(path).resolve()
        self.context_dir.mkdir(parents=True, exist_ok=True)
    
    async def resume(self):
        """Resume from last checkpoint (if durable execution enabled)"""
        # TODO: Implement durable execution resume

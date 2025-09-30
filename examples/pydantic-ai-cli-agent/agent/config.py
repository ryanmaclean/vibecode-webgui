"""Agent configuration"""

from dataclasses import dataclass
from pathlib import Path


@dataclass
class AgentConfig:
    """Configuration for the coding agent"""
    
    provider: str = 'openai'
    model: str = 'gpt-4-turbo-preview'
    context_dir: str = './workspace'
    mcp_enabled: bool = False
    mcp_server_url: str = 'http://localhost:3000'
    max_iterations: int = 10
    require_approval: bool = True
    enable_durable: bool = True
    
    def __post_init__(self):
        """Validate and normalize configuration"""
        self.context_dir = str(Path(self.context_dir).resolve())
        Path(self.context_dir).mkdir(parents=True, exist_ok=True)

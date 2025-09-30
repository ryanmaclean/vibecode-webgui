#!/usr/bin/env python3
"""
Pydantic AI CLI Coding Agent

A CLI coding assistant powered by Pydantic AI with file system access
and optional VibeCode MCP integration.

Usage:
    python agent.py
    python agent.py --task "Create a FastAPI endpoint"
    python agent.py --context ./src --task "Refactor auth module"
"""

import asyncio
import os
import sys
from pathlib import Path
from typing import Optional

import click
from dotenv import load_dotenv
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel

from agent.coding_agent import CodingAgent
from agent.config import AgentConfig

# Load environment variables
load_dotenv()

console = Console()


def print_banner():
    """Print welcome banner"""
    banner = """
    # 🤖 Pydantic AI Coding Agent
    
    Your AI pair programmer powered by Pydantic AI
    
    Type 'help' for commands, 'exit' to quit
    """
    console.print(Panel(Markdown(banner), border_style="blue"))


def print_help():
    """Print available commands"""
    help_text = """
    ## Available Commands
    
    - **help** - Show this help message
    - **exit** - Exit the agent
    - **clear** - Clear the screen
    - **status** - Show agent status
    - **context <path>** - Set working directory
    - **resume** - Resume from last checkpoint
    
    ## Example Tasks
    
    - "Create a Python function to calculate fibonacci"
    - "Refactor user_service.py to use async/await"
    - "Run tests for the auth module"
    - "Deploy this project to production"
    """
    console.print(Markdown(help_text))


async def run_interactive(agent: CodingAgent, initial_task: Optional[str] = None):
    """Run interactive chat loop"""
    print_banner()
    
    if initial_task:
        console.print(f"\n[bold blue]Task:[/bold blue] {initial_task}\n")
        await process_task(agent, initial_task)
    
    while True:
        try:
            # Get user input
            user_input = console.input("\n[bold green]You:[/bold green] ").strip()
            
            if not user_input:
                continue
            
            # Handle commands
            if user_input.lower() == 'exit':
                console.print("\n[yellow]Goodbye! 👋[/yellow]")
                break
            elif user_input.lower() == 'help':
                print_help()
                continue
            elif user_input.lower() == 'clear':
                console.clear()
                print_banner()
                continue
            elif user_input.lower() == 'status':
                await show_status(agent)
                continue
            elif user_input.lower().startswith('context '):
                path = user_input[8:].strip()
                agent.set_context(path)
                console.print(f"[green]✓[/green] Context set to: {path}")
                continue
            elif user_input.lower() == 'resume':
                await agent.resume()
                console.print("[green]✓[/green] Resumed from checkpoint")
                continue
            
            # Process as task
            await process_task(agent, user_input)
            
        except KeyboardInterrupt:
            console.print("\n\n[yellow]Use 'exit' to quit[/yellow]")
        except Exception as e:
            console.print(f"\n[red]Error:[/red] {e}")


async def process_task(agent: CodingAgent, task: str):
    """Process a single task"""
    console.print(f"\n[bold blue]Agent:[/bold blue] ", end="")
    
    try:
        # Run agent with streaming
        async for chunk in agent.run_stream(task):
            if chunk.get('type') == 'thought':
                console.print(f"[dim]{chunk['content']}[/dim]")
            elif chunk.get('type') == 'action':
                console.print(f"[yellow]→ {chunk['content']}[/yellow]")
            elif chunk.get('type') == 'result':
                console.print(chunk['content'])
            elif chunk.get('type') == 'error':
                console.print(f"[red]✗ {chunk['content']}[/red]")
        
        console.print("\n[green]✓ Done![/green]")
        
    except Exception as e:
        console.print(f"\n[red]Error:[/red] {e}")


async def show_status(agent: CodingAgent):
    """Show agent status"""
    status = await agent.get_status()
    
    status_text = f"""
    ## Agent Status
    
    - **Provider:** {status['provider']}
    - **Model:** {status['model']}
    - **Context:** {status['context_dir']}
    - **MCP Enabled:** {status['mcp_enabled']}
    - **Total Actions:** {status['total_actions']}
    - **Last Action:** {status['last_action'] or 'None'}
    """
    
    console.print(Panel(Markdown(status_text), title="Status", border_style="blue"))


@click.command()
@click.option('--task', '-t', help='Task to execute')
@click.option('--context', '-c', help='Working directory context')
@click.option('--provider', '-p', help='AI provider (openai, anthropic, etc.)')
@click.option('--model', '-m', help='AI model to use')
@click.option('--resume', '-r', is_flag=True, help='Resume from last checkpoint')
def main(
    task: Optional[str],
    context: Optional[str],
    provider: Optional[str],
    model: Optional[str],
    resume: bool,
):
    """Pydantic AI CLI Coding Agent"""
    
    # Load configuration
    config = AgentConfig(
        provider=provider or os.getenv('AI_PROVIDER', 'openai'),
        model=model or os.getenv('AI_MODEL', 'gpt-4-turbo-preview'),
        context_dir=context or os.getenv('WORKSPACE_DIR', './workspace'),
        mcp_enabled=os.getenv('MCP_ENABLED', 'false').lower() == 'true',
        mcp_server_url=os.getenv('MCP_SERVER_URL', 'http://localhost:3000'),
    )
    
    # Create agent
    agent = CodingAgent(config)
    
    # Run
    try:
        asyncio.run(run_interactive(agent, task))
    except KeyboardInterrupt:
        console.print("\n\n[yellow]Interrupted[/yellow]")
        sys.exit(0)


if __name__ == '__main__':
    main()

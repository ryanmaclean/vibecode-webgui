
# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
VibeCode Agents CLI

Production-ready command-line interface for agent management.
"""

import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import click
    from rich.console import Console
    from rich.table import Table
    from rich.live import Live
    from rich.panel import Panel
    from rich.progress import Progress, SpinnerColumn, TextColumn
except ImportError:
    print("CLI dependencies not installed. Install with: pip install vibecode-agents[cli]")
    sys.exit(1)

from vibecode_agents.client import AgentClient
from vibecode_agents.exceptions import AgentAPIError
from vibecode_agents.models import (
    AgentType,
    ListAgentsQuery,
    ModelType,
    StartAgentRequest,
)

console = Console()
logging.basicConfig(level=logging.WARNING)


@click.group()
@click.option("--base-url", default="http://localhost:3000/api", help="API base URL")
@click.option("--api-key", default=None, help="API key for authentication")
@click.option("--verbose", "-v", is_flag=True, help="Enable verbose output")
@click.pass_context
def cli(ctx: click.Context, base_url: str, api_key: Optional[str], verbose: bool) -> None:
    """VibeCode Agents CLI - Manage AI coding agents"""
    if verbose:
        logging.getLogger().setLevel(logging.INFO)

    ctx.ensure_object(dict)
    ctx.obj["base_url"] = base_url
    ctx.obj["api_key"] = api_key


@cli.command()
@click.pass_context
def health(ctx: click.Context) -> None:
    """Check API health status"""
    asyncio.run(_health(ctx.obj["base_url"], ctx.obj["api_key"]))


async def _health(base_url: str, api_key: Optional[str]) -> None:
    """Check API health"""
    try:
        async with AgentClient(base_url=base_url, api_key=api_key) as client:
            health = await client.get_health()

            console.print(Panel.fit(
                f"[green]Status:[/green] {health.status.value.upper()}\n"
                f"[blue]Version:[/blue] {health.version}\n"
                f"[yellow]Uptime:[/yellow] {health.uptime_seconds:.0f}s",
                title="API Health",
            ))

            if health.agents:
                console.print(f"\n[cyan]Agent Capacity:[/cyan]")
                console.print(f"  Active: {health.agents.active}/{health.agents.max_concurrent}")
                console.print(f"  User Limit: {health.agents.user_limit}")

    except AgentAPIError as e:
        console.print(f"[red]Error:[/red] {e}")
        sys.exit(1)


@cli.command()
@click.option("--agent-type", "-t", type=click.Choice(["aider", "goose", "cline"]), required=True)
@click.option("--workspace", "-w", required=True, help="Workspace directory path")
@click.option("--model", "-m", default="claude-3-5-sonnet-20241022", help="LLM model to use")
@click.option("--task", "-T", required=True, help="Task description")
@click.option("--files", "-f", multiple=True, help="Files to work on")
@click.option("--stream", "-s", is_flag=True, help="Stream output in real-time")
@click.pass_context
def start(
    ctx: click.Context,
    agent_type: str,
    workspace: str,
    model: str,
    task: str,
    files: tuple,
    stream: bool,
) -> None:
    """Start a new agent"""
    asyncio.run(_start(
        ctx.obj["base_url"],
        ctx.obj["api_key"],
        agent_type,
        workspace,
        model,
        task,
        list(files),
        stream,
    ))


async def _start(
    base_url: str,
    api_key: Optional[str],
    agent_type: str,
    workspace: str,
    model: str,
    task: str,
    files: List[str],
    stream: bool,
) -> None:
    """Start agent implementation"""
    try:
        async with AgentClient(base_url=base_url, api_key=api_key) as client:
            request = StartAgentRequest(
                agent_type=AgentType(agent_type),
                workspace=workspace,
                model=ModelType(model),
                task=task,
                files=files if files else None,
            )

            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
            ) as progress:
                progress.add_task("Starting agent...", total=None)
                agent = await client.start_agent(request)

            console.print(Panel.fit(
                f"[green]Agent ID:[/green] {agent.agent_id}\n"
                f"[blue]Status:[/blue] {agent.status.value}\n"
                f"[yellow]Terminal:[/yellow] {agent.terminal_id}",
                title=f"Agent Started ({agent_type})",
            ))

            if stream:
                console.print("\n[cyan]Streaming output...[/cyan]\n")
                async with client.stream_events(agent.agent_id) as event_stream:
                    async for event in event_stream:
                        if event.event.value == "output":
                            console.print(event.data.get("line", ""))
                        elif event.event.value == "status":
                            status = event.data.get("status", "")
                            console.print(f"[yellow]Status:[/yellow] {status}")
                        elif event.event.value == "complete":
                            console.print(f"\n[green]Agent completed[/green]")
                            break

    except AgentAPIError as e:
        console.print(f"[red]Error:[/red] {e}")
        sys.exit(1)


@cli.command()
@click.option("--status", "-s", help="Filter by status")
@click.option("--type", "-t", help="Filter by agent type")
@click.option("--limit", "-l", default=50, help="Number of results")
@click.pass_context
def list(ctx: click.Context, status: Optional[str], type: Optional[str], limit: int) -> None:
    """List all agents"""
    asyncio.run(_list(ctx.obj["base_url"], ctx.obj["api_key"], status, type, limit))


async def _list(
    base_url: str,
    api_key: Optional[str],
    status: Optional[str],
    agent_type: Optional[str],
    limit: int,
) -> None:
    """List agents implementation"""
    try:
        async with AgentClient(base_url=base_url, api_key=api_key) as client:
            query = ListAgentsQuery(
                status=status,  # type: ignore
                agent_type=agent_type,  # type: ignore
                limit=limit,
            )
            result = await client.list_agents(query)

            if not result.agents:
                console.print("[yellow]No agents found[/yellow]")
                return

            table = Table(title="Active Agents")
            table.add_column("Agent ID", style="cyan")
            table.add_column("Type", style="blue")
            table.add_column("Status", style="green")
            table.add_column("Uptime", style="yellow")
            table.add_column("Workspace", style="magenta")

            for agent in result.agents:
                table.add_row(
                    agent.agent_id,
                    agent.agent_type.value,
                    agent.status.value,
                    f"{agent.uptime_seconds:.0f}s",
                    agent.workspace,
                )

            console.print(table)

            if result.summary:
                console.print(f"\n[cyan]Summary:[/cyan]")
                console.print(f"  Active: {result.summary.active}")
                console.print(f"  Completed: {result.summary.completed}")
                console.print(f"  Failed: {result.summary.failed}")

    except AgentAPIError as e:
        console.print(f"[red]Error:[/red] {e}")
        sys.exit(1)


@cli.command()
@click.argument("agent_id")
@click.pass_context
def status(ctx: click.Context, agent_id: str) -> None:
    """Get agent status"""
    asyncio.run(_status(ctx.obj["base_url"], ctx.obj["api_key"], agent_id))


async def _status(base_url: str, api_key: Optional[str], agent_id: str) -> None:
    """Get agent status implementation"""
    try:
        async with AgentClient(base_url=base_url, api_key=api_key) as client:
            agent = await client.get_agent(agent_id)

            console.print(Panel.fit(
                f"[cyan]Agent ID:[/cyan] {agent.agent_id}\n"
                f"[blue]Type:[/blue] {agent.agent_type.value}\n"
                f"[green]Status:[/green] {agent.status.value}\n"
                f"[yellow]Uptime:[/yellow] {agent.uptime_seconds:.0f}s\n"
                f"[magenta]Workspace:[/magenta] {agent.workspace}\n"
                f"[white]Exit Code:[/white] {agent.exit_code or 'N/A'}",
                title="Agent Status",
            ))

            if agent.resource_usage:
                console.print(f"\n[cyan]Resource Usage:[/cyan]")
                console.print(f"  CPU: {agent.resource_usage.cpu_percent:.1f}%")
                console.print(f"  Memory: {agent.resource_usage.memory_mb:.1f} MB")
                console.print(f"  Disk I/O: {agent.resource_usage.disk_io_mb:.1f} MB")

            if agent.last_output:
                console.print(f"\n[cyan]Last Output:[/cyan]")
                console.print(f"  {agent.last_output}")

    except AgentAPIError as e:
        console.print(f"[red]Error:[/red] {e}")
        sys.exit(1)


@cli.command()
@click.argument("agent_id")
@click.option("--force", "-f", is_flag=True, help="Force immediate termination")
@click.pass_context
def stop(ctx: click.Context, agent_id: str, force: bool) -> None:
    """Stop a running agent"""
    asyncio.run(_stop(ctx.obj["base_url"], ctx.obj["api_key"], agent_id, force))


async def _stop(base_url: str, api_key: Optional[str], agent_id: str, force: bool) -> None:
    """Stop agent implementation"""
    try:
        async with AgentClient(base_url=base_url, api_key=api_key) as client:
            result = await client.stop_agent(agent_id, force=force)

            console.print(Panel.fit(
                f"[green]Agent stopped:[/green] {result.agent_id}\n"
                f"[blue]Message:[/blue] {result.message}\n"
                f"[yellow]Forced:[/yellow] {result.forced}",
                title="Agent Stopped",
            ))

    except AgentAPIError as e:
        console.print(f"[red]Error:[/red] {e}")
        sys.exit(1)


@cli.command()
@click.argument("agent_id")
@click.argument("message")
@click.pass_context
def send(ctx: click.Context, agent_id: str, message: str) -> None:
    """Send message to agent"""
    asyncio.run(_send(ctx.obj["base_url"], ctx.obj["api_key"], agent_id, message))


async def _send(base_url: str, api_key: Optional[str], agent_id: str, message: str) -> None:
    """Send message implementation"""
    try:
        async with AgentClient(base_url=base_url, api_key=api_key) as client:
            result = await client.send_message(agent_id, message)

            console.print(f"[green]Message sent:[/green] {result.message_id}")
            console.print(f"[blue]Status:[/blue] {result.status}")

    except AgentAPIError as e:
        console.print(f"[red]Error:[/red] {e}")
        sys.exit(1)


@cli.command()
@click.argument("agent_id")
@click.pass_context
def stream(ctx: click.Context, agent_id: str) -> None:
    """Stream agent output in real-time"""
    asyncio.run(_stream(ctx.obj["base_url"], ctx.obj["api_key"], agent_id))


async def _stream(base_url: str, api_key: Optional[str], agent_id: str) -> None:
    """Stream output implementation"""
    try:
        async with AgentClient(base_url=base_url, api_key=api_key) as client:
            console.print(f"[cyan]Streaming output for {agent_id}...[/cyan]\n")

            async with client.stream_events(agent_id) as event_stream:
                async for event in event_stream:
                    if event.event.value == "output":
                        console.print(event.data.get("line", ""))
                    elif event.event.value == "status":
                        status = event.data.get("status", "")
                        progress = event.data.get("progress")
                        if progress:
                            console.print(f"[yellow]Status:[/yellow] {status} ({progress*100:.0f}%)")
                        else:
                            console.print(f"[yellow]Status:[/yellow] {status}")
                    elif event.event.value == "error":
                        console.print(f"[red]Error:[/red] {event.data.get('error', '')}")
                    elif event.event.value == "complete":
                        console.print(f"\n[green]Agent completed[/green]")
                        break

    except AgentAPIError as e:
        console.print(f"[red]Error:[/red] {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        console.print("\n[yellow]Stream interrupted[/yellow]")


def main() -> None:
    """CLI entry point"""
    cli(obj={})


if __name__ == "__main__":
    main()

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
Basic usage examples for VibeCode Agents SDK

Demonstrates fundamental SDK operations.
"""

import asyncio
import logging
from typing import List

from vibecode_agents import AgentClient
from vibecode_agents.models import AgentType, ModelType, StartAgentRequest

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def example_start_agent() -> None:
    """Example: Start an agent and wait for completion"""
    async with AgentClient() as client:
        logger.info("Starting agent...")

        request = StartAgentRequest(
            agent_type=AgentType.AIDER,
            workspace="/home/coder/workspace",
            model=ModelType.CLAUDE_3_5_SONNET,
            task="Add type hints to all functions in src/api/routes.py",
            files=["src/api/routes.py"],
        )

        agent = await client.start_agent(request)
        logger.info(f"Agent started: {agent.agent_id}")

        # Stream output
        async with client.stream_events(agent.agent_id) as stream:
            async for event in stream:
                if event.event.value == "output":
                    print(event.data.get("line", ""))
                elif event.event.value == "complete":
                    logger.info("Agent completed successfully")
                    break


async def example_list_agents() -> None:
    """Example: List all active agents"""
    async with AgentClient() as client:
        result = await client.list_agents()

        logger.info(f"Found {len(result.agents)} agents")

        for agent in result.agents:
            print(f"  {agent.agent_id}: {agent.status.value} ({agent.uptime_seconds:.0f}s)")

        if result.summary:
            print(f"\nSummary:")
            print(f"  Active: {result.summary.active}")
            print(f"  Completed: {result.summary.completed}")
            print(f"  Failed: {result.summary.failed}")


async def example_monitor_agent() -> None:
    """Example: Monitor agent with real-time status updates"""
    async with AgentClient() as client:
        # Start agent
        request = StartAgentRequest(
            agent_type=AgentType.AIDER,
            workspace="/home/coder/workspace",
            model=ModelType.CLAUDE_3_5_SONNET,
            task="Refactor authentication logic for better security",
        )

        agent = await client.start_agent(request)
        logger.info(f"Monitoring agent: {agent.agent_id}")

        # Monitor with status updates
        async with client.stream_events(agent.agent_id) as stream:
            async for event in stream:
                if event.event.value == "output":
                    print(f"[OUTPUT] {event.data.get('line', '')}")
                elif event.event.value == "status":
                    status = event.data.get("status", "")
                    progress = event.data.get("progress")
                    if progress:
                        print(f"[STATUS] {status} - {progress*100:.0f}%")
                    else:
                        print(f"[STATUS] {status}")
                elif event.event.value == "error":
                    print(f"[ERROR] {event.data.get('error', '')}")
                elif event.event.value == "complete":
                    print("[COMPLETE] Agent finished")
                    break


async def example_batch_operations() -> None:
    """Example: Process multiple files in parallel"""
    files_to_process = [
        ["src/api/auth.py", "src/api/users.py"],
        ["src/models/user.py", "src/models/session.py"],
        ["src/services/email.py", "src/services/notification.py"],
    ]

    async with AgentClient() as client:
        tasks = []

        for file_group in files_to_process:
            request = StartAgentRequest(
                agent_type=AgentType.AIDER,
                workspace="/home/coder/workspace",
                model=ModelType.CLAUDE_3_5_SONNET,
                task=f"Add comprehensive docstrings to {', '.join(file_group)}",
                files=file_group,
            )

            task = client.start_agent(request)
            tasks.append(task)

        # Start all agents concurrently
        agents = await asyncio.gather(*tasks)

        logger.info(f"Started {len(agents)} agents")
        for agent in agents:
            print(f"  {agent.agent_id}: {agent.status.value}")


async def example_error_handling() -> None:
    """Example: Proper error handling"""
    from vibecode_agents.exceptions import (
        AgentAPIError,
        NotFoundError,
        RateLimitError,
        ValidationError,
    )

    async with AgentClient() as client:
        try:
            # Attempt to start agent with invalid workspace
            request = StartAgentRequest(
                agent_type=AgentType.AIDER,
                workspace="/invalid/path",  # Invalid workspace
                model=ModelType.CLAUDE_3_5_SONNET,
                task="This will fail validation",
            )

            agent = await client.start_agent(request)

        except ValidationError as e:
            logger.error(f"Validation error: {e}")
            logger.error(f"Status code: {e.status_code}")

        except RateLimitError as e:
            logger.error(f"Rate limited! Retry after {e.retry_after}s")

        except NotFoundError as e:
            logger.error(f"Resource not found: {e}")

        except AgentAPIError as e:
            logger.error(f"API error: {e}")


async def example_health_check() -> None:
    """Example: Check API health before operations"""
    async with AgentClient() as client:
        health = await client.get_health()

        print(f"API Status: {health.status.value}")
        print(f"Version: {health.version}")
        print(f"Uptime: {health.uptime_seconds:.0f}s")

        if health.agents:
            capacity = health.agents
            print(f"\nAgent Capacity:")
            print(f"  Active: {capacity.active}/{capacity.max_concurrent}")
            print(f"  Available: {capacity.max_concurrent - capacity.active}")

            # Check if we can start new agents
            if capacity.active >= capacity.max_concurrent:
                logger.warning("No agent slots available!")
            else:
                logger.info("Ready to start agents")


async def main() -> None:
    """Run all examples"""
    examples = [
        ("Health Check", example_health_check),
        ("Start Agent", example_start_agent),
        ("List Agents", example_list_agents),
        ("Monitor Agent", example_monitor_agent),
        ("Batch Operations", example_batch_operations),
        ("Error Handling", example_error_handling),
    ]

    for name, example_func in examples:
        print(f"\n{'='*60}")
        print(f"Example: {name}")
        print(f"{'='*60}\n")

        try:
            await example_func()
        except Exception as e:
            logger.error(f"Example failed: {e}")

        print("\n")


if __name__ == "__main__":
    asyncio.run(main())
#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
AgentAPI HTTP Server - MVP Implementation
Provides RESTful API for controlling terminal-based AI coding agents
"""

import asyncio
import json
import logging
import os
import signal
import subprocess
import sys
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from aiohttp import web
import aiohttp_cors
import yaml

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('agentapi')


class Agent:
    """Represents a running agent instance"""

    def __init__(self, agent_id: str, agent_type: str, workspace: str,
                 process: asyncio.subprocess.Process, terminal_id: str):
        self.agent_id = agent_id
        self.agent_type = agent_type
        self.workspace = workspace
        self.process = process
        self.terminal_id = terminal_id
        self.status = "running"
        self.started_at = datetime.utcnow()
        self.output_buffer = []
        self.max_buffer_size = 1000

    def add_output(self, line: str):
        """Add output line to buffer"""
        self.output_buffer.append({
            'timestamp': datetime.utcnow().isoformat(),
            'line': line
        })
        if len(self.output_buffer) > self.max_buffer_size:
            self.output_buffer.pop(0)

    def to_dict(self) -> dict:
        """Convert agent to dictionary"""
        return {
            'agent_id': self.agent_id,
            'agent_type': self.agent_type,
            'workspace': self.workspace,
            'terminal_id': self.terminal_id,
            'status': self.status,
            'pid': self.process.pid if self.process else None,
            'started_at': self.started_at.isoformat(),
            'uptime_seconds': (datetime.utcnow() - self.started_at).total_seconds()
        }


class AgentAPIServer:
    """HTTP server for agent control"""

    def __init__(self, config: dict):
        self.config = config
        self.host = config.get('host', '0.0.0.0')
        self.port = config.get('port', 3284)
        self.terminal_dir = Path(config.get('terminal_dir', '/tmp/terminals'))
        self.max_concurrent_agents = config.get('max_concurrent_agents', 5)
        self.agent_timeout = config.get('agent_timeout', 300)

        # Active agents registry
        self.agents: Dict[str, Agent] = {}

        # Metrics
        self.metrics = {
            'agents_started_total': 0,
            'agents_failed_total': 0,
            'agents_stopped_total': 0,
            'http_requests_total': 0,
        }

        # Web application
        self.app = web.Application()
        self._setup_routes()
        self._setup_cors()

        logger.info(f"AgentAPI initialized: {self.host}:{self.port}")
        logger.info(f"Terminal directory: {self.terminal_dir}")
        logger.info(f"Max concurrent agents: {self.max_concurrent_agents}")

    def _setup_routes(self):
        """Configure HTTP routes"""
        self.app.router.add_get('/health', self.health_check)
        self.app.router.add_get('/metrics', self.metrics_endpoint)
        self.app.router.add_get('/v1/agents', self.list_agents)
        self.app.router.add_post('/v1/agents/start', self.start_agent)
        self.app.router.add_get('/v1/agents/{agent_id}/status', self.agent_status)
        self.app.router.add_get('/v1/agents/{agent_id}/stream', self.stream_agent_output)
        self.app.router.add_post('/v1/agents/{agent_id}/stop', self.stop_agent)
        self.app.router.add_get('/v1/terminals', self.list_terminals)

    def _setup_cors(self):
        """Configure CORS"""
        cors = aiohttp_cors.setup(self.app, defaults={
            origin: aiohttp_cors.ResourceOptions(
                allow_credentials=True,
                expose_headers="*",
                allow_headers="*",
                allow_methods="*"
            ) for origin in self.config.get('allowed_origins', ['*'])
        })

        for route in list(self.app.router.routes()):
            cors.add(route)

    async def health_check(self, request: web.Request) -> web.Response:
        """Health check endpoint"""
        self.metrics['http_requests_total'] += 1

        health_status = {
            'status': 'healthy',
            'version': os.environ.get('AGENTAPI_VERSION', '0.1.0'),
            'agents_active': len(self.agents),
            'agents_max': self.max_concurrent_agents,
            'terminal_dir_accessible': self.terminal_dir.exists(),
            'uptime_seconds': time.time() - self.app.get('start_time', time.time())
        }

        return web.json_response(health_status)

    async def metrics_endpoint(self, request: web.Request) -> web.Response:
        """Prometheus-compatible metrics endpoint"""
        self.metrics['http_requests_total'] += 1

        metrics_text = f"""# HELP agentapi_agents_active Number of currently active agents
# TYPE agentapi_agents_active gauge
agentapi_agents_active {len(self.agents)}

# HELP agentapi_agents_total Total number of agents started
# TYPE agentapi_agents_total counter
agentapi_agents_total {self.metrics['agents_started_total']}

# HELP agentapi_agent_failures_total Total number of agent failures
# TYPE agentapi_agent_failures_total counter
agentapi_agent_failures_total {self.metrics['agents_failed_total']}

# HELP agentapi_agents_stopped_total Total number of agents stopped
# TYPE agentapi_agents_stopped_total counter
agentapi_agents_stopped_total {self.metrics['agents_stopped_total']}

# HELP agentapi_http_requests_total Total HTTP requests
# TYPE agentapi_http_requests_total counter
agentapi_http_requests_total {self.metrics['http_requests_total']}

# HELP agentapi_terminals_active Number of active terminal sessions
# TYPE agentapi_terminals_active gauge
agentapi_terminals_active {len(list(self.terminal_dir.glob('*'))) if self.terminal_dir.exists() else 0}
"""

        return web.Response(text=metrics_text, content_type='text/plain')

    async def list_agents(self, request: web.Request) -> web.Response:
        """List all active agents"""
        self.metrics['http_requests_total'] += 1

        agents_list = [agent.to_dict() for agent in self.agents.values()]

        return web.json_response({
            'agents': agents_list,
            'total': len(agents_list),
            'max_concurrent': self.max_concurrent_agents
        })

    async def start_agent(self, request: web.Request) -> web.Response:
        """Start a new agent"""
        self.metrics['http_requests_total'] += 1

        # Check concurrent limit
        if len(self.agents) >= self.max_concurrent_agents:
            return web.json_response({
                'error': 'Maximum concurrent agents reached',
                'max_concurrent': self.max_concurrent_agents,
                'active': len(self.agents)
            }, status=429)

        # Parse request
        try:
            data = await request.json()
        except json.JSONDecodeError:
            return web.json_response({'error': 'Invalid JSON'}, status=400)

        agent_type = data.get('agent_type', 'aider')
        workspace = data.get('workspace', '/home/coder/workspace')
        files = data.get('files', [])
        model = data.get('model', 'claude-3-5-sonnet')
        task = data.get('task', '')

        # Validate agent type
        supported_agents = ['aider', 'goose', 'cline']
        if agent_type not in supported_agents:
            return web.json_response({
                'error': f'Unsupported agent type: {agent_type}',
                'supported': supported_agents
            }, status=400)

        # Generate IDs
        agent_id = f"{agent_type}-{uuid.uuid4().hex[:8]}"
        terminal_id = f"term-{uuid.uuid4().hex[:8]}"

        # Build command
        cmd = self._build_agent_command(agent_type, workspace, files, model, task)

        logger.info(f"Starting agent {agent_id}: {' '.join(cmd)}")

        try:
            # Start agent process
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                cwd=workspace
            )

            # Create agent instance
            agent = Agent(agent_id, agent_type, workspace, process, terminal_id)
            self.agents[agent_id] = agent

            # Start output capture task
            asyncio.create_task(self._capture_agent_output(agent))

            self.metrics['agents_started_total'] += 1

            logger.info(f"Agent {agent_id} started with PID {process.pid}")

            return web.json_response({
                'agent_id': agent_id,
                'status': 'running',
                'terminal_id': terminal_id,
                'pid': process.pid,
                'command': ' '.join(cmd)
            }, status=201)

        except Exception as e:
            logger.error(f"Failed to start agent: {e}")
            self.metrics['agents_failed_total'] += 1
            return web.json_response({
                'error': f'Failed to start agent: {str(e)}'
            }, status=500)

    def _build_agent_command(self, agent_type: str, workspace: str,
                            files: List[str], model: str, task: str) -> List[str]:
        """Build agent command line"""

        if agent_type == 'aider':
            cmd = ['aider', '--model', model, '--yes']
            if files:
                cmd.extend(files)
            if task:
                cmd.extend(['--message', task])
            return cmd

        elif agent_type == 'goose':
            cmd = ['goose', 'session', 'start']
            if task:
                cmd.extend(['--profile', 'default'])
            return cmd

        elif agent_type == 'cline':
            cmd = ['npx', '-y', '@cline/cli']
            if task:
                cmd.extend(['--task', task])
            return cmd

        else:
            raise ValueError(f"Unknown agent type: {agent_type}")

    async def _capture_agent_output(self, agent: Agent):
        """Capture and buffer agent output"""
        try:
            while True:
                line = await agent.process.stdout.readline()
                if not line:
                    break

                line_str = line.decode('utf-8', errors='ignore').strip()
                if line_str:
                    agent.add_output(line_str)
                    logger.debug(f"Agent {agent.agent_id}: {line_str}")

            # Process completed
            returncode = await agent.process.wait()
            agent.status = 'completed' if returncode == 0 else 'failed'

            logger.info(f"Agent {agent.agent_id} {agent.status} with code {returncode}")

        except Exception as e:
            logger.error(f"Error capturing output for {agent.agent_id}: {e}")
            agent.status = 'error'
            self.metrics['agents_failed_total'] += 1

    async def agent_status(self, request: web.Request) -> web.Response:
        """Get agent status"""
        self.metrics['http_requests_total'] += 1
        agent_id = request.match_info['agent_id']

        agent = self.agents.get(agent_id)
        if not agent:
            return web.json_response({'error': 'Agent not found'}, status=404)

        return web.json_response(agent.to_dict())

    async def stream_agent_output(self, request: web.Request) -> web.StreamResponse:
        """Stream agent output via Server-Sent Events"""
        self.metrics['http_requests_total'] += 1
        agent_id = request.match_info['agent_id']

        agent = self.agents.get(agent_id)
        if not agent:
            return web.json_response({'error': 'Agent not found'}, status=404)

        response = web.StreamResponse()
        response.content_type = 'text/event-stream'
        await response.prepare(request)

        # Send buffered output
        for output in agent.output_buffer:
            data = json.dumps(output)
            await response.write(f"data: {data}\n\n".encode('utf-8'))

        # Stream new output (simplified for MVP)
        while agent.status == 'running':
            await asyncio.sleep(1)
            if agent.output_buffer:
                latest = agent.output_buffer[-1]
                data = json.dumps(latest)
                await response.write(f"data: {data}\n\n".encode('utf-8'))

        await response.write_eof()
        return response

    async def stop_agent(self, request: web.Request) -> web.Response:
        """Stop a running agent"""
        self.metrics['http_requests_total'] += 1
        agent_id = request.match_info['agent_id']

        agent = self.agents.get(agent_id)
        if not agent:
            return web.json_response({'error': 'Agent not found'}, status=404)

        if agent.status != 'running':
            return web.json_response({
                'error': 'Agent not running',
                'status': agent.status
            }, status=400)

        try:
            # Send SIGTERM
            agent.process.terminate()

            # Wait for graceful shutdown
            try:
                await asyncio.wait_for(agent.process.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                # Force kill if doesn't stop
                agent.process.kill()
                await agent.process.wait()

            agent.status = 'stopped'
            self.metrics['agents_stopped_total'] += 1

            logger.info(f"Agent {agent_id} stopped")

            return web.json_response({
                'agent_id': agent_id,
                'status': 'stopped',
                'message': 'Agent stopped successfully'
            })

        except Exception as e:
            logger.error(f"Error stopping agent {agent_id}: {e}")
            return web.json_response({
                'error': f'Failed to stop agent: {str(e)}'
            }, status=500)

    async def list_terminals(self, request: web.Request) -> web.Response:
        """List active terminal sessions"""
        self.metrics['http_requests_total'] += 1

        terminals = []
        if self.terminal_dir.exists():
            for terminal_file in self.terminal_dir.glob('*'):
                terminals.append({
                    'terminal_id': terminal_file.name,
                    'created_at': datetime.fromtimestamp(
                        terminal_file.stat().st_ctime
                    ).isoformat()
                })

        return web.json_response({
            'terminals': terminals,
            'total': len(terminals)
        })

    async def cleanup_completed_agents(self):
        """Background task to cleanup completed agents"""
        while True:
            try:
                await asyncio.sleep(60)  # Run every minute

                agents_to_remove = []
                for agent_id, agent in self.agents.items():
                    if agent.status in ('completed', 'failed', 'error'):
                        uptime = (datetime.utcnow() - agent.started_at).total_seconds()
                        if uptime > 300:  # Remove after 5 minutes
                            agents_to_remove.append(agent_id)

                for agent_id in agents_to_remove:
                    del self.agents[agent_id]
                    logger.info(f"Cleaned up agent {agent_id}")

            except Exception as e:
                logger.error(f"Error in cleanup task: {e}")

    async def start_server(self):
        """Start the HTTP server"""
        self.app['start_time'] = time.time()

        # Start background cleanup task
        asyncio.create_task(self.cleanup_completed_agents())

        runner = web.AppRunner(self.app)
        await runner.setup()

        site = web.TCPSite(runner, self.host, self.port)
        await site.start()

        logger.info(f"AgentAPI server started on {self.host}:{self.port}")
        logger.info(f"Health check: http://{self.host}:{self.port}/health")
        logger.info(f"Metrics: http://{self.host}:{self.port}/metrics")

        # Keep running
        await asyncio.Event().wait()


def load_config(config_path: str) -> dict:
    """Load configuration from YAML file or environment"""
    config = {
        'host': os.environ.get('AGENTAPI_HOST', '0.0.0.0'),
        'port': int(os.environ.get('AGENTAPI_PORT', 3284)),
        'terminal_dir': os.environ.get('AGENTAPI_TERMINAL_DIR', '/tmp/terminals'),
        'max_concurrent_agents': int(os.environ.get('AGENTAPI_MAX_CONCURRENT_AGENTS', 5)),
        'agent_timeout': int(os.environ.get('AGENTAPI_AGENT_TIMEOUT', 300)),
        'log_level': os.environ.get('AGENTAPI_LOG_LEVEL', 'info').upper(),
        'allowed_origins': os.environ.get('AGENTAPI_ALLOWED_ORIGINS', '*').split(',')
    }

    # Try to load from config file
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            file_config = yaml.safe_load(f)
            config.update(file_config)

    return config


async def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description='AgentAPI HTTP Server')
    parser.add_argument('--host', default=os.environ.get('AGENTAPI_HOST', '0.0.0.0'),
                       help='Host to bind to')
    parser.add_argument('--port', type=int, default=int(os.environ.get('AGENTAPI_PORT', 3284)),
                       help='Port to bind to')
    parser.add_argument('--terminal-dir', default=os.environ.get('AGENTAPI_TERMINAL_DIR', '/tmp/terminals'),
                       help='Terminal directory path')
    parser.add_argument('--config', default='/home/coder/.agentapi/config.yaml',
                       help='Config file path')

    args = parser.parse_args()

    # Load configuration
    config = load_config(args.config)
    config['host'] = args.host
    config['port'] = args.port
    config['terminal_dir'] = args.terminal_dir

    # Set log level
    logging.getLogger().setLevel(config['log_level'])

    # Create server
    server = AgentAPIServer(config)

    # Handle shutdown signals
    loop = asyncio.get_event_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, lambda: asyncio.create_task(shutdown(server)))

    # Start server
    try:
        await server.start_server()
    except KeyboardInterrupt:
        logger.info("Received interrupt, shutting down...")
    except Exception as e:
        logger.error(f"Server error: {e}", exc_info=True)
        sys.exit(1)


async def shutdown(server: AgentAPIServer):
    """Graceful shutdown"""
    logger.info("Shutting down AgentAPI server...")

    # Stop all running agents
    for agent_id, agent in list(server.agents.items()):
        if agent.status == 'running':
            try:
                agent.process.terminate()
                await asyncio.wait_for(agent.process.wait(), timeout=5.0)
            except Exception as e:
                logger.error(f"Error stopping agent {agent_id}: {e}")

    logger.info("AgentAPI server shutdown complete")
    sys.exit(0)


if __name__ == '__main__':
    asyncio.run(main())
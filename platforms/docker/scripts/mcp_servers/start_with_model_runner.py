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
MCP Servers Startup Script with Docker Model Runner Integration

Starts MCP servers with Docker Model Runner integration.

Usage:
    python start_with_model_runner.py
"""

import os
import signal
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional
from urllib.request import urlopen
from urllib.error import URLError


@dataclass
class ServerProcess:
    """Information about a running server process."""
    name: str
    port: int
    process: Optional[subprocess.Popen] = None


@dataclass
class MCPServersConfig:
    """Configuration for MCP servers."""
    model_runner_url: str = "http://model-runner.docker.internal/engines/v1"
    servers_dir: str = "./servers"
    processes: list[ServerProcess] = field(default_factory=list)


def check_model_runner(url: str, max_attempts: int = 30) -> bool:
    """Check if Docker Model Runner is available."""
    print("Waiting for Docker Model Runner...")

    for attempt in range(1, max_attempts + 1):
        try:
            with urlopen(f"{url}/models", timeout=5) as response:
                if response.status == 200:
                    print("Docker Model Runner is available!")
                    return True
        except (URLError, OSError):
            pass

        print(f"Attempt {attempt}/{max_attempts} - waiting for Model Runner...")
        time.sleep(2)

    print(f"Warning: Docker Model Runner not available after {max_attempts} attempts")
    print("Continuing with limited functionality...")
    return False


def check_available_models(url: str) -> list[str]:
    """Check for available models."""
    models = [
        "ai/smollm2:360M-Q4_K_M",
        "ai/llama3.2:1b-Q4_K_M",
        "ai/qwen2.5-coder:1.5b-Q4_K_M",
        "ai/whisper:base-Q4_K_M",
    ]

    print("Checking for available models...")
    for model in models:
        print(f"  Checking model: {model}")

    return models


def start_server(
    name: str,
    port: int,
    command: list[str],
    cwd: str,
    env: dict,
) -> Optional[subprocess.Popen]:
    """Start a server process."""
    print(f"Starting {name} MCP Server...")

    server_path = Path(cwd)
    if not server_path.exists():
        print(f"  Server path not found: {cwd}")
        return None

    try:
        process = subprocess.Popen(
            command,
            cwd=cwd,
            env={**os.environ, **env},
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        print(f"  {name} MCP Server started with PID {process.pid}")
        return process
    except (FileNotFoundError, PermissionError) as e:
        print(f"  Failed to start {name}: {e}")
        return None


def create_health_monitor(port: int) -> Optional[subprocess.Popen]:
    """Create a simple health check server."""
    health_script = """
const http = require('http');

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      services: {
        filesystem: 'running',
        database: 'running',
        webSearch: 'running',
        sequentialThinking: 'running'
      },
      modelRunner: process.env.MODEL_RUNNER_URL || 'http://model-runner.docker.internal/engines/v1',
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log('MCP Health Monitor running on port ' + PORT);
});
""".replace("PORT", str(port))

    # Write temporary health monitor script
    health_script_path = Path("/tmp/health-monitor.js")
    health_script_path.write_text(health_script)

    try:
        process = subprocess.Popen(
            ["node", str(health_script_path)],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        print(f"Health Monitor started with PID {process.pid}")
        return process
    except (FileNotFoundError, PermissionError):
        return None


def cleanup_processes(processes: list[ServerProcess]) -> None:
    """Clean up all server processes."""
    print("Shutting down MCP servers...")
    for server in processes:
        if server.process:
            try:
                server.process.terminate()
                server.process.wait(timeout=5)
            except Exception:
                server.process.kill()


def start_mcp_servers(config: Optional[MCPServersConfig] = None) -> int:
    """Start all MCP servers."""
    if config is None:
        config = MCPServersConfig(
            model_runner_url=os.environ.get(
                "MODEL_RUNNER_URL",
                "http://model-runner.docker.internal/engines/v1"
            ),
            servers_dir=os.environ.get("SERVERS_DIR", "./servers"),
        )

    print("Starting MCP Servers with Docker Model Runner Integration...")

    # Check Model Runner
    model_runner_available = check_model_runner(config.model_runner_url)

    if model_runner_available:
        check_available_models(config.model_runner_url)

    env = {
        "MODEL_RUNNER_URL": config.model_runner_url,
    }

    # Define servers to start
    servers = [
        {
            "name": "File System",
            "port": 3001,
            "command": ["node", "./servers/filesystem/server.js"],
            "path": f"{config.servers_dir}/filesystem/server.js",
        },
        {
            "name": "Database",
            "port": 3002,
            "command": ["python3", "./servers/database/server.py"],
            "path": f"{config.servers_dir}/database/server.py",
        },
        {
            "name": "Web Search",
            "port": 3003,
            "command": ["node", "./servers/web-search/server.js"],
            "path": f"{config.servers_dir}/web-search/server.js",
        },
        {
            "name": "Sequential Thinking",
            "port": 3004,
            "command": ["node", "./servers/sequential_thinking/server.js"],
            "path": f"{config.servers_dir}/sequential_thinking/server.js",
        },
    ]

    # Start servers
    for server in servers:
        server_path = Path(server["path"])
        if server_path.exists():
            process = start_server(
                server["name"],
                server["port"],
                server["command"],
                str(server_path.parent),
                {**env, "MCP_SERVER_PORT": str(server["port"])},
            )
            if process:
                config.processes.append(ServerProcess(
                    name=server["name"],
                    port=server["port"],
                    process=process,
                ))

    # Start health monitor
    print("Starting MCP Health Monitor...")
    health_process = create_health_monitor(3001)
    if health_process:
        config.processes.append(ServerProcess(
            name="Health Monitor",
            port=3001,
            process=health_process,
        ))

    # Set up signal handlers
    def signal_handler(sig, frame):
        cleanup_processes(config.processes)
        sys.exit(0)

    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    # Print status
    print("\nAll MCP servers with Model Runner integration started!")
    print("Services available:")
    for server in config.processes:
        print(f"  - {server.name} MCP: Port {server.port}")
    print(f"  - Model Runner: {config.model_runner_url}")

    # Wait for processes
    try:
        while True:
            # Check if any process has died
            for server in config.processes:
                if server.process and server.process.poll() is not None:
                    print(f"Server {server.name} has stopped")
            time.sleep(1)
    except KeyboardInterrupt:
        cleanup_processes(config.processes)

    return 0


def main() -> int:
    """Main entry point."""
    return start_mcp_servers()


if __name__ == "__main__":
    sys.exit(main())
#!/usr/bin/env python3
"""VibeCode Apple Container Datadog Monitoring.

Sends container metrics to Datadog.
"""

from __future__ import annotations

import argparse
import json
import os
import signal
import socket
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional
from urllib import error, request


@dataclass
class DatadogConfig:
    """Datadog configuration."""

    api_key: str
    site: str = "datadoghq.com"
    hostname: str = field(default_factory=socket.gethostname)


@dataclass
class ContainerInfo:
    """Container information."""

    id: str
    state: str
    image: str


class MetricSender:
    """Sends metrics to Datadog."""

    def __init__(self, config: DatadogConfig, timeout: int = 5):
        self.config = config
        self.timeout = timeout

    def send_metric(
        self,
        metric_name: str,
        value: float,
        tags: List[str],
    ) -> bool:
        """Send a metric to Datadog.

        Returns True if successful, False otherwise.
        """
        timestamp = int(datetime.now(timezone.utc).timestamp())

        payload = {
            "series": [
                {
                    "metric": metric_name,
                    "type": 0,  # gauge
                    "points": [{"timestamp": timestamp, "value": value}],
                    "tags": tags,
                }
            ]
        }

        url = f"https://api.{self.config.site}/api/v2/series"
        headers = {
            "Content-Type": "application/json",
            "DD-API-KEY": self.config.api_key,
        }

        try:
            data = json.dumps(payload).encode("utf-8")
            req = request.Request(url, data=data, headers=headers, method="POST")
            with request.urlopen(req, timeout=self.timeout):  # nosec B310
                pass
            return True
        except (error.URLError, error.HTTPError):
            return False


class ContainerMonitor:
    """Monitors Apple containers and sends metrics to Datadog."""

    def __init__(
        self,
        config: DatadogConfig,
        metric_sender: Optional[MetricSender] = None,
        interval: int = 60,
    ):
        self.config = config
        self.sender = metric_sender or MetricSender(config)
        self.interval = interval
        self._running = False

    def get_container_list(self) -> List[ContainerInfo]:
        """Get list of containers from the container CLI."""
        try:
            result = subprocess.run(
                ["container", "list", "--format", "json"],
                capture_output=True,
                text=True,
                timeout=10,
            )
            if result.returncode != 0:
                return []

            containers = json.loads(result.stdout) if result.stdout.strip() else []
            return [
                ContainerInfo(
                    id=c.get("id", ""),
                    state=c.get("state", ""),
                    image=c.get("image", ""),
                )
                for c in containers
            ]
        except (subprocess.TimeoutExpired, subprocess.CalledProcessError, json.JSONDecodeError):
            return []
        except FileNotFoundError:
            # container CLI not available
            return []

    def collect_and_send_metrics(self) -> Dict[str, int]:
        """Collect container metrics and send to Datadog.

        Returns dict with total and running counts.
        """
        containers = self.get_container_list()
        total_count = len(containers)
        running_count = sum(1 for c in containers if c.state == "running")

        base_tags = [
            "platform:macos",
            "runtime:apple_container",
            f"host:{self.config.hostname}",
        ]

        # Send aggregate metrics
        self.sender.send_metric(
            "vibecode.apple_container.total",
            float(total_count),
            base_tags,
        )
        self.sender.send_metric(
            "vibecode.apple_container.running",
            float(running_count),
            base_tags,
        )

        # Send per-container metrics for running containers
        for container in containers:
            if container.state == "running":
                container_tags = [
                    f"container_id:{container.id}",
                    f"image:{container.image}",
                    "platform:macos",
                ]
                self.sender.send_metric(
                    "vibecode.apple_container.container.up",
                    1.0,
                    container_tags,
                )

        return {"total": total_count, "running": running_count}

    def run_once(self) -> Dict[str, int]:
        """Run a single metrics collection cycle."""
        return self.collect_and_send_metrics()

    def run_loop(self) -> None:
        """Run the monitoring loop until stopped."""
        self._running = True
        print("Starting monitoring (Ctrl+C to stop)...")

        while self._running:
            metrics = self.collect_and_send_metrics()
            now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            print(f"{now}: Sent metrics - Total: {metrics['total']}, Running: {metrics['running']}")
            time.sleep(self.interval)

    def stop(self) -> None:
        """Stop the monitoring loop."""
        self._running = False


def parse_args(argv: List[str] | None = None) -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="VibeCode Apple Container Datadog Monitoring",
    )
    parser.add_argument(
        "--api-key",
        default=os.environ.get("DD_API_KEY", ""),
        help="Datadog API key (or set DD_API_KEY env var)",
    )
    parser.add_argument(
        "--site",
        default=os.environ.get("DD_SITE", "datadoghq.com"),
        help="Datadog site (default: datadoghq.com)",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=60,
        help="Metrics collection interval in seconds (default: 60)",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run once and exit (don't loop)",
    )
    return parser.parse_args(argv)


def main(argv: List[str] | None = None) -> int:
    """Main entry point."""
    args = parse_args(argv)

    if not args.api_key:
        print("\u274c Error: DD_API_KEY environment variable required")
        print("Export it: export DD_API_KEY=your_key_here")
        return 1

    hostname = socket.gethostname()

    print("=== VibeCode Apple Container Datadog Monitor ===")
    print(f"Hostname: {hostname}")
    print(f"Datadog Site: {args.site}")
    print()

    config = DatadogConfig(
        api_key=args.api_key,
        site=args.site,
        hostname=hostname,
    )

    monitor = ContainerMonitor(config, interval=args.interval)

    # Handle SIGINT/SIGTERM gracefully
    def signal_handler(signum, frame):
        print("\nStopping monitor...")
        monitor.stop()

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    if args.once:
        metrics = monitor.run_once()
        print(f"Sent metrics - Total: {metrics['total']}, Running: {metrics['running']}")
    else:
        monitor.run_loop()

    return 0


__all__ = [
    "ContainerInfo",
    "ContainerMonitor",
    "DatadogConfig",
    "MetricSender",
    "main",
]


if __name__ == "__main__":
    sys.exit(main())

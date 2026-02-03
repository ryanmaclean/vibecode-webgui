#!/usr/bin/env python3
"""Docker TUI for VibeCode.

A terminal user interface that consolidates all Docker scripts:
- docker-*.sh
- scripts/cloud/docker/*.sh

Features:
- Docker status and diagnostics
- Build management (optimized builds)
- Container and image management
- Docker Compose operations
- Troubleshooting tools
"""

from __future__ import annotations

import curses
import glob
import os
import shutil
import subprocess
import sys
import threading
import time
from dataclasses import dataclass, field
from enum import Enum, auto
from pathlib import Path
from typing import Callable


@dataclass(frozen=True)
class Colors:
    """Color pair indices for curses."""

    DEFAULT = 0
    HEADER = 1
    SELECTED = 2
    SUCCESS = 3
    ERROR = 4
    WARNING = 5
    INFO = 6
    MENU = 7
    STATUS_BAR = 8


class ViewMode(Enum):
    """Current view mode."""

    MAIN_MENU = auto()
    STATUS = auto()
    CONTAINERS = auto()
    IMAGES = auto()
    COMPOSE = auto()
    BUILD = auto()
    TROUBLESHOOT = auto()
    LOGS = auto()
    HELP = auto()


@dataclass
class DockerScript:
    """Represents a Docker script."""

    path: Path
    name: str
    description: str
    category: str


@dataclass
class Container:
    """Docker container info."""

    id: str
    name: str
    image: str
    status: str
    ports: str
    created: str


@dataclass
class Image:
    """Docker image info."""

    id: str
    repository: str
    tag: str
    size: str
    created: str


def get_project_root() -> Path:
    """Get project root directory."""
    return Path(__file__).resolve().parent.parent


def discover_docker_scripts(project_root: Path) -> list[DockerScript]:
    """Discover all Docker scripts in the project."""
    scripts: list[DockerScript] = []

    # Patterns to search
    patterns = [
        "scripts/docker-*.sh",
        "scripts/cloud/docker/*.sh",
        "scripts/benchmarks/docker-*.sh",
        "tests/docker-*.sh",
    ]

    descriptions = {
        "docker-doctor.sh": "Interactive Docker troubleshooting and repair",
        "docker-setup.sh": "Configure Docker client for VibeCode VM",
        "docker-build-optimized.sh": "Build optimized Docker images with BuildKit",
        "docker-fix-simple.sh": "Simple Docker fixes and repairs",
        "docker-test-optimizations.sh": "Test Docker optimization settings",
        "docker-musl-vs-glibc.sh": "Benchmark musl vs glibc builds",
        "start-compose.sh": "Start Docker Compose services",
        "stop-compose.sh": "Stop Docker Compose services",
        "docker-compose-tests.sh": "Run Docker Compose tests",
    }

    categories = {
        "docker-doctor.sh": "Troubleshooting",
        "docker-setup.sh": "Setup",
        "docker-build-optimized.sh": "Build",
        "docker-fix-simple.sh": "Troubleshooting",
        "docker-test-optimizations.sh": "Testing",
        "docker-musl-vs-glibc.sh": "Benchmarks",
        "start-compose.sh": "Compose",
        "stop-compose.sh": "Compose",
        "docker-compose-tests.sh": "Testing",
    }

    found_paths: set[Path] = set()

    for pattern in patterns:
        for path_str in glob.glob(str(project_root / pattern), recursive=True):
            found_paths.add(Path(path_str))

    for path in sorted(found_paths):
        name = path.name
        scripts.append(DockerScript(
            path=path,
            name=name,
            description=descriptions.get(name, "Docker script"),
            category=categories.get(name, "General"),
        ))

    return scripts


class DockerManager:
    """Manages Docker operations."""

    def __init__(self) -> None:
        self.docker_available = self._check_docker()
        self.output = ""
        self.running = False
        self._thread: threading.Thread | None = None

    def _check_docker(self) -> bool:
        """Check if Docker is available."""
        return shutil.which("docker") is not None

    def _run_command(
        self,
        cmd: list[str],
        timeout: int = 30,
    ) -> tuple[bool, str]:
        """Run a command and return success status and output."""
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
            )
            output = result.stdout + result.stderr
            return result.returncode == 0, output
        except subprocess.TimeoutExpired:
            return False, "Command timed out"
        except Exception as e:
            return False, str(e)

    def is_daemon_running(self) -> bool:
        """Check if Docker daemon is running."""
        success, _ = self._run_command(["docker", "info"], timeout=5)
        return success

    def get_version(self) -> str:
        """Get Docker version."""
        success, output = self._run_command(["docker", "--version"])
        return output.strip() if success else "Not available"

    def get_info(self) -> dict[str, str]:
        """Get Docker system info."""
        info = {}

        if not self.is_daemon_running():
            return {"status": "Docker daemon not running"}

        # Get version
        success, output = self._run_command(["docker", "version", "--format", "{{.Server.Version}}"])
        info["server_version"] = output.strip() if success else "Unknown"

        # Get containers count
        success, output = self._run_command(["docker", "ps", "-q"])
        running = len(output.strip().split("\n")) if output.strip() else 0
        success, output = self._run_command(["docker", "ps", "-aq"])
        total = len(output.strip().split("\n")) if output.strip() else 0
        info["containers"] = f"{running} running / {total} total"

        # Get images count
        success, output = self._run_command(["docker", "images", "-q"])
        images = len(output.strip().split("\n")) if output.strip() else 0
        info["images"] = str(images)

        # Get disk usage
        success, output = self._run_command(["docker", "system", "df", "--format", "{{.Type}}\t{{.Size}}"])
        if success:
            info["disk_usage"] = output.strip().replace("\t", ": ").replace("\n", ", ")

        return info

    def get_containers(self) -> list[Container]:
        """Get list of containers."""
        containers = []

        success, output = self._run_command([
            "docker", "ps", "-a",
            "--format", "{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}\t{{.CreatedAt}}"
        ])

        if not success or not output.strip():
            return containers

        for line in output.strip().split("\n"):
            parts = line.split("\t")
            if len(parts) >= 6:
                containers.append(Container(
                    id=parts[0],
                    name=parts[1],
                    image=parts[2],
                    status=parts[3],
                    ports=parts[4] if parts[4] else "-",
                    created=parts[5],
                ))

        return containers

    def get_images(self) -> list[Image]:
        """Get list of images."""
        images = []

        success, output = self._run_command([
            "docker", "images",
            "--format", "{{.ID}}\t{{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
        ])

        if not success or not output.strip():
            return images

        for line in output.strip().split("\n"):
            parts = line.split("\t")
            if len(parts) >= 5:
                images.append(Image(
                    id=parts[0],
                    repository=parts[1],
                    tag=parts[2],
                    size=parts[3],
                    created=parts[4],
                ))

        return images

    def start_container(self, container_id: str) -> tuple[bool, str]:
        """Start a container."""
        return self._run_command(["docker", "start", container_id])

    def stop_container(self, container_id: str) -> tuple[bool, str]:
        """Stop a container."""
        return self._run_command(["docker", "stop", container_id])

    def remove_container(self, container_id: str, force: bool = False) -> tuple[bool, str]:
        """Remove a container."""
        cmd = ["docker", "rm"]
        if force:
            cmd.append("-f")
        cmd.append(container_id)
        return self._run_command(cmd)

    def remove_image(self, image_id: str, force: bool = False) -> tuple[bool, str]:
        """Remove an image."""
        cmd = ["docker", "rmi"]
        if force:
            cmd.append("-f")
        cmd.append(image_id)
        return self._run_command(cmd)

    def prune_system(self, all_images: bool = False) -> tuple[bool, str]:
        """Prune Docker system."""
        cmd = ["docker", "system", "prune", "-f"]
        if all_images:
            cmd.append("-a")
        return self._run_command(cmd, timeout=120)

    def get_container_logs(self, container_id: str, lines: int = 100) -> str:
        """Get container logs."""
        success, output = self._run_command([
            "docker", "logs", "--tail", str(lines), container_id
        ])
        return output if success else f"Failed to get logs: {output}"

    def run_script_async(
        self,
        script_path: Path,
        on_complete: Callable[[bool, str], None] | None = None,
    ) -> None:
        """Run a Docker script asynchronously."""
        if self.running:
            return

        self.running = True
        self.output = ""

        def _run() -> None:
            try:
                result = subprocess.run(
                    [str(script_path)],
                    capture_output=True,
                    text=True,
                    timeout=600,
                    cwd=script_path.parent,
                )
                self.output = result.stdout + result.stderr
                success = result.returncode == 0
            except subprocess.TimeoutExpired:
                self.output = "Script timed out after 10 minutes"
                success = False
            except Exception as e:
                self.output = f"Error: {e}"
                success = False
            finally:
                self.running = False
                if on_complete:
                    on_complete(success, self.output)

        self._thread = threading.Thread(target=_run, daemon=True)
        self._thread.start()


class DockerTUI:
    """Main TUI application for Docker management."""

    def __init__(self, stdscr: curses.window) -> None:
        self.stdscr = stdscr
        self.project_root = get_project_root()
        self.scripts = discover_docker_scripts(self.project_root)
        self.docker = DockerManager()

        # UI state
        self.mode = ViewMode.MAIN_MENU
        self.selected_idx = 0
        self.scroll_offset = 0
        self.message = ""
        self.message_time = 0.0
        self.log_content = ""
        self.log_scroll = 0

        # Data caches
        self.containers: list[Container] = []
        self.images: list[Image] = []
        self.docker_info: dict[str, str] = {}

        # Menu items
        self.main_menu_items = [
            ("Status & Info", "View Docker status and system information"),
            ("Containers", "Manage Docker containers"),
            ("Images", "Manage Docker images"),
            ("Compose", "Docker Compose operations"),
            ("Build", "Build Docker images"),
            ("Troubleshoot", "Docker Doctor - diagnose and fix issues"),
            ("Help", "Show help and keyboard shortcuts"),
            ("Quit", "Exit Docker TUI"),
        ]

        # Setup colors
        self._setup_colors()

        # Setup curses
        curses.curs_set(0)
        self.stdscr.nodelay(True)
        self.stdscr.timeout(100)

        # Initial data load
        self._refresh_data()

    def _setup_colors(self) -> None:
        """Initialize color pairs."""
        curses.start_color()
        curses.use_default_colors()

        curses.init_pair(Colors.HEADER, curses.COLOR_WHITE, curses.COLOR_BLUE)
        curses.init_pair(Colors.SELECTED, curses.COLOR_BLACK, curses.COLOR_CYAN)
        curses.init_pair(Colors.SUCCESS, curses.COLOR_GREEN, -1)
        curses.init_pair(Colors.ERROR, curses.COLOR_RED, -1)
        curses.init_pair(Colors.WARNING, curses.COLOR_YELLOW, -1)
        curses.init_pair(Colors.INFO, curses.COLOR_CYAN, -1)
        curses.init_pair(Colors.MENU, curses.COLOR_WHITE, -1)
        curses.init_pair(Colors.STATUS_BAR, curses.COLOR_BLACK, curses.COLOR_WHITE)

    def _refresh_data(self) -> None:
        """Refresh Docker data."""
        if self.docker.is_daemon_running():
            self.docker_info = self.docker.get_info()
            self.containers = self.docker.get_containers()
            self.images = self.docker.get_images()
        else:
            self.docker_info = {"status": "Docker daemon not running"}
            self.containers = []
            self.images = []

    def _set_message(self, msg: str) -> None:
        """Set a temporary status message."""
        self.message = msg
        self.message_time = time.time()

    def _draw_header(self) -> None:
        """Draw the header bar."""
        height, width = self.stdscr.getmaxyx()
        title = " Docker TUI - VibeCode "

        # Status indicator
        if self.docker.is_daemon_running():
            status = " [Docker: Running] "
            status_color = Colors.SUCCESS
        else:
            status = " [Docker: Stopped] "
            status_color = Colors.ERROR

        # Draw header bar
        self.stdscr.attron(curses.color_pair(Colors.HEADER) | curses.A_BOLD)
        self.stdscr.addstr(0, 0, " " * width)
        self.stdscr.addstr(0, 2, title)
        self.stdscr.attroff(curses.color_pair(Colors.HEADER) | curses.A_BOLD)

        # Draw status
        self.stdscr.attron(curses.color_pair(status_color) | curses.A_BOLD)
        self.stdscr.addstr(0, width - len(status) - 2, status)
        self.stdscr.attroff(curses.color_pair(status_color) | curses.A_BOLD)

    def _draw_status_bar(self) -> None:
        """Draw the status bar at the bottom."""
        height, width = self.stdscr.getmaxyx()

        if self.message and time.time() - self.message_time < 3:
            status = f" {self.message} "
        elif self.docker.running:
            status = " Running script... "
        else:
            mode_names = {
                ViewMode.MAIN_MENU: "Main Menu",
                ViewMode.STATUS: "Status",
                ViewMode.CONTAINERS: "Containers",
                ViewMode.IMAGES: "Images",
                ViewMode.COMPOSE: "Compose",
                ViewMode.BUILD: "Build",
                ViewMode.TROUBLESHOOT: "Troubleshoot",
                ViewMode.LOGS: "Logs",
                ViewMode.HELP: "Help",
            }
            status = f" {mode_names.get(self.mode, 'Unknown')} "

        help_text = " [q]Back [h]Help [r]Refresh "

        self.stdscr.attron(curses.color_pair(Colors.STATUS_BAR))
        self.stdscr.addstr(height - 1, 0, " " * width)
        self.stdscr.addstr(height - 1, 0, status[:width - len(help_text) - 1])
        self.stdscr.addstr(height - 1, width - len(help_text), help_text)
        self.stdscr.attroff(curses.color_pair(Colors.STATUS_BAR))

    def _draw_main_menu(self) -> None:
        """Draw the main menu."""
        height, width = self.stdscr.getmaxyx()
        start_y = 3

        # Title
        self.stdscr.attron(curses.A_BOLD)
        self.stdscr.addstr(start_y, 2, "Main Menu")
        self.stdscr.attroff(curses.A_BOLD)
        self.stdscr.addstr(start_y + 1, 2, "─" * 40)

        # Menu items
        for i, (name, description) in enumerate(self.main_menu_items):
            y = start_y + 3 + i * 2
            if y >= height - 2:
                break

            is_selected = i == self.selected_idx

            if is_selected:
                self.stdscr.attron(curses.color_pair(Colors.SELECTED))
                self.stdscr.addstr(y, 2, f" ▶ {name}".ljust(width - 4))
                self.stdscr.attroff(curses.color_pair(Colors.SELECTED))
            else:
                self.stdscr.addstr(y, 2, f"   {name}")

            # Description
            if y + 1 < height - 2:
                self.stdscr.attron(curses.A_DIM)
                self.stdscr.addstr(y + 1, 6, description[:width - 10])
                self.stdscr.attroff(curses.A_DIM)

    def _draw_status_view(self) -> None:
        """Draw the status view."""
        height, width = self.stdscr.getmaxyx()
        y = 3

        self.stdscr.attron(curses.A_BOLD)
        self.stdscr.addstr(y, 2, "Docker Status")
        self.stdscr.attroff(curses.A_BOLD)
        y += 2

        # Docker version
        self.stdscr.addstr(y, 2, f"Version: {self.docker.get_version()}")
        y += 2

        # Docker info
        if self.docker_info:
            for key, value in self.docker_info.items():
                if y >= height - 2:
                    break
                label = key.replace("_", " ").title()
                self.stdscr.addstr(y, 2, f"{label}: ")
                self.stdscr.attron(curses.color_pair(Colors.INFO))
                self.stdscr.addstr(value[:width - len(label) - 6])
                self.stdscr.attroff(curses.color_pair(Colors.INFO))
                y += 1

        y += 2
        if y < height - 4:
            self.stdscr.addstr(y, 2, "Quick Actions:")
            y += 1
            self.stdscr.addstr(y, 4, "[p] Prune system  [P] Prune all (including images)")

    def _draw_containers_view(self) -> None:
        """Draw the containers view."""
        height, width = self.stdscr.getmaxyx()
        start_y = 3
        visible_lines = height - start_y - 4

        self.stdscr.attron(curses.A_BOLD)
        self.stdscr.addstr(start_y, 2, f"Containers ({len(self.containers)})")
        self.stdscr.attroff(curses.A_BOLD)

        if not self.containers:
            self.stdscr.addstr(start_y + 2, 2, "No containers found")
            return

        # Headers
        headers = "  NAME                    IMAGE                 STATUS"
        self.stdscr.addstr(start_y + 2, 0, headers[:width])
        self.stdscr.addstr(start_y + 3, 0, "─" * min(width, 70))

        # Adjust scroll
        if self.selected_idx < self.scroll_offset:
            self.scroll_offset = self.selected_idx
        elif self.selected_idx >= self.scroll_offset + visible_lines:
            self.scroll_offset = self.selected_idx - visible_lines + 1

        for i, container in enumerate(self.containers):
            if i < self.scroll_offset:
                continue
            if i >= self.scroll_offset + visible_lines:
                break

            y = start_y + 4 + (i - self.scroll_offset)
            is_selected = i == self.selected_idx

            # Status color
            if "Up" in container.status:
                status_color = Colors.SUCCESS
            elif "Exited" in container.status:
                status_color = Colors.WARNING
            else:
                status_color = Colors.DEFAULT

            name = container.name[:22].ljust(22)
            image = container.image[:20].ljust(20)
            status = container.status[:20]

            if is_selected:
                self.stdscr.attron(curses.color_pair(Colors.SELECTED))
                line = f"▶ {name}  {image}  {status}"
                self.stdscr.addstr(y, 0, line[:width].ljust(width))
                self.stdscr.attroff(curses.color_pair(Colors.SELECTED))
            else:
                self.stdscr.addstr(y, 0, f"  {name}  {image}  ")
                self.stdscr.attron(curses.color_pair(status_color))
                self.stdscr.addstr(status)
                self.stdscr.attroff(curses.color_pair(status_color))

        # Actions
        y = height - 3
        self.stdscr.addstr(y, 2, "[s]tart [S]top [x]Remove [l]ogs [Enter]Details")

    def _draw_images_view(self) -> None:
        """Draw the images view."""
        height, width = self.stdscr.getmaxyx()
        start_y = 3
        visible_lines = height - start_y - 4

        self.stdscr.attron(curses.A_BOLD)
        self.stdscr.addstr(start_y, 2, f"Images ({len(self.images)})")
        self.stdscr.attroff(curses.A_BOLD)

        if not self.images:
            self.stdscr.addstr(start_y + 2, 2, "No images found")
            return

        # Headers
        headers = "  REPOSITORY                  TAG           SIZE"
        self.stdscr.addstr(start_y + 2, 0, headers[:width])
        self.stdscr.addstr(start_y + 3, 0, "─" * min(width, 60))

        # Adjust scroll
        if self.selected_idx < self.scroll_offset:
            self.scroll_offset = self.selected_idx
        elif self.selected_idx >= self.scroll_offset + visible_lines:
            self.scroll_offset = self.selected_idx - visible_lines + 1

        for i, image in enumerate(self.images):
            if i < self.scroll_offset:
                continue
            if i >= self.scroll_offset + visible_lines:
                break

            y = start_y + 4 + (i - self.scroll_offset)
            is_selected = i == self.selected_idx

            repo = image.repository[:26].ljust(26)
            tag = image.tag[:12].ljust(12)
            size = image.size[:10]

            if is_selected:
                self.stdscr.attron(curses.color_pair(Colors.SELECTED))
                line = f"▶ {repo}  {tag}  {size}"
                self.stdscr.addstr(y, 0, line[:width].ljust(width))
                self.stdscr.attroff(curses.color_pair(Colors.SELECTED))
            else:
                self.stdscr.addstr(y, 0, f"  {repo}  {tag}  {size}")

        # Actions
        y = height - 3
        self.stdscr.addstr(y, 2, "[x]Remove [Enter]Details")

    def _draw_compose_view(self) -> None:
        """Draw the Docker Compose view."""
        height, width = self.stdscr.getmaxyx()
        y = 3

        self.stdscr.attron(curses.A_BOLD)
        self.stdscr.addstr(y, 2, "Docker Compose")
        self.stdscr.attroff(curses.A_BOLD)
        y += 2

        # Find compose scripts
        compose_scripts = [s for s in self.scripts if s.category == "Compose"]

        if not compose_scripts:
            self.stdscr.addstr(y, 2, "No Compose scripts found")
            return

        for i, script in enumerate(compose_scripts):
            is_selected = i == self.selected_idx

            if is_selected:
                self.stdscr.attron(curses.color_pair(Colors.SELECTED))
                self.stdscr.addstr(y, 2, f" ▶ {script.name}".ljust(width - 4))
                self.stdscr.attroff(curses.color_pair(Colors.SELECTED))
            else:
                self.stdscr.addstr(y, 2, f"   {script.name}")

            y += 1
            self.stdscr.attron(curses.A_DIM)
            self.stdscr.addstr(y, 6, script.description[:width - 10])
            self.stdscr.attroff(curses.A_DIM)
            y += 2

        y += 1
        self.stdscr.addstr(y, 2, "[Enter] Run script")

    def _draw_build_view(self) -> None:
        """Draw the build view."""
        height, width = self.stdscr.getmaxyx()
        y = 3

        self.stdscr.attron(curses.A_BOLD)
        self.stdscr.addstr(y, 2, "Docker Build")
        self.stdscr.attroff(curses.A_BOLD)
        y += 2

        build_options = [
            ("Production Build", "Build optimized production image"),
            ("Development Build", "Build with dev tools and hot reload"),
            ("Testing Build", "Build with test dependencies"),
            ("Custom Build", "Run docker-build-optimized.sh with options"),
        ]

        for i, (name, desc) in enumerate(build_options):
            is_selected = i == self.selected_idx

            if is_selected:
                self.stdscr.attron(curses.color_pair(Colors.SELECTED))
                self.stdscr.addstr(y, 2, f" ▶ {name}".ljust(width - 4))
                self.stdscr.attroff(curses.color_pair(Colors.SELECTED))
            else:
                self.stdscr.addstr(y, 2, f"   {name}")

            y += 1
            self.stdscr.attron(curses.A_DIM)
            self.stdscr.addstr(y, 6, desc[:width - 10])
            self.stdscr.attroff(curses.A_DIM)
            y += 2

    def _draw_troubleshoot_view(self) -> None:
        """Draw the troubleshooting view."""
        height, width = self.stdscr.getmaxyx()
        y = 3

        self.stdscr.attron(curses.A_BOLD)
        self.stdscr.addstr(y, 2, "Docker Troubleshooting")
        self.stdscr.attroff(curses.A_BOLD)
        y += 2

        troubleshoot_options = [
            ("Run Diagnostics", "Comprehensive Docker health check"),
            ("Restart Docker", "Restart Docker Desktop"),
            ("Quick Fixes", "Run automated repair sequence"),
            ("Reset Preferences", "Reset Docker to default settings"),
            ("Clean System", "Remove unused containers, images, volumes"),
            ("View Logs", "Show Docker daemon logs"),
        ]

        for i, (name, desc) in enumerate(troubleshoot_options):
            is_selected = i == self.selected_idx

            if is_selected:
                self.stdscr.attron(curses.color_pair(Colors.SELECTED))
                self.stdscr.addstr(y, 2, f" ▶ {name}".ljust(width - 4))
                self.stdscr.attroff(curses.color_pair(Colors.SELECTED))
            else:
                self.stdscr.addstr(y, 2, f"   {name}")

            y += 1
            self.stdscr.attron(curses.A_DIM)
            self.stdscr.addstr(y, 6, desc[:width - 10])
            self.stdscr.attroff(curses.A_DIM)
            y += 2

    def _draw_logs_view(self) -> None:
        """Draw logs view."""
        height, width = self.stdscr.getmaxyx()
        y = 3

        self.stdscr.attron(curses.A_BOLD)
        self.stdscr.addstr(y, 2, "Output Log")
        self.stdscr.attroff(curses.A_BOLD)
        y += 2

        if not self.log_content:
            self.stdscr.addstr(y, 2, "No log content")
            return

        lines = self.log_content.split("\n")
        visible_lines = height - y - 2

        # Adjust scroll
        max_scroll = max(0, len(lines) - visible_lines)
        self.log_scroll = max(0, min(self.log_scroll, max_scroll))

        for i, line in enumerate(lines[self.log_scroll:]):
            if y >= height - 2:
                break

            # Color errors/success
            if "error" in line.lower() or "fail" in line.lower():
                self.stdscr.attron(curses.color_pair(Colors.ERROR))
                self.stdscr.addstr(y, 2, line[:width - 4])
                self.stdscr.attroff(curses.color_pair(Colors.ERROR))
            elif "success" in line.lower() or "✓" in line or "✅" in line:
                self.stdscr.attron(curses.color_pair(Colors.SUCCESS))
                self.stdscr.addstr(y, 2, line[:width - 4])
                self.stdscr.attroff(curses.color_pair(Colors.SUCCESS))
            else:
                self.stdscr.addstr(y, 2, line[:width - 4])

            y += 1

    def _draw_help_view(self) -> None:
        """Draw help screen."""
        height, width = self.stdscr.getmaxyx()

        help_text = """
 Docker TUI - Help
 ═════════════════

 Navigation
 ──────────
   ↑/k       Move up
   ↓/j       Move down
   Enter     Select / Execute
   q/Esc     Back / Quit

 Container Actions
 ─────────────────
   s         Start container
   S         Stop container
   x         Remove container
   l         View logs

 Image Actions
 ─────────────
   x         Remove image

 System Actions
 ──────────────
   r         Refresh data
   p         Prune system
   P         Prune all (including images)

 Views
 ─────
   1-7       Quick switch to menu item
   h/?       This help screen

 Press any key to return...
"""

        lines = help_text.strip().split("\n")
        for i, line in enumerate(lines):
            if i + 2 >= height - 1:
                break
            self.stdscr.addstr(i + 2, 2, line[:width - 4])

    def draw(self) -> None:
        """Draw the full UI."""
        self.stdscr.clear()

        self._draw_header()

        if self.mode == ViewMode.MAIN_MENU:
            self._draw_main_menu()
        elif self.mode == ViewMode.STATUS:
            self._draw_status_view()
        elif self.mode == ViewMode.CONTAINERS:
            self._draw_containers_view()
        elif self.mode == ViewMode.IMAGES:
            self._draw_images_view()
        elif self.mode == ViewMode.COMPOSE:
            self._draw_compose_view()
        elif self.mode == ViewMode.BUILD:
            self._draw_build_view()
        elif self.mode == ViewMode.TROUBLESHOOT:
            self._draw_troubleshoot_view()
        elif self.mode == ViewMode.LOGS:
            self._draw_logs_view()
        elif self.mode == ViewMode.HELP:
            self._draw_help_view()

        self._draw_status_bar()

        self.stdscr.refresh()

    def _get_max_items(self) -> int:
        """Get max items for current view."""
        if self.mode == ViewMode.MAIN_MENU:
            return len(self.main_menu_items)
        elif self.mode == ViewMode.CONTAINERS:
            return len(self.containers)
        elif self.mode == ViewMode.IMAGES:
            return len(self.images)
        elif self.mode == ViewMode.COMPOSE:
            return len([s for s in self.scripts if s.category == "Compose"])
        elif self.mode == ViewMode.BUILD:
            return 4
        elif self.mode == ViewMode.TROUBLESHOOT:
            return 6
        return 0

    def _handle_main_menu_select(self) -> None:
        """Handle main menu selection."""
        if self.selected_idx == 0:
            self.mode = ViewMode.STATUS
        elif self.selected_idx == 1:
            self.mode = ViewMode.CONTAINERS
            self._refresh_data()
        elif self.selected_idx == 2:
            self.mode = ViewMode.IMAGES
            self._refresh_data()
        elif self.selected_idx == 3:
            self.mode = ViewMode.COMPOSE
        elif self.selected_idx == 4:
            self.mode = ViewMode.BUILD
        elif self.selected_idx == 5:
            self.mode = ViewMode.TROUBLESHOOT
        elif self.selected_idx == 6:
            self.mode = ViewMode.HELP
        elif self.selected_idx == 7:
            return  # Will be handled as quit

        self.selected_idx = 0
        self.scroll_offset = 0

    def _run_docker_doctor(self, command: str) -> None:
        """Run docker-doctor with a specific command."""
        doctor_script = self.project_root / "scripts" / "docker-doctor.sh"
        if doctor_script.exists():
            def on_complete(success: bool, output: str) -> None:
                self.log_content = output
                self._set_message("Command completed" if success else "Command failed")

            # Run with environment to skip interactive mode
            self._set_message(f"Running {command}...")
            self.docker.run_script_async(doctor_script, on_complete)
            self.mode = ViewMode.LOGS

    def handle_input(self, key: int) -> bool:
        """Handle keyboard input. Returns False to quit."""
        # Help view - any key returns
        if self.mode == ViewMode.HELP:
            if key != -1:
                self.mode = ViewMode.MAIN_MENU
            return True

        # Global keys
        if key == ord("q") or key == 27:  # q or Escape
            if self.mode == ViewMode.MAIN_MENU:
                return False
            self.mode = ViewMode.MAIN_MENU
            self.selected_idx = 0
            self.scroll_offset = 0
            return True

        if key == ord("h") or key == ord("?"):
            self.mode = ViewMode.HELP
            return True

        if key == ord("r"):
            self._refresh_data()
            self._set_message("Data refreshed")
            return True

        # Quick menu access
        if ord("1") <= key <= ord("7") and self.mode == ViewMode.MAIN_MENU:
            self.selected_idx = key - ord("1")
            self._handle_main_menu_select()
            return True

        # Navigation
        max_items = self._get_max_items()

        if key == curses.KEY_UP or key == ord("k"):
            self.selected_idx = max(0, self.selected_idx - 1)
        elif key == curses.KEY_DOWN or key == ord("j"):
            self.selected_idx = min(max_items - 1, self.selected_idx + 1)
        elif key == curses.KEY_PPAGE:
            self.selected_idx = max(0, self.selected_idx - 10)
        elif key == curses.KEY_NPAGE:
            self.selected_idx = min(max_items - 1, self.selected_idx + 10)

        # Log view scrolling
        if self.mode == ViewMode.LOGS:
            if key == curses.KEY_UP or key == ord("k"):
                self.log_scroll = max(0, self.log_scroll - 1)
            elif key == curses.KEY_DOWN or key == ord("j"):
                self.log_scroll += 1

        # Enter key
        if key == 10:  # Enter
            if self.mode == ViewMode.MAIN_MENU:
                if self.selected_idx == 7:  # Quit
                    return False
                self._handle_main_menu_select()

            elif self.mode == ViewMode.CONTAINERS and self.containers:
                container = self.containers[self.selected_idx]
                self.log_content = self.docker.get_container_logs(container.id)
                self.mode = ViewMode.LOGS
                self.log_scroll = 0

        # Container actions
        if self.mode == ViewMode.CONTAINERS and self.containers:
            container = self.containers[self.selected_idx]

            if key == ord("s"):  # Start
                success, msg = self.docker.start_container(container.id)
                self._set_message(f"Started {container.name}" if success else f"Failed: {msg}")
                self._refresh_data()

            elif key == ord("S"):  # Stop
                success, msg = self.docker.stop_container(container.id)
                self._set_message(f"Stopped {container.name}" if success else f"Failed: {msg}")
                self._refresh_data()

            elif key == ord("x"):  # Remove
                success, msg = self.docker.remove_container(container.id)
                self._set_message(f"Removed {container.name}" if success else f"Failed: {msg}")
                self._refresh_data()
                self.selected_idx = min(self.selected_idx, len(self.containers) - 1)

            elif key == ord("l"):  # Logs
                self.log_content = self.docker.get_container_logs(container.id)
                self.mode = ViewMode.LOGS
                self.log_scroll = 0

        # Image actions
        if self.mode == ViewMode.IMAGES and self.images:
            image = self.images[self.selected_idx]

            if key == ord("x"):  # Remove
                success, msg = self.docker.remove_image(image.id)
                self._set_message(f"Removed {image.repository}:{image.tag}" if success else f"Failed: {msg}")
                self._refresh_data()
                self.selected_idx = min(self.selected_idx, len(self.images) - 1)

        # Status view actions
        if self.mode == ViewMode.STATUS:
            if key == ord("p"):  # Prune
                self._set_message("Pruning system...")
                success, msg = self.docker.prune_system(all_images=False)
                self._set_message("Prune completed" if success else f"Prune failed: {msg}")
                self._refresh_data()

            elif key == ord("P"):  # Prune all
                self._set_message("Pruning all...")
                success, msg = self.docker.prune_system(all_images=True)
                self._set_message("Prune completed" if success else f"Prune failed: {msg}")
                self._refresh_data()

        # Troubleshoot actions
        if self.mode == ViewMode.TROUBLESHOOT and key == 10:
            if self.selected_idx == 0:  # Diagnostics
                self._run_docker_doctor("diagnose")
            elif self.selected_idx == 1:  # Restart
                self._run_docker_doctor("restart")
            elif self.selected_idx == 2:  # Quick fixes
                self._run_docker_doctor("quick-fix")
            elif self.selected_idx == 4:  # Clean
                success, msg = self.docker.prune_system(all_images=True)
                self._set_message("Cleanup completed" if success else f"Failed: {msg}")
                self._refresh_data()

        return True

    def run(self) -> None:
        """Main event loop."""
        running = True
        while running:
            self.draw()
            try:
                key = self.stdscr.getch()
                running = self.handle_input(key)
            except KeyboardInterrupt:
                running = False


def main_curses(stdscr: curses.window) -> int:
    """Main function wrapped for curses."""
    tui = DockerTUI(stdscr)
    tui.run()
    return 0


def run_headless(args: list[str]) -> int:
    """Run commands without TUI."""
    docker = DockerManager()

    if "--status" in args or "-s" in args:
        if docker.is_daemon_running():
            print("Docker: Running")
            info = docker.get_info()
            for key, value in info.items():
                print(f"  {key}: {value}")
        else:
            print("Docker: Not running")
        return 0

    if "--containers" in args or "-c" in args:
        containers = docker.get_containers()
        if not containers:
            print("No containers")
            return 0
        print(f"{'NAME':<25} {'IMAGE':<25} {'STATUS':<20}")
        print("─" * 70)
        for c in containers:
            print(f"{c.name:<25} {c.image:<25} {c.status:<20}")
        return 0

    if "--images" in args or "-i" in args:
        images = docker.get_images()
        if not images:
            print("No images")
            return 0
        print(f"{'REPOSITORY':<30} {'TAG':<15} {'SIZE':<10}")
        print("─" * 55)
        for img in images:
            print(f"{img.repository:<30} {img.tag:<15} {img.size:<10}")
        return 0

    if "--prune" in args:
        all_images = "--all" in args or "-a" in args
        print("Pruning Docker system...")
        success, output = docker.prune_system(all_images=all_images)
        print(output)
        return 0 if success else 1

    print("Docker TUI - Usage:")
    print()
    print("  Without arguments: Launch interactive TUI")
    print()
    print("Headless options:")
    print("  --status, -s      Show Docker status")
    print("  --containers, -c  List containers")
    print("  --images, -i      List images")
    print("  --prune           Prune system (add --all for images)")
    print("  --help, -h        Show this help")

    return 0


def main() -> int:
    """Main entry point."""
    args = sys.argv[1:]

    # Check for headless mode
    headless_flags = {"--status", "-s", "--containers", "-c", "--images", "-i", "--prune", "--help", "-h"}
    if any(arg in headless_flags for arg in args):
        return run_headless(args)

    # Check if terminal supports curses
    if not sys.stdout.isatty():
        print("Error: TUI requires a terminal. Use --help for headless options.")
        return 1

    try:
        return curses.wrapper(main_curses)
    except curses.error as e:
        print(f"Error initializing TUI: {e}")
        print("Try running with --help for headless options.")
        return 1


if __name__ == "__main__":
    sys.exit(main())

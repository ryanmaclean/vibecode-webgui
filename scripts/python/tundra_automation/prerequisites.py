#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "tundra-prerequisites"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "tundra", "cluster": "tundra-dome"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation


# -- VibeCode Telemetry --
import sys
import os

# Initialize log aggregation
log_agg = get_log_aggregation()

try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
Prerequisites checker for Tundra Kubernetes development environment.

This module provides functionality to check for required tools (Docker, KIND,
kubectl, Helm), validate Docker Desktop is running with sufficient resources,
and optionally install missing tools via Homebrew on macOS.

Supports Apple Silicon (M1/M4) with /opt/homebrew/bin paths.
"""

# Datadog APM tracing - auto-detects local agent
import os

os.environ.setdefault("DD_SERVICE", "tundra-automation")
os.environ.setdefault("DD_ENV", "development")

try:
    from ddtrace import tracer, patch_all

    patch_all()
except ImportError:
    tracer = None

import json
import platform
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Optional


class ToolStatus(Enum):
    """Status of a required tool."""

    INSTALLED = "installed"
    NOT_INSTALLED = "not_installed"
    NOT_RUNNING = "not_running"
    INSUFFICIENT_RESOURCES = "insufficient_resources"
    ERROR = "error"


@dataclass
class ToolCheckResult:
    """Result of checking a single tool."""

    name: str
    status: ToolStatus
    version: Optional[str] = None
    path: Optional[str] = None
    message: Optional[str] = None
    details: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        """Convert to dictionary representation."""
        return {
            "name": self.name,
            "status": self.status.value,
            "version": self.version,
            "path": self.path,
            "message": self.message,
            "details": self.details,
        }


@dataclass
class PrerequisiteResult:
    """Overall result of prerequisite checks."""

    success: bool
    tools: dict[str, ToolCheckResult]
    issues: list[str]
    warnings: list[str]
    docker_resources: Optional[dict] = None

    def to_dict(self) -> dict:
        """Convert to dictionary representation."""
        return {
            "success": self.success,
            "tools": {name: result.to_dict() for name, result in self.tools.items()},
            "issues": self.issues,
            "warnings": self.warnings,
            "docker_resources": self.docker_resources,
        }


class PrerequisiteChecker:
    """
    Check and install prerequisites for Tundra Kubernetes development.

    Checks for required tools:
    - Docker (with Docker Desktop running)
    - KIND (Kubernetes IN Docker)
    - kubectl
    - Helm

    Supports installation via Homebrew on macOS, with proper handling
    of Apple Silicon paths.
    """

    # Required tools with their brew package names
    REQUIRED_TOOLS = {
        "docker": {"brew_name": "docker", "brew_cask": True},
        "kind": {"brew_name": "kind", "brew_cask": False},
        "kubectl": {"brew_name": "kubernetes-cli", "brew_cask": False},
        "helm": {"brew_name": "helm", "brew_cask": False},
    }

    # Minimum recommended Docker disk space in GB
    MIN_DOCKER_DISK_GB = 40

    def __init__(self, verbose: bool = False):
        """
        Initialize the prerequisite checker.

        Args:
            verbose: If True, print detailed progress information.
        """
        self.verbose = verbose
        self._setup_paths()

    def _setup_paths(self) -> None:
        """Set up PATH to include Homebrew locations for Apple Silicon."""
        # Apple Silicon Homebrew path
        homebrew_paths = [
            "/opt/homebrew/bin",  # Apple Silicon
            "/usr/local/bin",     # Intel Mac
        ]

        current_path = os.environ.get("PATH", "")
        path_parts = current_path.split(":")

        for brew_path in homebrew_paths:
            if brew_path not in path_parts and Path(brew_path).exists():
                path_parts.insert(0, brew_path)

        os.environ["PATH"] = ":".join(path_parts)

    def _log(self, message: str) -> None:
        """Print message if verbose mode is enabled."""
        if self.verbose:
            print(f"[prereq] {message}")

    def _run_command(
        self,
        cmd: list[str],
        timeout: int = 30,
        capture_output: bool = True,
    ) -> tuple[int, str, str]:
        """
        Run a command and return exit code, stdout, and stderr.

        Args:
            cmd: Command and arguments as a list.
            timeout: Timeout in seconds.
            capture_output: Whether to capture stdout/stderr.

        Returns:
            Tuple of (exit_code, stdout, stderr).
        """
        try:
            result = subprocess.run(
                cmd,
                capture_output=capture_output,
                text=True,
                timeout=timeout,
                env=os.environ,
            )
            return result.returncode, result.stdout.strip(), result.stderr.strip()
        except subprocess.TimeoutExpired:
            return -1, "", f"Command timed out after {timeout}s"
        except FileNotFoundError:
            return -1, "", f"Command not found: {cmd[0]}"
        except Exception as e:
            return -1, "", str(e)

    def _get_tool_version(self, tool: str) -> tuple[Optional[str], Optional[str]]:
        """
        Get the version of an installed tool.

        Args:
            tool: Name of the tool.

        Returns:
            Tuple of (version_string, tool_path) or (None, None) if not found.
        """
        version_commands = {
            "docker": ["docker", "--version"],
            "kind": ["kind", "version"],
            "kubectl": ["kubectl", "version", "--client", "--output=json"],
            "helm": ["helm", "version", "--short"],
        }

        cmd = version_commands.get(tool)
        if not cmd:
            return None, None

        # Find the tool path
        tool_path = shutil.which(cmd[0])
        if not tool_path:
            return None, None

        exit_code, stdout, stderr = self._run_command(cmd)
        if exit_code != 0:
            return None, tool_path

        # Parse version from output
        version = None
        if tool == "docker":
            # Docker version 24.0.6, build ed223bc
            match = re.search(r"Docker version ([\d.]+)", stdout)
            if match:
                version = match.group(1)
        elif tool == "kind":
            # kind v0.20.0 go1.20.5 darwin/arm64
            match = re.search(r"kind (v[\d.]+)", stdout)
            if match:
                version = match.group(1)
        elif tool == "kubectl":
            try:
                data = json.loads(stdout)
                version = data.get("clientVersion", {}).get("gitVersion", "")
            except json.JSONDecodeError:
                match = re.search(r"(v[\d.]+)", stdout)
                if match:
                    version = match.group(1)
        elif tool == "helm":
            # v3.12.3+g3a31588
            match = re.search(r"(v[\d.]+)", stdout)
            if match:
                version = match.group(1)

        return version, tool_path

    def check_docker_running(self) -> ToolCheckResult:
        """
        Check if Docker Desktop is installed and running.

        Returns:
            ToolCheckResult with status and details.
        """
        self._log("Checking Docker Desktop...")

        # First check if docker CLI is available
        version, path = self._get_tool_version("docker")

        if not path:
            return ToolCheckResult(
                name="docker",
                status=ToolStatus.NOT_INSTALLED,
                message="Docker CLI not found. Install Docker Desktop.",
            )

        # Check if Docker daemon is running by trying docker info
        exit_code, stdout, stderr = self._run_command(
            ["docker", "info", "--format", "{{.ServerVersion}}"],
            timeout=10,
        )

        if exit_code != 0:
            # Docker is installed but daemon is not running
            is_desktop_running = self._check_docker_desktop_process()
            if not is_desktop_running:
                return ToolCheckResult(
                    name="docker",
                    status=ToolStatus.NOT_RUNNING,
                    version=version,
                    path=path,
                    message="Docker Desktop is not running. Please start Docker Desktop.",
                )
            else:
                return ToolCheckResult(
                    name="docker",
                    status=ToolStatus.NOT_RUNNING,
                    version=version,
                    path=path,
                    message="Docker Desktop is starting or not responding. Please wait or restart Docker Desktop.",
                )

        return ToolCheckResult(
            name="docker",
            status=ToolStatus.INSTALLED,
            version=version,
            path=path,
            message="Docker is installed and running.",
            details={"server_version": stdout},
        )

    def _check_docker_desktop_process(self) -> bool:
        """Check if Docker Desktop process is running on macOS."""
        if platform.system() != "Darwin":
            return False

        exit_code, stdout, _ = self._run_command(
            ["pgrep", "-f", "Docker Desktop"]
        )
        return exit_code == 0 and bool(stdout)

    def check_tool(self, tool: str) -> ToolCheckResult:
        """
        Check if a specific tool is installed.

        Args:
            tool: Name of the tool to check.

        Returns:
            ToolCheckResult with status and details.
        """
        if tool == "docker":
            return self.check_docker_running()

        self._log(f"Checking {tool}...")
        version, path = self._get_tool_version(tool)

        if not path:
            return ToolCheckResult(
                name=tool,
                status=ToolStatus.NOT_INSTALLED,
                message=f"{tool} is not installed.",
            )

        return ToolCheckResult(
            name=tool,
            status=ToolStatus.INSTALLED,
            version=version,
            path=path,
            message=f"{tool} is installed.",
        )

    def check_all(self) -> PrerequisiteResult:
        """
        Check all required prerequisites.

        Returns:
            PrerequisiteResult with status of all tools and any issues.
        """
        self._log("Checking all prerequisites...")

        tools: dict[str, ToolCheckResult] = {}
        issues: list[str] = []
        warnings: list[str] = []

        # Check each required tool
        for tool in self.REQUIRED_TOOLS:
            result = self.check_tool(tool)
            tools[tool] = result

            if result.status == ToolStatus.NOT_INSTALLED:
                issues.append(f"{tool}: Not installed")
            elif result.status == ToolStatus.NOT_RUNNING:
                issues.append(f"{tool}: {result.message}")
            elif result.status == ToolStatus.ERROR:
                issues.append(f"{tool}: Error - {result.message}")

        # Check Docker resources if Docker is running
        docker_resources = None
        if tools["docker"].status == ToolStatus.INSTALLED:
            docker_resources = self.validate_docker_resources()
            if docker_resources.get("disk_space_gb", 0) < self.MIN_DOCKER_DISK_GB:
                warnings.append(
                    f"Docker disk space ({docker_resources.get('disk_space_gb', 0):.1f}GB) "
                    f"is below recommended {self.MIN_DOCKER_DISK_GB}GB"
                )

        success = len(issues) == 0

        return PrerequisiteResult(
            success=success,
            tools=tools,
            issues=issues,
            warnings=warnings,
            docker_resources=docker_resources,
        )

    def validate_docker_resources(self) -> dict:
        """
        Validate Docker has sufficient disk space.

        Returns:
            Dictionary with resource information including:
            - disk_space_gb: Available disk space in GB
            - disk_total_gb: Total disk space in GB
            - sufficient: Boolean indicating if space is sufficient
        """
        self._log("Validating Docker resources...")

        result = {
            "disk_space_gb": 0,
            "disk_total_gb": 0,
            "sufficient": False,
            "error": None,
        }

        # Get Docker system info
        exit_code, stdout, stderr = self._run_command(
            ["docker", "system", "df", "--format", "json"],
            timeout=30,
        )

        if exit_code != 0:
            result["error"] = f"Failed to get Docker disk info: {stderr}"
            return result

        # Parse Docker disk usage
        try:
            # docker system df --format json outputs one JSON object per line
            total_used_bytes = 0
            for line in stdout.strip().split("\n"):
                if line:
                    data = json.loads(line)
                    # Size is like "1.234GB" or "123.4MB"
                    size_str = data.get("Size", "0B")
                    total_used_bytes += self._parse_size_to_bytes(size_str)
        except (json.JSONDecodeError, KeyError) as e:
            result["error"] = f"Failed to parse Docker disk info: {e}"

        # Get Docker root directory info
        exit_code, stdout, stderr = self._run_command(
            ["docker", "info", "--format", "{{.DockerRootDir}}"],
            timeout=10,
        )

        if exit_code == 0 and stdout:
            docker_root = Path(stdout)
            try:
                # Get filesystem stats for Docker root
                import shutil as sh
                total, used, free = sh.disk_usage(docker_root.parent)
                result["disk_total_gb"] = total / (1024**3)
                result["disk_space_gb"] = free / (1024**3)
                result["sufficient"] = result["disk_space_gb"] >= self.MIN_DOCKER_DISK_GB
            except OSError as e:
                result["error"] = f"Failed to get disk usage: {e}"

        return result

    def _parse_size_to_bytes(self, size_str: str) -> int:
        """Parse a size string like '1.234GB' to bytes."""
        units = {
            "B": 1,
            "KB": 1024,
            "MB": 1024**2,
            "GB": 1024**3,
            "TB": 1024**4,
        }

        match = re.match(r"([\d.]+)\s*([KMGT]?B)", size_str, re.IGNORECASE)
        if not match:
            return 0

        value = float(match.group(1))
        unit = match.group(2).upper()
        return int(value * units.get(unit, 1))

    def check_homebrew(self) -> bool:
        """Check if Homebrew is installed."""
        return shutil.which("brew") is not None

    def install_tool(self, tool: str) -> tuple[bool, str]:
        """
        Install a tool via Homebrew.

        Args:
            tool: Name of the tool to install.

        Returns:
            Tuple of (success, message).
        """
        if platform.system() != "Darwin":
            return False, "Installation via Homebrew is only supported on macOS."

        if not self.check_homebrew():
            return False, "Homebrew is not installed. Please install Homebrew first."

        tool_config = self.REQUIRED_TOOLS.get(tool)
        if not tool_config:
            return False, f"Unknown tool: {tool}"

        brew_name = tool_config["brew_name"]
        is_cask = tool_config["brew_cask"]

        self._log(f"Installing {tool} via Homebrew...")

        if is_cask:
            cmd = ["brew", "install", "--cask", brew_name]
        else:
            cmd = ["brew", "install", brew_name]

        exit_code, stdout, stderr = self._run_command(
            cmd,
            timeout=300,  # 5 minutes for installation
            capture_output=True,
        )

        if exit_code == 0:
            return True, f"Successfully installed {tool}"
        else:
            return False, f"Failed to install {tool}: {stderr}"

    def install_missing(self) -> dict[str, tuple[bool, str]]:
        """
        Install all missing tools via Homebrew.

        Returns:
            Dictionary mapping tool name to (success, message) tuple.
        """
        results: dict[str, tuple[bool, str]] = {}

        # First check what's missing
        check_result = self.check_all()

        for tool, tool_result in check_result.tools.items():
            if tool_result.status == ToolStatus.NOT_INSTALLED:
                results[tool] = self.install_tool(tool)
            elif tool_result.status == ToolStatus.NOT_RUNNING and tool == "docker":
                results[tool] = (
                    False,
                    "Docker is installed but not running. Please start Docker Desktop manually.",
                )
            else:
                results[tool] = (True, f"{tool} is already installed")

        return results

    def get_missing_tools(self) -> list[str]:
        """Get list of tools that are not installed."""
        missing = []
        for tool in self.REQUIRED_TOOLS:
            result = self.check_tool(tool)
            if result.status == ToolStatus.NOT_INSTALLED:
                missing.append(tool)
        return missing


def main():
    """Main entry point for CLI usage."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Check prerequisites for Tundra Kubernetes development environment",
    )
    parser.add_argument(
        "--check-only",
        action="store_true",
        help="Only check prerequisites, don't install missing tools",
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable verbose output",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON",
    )

    args = parser.parse_args()

    checker = PrerequisiteChecker(verbose=args.verbose)
    result = checker.check_all()

    if args.json:
        print(json.dumps(result.to_dict(), indent=2))
        sys.exit(0 if result.success else 1)

    # Print human-readable output
    print("\n=== Tundra Prerequisites Check ===\n")

    for name, tool_result in result.tools.items():
        status_icon = {
            ToolStatus.INSTALLED: "[OK]",
            ToolStatus.NOT_INSTALLED: "[MISSING]",
            ToolStatus.NOT_RUNNING: "[NOT RUNNING]",
            ToolStatus.ERROR: "[ERROR]",
            ToolStatus.INSUFFICIENT_RESOURCES: "[WARNING]",
        }.get(tool_result.status, "[?]")

        version_str = f" ({tool_result.version})" if tool_result.version else ""
        print(f"  {status_icon} {name}{version_str}")
        if tool_result.path:
            print(f"       Path: {tool_result.path}")
        if tool_result.message and tool_result.status != ToolStatus.INSTALLED:
            print(f"       {tool_result.message}")

    # Docker resources
    if result.docker_resources:
        print("\n=== Docker Resources ===\n")
        res = result.docker_resources
        if res.get("error"):
            print(f"  Error: {res['error']}")
        else:
            print(f"  Disk Space Available: {res.get('disk_space_gb', 0):.1f} GB")
            print(f"  Disk Space Total: {res.get('disk_total_gb', 0):.1f} GB")
            sufficient = res.get("sufficient", False)
            status = "[OK]" if sufficient else "[WARNING]"
            print(f"  Status: {status} (Recommended: {PrerequisiteChecker.MIN_DOCKER_DISK_GB}+ GB)")

    # Issues and warnings
    if result.issues:
        print("\n=== Issues ===\n")
        for issue in result.issues:
            print(f"  - {issue}")

    if result.warnings:
        print("\n=== Warnings ===\n")
        for warning in result.warnings:
            print(f"  - {warning}")

    # Offer to install missing tools
    if not args.check_only and result.issues:
        missing = checker.get_missing_tools()
        if missing and platform.system() == "Darwin":
            print(f"\n=== Missing Tools: {', '.join(missing)} ===")
            response = input("\nWould you like to install missing tools via Homebrew? [y/N]: ")
            if response.lower() in ("y", "yes"):
                install_results = checker.install_missing()
                print("\n=== Installation Results ===\n")
                for tool, (success, msg) in install_results.items():
                    status = "[OK]" if success else "[FAILED]"
                    print(f"  {status} {tool}: {msg}")

    # Final status
    print("\n" + "=" * 40)
    if result.success:
        print("All prerequisites are satisfied!")
        sys.exit(0)
    else:
        print("Prerequisites check failed. Please resolve the issues above.")
        sys.exit(1)


# Backward compatibility alias (some code uses PrerequisitesChecker with 's')
PrerequisitesChecker = PrerequisiteChecker


if __name__ == "__main__":
    main()
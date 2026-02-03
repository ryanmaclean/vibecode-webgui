#!/usr/bin/env python3
"""Quick verification script for VibeCode setup.

Checks that all major components are properly configured.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional


@dataclass
class VerificationStats:
    """Verification statistics."""

    pass_count: int = 0
    fail_count: int = 0

    @property
    def total(self) -> int:
        """Get total number of checks."""
        return self.pass_count + self.fail_count


@dataclass
class VerificationConfig:
    """Verification configuration."""

    project_root: Path

    @classmethod
    def from_cwd(cls) -> "VerificationConfig":
        """Create config from current working directory."""
        return cls(project_root=Path.cwd())


def get_command_version(command: str) -> Optional[str]:
    """Get version output from a command.

    Args:
        command: Command to run with --version.

    Returns:
        Version string if successful, None otherwise.
    """
    try:
        result = subprocess.run(
            [command, "--version"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0:
            return result.stdout.strip().split("\n")[0]
    except (subprocess.TimeoutExpired, subprocess.SubprocessError, FileNotFoundError):
        pass
    return None


def check_file_exists(path: Path) -> bool:
    """Check if a file exists.

    Args:
        path: Path to check.

    Returns:
        True if file exists, False otherwise.
    """
    return path.is_file()


def check_dir_exists(path: Path) -> bool:
    """Check if a directory exists.

    Args:
        path: Path to check.

    Returns:
        True if directory exists, False otherwise.
    """
    return path.is_dir()


def check_file_executable(path: Path) -> bool:
    """Check if a file is executable.

    Args:
        path: Path to check.

    Returns:
        True if file is executable, False otherwise.
    """
    return path.is_file() and os.access(path, os.X_OK)


def check_package_json_contains(project_root: Path, pattern: str) -> bool:
    """Check if package.json contains a pattern.

    Args:
        project_root: Project root directory.
        pattern: Pattern to search for.

    Returns:
        True if pattern found, False otherwise.
    """
    package_json = project_root / "package.json"
    if not package_json.exists():
        return False

    try:
        content = package_json.read_text()
        return pattern in content
    except OSError:
        return False


class SetupVerifier:
    """Verifies VibeCode setup."""

    def __init__(self, config: VerificationConfig) -> None:
        """Initialize verifier.

        Args:
            config: Verification configuration.
        """
        self.config = config
        self.stats = VerificationStats()

    def check(self, name: str, check_fn: Callable[[], tuple[bool, str]]) -> bool:
        """Run a verification check.

        Args:
            name: Name of the check.
            check_fn: Function that returns (passed, result_text).

        Returns:
            True if check passed, False otherwise.
        """
        print(f"\u2713 {name}: ", end="", flush=True)

        try:
            passed, result = check_fn()
        except Exception as e:
            passed = False
            result = str(e)

        if passed:
            print(result)
            self.stats.pass_count += 1
        else:
            print(result)
            self.stats.fail_count += 1

        return passed

    def check_node_version(self) -> tuple[bool, str]:
        """Check Node.js version."""
        version = get_command_version("node")
        if version:
            return True, version
        return False, "not found"

    def check_npm_version(self) -> tuple[bool, str]:
        """Check npm version."""
        version = get_command_version("npm")
        if version:
            return True, version
        return False, "not found"

    def check_node_modules(self) -> tuple[bool, str]:
        """Check node_modules exists."""
        if check_dir_exists(self.config.project_root / "node_modules"):
            return True, "yes"
        return False, "no"

    def check_monaco_editor(self) -> tuple[bool, str]:
        """Check Monaco Editor 0.53.0."""
        if check_package_json_contains(self.config.project_root, '"monaco-editor": "0.53.0"'):
            return True, "yes"
        return False, "no"

    def check_monacopilot(self) -> tuple[bool, str]:
        """Check Monacopilot installed."""
        if check_package_json_contains(self.config.project_root, '"monacopilot"'):
            return True, "yes"
        return False, "no"

    def check_mcp_sdk(self) -> tuple[bool, str]:
        """Check MCP SDK installed."""
        if check_package_json_contains(self.config.project_root, "@modelcontextprotocol/sdk"):
            return True, "yes"
        return False, "no"

    def check_mcp_server_exists(self) -> tuple[bool, str]:
        """Check MCP server exists."""
        if check_file_exists(self.config.project_root / "src" / "mcp" / "server.ts"):
            return True, "yes"
        return False, "no"

    def check_mcp_server_executable(self) -> tuple[bool, str]:
        """Check MCP server executable."""
        if check_file_executable(self.config.project_root / "src" / "mcp" / "server.ts"):
            return True, "yes"
        return False, "no"

    def check_pydantic_ai_example(self) -> tuple[bool, str]:
        """Check Pydantic AI example exists."""
        path = self.config.project_root / "examples" / "pydantic-ai-cli-agent" / "agent.py"
        if check_file_exists(path):
            return True, "yes"
        return False, "no"

    def check_mcp_documentation(self) -> tuple[bool, str]:
        """Check MCP documentation exists."""
        if check_file_exists(self.config.project_root / "docs" / "MCP_INTEGRATION.md"):
            return True, "yes"
        return False, "no"

    def check_monacopilot_docs(self) -> tuple[bool, str]:
        """Check Monacopilot docs exist."""
        if check_file_exists(self.config.project_root / "docs" / "MONACOPILOT_INTEGRATION.md"):
            return True, "yes"
        return False, "no"

    def check_monaco_verification_script(self) -> tuple[bool, str]:
        """Check Monaco verification script."""
        if check_file_exists(self.config.project_root / "scripts" / "verify-monacopilot.js"):
            return True, "yes"
        return False, "no"

    def check_monaco_version_lock(self) -> tuple[bool, str]:
        """Check Monaco version lock exists."""
        if check_file_exists(self.config.project_root / ".monaco-version-lock"):
            return True, "yes"
        return False, "no"

    def run(self) -> int:
        """Run all verification checks.

        Returns:
            Exit code (0 for success, 1 for failure).
        """
        print("\U0001f50d VibeCode Setup Verification")
        print("==============================")
        print()

        # Run all checks
        self.check("Node.js version", self.check_node_version)
        self.check("npm version", self.check_npm_version)
        self.check("node_modules exists", self.check_node_modules)
        self.check("Monaco Editor 0.53.0", self.check_monaco_editor)
        self.check("Monacopilot installed", self.check_monacopilot)
        self.check("MCP SDK installed", self.check_mcp_sdk)
        self.check("MCP server exists", self.check_mcp_server_exists)
        self.check("MCP server executable", self.check_mcp_server_executable)
        self.check("Pydantic AI example exists", self.check_pydantic_ai_example)
        self.check("MCP documentation exists", self.check_mcp_documentation)
        self.check("Monacopilot docs exist", self.check_monacopilot_docs)
        self.check("Monaco verification script", self.check_monaco_verification_script)
        self.check("Monaco version lock exists", self.check_monaco_version_lock)

        # Print results
        print()
        print("==============================")
        print(f"Results: {self.stats.pass_count} passed, {self.stats.fail_count} failed")
        print()

        if self.stats.fail_count == 0:
            print("\u2705 All checks passed! Setup is complete.")
            return 0
        else:
            print("\u26a0\ufe0f  Some checks failed. Review the output above.")
            return 1


def verify_setup(config: Optional[VerificationConfig] = None) -> int:
    """Run setup verification.

    Args:
        config: Verification configuration (uses cwd if None).

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    if config is None:
        config = VerificationConfig.from_cwd()

    verifier = SetupVerifier(config)
    return verifier.run()


def main() -> int:
    """Main entry point."""
    return verify_setup()


if __name__ == "__main__":
    sys.exit(main())

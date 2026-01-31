#!/usr/bin/env python3
"""
AI Tools Verification Script

Verifies that all AI coding tools are installed and accessible.

Usage:
    python verify_ai_tools.py
"""

import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from typing import Optional


@dataclass
class ToolStatus:
    """Status of a tool installation."""
    name: str
    installed: bool
    version: Optional[str] = None


def check_command_exists(cmd: str) -> bool:
    """Check if a command exists in PATH."""
    return shutil.which(cmd) is not None


def get_command_version(cmd: str, version_arg: str = "--version") -> Optional[str]:
    """Get the version of a command."""
    try:
        result = subprocess.run(
            [cmd, version_arg],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0:
            return result.stdout.strip() or result.stderr.strip() or "installed"
        return "installed"
    except (subprocess.TimeoutExpired, FileNotFoundError, PermissionError):
        return None


def check_npm_package_installed(package: str) -> bool:
    """Check if an npm package is globally installed."""
    try:
        result = subprocess.run(
            ["npm", "list", "-g", package],
            capture_output=True,
            timeout=30,
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False


def check_env_var_set(var: str) -> bool:
    """Check if an environment variable is set."""
    return bool(os.environ.get(var))


def check_nodejs_ai_tools() -> list[ToolStatus]:
    """Check Node.js AI tools."""
    tools = [
        ("claude", "Claude Code CLI"),
        ("codex", "OpenAI Codex CLI"),
        ("coder", "just-every/code Fork"),
        ("gemini", "Google Gemini CLI"),
    ]

    results = []
    for cmd, name in tools:
        installed = check_command_exists(cmd)
        version = get_command_version(cmd) if installed else None
        results.append(ToolStatus(name=name, installed=installed, version=version))

    return results


def check_npm_packages() -> list[ToolStatus]:
    """Check npm packages."""
    packages = [
        ("@anthropic-ai/claude-code", "@anthropic-ai/claude-code"),
        ("@openai/codex", "@openai/codex"),
        ("@just-every/code", "@just-every/code"),
        ("@google/gemini-cli", "@google/gemini-cli"),
    ]

    results = []
    for package, name in packages:
        installed = check_npm_package_installed(package)
        results.append(ToolStatus(name=name, installed=installed))

    return results


def check_python_ai_tools() -> list[ToolStatus]:
    """Check Python AI tools."""
    tools = [
        ("aider", "Aider"),
    ]

    results = []
    for cmd, name in tools:
        installed = check_command_exists(cmd)
        version = get_command_version(cmd) if installed else None
        results.append(ToolStatus(name=name, installed=installed, version=version))

    return results


def check_api_keys() -> dict[str, bool]:
    """Check API key environment variables."""
    keys = [
        "ANTHROPIC_API_KEY",
        "OPENAI_API_KEY",
        "GOOGLE_API_KEY",
        "OPENCODE_API_KEY",
    ]

    return {key: check_env_var_set(key) for key in keys}


def print_tool_status(status: ToolStatus, prefix: str = "") -> None:
    """Print the status of a tool."""
    if status.installed:
        version_info = f": {status.version}" if status.version else ""
        print(f"✅ {status.name}{version_info}")
    else:
        print(f"❌ {status.name}: not found")


def run_verification() -> None:
    """Run the AI tools verification."""
    print("🤖 AI Coding Tools Verification")
    print("================================")

    # Check Node.js tools
    print("\n📦 Checking Node.js AI Tools...")
    for status in check_nodejs_ai_tools():
        print_tool_status(status)

    # Check npm packages
    print("\n📋 Checking npm packages...")
    for status in check_npm_packages():
        print_tool_status(status)

    # Check Python tools
    print("\n🐍 Checking Python AI Tools...")
    for status in check_python_ai_tools():
        print_tool_status(status)

    # Check API keys
    print("\n🔑 Checking API Key Environment Variables...")
    for key, is_set in check_api_keys().items():
        if is_set:
            print(f"✅ {key}: set")
        else:
            print(f"⚠️  {key}: not set")

    # Print usage examples
    print("\n🎯 Usage Examples:")
    print("  claude --help                    # Claude Code CLI")
    print("  codex --help                    # OpenAI Codex CLI")
    print("  coder --help                    # just-every/code Fork")
    print("  gemini --help                   # Google Gemini CLI")
    print("  aider --help                    # Aider AI assistant")

    print("\n💡 To set API keys:")
    print("  export ANTHROPIC_API_KEY='your-key-here'")
    print("  export OPENAI_API_KEY='your-key-here'")
    print("  export GOOGLE_API_KEY='your-key-here'")
    print("  export OPENCODE_API_KEY='your-key-here'")


def main() -> int:
    """Main entry point."""
    run_verification()
    return 0


if __name__ == "__main__":
    sys.exit(main())

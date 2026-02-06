#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "install-claude-code-cli"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "scripts"})
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
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), './')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
Claude Code CLI Installation Script for VibeCode Platform

Converts install-claude-code-cli.sh to Python with proper type hints.

License: Apache 2.0
Version: 1.0.0
"""

import json
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional


# ANSI colors
class Colors:
    RED: str = "\033[0;31m"
    GREEN: str = "\033[0;32m"
    YELLOW: str = "\033[1;33m"
    BLUE: str = "\033[0;34m"
    NC: str = "\033[0m"


@dataclass
class InstallConfig:
    """Installation configuration."""
    cli_version: str = "1.0.0"
    install_dir: Path = Path("/opt/vibecode/ai-cli-tools/claude-code")
    config_dir: Path = Path("/etc/vibecode/claude-code")
    log_file: Path = Path("/var/log/vibecode/claude-code-cli-install.log")


# Default configuration
CONFIG = InstallConfig()


def timestamp() -> str:
    """Get current timestamp for logging."""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def log(message: str, log_file: Optional[Path] = None) -> None:
    """Log an info message."""
    formatted = f"{Colors.GREEN}[{timestamp()}] {message}{Colors.NC}"
    print(formatted)
    if log_file and log_file.exists():
        with open(log_file, "a") as f:
            f.write(f"[{timestamp()}] {message}\n")


def warn(message: str, log_file: Optional[Path] = None) -> None:
    """Log a warning message."""
    formatted = f"{Colors.YELLOW}[{timestamp()}] WARNING: {message}{Colors.NC}"
    print(formatted)
    if log_file and log_file.exists():
        with open(log_file, "a") as f:
            f.write(f"[{timestamp()}] WARNING: {message}\n")


def error(message: str, log_file: Optional[Path] = None) -> None:
    """Log an error message and exit."""
    formatted = f"{Colors.RED}[{timestamp()}] ERROR: {message}{Colors.NC}"
    print(formatted, file=sys.stderr)
    if log_file and log_file.exists():
        with open(log_file, "a") as f:
            f.write(f"[{timestamp()}] ERROR: {message}\n")
    sys.exit(1)


def is_root() -> bool:
    """Check if running as root."""
    return os.geteuid() == 0


def command_exists(cmd: str) -> bool:
    """Check if a command exists on the system."""
    return shutil.which(cmd) is not None


def run_command(
    cmd: list[str],
    capture: bool = True,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    """Run a shell command."""
    return subprocess.run(
        cmd,
        capture_output=capture,
        text=True,
        check=check,
    )


def get_python_version() -> Optional[str]:
    """Get the Python version string."""
    try:
        result = run_command(["python3", "--version"])
        return result.stdout.strip().split()[1]
    except Exception:
        return None


def check_python_version_compatible() -> bool:
    """Check if Python version is 3.8 or higher."""
    return sys.version_info >= (3, 8)


def check_prerequisites(config: InstallConfig) -> bool:
    """
    Check all prerequisites for installation.

    Args:
        config: Installation configuration

    Returns:
        True if all prerequisites are met
    """
    log("Checking prerequisites...", config.log_file)

    # Check root privileges
    if is_root():
        log("Running with root privileges", config.log_file)
    else:
        warn("Not running as root. Some operations may require sudo.", config.log_file)

    # Check Python version
    if command_exists("python3"):
        python_version = get_python_version()
        log(f"Python3 version: {python_version}", config.log_file)

        if check_python_version_compatible():
            log("Python version is compatible", config.log_file)
        else:
            error("Python 3.8 or higher is required", config.log_file)
            return False
    else:
        error("Python3 is not installed", config.log_file)
        return False

    # Check pip
    if command_exists("pip3"):
        log("pip3 is available", config.log_file)
    else:
        error("pip3 is not installed", config.log_file)
        return False

    # Check curl
    if command_exists("curl"):
        log("curl is available", config.log_file)
    else:
        error("curl is not installed", config.log_file)
        return False

    return True


def create_directories(config: InstallConfig) -> bool:
    """
    Create installation directories.

    Args:
        config: Installation configuration

    Returns:
        True if directories created successfully
    """
    log("Creating installation directories...", config.log_file)

    try:
        # Create directories with sudo
        for directory in [config.install_dir, config.config_dir, config.log_file.parent]:
            run_command(["sudo", "mkdir", "-p", str(directory)])

        # Set permissions
        user = os.environ.get("USER", "root")
        run_command(["sudo", "chown", "-R", f"{user}:{user}", str(config.install_dir)])
        run_command(["sudo", "chmod", "755", str(config.install_dir)])
        run_command(["sudo", "chmod", "755", str(config.config_dir)])

        log("Directories created successfully", config.log_file)
        return True
    except subprocess.CalledProcessError as e:
        error(f"Failed to create directories: {e}", config.log_file)
        return False


def install_anthropic_sdk(config: InstallConfig) -> bool:
    """
    Install the Anthropic Python SDK.

    Args:
        config: Installation configuration

    Returns:
        True if SDK installed successfully
    """
    log("Installing Anthropic Python SDK...", config.log_file)

    try:
        run_command(["pip3", "install", "--user", "anthropic"])

        # Verify installation
        result = run_command(
            ["python3", "-c", "import anthropic; print('OK')"],
            check=False,
        )

        if result.returncode == 0:
            log("Anthropic SDK installed successfully", config.log_file)
            return True
        else:
            error("Failed to install Anthropic SDK", config.log_file)
            return False
    except subprocess.CalledProcessError as e:
        error(f"Failed to install Anthropic SDK: {e}", config.log_file)
        return False


def get_claude_cli_content() -> str:
    """Get the Claude Code CLI wrapper script content."""
    return '''#!/usr/bin/env python3
"""
Claude Code CLI for VibeCode Platform
A command-line interface for Anthropic's Claude models
"""

import argparse
import os
import sys
from typing import Optional

# Setup Datadog LLM Observability if enabled
try:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, script_dir)
    from datadog_python_setup import setup_datadog_llmobs
    setup_datadog_llmobs()
except ImportError:
    try:
        from ddtrace import patch_all
        from ddtrace.llmobs import LLMObs
        if os.getenv('DD_LLMOBS_ENABLED') == '1':
            patch_all()
            LLMObs.enable(
                ml_app=os.getenv('DD_LLMOBS_ML_APP', 'vibecode-ai'),
                agentless_enabled=True,
                api_key=os.getenv('DD_API_KEY'),
                site=os.getenv('DD_SITE', 'datadoghq.com')
            )
    except ImportError:
        pass

import anthropic


class ClaudeCodeCLI:
    """Claude Code CLI client."""

    def __init__(self, api_key: Optional[str] = None) -> None:
        """Initialize Claude Code CLI with API key."""
        self.api_key = api_key or os.getenv('ANTHROPIC_API_KEY')
        if not self.api_key:
            raise ValueError(
                "Anthropic API key is required. "
                "Set ANTHROPIC_API_KEY environment variable or pass --api-key"
            )

        self.client = anthropic.Anthropic(api_key=self.api_key)
        self.model = "claude-3-sonnet"

    def set_model(self, model_name: str = "claude-3-sonnet") -> bool:
        """Set the model to use."""
        try:
            self.model = model_name
            return True
        except Exception as e:
            print(f"Error setting model {model_name}: {e}")
            return False

    def generate_code(self, prompt: str, language: str = "python") -> str:
        """Generate code based on prompt."""
        try:
            full_prompt = (
                f"Generate {language} code for the following request: {prompt}\\n\\n"
                "Provide only the code without explanations:"
            )
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                temperature=0.7,
                system=f"You are a {language} expert. Generate only code without explanations.",
                messages=[{"role": "user", "content": full_prompt}]
            )
            return response.content[0].text
        except Exception as e:
            return f"Error generating code: {e}"

    def explain_code(self, code: str, language: str = "python") -> str:
        """Explain the provided code."""
        try:
            prompt = f"Explain this {language} code in detail:\\n\\n{code}"
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                temperature=0.7,
                system=f"You are a {language} expert. Explain the provided code in detail.",
                messages=[{"role": "user", "content": prompt}]
            )
            return response.content[0].text
        except Exception as e:
            return f"Error explaining code: {e}"

    def optimize_code(self, code: str, language: str = "python") -> str:
        """Optimize the provided code."""
        try:
            prompt = (
                f"Optimize this {language} code for better performance, "
                f"readability, and best practices:\\n\\n{code}\\n\\n"
                "Provide only the optimized code:"
            )
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                temperature=0.7,
                system=(
                    f"You are a {language} expert. "
                    "Optimize the provided code and return only the optimized code."
                ),
                messages=[{"role": "user", "content": prompt}]
            )
            return response.content[0].text
        except Exception as e:
            return f"Error optimizing code: {e}"

    def chat(self, message: str) -> str:
        """Chat with Claude."""
        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                temperature=0.7,
                messages=[{"role": "user", "content": message}]
            )
            return response.content[0].text
        except Exception as e:
            return f"Error in chat: {e}"


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Claude Code CLI for VibeCode Platform")
    parser.add_argument("--api-key", help="Anthropic API key")
    parser.add_argument("--model", default="claude-3-sonnet", help="Model to use")
    parser.add_argument("--language", default="python", help="Programming language")

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    gen_parser = subparsers.add_parser("generate", help="Generate code")
    gen_parser.add_argument("prompt", help="Code generation prompt")

    explain_parser = subparsers.add_parser("explain", help="Explain code")
    explain_parser.add_argument("code", help="Code to explain")

    optimize_parser = subparsers.add_parser("optimize", help="Optimize code")
    optimize_parser.add_argument("code", help="Code to optimize")

    chat_parser = subparsers.add_parser("chat", help="Chat with Claude")
    chat_parser.add_argument("message", help="Message to send")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 0

    try:
        cli = ClaudeCodeCLI(args.api_key)
        cli.set_model(args.model)

        if args.command == "generate":
            print(cli.generate_code(args.prompt, args.language))
        elif args.command == "explain":
            print(cli.explain_code(args.code, args.language))
        elif args.command == "optimize":
            print(cli.optimize_code(args.code, args.language))
        elif args.command == "chat":
            print(cli.chat(args.message))

        return 0
    except Exception as e:
        print(f"Error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
'''


def create_claude_cli(config: InstallConfig) -> bool:
    """
    Create the Claude Code CLI wrapper script.

    Args:
        config: Installation configuration

    Returns:
        True if CLI created successfully
    """
    log("Creating Claude Code CLI wrapper...", config.log_file)

    try:
        cli_path = config.install_dir / "claude-code"

        # Write the CLI script
        cli_path.write_text(get_claude_cli_content())

        # Make executable
        cli_path.chmod(0o755)

        # Create symlink
        run_command([
            "sudo", "ln", "-sf",
            str(cli_path),
            "/usr/local/bin/claude-code"
        ])

        log("Claude Code CLI wrapper created successfully", config.log_file)
        return True
    except Exception as e:
        error(f"Failed to create Claude CLI: {e}", config.log_file)
        return False


def get_config_content() -> dict[str, object]:
    """Get the default configuration content."""
    return {
        "default_model": "claude-3-sonnet",
        "available_models": [
            "claude-3-opus",
            "claude-3-sonnet",
            "claude-3-haiku"
        ],
        "default_language": "python",
        "supported_languages": [
            "python", "javascript", "typescript", "java",
            "cpp", "csharp", "go", "rust", "php", "ruby"
        ],
        "max_tokens": 4096,
        "temperature": 0.7,
        "timeout": 30
    }


def create_config(config: InstallConfig) -> bool:
    """
    Create the configuration file.

    Args:
        config: Installation configuration

    Returns:
        True if config created successfully
    """
    log("Creating configuration file...", config.log_file)

    try:
        config_path = config.config_dir / "config.json"
        config_content = get_config_content()

        config_path.write_text(json.dumps(config_content, indent=2))

        log("Configuration file created successfully", config.log_file)
        return True
    except Exception as e:
        error(f"Failed to create config: {e}", config.log_file)
        return False


def get_uninstall_script_content(config: InstallConfig) -> str:
    """Get the uninstall script content."""
    return f'''#!/bin/bash
# Uninstall script for Claude Code CLI

set -e

INSTALL_DIR="{config.install_dir}"
CONFIG_DIR="{config.config_dir}"

echo "Uninstalling Claude Code CLI..."

sudo rm -f /usr/local/bin/claude-code
sudo rm -rf "$INSTALL_DIR"
sudo rm -rf "$CONFIG_DIR"
pip3 uninstall -y anthropic

echo "Claude Code CLI uninstalled successfully"
'''


def create_uninstall_script(config: InstallConfig) -> bool:
    """
    Create the uninstall script.

    Args:
        config: Installation configuration

    Returns:
        True if script created successfully
    """
    log("Creating uninstall script...", config.log_file)

    try:
        uninstall_path = config.install_dir / "uninstall.sh"
        uninstall_path.write_text(get_uninstall_script_content(config))
        uninstall_path.chmod(0o755)

        log("Uninstall script created successfully", config.log_file)
        return True
    except Exception as e:
        error(f"Failed to create uninstall script: {e}", config.log_file)
        return False


def test_installation(config: InstallConfig) -> bool:
    """
    Test the installation.

    Args:
        config: Installation configuration

    Returns:
        True if tests pass
    """
    log("Testing installation...", config.log_file)

    # Check if CLI is accessible
    if command_exists("claude-code"):
        log("Claude Code CLI is accessible", config.log_file)
    else:
        error("Claude Code CLI is not accessible", config.log_file)
        return False

    # Test Python import
    result = run_command(
        ["python3", "-c", "import anthropic; print('OK')"],
        check=False,
    )

    if result.returncode == 0:
        log("Anthropic SDK import test passed", config.log_file)
    else:
        error("Anthropic SDK import test failed", config.log_file)
        return False

    log("Installation test completed successfully", config.log_file)
    return True


def display_usage(config: InstallConfig) -> None:
    """Display usage information."""
    print(f"{Colors.BLUE}")
    print("Claude Code CLI Installation Complete!")
    print("====================================")
    print()
    print(f"Installation Directory: {config.install_dir}")
    print(f"Configuration Directory: {config.config_dir}")
    print(f"Log File: {config.log_file}")
    print()
    print("Usage Examples:")
    print("===============")
    print()
    print("1. Generate Python code:")
    print("   claude-code generate 'Create a fibonacci function' --language python")
    print()
    print("2. Explain code:")
    print("   claude-code explain 'def fib(n): return n if n < 2 else fib(n-1) + fib(n-2)'")
    print()
    print("3. Optimize code:")
    print("   claude-code optimize 'def fib(n): return n if n < 2 else fib(n-1) + fib(n-2)'")
    print()
    print("4. Chat with Claude:")
    print("   claude-code chat 'What are Python best practices?'")
    print()
    print("Configuration:")
    print("==============")
    print("Set your Anthropic API key:")
    print("   export ANTHROPIC_API_KEY='your-api-key-here'")
    print()
    print(f"Or edit: {config.config_dir}/config.json")
    print()
    print("Uninstall:")
    print("==========")
    print(f"   {config.install_dir}/uninstall.sh")
    print(f"{Colors.NC}")


def main() -> int:
    """
    Main installation function.

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    print(f"{Colors.BLUE}Claude Code CLI Installation for VibeCode Platform{Colors.NC}")
    print("=======================================================")
    print()

    config = InstallConfig()

    # Create log file directory
    try:
        run_command(["sudo", "mkdir", "-p", str(config.log_file.parent)])
        run_command(["sudo", "touch", str(config.log_file)])
        user = os.environ.get("USER", "root")
        run_command(["sudo", "chown", f"{user}:{user}", str(config.log_file)])
    except subprocess.CalledProcessError:
        warn("Could not create log file, continuing without logging")

    log("Starting Claude Code CLI installation...", config.log_file)

    # Run installation steps
    steps: list[tuple[str, callable]] = [
        ("Prerequisites", lambda: check_prerequisites(config)),
        ("Directories", lambda: create_directories(config)),
        ("Anthropic SDK", lambda: install_anthropic_sdk(config)),
        ("CLI Wrapper", lambda: create_claude_cli(config)),
        ("Configuration", lambda: create_config(config)),
        ("Uninstall Script", lambda: create_uninstall_script(config)),
        ("Testing", lambda: test_installation(config)),
    ]

    for step_name, step_func in steps:
        if not step_func():
            error(f"Installation failed at step: {step_name}", config.log_file)
            return 1

    log("Claude Code CLI installation completed successfully!", config.log_file)
    display_usage(config)

    return 0


if __name__ == "__main__":
    sys.exit(main())
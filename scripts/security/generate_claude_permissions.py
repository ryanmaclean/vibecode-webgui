#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "generate_claude_permissions"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "security"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
try:
    from scripts.lib.log_aggregation import get_log_aggregation
    log_agg = get_log_aggregation()
except (ImportError, ValueError):
    log_agg = None


# -- VibeCode Telemetry --
import sys
import os

try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except (ImportError, ValueError):
    tracer = None
# ------------------------

"""
Claude Code Permission Generation Script

Generates granular Bash permissions from .auto-claude-security.json.
Replaces the insecure Bash(*) wildcard with specific command permissions.

Usage:
    python generate_claude_permissions.py --dry-run
    python generate_claude_permissions.py --output .claude_settings.new.json
    python generate_claude_permissions.py --security-file custom_security.json --dry-run
"""

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional


class Color:
    """ANSI color codes."""
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'


@dataclass
class GenerationResult:
    """Result of permission generation."""
    success: bool
    total_permissions: int = 0
    base_commands: int = 0
    stack_commands: int = 0
    permissions: list[str] = field(default_factory=list)
    error: Optional[str] = None


def print_status(status: str, message: str) -> None:
    """Print colored status message."""
    colors = {
        "success": Color.GREEN,
        "warning": Color.YELLOW,
        "error": Color.RED,
        "info": Color.BLUE,
    }
    color = colors.get(status, Color.NC)
    icons = {
        "success": "✅",
        "warning": "⚠️ ",
        "error": "❌",
        "info": "ℹ️ ",
    }
    icon = icons.get(status, "")
    print(f"{color}{icon} {message}{Color.NC}")


def load_security_config(security_file: Path) -> Optional[dict[str, Any]]:
    """Load the security configuration file."""
    try:
        if not security_file.exists():
            print_status("error", f"Security file not found: {security_file}")
            return None

        with security_file.open("r") as f:
            data = json.load(f)

        return data
    except json.JSONDecodeError as e:
        print_status("error", f"Invalid JSON in security file: {e}")
        return None
    except OSError as e:
        print_status("error", f"Failed to read security file: {e}")
        return None


def generate_permissions(security_config: dict[str, Any]) -> GenerationResult:
    """Generate Bash permissions from security config."""
    base_commands = security_config.get("base_commands", [])
    stack_commands = security_config.get("stack_commands", [])

    if not base_commands and not stack_commands:
        return GenerationResult(
            success=False,
            error="No commands found in security configuration",
        )

    # Generate Bash(command) permissions
    permissions = []
    for command in base_commands:
        permissions.append(f"Bash({command})")

    for command in stack_commands:
        permissions.append(f"Bash({command})")

    return GenerationResult(
        success=True,
        total_permissions=len(permissions),
        base_commands=len(base_commands),
        stack_commands=len(stack_commands),
        permissions=permissions,
    )


def load_claude_settings(settings_file: Path) -> Optional[dict[str, Any]]:
    """Load existing .claude_settings.json file."""
    try:
        if not settings_file.exists():
            print_status("warning", f"Settings file not found: {settings_file}")
            return None

        with settings_file.open("r") as f:
            data = json.load(f)

        return data
    except json.JSONDecodeError as e:
        print_status("error", f"Invalid JSON in settings file: {e}")
        return None
    except OSError as e:
        print_status("error", f"Failed to read settings file: {e}")
        return None


def update_claude_settings(
    settings: dict[str, Any],
    new_permissions: list[str],
) -> dict[str, Any]:
    """Update Claude settings with new permissions."""
    if "permissions" not in settings:
        settings["permissions"] = {}

    if "allow" not in settings["permissions"]:
        settings["permissions"]["allow"] = []

    # Remove old Bash(*) wildcard permission
    allow_list = settings["permissions"]["allow"]
    allow_list = [p for p in allow_list if p != "Bash(*)"]

    # Add new granular Bash permissions
    # Remove any existing Bash() permissions first to avoid duplicates
    allow_list = [p for p in allow_list if not p.startswith("Bash(")]

    # Add the new permissions
    allow_list.extend(new_permissions)

    settings["permissions"]["allow"] = allow_list

    return settings


def write_settings_file(settings: dict[str, Any], output_file: Path) -> bool:
    """Write updated settings to file."""
    try:
        with output_file.open("w") as f:
            json.dump(settings, f, indent=2)
            f.write("\n")  # Add trailing newline

        return True
    except OSError as e:
        print_status("error", f"Failed to write settings file: {e}")
        return False


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Generate granular Claude Code Bash permissions from security.json"
    )
    parser.add_argument(
        "--security-file",
        type=Path,
        default=Path(".auto-claude-security.json"),
        help="Path to security configuration file (default: .auto-claude-security.json)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be generated without writing to file",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Output file for generated settings (default: update in place)",
    )
    parser.add_argument(
        "--settings-file",
        type=Path,
        default=Path(".claude_settings.json"),
        help="Existing Claude settings file to update (default: .claude_settings.json)",
    )

    args = parser.parse_args()

    print(f"{Color.BLUE}🔐 Claude Code Permission Generator{Color.NC}\n")

    # Load security configuration
    print_status("info", f"Loading security configuration from {args.security_file}")
    security_config = load_security_config(args.security_file)
    if security_config is None:
        return 1

    # Generate permissions
    print_status("info", "Generating Bash permissions...")
    result = generate_permissions(security_config)

    if not result.success:
        print_status("error", result.error or "Permission generation failed")
        return 1

    print_status(
        "success",
        f"Generated {result.total_permissions} Bash permissions "
        f"({result.base_commands} base + {result.stack_commands} stack commands)",
    )

    if args.dry_run:
        print(f"\n{Color.BLUE}Dry run - Generated permissions:{Color.NC}")
        for i, perm in enumerate(result.permissions, 1):
            print(f"  {i:3}. {perm}")
        print(f"\n{Color.GREEN}Generated {result.total_permissions} Bash permissions from security.json{Color.NC}")
        return 0

    # Load existing settings file
    settings_file = args.settings_file
    if args.output:
        # If output specified, try to load existing settings as base
        if settings_file.exists():
            print_status("info", f"Loading existing settings from {settings_file}")
            settings = load_claude_settings(settings_file)
        else:
            print_status("warning", "No existing settings file found, creating new one")
            settings = {}
    else:
        # Update in place
        print_status("info", f"Loading settings from {settings_file}")
        settings = load_claude_settings(settings_file)
        if settings is None:
            return 1

    # Update settings with new permissions
    print_status("info", "Updating permission configuration...")
    updated_settings = update_claude_settings(settings or {}, result.permissions)

    # Write to file
    output_file = args.output or settings_file
    print_status("info", f"Writing updated settings to {output_file}")
    if write_settings_file(updated_settings, output_file):
        print_status("success", f"Successfully wrote {result.total_permissions} permissions to {output_file}")
        return 0
    else:
        return 1


if __name__ == "__main__":
    sys.exit(main())

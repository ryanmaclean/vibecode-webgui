#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "test-claude-permissions"
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
except ImportError:
    log_agg = None


# -- VibeCode Telemetry --
import sys
import os

try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    tracer = None
# ------------------------

"""Tests for Claude Code permission configuration."""

import argparse
import json
import sys
import unittest
from pathlib import Path
from typing import Dict, List, Set


class Color:
    """Terminal color codes."""
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    NC = '\033[0m'  # No Color


def load_claude_settings(config_path: str) -> Dict:
    """Load Claude settings from JSON file.

    Args:
        config_path: Path to .claude_settings.json file

    Returns:
        Dictionary containing Claude settings

    Raises:
        FileNotFoundError: If config file doesn't exist
        json.JSONDecodeError: If config file is invalid JSON
    """
    path = Path(config_path)
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    with open(path, 'r') as f:
        return json.load(f)


def get_bash_permissions(settings: Dict) -> Set[str]:
    """Extract Bash permissions from Claude settings.

    Args:
        settings: Claude settings dictionary

    Returns:
        Set of command names that are permitted
    """
    permissions = settings.get('permissions', {}).get('allow', [])
    bash_perms = set()

    for perm in permissions:
        if isinstance(perm, str) and perm.startswith('Bash(') and perm.endswith(')'):
            # Extract command name from Bash(command)
            command = perm[5:-1]  # Remove 'Bash(' and ')'
            bash_perms.add(command)

    return bash_perms


def check_command_permitted(bash_perms: Set[str], command: str) -> bool:
    """Check if a command is permitted.

    Args:
        bash_perms: Set of permitted Bash commands
        command: Command name to check

    Returns:
        True if command is permitted, False otherwise
    """
    return command in bash_perms


def print_status(status: str, message: str):
    """Print colored status message.

    Args:
        status: Status type (success, error, warning, info)
        message: Message to print
    """
    colors = {
        'success': Color.GREEN,
        'error': Color.RED,
        'warning': Color.YELLOW,
        'info': Color.BLUE
    }
    color = colors.get(status, Color.NC)
    print(f"{color}{message}{Color.NC}")


class TestClaudePermissions(unittest.TestCase):
    """Tests for Claude Code permission configuration."""

    # Class variable to store config path (can be set before running tests)
    config_path = '.claude_settings.json'

    @classmethod
    def setUpClass(cls):
        """Set up test fixtures."""
        try:
            cls.settings = load_claude_settings(cls.config_path)
            cls.bash_perms = get_bash_permissions(cls.settings)
        except Exception as e:
            print_status('error', f"Failed to load config: {e}")
            raise

    def test_config_file_exists(self):
        """Test that config file exists and is readable."""
        self.assertIsNotNone(self.settings)
        self.assertIsInstance(self.settings, dict)

    def test_permissions_structure(self):
        """Test that permissions structure is valid."""
        self.assertIn('permissions', self.settings)
        self.assertIn('allow', self.settings['permissions'])
        self.assertIsInstance(self.settings['permissions']['allow'], list)

    def test_has_bash_permissions(self):
        """Test that some Bash permissions are defined."""
        self.assertGreater(len(self.bash_perms), 0,
                          "No Bash permissions found in config")

    def test_git_command_permitted(self):
        """Test that git command is permitted."""
        self.assertTrue(
            check_command_permitted(self.bash_perms, 'git'),
            "git command is not permitted"
        )

    def test_npm_command_permitted(self):
        """Test that npm command is permitted."""
        self.assertTrue(
            check_command_permitted(self.bash_perms, 'npm'),
            "npm command is not permitted"
        )

    def test_ls_command_permitted(self):
        """Test that ls command is permitted."""
        self.assertTrue(
            check_command_permitted(self.bash_perms, 'ls'),
            "ls command is not permitted"
        )

    def test_grep_command_permitted(self):
        """Test that grep command is permitted."""
        self.assertTrue(
            check_command_permitted(self.bash_perms, 'grep'),
            "grep command is not permitted"
        )

    def test_common_file_commands_permitted(self):
        """Test that common file manipulation commands are permitted."""
        common_commands = ['cat', 'head', 'tail', 'find', 'wc']
        for cmd in common_commands:
            with self.subTest(command=cmd):
                self.assertTrue(
                    check_command_permitted(self.bash_perms, cmd),
                    f"{cmd} command is not permitted"
                )

    def test_no_wildcard_bash_permission(self):
        """Test that Bash(*) wildcard is not present."""
        permissions = self.settings.get('permissions', {}).get('allow', [])
        self.assertNotIn('Bash(*)', permissions,
                        "Dangerous Bash(*) wildcard permission found")

    def test_expected_permission_count(self):
        """Test that we have expected number of permissions."""
        # Should have at least 200 Bash permissions (229 expected)
        self.assertGreaterEqual(
            len(self.bash_perms), 200,
            f"Expected at least 200 Bash permissions, found {len(self.bash_perms)}"
        )


def run_permission_tests(config_path: str) -> bool:
    """Run permission tests and return success status.

    Args:
        config_path: Path to Claude settings file

    Returns:
        True if all tests pass, False otherwise
    """
    print_status('info', f"Testing permissions in: {config_path}\n")

    try:
        # Load and analyze config
        settings = load_claude_settings(config_path)
        bash_perms = get_bash_permissions(settings)

        print_status('info', f"Found {len(bash_perms)} Bash permissions")

        # Check common commands
        common_commands = ['git', 'npm', 'ls', 'grep']
        all_permitted = True

        for cmd in common_commands:
            permitted = check_command_permitted(bash_perms, cmd)
            if permitted:
                print_status('success', f"✓ {cmd} is permitted")
            else:
                print_status('error', f"✗ {cmd} is NOT permitted")
                all_permitted = False

        # Check for wildcard
        permissions = settings.get('permissions', {}).get('allow', [])
        if 'Bash(*)' in permissions:
            print_status('error', "✗ Dangerous Bash(*) wildcard found")
            all_permitted = False
        else:
            print_status('success', "✓ No Bash(*) wildcard (good)")

        print()
        if all_permitted:
            print_status('success', "All common commands are permitted ✓")
            return True
        else:
            print_status('error', "Some common commands are missing ✗")
            return False

    except Exception as e:
        print_status('error', f"Error: {e}")
        return False


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Test Claude Code permission configuration'
    )
    parser.add_argument(
        '--config',
        default='.claude_settings.json',
        help='Path to Claude settings file'
    )
    parser.add_argument(
        '--unittest',
        action='store_true',
        help='Run as unittest suite'
    )

    args, remaining = parser.parse_known_args()

    if args.unittest:
        # Set config path for unittest
        TestClaudePermissions.config_path = args.config
        # Run as unittest
        sys.argv = [sys.argv[0]] + remaining
        unittest.main()
    else:
        # Run quick permission check
        success = run_permission_tests(args.config)
        sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()

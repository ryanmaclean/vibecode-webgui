#!/usr/bin/env python3
"""Shared helpers for bootstrap validation scripts.

This module sets up environment variables and paths for bootstrap tests.
Import this module to initialize the test environment.

Usage:
    from bootstrap_env import (
        BOOTSTRAP_TEST_DIR,
        BOOTSTRAP_TEST_REPO_ROOT,
        BOOTSTRAP_TEST_SCRIPTS_DIR,
        load_test_env,
    )
"""

import os
import sys
from pathlib import Path
from typing import Dict, Optional

# Guard against double initialization
_BOOTSTRAP_TEST_ENV_INITIALIZED = False

# Directory paths
BOOTSTRAP_TEST_DIR = Path(__file__).parent.resolve()
BOOTSTRAP_TEST_REPO_ROOT = BOOTSTRAP_TEST_DIR.parent.parent.parent
BOOTSTRAP_TEST_SCRIPTS_DIR = BOOTSTRAP_TEST_REPO_ROOT / "scripts"

# Environment file paths
BOOTSTRAP_TEST_ENV_FILE = BOOTSTRAP_TEST_DIR / "test-env.sh"
BOOTSTRAP_TEST_ENV_EXAMPLE = BOOTSTRAP_TEST_DIR / "test-env.example.sh"


def parse_shell_env_file(path: Path) -> Dict[str, str]:
    """Parse a shell environment file and extract variable assignments.

    Args:
        path: Path to the shell environment file.

    Returns:
        Dictionary of variable names to values.
    """
    env_vars: Dict[str, str] = {}

    if not path.exists():
        return env_vars

    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()

            # Skip empty lines and comments
            if not line or line.startswith('#'):
                continue

            # Handle export statements
            if line.startswith('export '):
                line = line[7:]

            # Parse variable assignment
            if '=' not in line:
                continue

            key, _, value = line.partition('=')
            key = key.strip()

            # Skip if not a valid variable name
            if not key or not key.replace('_', '').isalnum():
                continue

            # Remove quotes from value
            value = value.strip()
            if len(value) >= 2:
                if (value.startswith('"') and value.endswith('"')) or \
                   (value.startswith("'") and value.endswith("'")):
                    value = value[1:-1]

            # Handle inline comments (simple approach)
            if '#' in value and not value.startswith('$'):
                # Only strip if # is not inside quotes
                in_quote = False
                quote_char = None
                for i, char in enumerate(value):
                    if char in ('"', "'") and not in_quote:
                        in_quote = True
                        quote_char = char
                    elif char == quote_char and in_quote:
                        in_quote = False
                        quote_char = None
                    elif char == '#' and not in_quote:
                        value = value[:i].strip()
                        break

            env_vars[key] = value

    return env_vars


def load_test_env(force: bool = False) -> Dict[str, str]:
    """Load test environment variables from config files.

    Loads variables from test-env.sh or test-env.example.sh if they exist.
    Sets them as environment variables and returns the loaded values.

    Args:
        force: If True, reload even if already initialized.

    Returns:
        Dictionary of loaded environment variables.
    """
    global _BOOTSTRAP_TEST_ENV_INITIALIZED

    if _BOOTSTRAP_TEST_ENV_INITIALIZED and not force:
        return {}

    loaded_vars: Dict[str, str] = {}

    # Try to load environment file
    if BOOTSTRAP_TEST_ENV_FILE.exists():
        loaded_vars = parse_shell_env_file(BOOTSTRAP_TEST_ENV_FILE)
    elif BOOTSTRAP_TEST_ENV_EXAMPLE.exists():
        loaded_vars = parse_shell_env_file(BOOTSTRAP_TEST_ENV_EXAMPLE)
    else:
        print("Warning: No bootstrap test environment stub found; continuing with defaults",
              file=sys.stderr)

    # Set environment variables
    for key, value in loaded_vars.items():
        os.environ[key] = value

    _BOOTSTRAP_TEST_ENV_INITIALIZED = True
    return loaded_vars


def get_bootstrap_paths() -> Dict[str, Path]:
    """Get all bootstrap test paths.

    Returns:
        Dictionary with path names and their values.
    """
    return {
        "BOOTSTRAP_TEST_DIR": BOOTSTRAP_TEST_DIR,
        "BOOTSTRAP_TEST_REPO_ROOT": BOOTSTRAP_TEST_REPO_ROOT,
        "BOOTSTRAP_TEST_SCRIPTS_DIR": BOOTSTRAP_TEST_SCRIPTS_DIR,
        "BOOTSTRAP_TEST_ENV_FILE": BOOTSTRAP_TEST_ENV_FILE,
        "BOOTSTRAP_TEST_ENV_EXAMPLE": BOOTSTRAP_TEST_ENV_EXAMPLE,
    }


def export_to_environ() -> None:
    """Export bootstrap paths to environment variables.

    This mimics the shell script's export behavior.
    """
    os.environ["BOOTSTRAP_TEST_DIR"] = str(BOOTSTRAP_TEST_DIR)
    os.environ["BOOTSTRAP_TEST_REPO_ROOT"] = str(BOOTSTRAP_TEST_REPO_ROOT)
    os.environ["BOOTSTRAP_TEST_SCRIPTS_DIR"] = str(BOOTSTRAP_TEST_SCRIPTS_DIR)


def is_initialized() -> bool:
    """Check if the bootstrap environment has been initialized.

    Returns:
        True if initialized.
    """
    return _BOOTSTRAP_TEST_ENV_INITIALIZED


def reset() -> None:
    """Reset the initialization state.

    Useful for testing.
    """
    global _BOOTSTRAP_TEST_ENV_INITIALIZED
    _BOOTSTRAP_TEST_ENV_INITIALIZED = False


def init() -> Dict[str, str]:
    """Initialize the bootstrap test environment.

    This is the main entry point that mimics the shell script behavior.
    Exports paths to environment and loads test env file.

    Returns:
        Dictionary of loaded environment variables.
    """
    export_to_environ()
    return load_test_env()


# Auto-initialize when imported (like the shell script does when sourced)
if not _BOOTSTRAP_TEST_ENV_INITIALIZED:
    init()


if __name__ == "__main__":
    # When run directly, print the environment info
    print("Bootstrap Test Environment")
    print("=" * 40)
    print()
    print("Paths:")
    for name, path in get_bootstrap_paths().items():
        exists = "exists" if path.exists() else "not found"
        print(f"  {name}:")
        print(f"    {path} ({exists})")
    print()

    # Show loaded environment
    reset()
    loaded = load_test_env()
    if loaded:
        print("Loaded Environment Variables:")
        for key, value in loaded.items():
            # Mask sensitive values
            if any(s in key.lower() for s in ['secret', 'password', 'key', 'token']):
                display_value = value[:4] + "..." if len(value) > 4 else "***"
            else:
                display_value = value
            print(f"  {key}={display_value}")
    else:
        print("No environment variables loaded from config files.")

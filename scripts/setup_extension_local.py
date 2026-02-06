#!/usr/bin/env python3
"""Setup extension for code-server testing.

This script sets up the VibeCode AI Assistant extension for local
code-server testing by copying the VSIX, creating recommendations,
and generating a test script.
"""

import argparse
import shutil
import stat
import sys
from pathlib import Path
from typing import Optional

# ANSI colors for output
GREEN = '\033[0;32m'
NC = '\033[0m'

# Extension configuration
EXTENSION_NAME = "vibecode-ai-assistant"
EXTENSION_VERSION = "1.0.0"
EXTENSION_ID = "vibecode.vibecode-ai-assistant"

# Extensions recommendation JSON content
EXTENSIONS_JSON = """{
  "recommendations": [
    "vibecode.vibecode-ai-assistant"
  ]
}
"""

# Test script content
TEST_SCRIPT_CONTENT = '''#!/bin/bash
set -euo pipefail

echo "Starting code-server with VibeCode AI Assistant..."

# Install extension automatically
if [ -f ".vscode/extensions/vibecode-ai-assistant-1.0.0.vsix" ]; then
    echo "Installing VibeCode AI Assistant extension..."
    code-server --install-extension .vscode/extensions/vibecode-ai-assistant-1.0.0.vsix || echo "Extension may already be installed"
fi

# Start code-server
code-server \\
    --bind-addr 0.0.0.0:8080 \\
    --auth none \\
    --disable-telemetry \\
    --disable-update-check \\
    --disable-workspace-trust \\
    --user-data-dir .vscode/code-server \\
    --extensions-dir .vscode/extensions \\
    --log trace \\
    .

echo "code-server started at http://localhost:8080"
echo "VibeCode AI Assistant should be installed automatically!"
'''


def get_project_root() -> Path:
    """Get the project root directory.

    Returns:
        Path to project root directory.
    """
    script_dir = Path(__file__).parent.resolve()
    return script_dir.parent


def get_vsix_filename() -> str:
    """Get the VSIX filename.

    Returns:
        VSIX filename string.
    """
    return f"{EXTENSION_NAME}-{EXTENSION_VERSION}.vsix"


def setup_extensions_directory(project_root: Path) -> Path:
    """Create the .vscode/extensions directory.

    Args:
        project_root: Path to project root.

    Returns:
        Path to extensions directory.
    """
    extensions_dir = project_root / ".vscode" / "extensions"
    extensions_dir.mkdir(parents=True, exist_ok=True)
    return extensions_dir


def copy_extension(project_root: Path, extensions_dir: Path) -> bool:
    """Copy the VSIX extension to the extensions directory.

    Args:
        project_root: Path to project root.
        extensions_dir: Path to extensions directory.

    Returns:
        True if successful.
    """
    vsix_filename = get_vsix_filename()
    source = project_root / "extensions" / EXTENSION_NAME / vsix_filename
    dest = extensions_dir / vsix_filename

    if not source.exists():
        print(f"Warning: Extension not found: {source}")
        return False

    try:
        shutil.copy2(source, dest)
        print(f"{GREEN}Extension copied to .vscode/extensions{NC}")
        return True
    except OSError as e:
        print(f"Error copying extension: {e}")
        return False


def create_extensions_json(project_root: Path) -> bool:
    """Create the extensions.json recommendation file.

    Args:
        project_root: Path to project root.

    Returns:
        True if successful.
    """
    extensions_json_path = project_root / ".vscode" / "extensions.json"

    try:
        extensions_json_path.write_text(EXTENSIONS_JSON)
        print(f"{GREEN}Extension recommendation added{NC}")
        return True
    except OSError as e:
        print(f"Error creating extensions.json: {e}")
        return False


def create_test_script(project_root: Path) -> bool:
    """Create the test-extension.sh script.

    Args:
        project_root: Path to project root.

    Returns:
        True if successful.
    """
    scripts_dir = project_root / "scripts"
    scripts_dir.mkdir(parents=True, exist_ok=True)

    test_script_path = scripts_dir / "test-extension.sh"

    try:
        test_script_path.write_text(TEST_SCRIPT_CONTENT)
        # Make executable
        test_script_path.chmod(
            test_script_path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH
        )
        print(f"{GREEN}Test script created: scripts/test-extension.sh{NC}")
        return True
    except OSError as e:
        print(f"Error creating test script: {e}")
        return False


def print_instructions() -> None:
    """Print usage instructions."""
    print()
    print("To test locally:")
    print("  ./scripts/test-extension.sh")


def main(project_root: Optional[Path] = None) -> int:
    """Main entry point.

    Args:
        project_root: Path to project root (default: auto-detect).

    Returns:
        Exit code (0 for success).
    """
    print(f"{GREEN}Setting up VibeCode AI Assistant for code-server testing...{NC}")

    if project_root is None:
        project_root = get_project_root()

    # Setup extensions directory
    extensions_dir = setup_extensions_directory(project_root)

    # Copy extension
    copy_extension(project_root, extensions_dir)

    # Create extensions.json
    if not create_extensions_json(project_root):
        return 1

    # Create test script
    if not create_test_script(project_root):
        return 1

    print_instructions()

    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Setup extension for code-server testing"
    )
    parser.add_argument(
        '-d', '--directory',
        type=Path,
        help="Path to project root (default: auto-detect)"
    )

    args = parser.parse_args()
    sys.exit(main(args.directory))

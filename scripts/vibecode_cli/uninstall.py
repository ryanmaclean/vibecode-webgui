from __future__ import annotations
#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "uninstall"
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




"""Vibecode WebGUI - Cleanup helper.

Removes local build artifacts and optionally environment files.
"""


# Initialize log aggregation
log_agg = get_log_aggregation()

try:
    import os as _os; _c = __import__('ddtrace').config; _s = _os.path.basename(__file__).replace('.py',''); _c.service = _s; _c.requests.service = _s; __import__('ddtrace').patch_all()
except: pass
# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

import argparse
import os
import shutil
import sys
from pathlib import Path

from . import COLORS, get_project_root, is_root_user


BUILD_TARGETS = [
    ".next",
    "dist",
    ".turbo",
    "playwright-report",
    "coverage",
    ".cache",
    "reports",
    "tmp-codeium-example",
]

ENV_FILES = [
    ".env.local",
    ".env.development",
    ".env.test",
]


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Cleans local Vibecode WebGUI artifacts. Designed for developer workstations - does not affect remote deployments.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
Examples:
    python -m vibecode_cli.uninstall
    python -m vibecode_cli.uninstall --dry-run
""",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show actions without removing files",
    )
    parser.add_argument(
        "--keep-env",
        action="store_true",
        help="Preserve .env.* files",
    )
    parser.add_argument(
        "--keep-node-modules",
        action="store_true",
        help="Preserve node_modules directory",
    )
    return parser.parse_args(argv)


def log_rm(path: Path, dry_run: bool) -> bool:
    """Log and optionally remove a file or directory.

    Returns True if the path existed (or would have been removed in dry-run mode).
    """
    if dry_run:
        if path.exists():
            print(f"{COLORS.yellow}DRY RUN{COLORS.reset} would remove {path}")
            return True
    else:
        if path.exists():
            if path.is_dir():
                shutil.rmtree(path)
            else:
                path.unlink()
            print(f"{COLORS.green}Removed {path}{COLORS.reset}")
            return True
    return False


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    args = parse_args(argv)

    if is_root_user():
        print(
            f"{COLORS.yellow}\u26a0 This script should run without sudo. Aborting.{COLORS.reset}",
            file=sys.stderr,
        )
        return 1

    project_root = get_project_root()
    os.chdir(project_root)

    print(f"{COLORS.green}Vibecode cleanup utility{COLORS.reset}")
    print(f"Project: {project_root}\n")

    # Remove build artifacts
    for target in BUILD_TARGETS:
        log_rm(project_root / target, args.dry_run)

    # Handle node_modules
    if not args.keep_node_modules:
        log_rm(project_root / "node_modules", args.dry_run)
    else:
        print(f"{COLORS.yellow}Preserving node_modules (--keep-node-modules){COLORS.reset}")

    print()

    # Handle env files
    if not args.keep_env:
        for env_file in ENV_FILES:
            log_rm(project_root / env_file, args.dry_run)
    else:
        print(f"{COLORS.yellow}Preserving environment files (--keep-env){COLORS.reset}")

    print(f"\n{COLORS.green}Cleanup complete.{COLORS.reset}")
    if args.dry_run:
        print("No files were deleted (dry-run mode).")

    return 0


if __name__ == "__main__":
    sys.exit(main())
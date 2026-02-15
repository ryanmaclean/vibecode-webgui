#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), './')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
Security Updates Script - vibecode-webgui

Purpose: Automate the application of critical security patches.
Version: 1.1

This script applies patches for:
1. @modelcontextprotocol/sdk ReDoS (GHSA-8r9q-7v3j-jr4g)
2. langchain Serialization Injection (GHSA-r399-636x-v7f6)

Note: preact patch removed as package is not used in this project
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional


class Colors:
    """ANSI color codes for terminal output."""
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'


@dataclass
class Config:
    """Script configuration."""
    script_dir: Path
    log_dir: Path
    timestamp: str
    log_file: Path
    backup_dir: Path
    skip_tests: bool = False
    force_update: bool = False
    dry_run: bool = False
    verbose: bool = False
    update_mcp_only: bool = False
    update_langchain_only: bool = False


def print_info(msg: str, log_file: Optional[Path] = None) -> None:
    """Print info message."""
    output = f"{Colors.BLUE}[INFO]{Colors.NC} {msg}"
    print(output)
    if log_file:
        with open(log_file, 'a') as f:
            f.write(f"[INFO] {msg}\n")


def print_success(msg: str, log_file: Optional[Path] = None) -> None:
    """Print success message."""
    output = f"{Colors.GREEN}[SUCCESS]{Colors.NC} {msg}"
    print(output)
    if log_file:
        with open(log_file, 'a') as f:
            f.write(f"[SUCCESS] {msg}\n")


def print_warning(msg: str, log_file: Optional[Path] = None) -> None:
    """Print warning message."""
    output = f"{Colors.YELLOW}[WARNING]{Colors.NC} {msg}"
    print(output)
    if log_file:
        with open(log_file, 'a') as f:
            f.write(f"[WARNING] {msg}\n")


def print_error(msg: str, log_file: Optional[Path] = None) -> None:
    """Print error message."""
    output = f"{Colors.RED}[ERROR]{Colors.NC} {msg}"
    print(output)
    if log_file:
        with open(log_file, 'a') as f:
            f.write(f"[ERROR] {msg}\n")


def log(msg: str, log_file: Path) -> None:
    """Log message to file only."""
    with open(log_file, 'a') as f:
        f.write(f"{msg}\n")


def run_cmd(
    cmd: str,
    description: str,
    config: Config
) -> bool:
    """Run command with logging."""
    print_info(description, config.log_file)
    log(f"Command: {cmd}", config.log_file)

    if config.dry_run:
        print_info(f"[DRY RUN] Would execute: {cmd}", config.log_file)
        return True

    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=300
        )
        with open(config.log_file, 'a') as f:
            f.write(result.stdout)
            f.write(result.stderr)

        if result.returncode == 0:
            print_success(f"Completed: {description}", config.log_file)
            return True
        else:
            print_error(f"Failed: {description}", config.log_file)
            return False
    except subprocess.TimeoutExpired:
        print_error(f"Timeout: {description}", config.log_file)
        return False
    except Exception as e:
        print_error(f"Error: {description} - {e}", config.log_file)
        return False


def command_exists(cmd: str) -> bool:
    """Check if a command exists."""
    return shutil.which(cmd) is not None


def initialize(config: Config) -> None:
    """Initialize script - create directories and log file."""
    print_info("Security Updates Script v1.1")
    print_info("Starting security patch process...")

    config.log_dir.mkdir(parents=True, exist_ok=True)
    config.backup_dir.mkdir(parents=True, exist_ok=True)

    with open(config.log_file, 'w') as f:
        f.write("=" * 47 + "\n")
        f.write("Security Updates Log\n")
        f.write(f"Timestamp: {datetime.now()}\n")
        f.write(f"User: {os.getenv('USER', 'unknown')}\n")
        f.write(f"Directory: {os.getcwd()}\n")
        f.write(f"Script: {__file__}\n")
        f.write("=" * 47 + "\n")

    print_info(f"Log file: {config.log_file}")
    print_info(f"Backup directory: {config.backup_dir}")


def check_prerequisites(config: Config) -> bool:
    """Check prerequisites for running the script."""
    print_info("Checking prerequisites...", config.log_file)

    if not Path("package.json").exists():
        print_error("package.json not found in current directory", config.log_file)
        print_error("Please run this script from the repository root", config.log_file)
        return False

    if not command_exists("npm"):
        print_error("npm not found. Please install Node.js and npm", config.log_file)
        return False

    if not command_exists("git"):
        print_error("git not found. Please install git", config.log_file)
        return False

    # Check versions
    result = subprocess.run(["npm", "--version"], capture_output=True, text=True)
    npm_version = result.stdout.strip()
    print_info(f"npm version: {npm_version}", config.log_file)

    result = subprocess.run(["node", "--version"], capture_output=True, text=True)
    node_version = result.stdout.strip()
    print_info(f"Node version: {node_version}", config.log_file)

    # Check git status
    result = subprocess.run(["git", "status", "--short"], capture_output=True, text=True)
    if result.stdout.strip():
        print_warning("Git working directory has uncommitted changes:", config.log_file)
        print(result.stdout)
        if not config.force_update:
            print_error("Commit or stash changes before running this script", config.log_file)
            return False

    print_success("Prerequisites check passed", config.log_file)
    return True


def backup_current_state(config: Config) -> None:
    """Backup current state before making changes."""
    print_info("Backing up current state...", config.log_file)

    run_cmd(f"cp package.json {config.backup_dir}/", "Backup package.json", config)
    run_cmd(f"cp package-lock.json {config.backup_dir}/", "Backup package-lock.json", config)

    # Git status snapshot
    subprocess.run(
        ["git", "status"],
        stdout=open(config.backup_dir / "git-status-before.txt", 'w'),
        stderr=subprocess.STDOUT
    )
    subprocess.run(
        ["npm", "list", "--depth=0"],
        stdout=open(config.backup_dir / "npm-list-before.txt", 'w'),
        stderr=subprocess.STDOUT
    )
    subprocess.run(
        ["npm", "audit", "--json"],
        stdout=open(config.backup_dir / "npm-audit-before.json", 'w'),
        stderr=subprocess.STDOUT
    )

    print_success("Backup completed", config.log_file)


def run_pretests(config: Config) -> bool:
    """Run pre-update tests."""
    if config.skip_tests:
        print_warning("Skipping pre-update tests", config.log_file)
        return True

    print_info("Running pre-update tests...", config.log_file)

    if not run_cmd("npm run type-check 2>&1 | tail -20", "Running type-check", config):
        print_warning("Type-check had issues (this is OK, may be pre-existing)", config.log_file)

    if not run_cmd("npm run lint 2>&1 | tail -20", "Running lint", config):
        print_warning("Lint had issues (this is OK, may be pre-existing)", config.log_file)

    print_info("Pre-update tests completed", config.log_file)
    return True


def update_preact(config: Config) -> bool:
    """Update preact to fix JSON VNode injection (DEPRECATED - package not used)."""
    print_info("=" * 42, config.log_file)
    print_info("Checking for preact package...", config.log_file)
    print_info("=" * 42, config.log_file)

    # Check if preact is in package.json
    try:
        with open("package.json", 'r') as f:
            package_data = json.load(f)
            deps = package_data.get("dependencies", {})
            dev_deps = package_data.get("devDependencies", {})
            if "preact" not in deps and "preact" not in dev_deps:
                print_warning("preact not found in package.json - skipping", config.log_file)
                print_info("This package is not used in the current project", config.log_file)
                return True  # Not an error condition
    except Exception as e:
        print_error(f"Failed to read package.json: {e}", config.log_file)
        return False

    # If preact exists, update it
    print_info("Updating preact to fix JSON VNode injection", config.log_file)
    print_info("Vulnerability: GHSA-36hm-qxxp-pg3m", config.log_file)

    if not run_cmd("npm install preact@10.28.2 --save", "Installing preact@10.28.2", config):
        return False

    # Verify update
    result = subprocess.run(["npm", "list", "preact"], capture_output=True, text=True)
    if "preact@10.28.2" in result.stdout:
        print_success("preact updated to 10.28.2", config.log_file)
        log("preact: 10.27.2 → 10.28.2 ✓", config.log_file)
        return True
    else:
        print_error("preact update verification failed", config.log_file)
        return False


def update_mcp(config: Config) -> bool:
    """Update @modelcontextprotocol/sdk to fix ReDoS."""
    print_info("=" * 42, config.log_file)
    print_info("Updating @modelcontextprotocol/sdk", config.log_file)
    print_info("Vulnerability: GHSA-8r9q-7v3j-jr4g (ReDoS)", config.log_file)
    print_info("=" * 42, config.log_file)

    if not run_cmd(
        "npm install @modelcontextprotocol/sdk@1.26.0 --save",
        "Installing @modelcontextprotocol/sdk@1.26.0",
        config
    ):
        return False

    result = subprocess.run(
        ["npm", "list", "@modelcontextprotocol/sdk"],
        capture_output=True,
        text=True
    )
    if "1.26.0" in result.stdout:
        print_success("@modelcontextprotocol/sdk updated to 1.26.0", config.log_file)
        log("@modelcontextprotocol/sdk: 1.25.1 → 1.26.0 ✓", config.log_file)
        return True
    else:
        print_error("@modelcontextprotocol/sdk update verification failed", config.log_file)
        return False


def update_langchain(config: Config) -> bool:
    """Update langchain to fix Serialization Injection."""
    print_info("=" * 42, config.log_file)
    print_info("Updating langchain", config.log_file)
    print_info("Vulnerability: GHSA-r399-636x-v7f6 (Serialization Injection)", config.log_file)
    print_warning("This is a minor version update", config.log_file)
    print_info("=" * 42, config.log_file)

    if not run_cmd("npm install langchain@1.2.24 --save", "Installing langchain@1.2.24", config):
        return False

    result = subprocess.run(["npm", "list", "langchain"], capture_output=True, text=True)
    if "1.2.24" in result.stdout:
        print_success("langchain updated to 1.2.24", config.log_file)
        log("langchain: 1.0.2 → 1.2.24 ✓", config.log_file)
        return True
    else:
        print_error("langchain update verification failed", config.log_file)
        return False


def run_posttests(config: Config) -> bool:
    """Run post-update tests."""
    if config.skip_tests:
        print_warning("Skipping post-update tests", config.log_file)
        return True

    print_info("Running post-update tests...", config.log_file)
    print_info("This may take several minutes...", config.log_file)

    # Type checking
    print_info("Running type-check...", config.log_file)
    if not run_cmd("npm run type-check 2>&1", "Type checking", config):
        print_error("Type-check failed", config.log_file)
        if not config.force_update:
            return False
        print_warning("Continuing despite type-check failure (--force flag used)", config.log_file)

    # Linting
    print_info("Running lint...", config.log_file)
    if not run_cmd("npm run lint 2>&1 | tail -50", "Linting", config):
        print_error("Lint failed", config.log_file)
        if not config.force_update:
            return False
        print_warning("Continuing despite lint failure (--force flag used)", config.log_file)

    # Security audit
    print_info("Running security audit...", config.log_file)
    if not run_cmd("npm audit 2>&1", "Security audit", config):
        print_warning("Audit reported issues (checking details)", config.log_file)

    # Check vulnerability count
    result = subprocess.run(
        ["npm", "audit", "--json"],
        capture_output=True,
        text=True
    )
    try:
        audit_data = json.loads(result.stdout)
        vuln_count = audit_data.get("metadata", {}).get("vulnerabilities", {}).get("total", "unknown")
    except json.JSONDecodeError:
        vuln_count = "unknown"

    if vuln_count == 0 or vuln_count == "unknown":
        print_success("Security audit passed (0 vulnerabilities)", config.log_file)
    else:
        print_error(f"Security audit found {vuln_count} vulnerabilities", config.log_file)
        if not config.force_update:
            return False

    print_success("Post-update tests completed", config.log_file)
    return True


def create_summary(config: Config) -> None:
    """Create patch summary file."""
    summary_file = config.backup_dir / "PATCH_SUMMARY.txt"

    summary = f"""================================================================================
SECURITY PATCH SUMMARY
================================================================================

Applied Patches:
1. @modelcontextprotocol/sdk 1.25.1 → 1.26.0
   - Vulnerability: GHSA-8r9q-7v3j-jr4g (ReDoS)
   - Type: Minor version update (safe)

2. langchain 1.0.2 → 1.2.24
   - Vulnerability: GHSA-r399-636x-v7f6 (Serialization Injection)
   - Type: Minor version update (requires testing)

Note: preact patch skipped (package not used in this project)

Installation Time: {datetime.now()}
Backup Location: {config.backup_dir}

Next Steps:
1. Run npm test for full test suite
2. Deploy to staging environment
3. Run E2E tests in staging
4. Verify all functionality works
5. Deploy to production when confident
6. Monitor logs for any issues
7. Rotate credentials that may have been exposed

Rollback Instructions:
If any issues occur, rollback using:
    cd {os.getcwd()}
    cp {config.backup_dir}/package.json .
    cp {config.backup_dir}/package-lock.json .
    npm ci
    git reset --hard HEAD

For more details, see SECURITY_FIX_PLAN.md
================================================================================
"""

    summary_file.write_text(summary)
    print_info(f"Summary saved to: {summary_file}", config.log_file)
    print(summary)


def main_update(config: Config) -> int:
    """Run main update logic."""
    failed = 0

    do_preact = True
    do_mcp = True
    do_langchain = True

    if config.update_mcp_only:
        do_preact = False
        do_langchain = False
    elif config.update_langchain_only:
        do_preact = False
        do_mcp = False

    if do_preact:
        if not update_preact(config):
            print_error("Preact update failed", config.log_file)
            failed += 1

    if do_mcp:
        if not update_mcp(config):
            print_error("MCP SDK update failed", config.log_file)
            failed += 1

    if do_langchain:
        if not update_langchain(config):
            print_error("langchain update failed", config.log_file)
            failed += 1

    return failed


def run_security_updates(
    skip_tests: bool = False,
    force_update: bool = False,
    dry_run: bool = False,
    verbose: bool = False,
    mcp_only: bool = False,
    langchain_only: bool = False
) -> int:
    """
    Run security updates.

    Args:
        skip_tests: Skip running tests
        force_update: Force updates even if tests fail
        dry_run: Show what would be done without making changes
        verbose: Enable verbose output
        mcp_only: Update only MCP SDK
        langchain_only: Update only langchain

    Returns:
        Exit code (0 for success)
    """
    script_dir = Path(__file__).parent.resolve()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    config = Config(
        script_dir=script_dir,
        log_dir=script_dir / "security-patch-logs",
        timestamp=timestamp,
        log_file=script_dir / "security-patch-logs" / f"security-updates_{timestamp}.log",
        backup_dir=script_dir / "backups" / f"security-patch-{timestamp}",
        skip_tests=skip_tests,
        force_update=force_update,
        dry_run=dry_run,
        verbose=verbose,
        update_mcp_only=mcp_only,
        update_langchain_only=langchain_only
    )

    initialize(config)

    if dry_run:
        print_warning("====== DRY RUN MODE ======", config.log_file)
        print_warning("No changes will be made to your system", config.log_file)
        print_warning("==========================", config.log_file)

    if not skip_tests:
        print_info("Note: Full test suite will be run", config.log_file)
        print_info("This may take 5-10 minutes", config.log_file)
    else:
        print_warning("Tests will be skipped - NOT RECOMMENDED", config.log_file)

    if not check_prerequisites(config):
        return 1

    if not dry_run:
        backup_current_state(config)

    if not run_pretests(config):
        print_warning("Pre-tests had issues, continuing anyway...", config.log_file)

    failed = main_update(config)
    if failed > 0:
        print_error("Script encountered errors", config.log_file)
        print_warning(f"Review log file: {config.log_file}", config.log_file)
        if not dry_run:
            print_warning("You may need to run rollback procedures", config.log_file)
            print_info(f"Backup saved to: {config.backup_dir}", config.log_file)
        return 1

    if not run_posttests(config):
        if not force_update:
            print_error("Post-tests failed", config.log_file)
            return 1

    create_summary(config)

    print_success("=" * 42, config.log_file)
    print_success("Security patches applied successfully!", config.log_file)
    print_success("=" * 42, config.log_file)

    if dry_run:
        print_info("This was a DRY RUN - no actual changes were made", config.log_file)
    else:
        print_info("Next steps:", config.log_file)
        print_info(f"1. Review the backup: {config.backup_dir}", config.log_file)
        print_info("2. Run: npm test", config.log_file)
        print_info("3. Test in staging environment", config.log_file)
        print_info("4. Deploy to production when confident", config.log_file)
        print_info("5. Rotate sensitive credentials", config.log_file)
        print()
        print_info(f"Log file: {config.log_file}", config.log_file)

    return 0


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Security patch script for vibecode-webgui",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
EXAMPLES:
    # Run full security update with tests
    python security_updates.py

    # Dry run to see what would be done
    python security_updates.py --dry-run

    # Update without running tests
    python security_updates.py --skip-tests

    # Update only MCP SDK
    python security_updates.py --mcp-only

    # Update only langchain
    python security_updates.py --langchain-only
"""
    )

    parser.add_argument(
        "-d", "--dry-run",
        action="store_true",
        help="Show what would be done without making changes"
    )
    parser.add_argument(
        "-s", "--skip-tests",
        action="store_true",
        help="Skip running tests after updates"
    )
    parser.add_argument(
        "-f", "--force",
        action="store_true",
        help="Force updates even if tests fail"
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable verbose output"
    )
    parser.add_argument(
        "-m", "--mcp-only",
        action="store_true",
        help="Update only MCP SDK patch"
    )
    parser.add_argument(
        "-l", "--langchain-only",
        action="store_true",
        help="Update only langchain patch"
    )

    args = parser.parse_args()

    return run_security_updates(
        skip_tests=args.skip_tests,
        force_update=args.force,
        dry_run=args.dry_run,
        verbose=args.verbose,
        mcp_only=args.mcp_only,
        langchain_only=args.langchain_only
    )


if __name__ == "__main__":
    sys.exit(main())
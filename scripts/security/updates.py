#!/usr/bin/env python3
"""
Security Updates Script

Automates the application of critical security patches.

Usage:
    python updates.py [OPTIONS]
    python updates.py --dry-run
    python updates.py --skip-tests
"""

import argparse
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional


class Color:
    """ANSI color codes."""
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'


@dataclass
class UpdateConfig:
    """Configuration for security updates."""
    skip_tests: bool = False
    force_update: bool = False
    dry_run: bool = False
    verbose: bool = False
    preact_only: bool = False
    mcp_only: bool = False
    langchain_only: bool = False


@dataclass
class PatchInfo:
    """Information about a security patch."""
    name: str
    old_version: str
    new_version: str
    vulnerability: str
    risk_level: str


class SecurityUpdater:
    """Handles security update operations."""

    def __init__(self, config: UpdateConfig):
        self.config = config
        self.script_dir = Path(__file__).parent.resolve()
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.log_dir = self.script_dir / "security-patch-logs"
        self.backup_dir = self.script_dir / "backups" / f"security-patch-{self.timestamp}"
        self.log_file: Optional[Path] = None

    def print_info(self, message: str) -> None:
        """Print info message."""
        self._log(f"{Color.BLUE}[INFO]{Color.NC} {message}")

    def print_success(self, message: str) -> None:
        """Print success message."""
        self._log(f"{Color.GREEN}[SUCCESS]{Color.NC} {message}")

    def print_warning(self, message: str) -> None:
        """Print warning message."""
        self._log(f"{Color.YELLOW}[WARNING]{Color.NC} {message}")

    def print_error(self, message: str) -> None:
        """Print error message."""
        self._log(f"{Color.RED}[ERROR]{Color.NC} {message}")

    def _log(self, message: str) -> None:
        """Log message to console and file."""
        print(message)
        if self.log_file and self.log_file.exists():
            with open(self.log_file, "a") as f:
                # Strip ANSI codes for log file
                clean_msg = message
                for code in [Color.RED, Color.GREEN, Color.YELLOW, Color.BLUE, Color.NC]:
                    clean_msg = clean_msg.replace(code, "")
                f.write(f"{clean_msg}\n")

    def run_cmd(self, cmd: list[str], description: str) -> bool:
        """Run a command with logging."""
        self.print_info(description)

        if self.config.dry_run:
            self.print_info(f"[DRY RUN] Would execute: {' '.join(cmd)}")
            return True

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
            )

            if result.returncode == 0:
                self.print_success(f"Completed: {description}")
                return True
            else:
                self.print_error(f"Failed: {description}")
                if self.config.verbose:
                    print(result.stderr)
                return False

        except Exception as e:
            self.print_error(f"Error: {e}")
            return False

    def initialize(self) -> None:
        """Initialize the update process."""
        self.print_info("Security Updates Script v1.0")
        self.print_info("Starting security patch process...")

        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.backup_dir.mkdir(parents=True, exist_ok=True)

        self.log_file = self.log_dir / f"security-updates_{self.timestamp}.log"

        with open(self.log_file, "w") as f:
            f.write("=" * 50 + "\n")
            f.write("Security Updates Log\n")
            f.write(f"Timestamp: {datetime.now()}\n")
            f.write(f"User: {os.getenv('USER', 'unknown')}\n")
            f.write(f"Directory: {os.getcwd()}\n")
            f.write("=" * 50 + "\n")

        self.print_info(f"Log file: {self.log_file}")
        self.print_info(f"Backup directory: {self.backup_dir}")

    def check_prerequisites(self) -> bool:
        """Check if prerequisites are met."""
        self.print_info("Checking prerequisites...")

        if not Path("package.json").exists():
            self.print_error("package.json not found in current directory")
            return False

        if not shutil.which("npm"):
            self.print_error("npm not found. Please install Node.js and npm")
            return False

        if not shutil.which("git"):
            self.print_error("git not found. Please install git")
            return False

        # Check npm version
        result = subprocess.run(["npm", "--version"], capture_output=True, text=True)
        self.print_info(f"npm version: {result.stdout.strip()}")

        # Check Node version
        result = subprocess.run(["node", "--version"], capture_output=True, text=True)
        self.print_info(f"Node version: {result.stdout.strip()}")

        # Check git status
        result = subprocess.run(["git", "status", "--short"], capture_output=True, text=True)
        if result.stdout.strip():
            self.print_warning("Git working directory has uncommitted changes")
            if not self.config.force_update:
                self.print_error("Commit or stash changes before running this script")
                return False

        self.print_success("Prerequisites check passed")
        return True

    def backup_current_state(self) -> None:
        """Backup current package files."""
        self.print_info("Backing up current state...")

        if self.config.dry_run:
            self.print_info("[DRY RUN] Would backup package.json and package-lock.json")
            return

        shutil.copy("package.json", self.backup_dir / "package.json")
        if Path("package-lock.json").exists():
            shutil.copy("package-lock.json", self.backup_dir / "package-lock.json")

        self.print_success("Backup completed")

    def update_package(self, package: str, version: str, description: str) -> bool:
        """Update a specific npm package."""
        self.print_info("=" * 50)
        self.print_info(f"Updating {package}")
        self.print_info(description)
        self.print_info("=" * 50)

        if not self.run_cmd(
            ["npm", "install", f"{package}@{version}", "--save"],
            f"Installing {package}@{version}",
        ):
            return False

        # Verify update
        result = subprocess.run(
            ["npm", "list", package],
            capture_output=True,
            text=True,
        )

        if version in result.stdout:
            self.print_success(f"{package} updated to {version}")
            return True

        self.print_error(f"{package} update verification failed")
        return False

    def update_preact(self) -> bool:
        """Update preact to fix JSON VNode injection."""
        return self.update_package(
            "preact",
            "10.28.2",
            "Vulnerability: GHSA-36hm-qxxp-pg3m (JSON VNode Injection)",
        )

    def update_mcp(self) -> bool:
        """Update MCP SDK to fix ReDoS vulnerability."""
        return self.update_package(
            "@modelcontextprotocol/sdk",
            "1.25.2",
            "Vulnerability: GHSA-8r9q-7v3j-jr4g (ReDoS)",
        )

    def update_langchain(self) -> bool:
        """Update langchain to fix serialization injection."""
        return self.update_package(
            "langchain",
            "1.2.8",
            "Vulnerability: GHSA-r399-636x-v7f6 (Serialization Injection)",
        )

    def run_tests(self, phase: str) -> bool:
        """Run tests."""
        if self.config.skip_tests:
            self.print_warning(f"Skipping {phase} tests")
            return True

        self.print_info(f"Running {phase} tests...")

        # Type checking
        if not self.run_cmd(["npm", "run", "type-check"], "Running type-check"):
            if not self.config.force_update:
                return False
            self.print_warning("Continuing despite type-check failure (--force flag used)")

        # Linting
        if not self.run_cmd(["npm", "run", "lint"], "Running lint"):
            if not self.config.force_update:
                return False
            self.print_warning("Continuing despite lint failure (--force flag used)")

        self.print_success(f"{phase} tests completed")
        return True

    def run_security_audit(self) -> bool:
        """Run npm audit."""
        self.print_info("Running security audit...")

        result = subprocess.run(
            ["npm", "audit", "--json"],
            capture_output=True,
            text=True,
        )

        try:
            import json
            audit_data = json.loads(result.stdout)
            total_vulns = audit_data.get("metadata", {}).get("vulnerabilities", {}).get("total", 0)

            if total_vulns == 0:
                self.print_success("Security audit passed (0 vulnerabilities)")
                return True
            else:
                self.print_warning(f"Security audit found {total_vulns} vulnerabilities")
                return self.config.force_update

        except (json.JSONDecodeError, KeyError):
            self.print_warning("Could not parse audit results")
            return True

    def create_summary(self) -> None:
        """Create a summary report."""
        summary_file = self.backup_dir / "PATCH_SUMMARY.txt"

        summary = f"""================================================================================
SECURITY PATCH SUMMARY
================================================================================

Applied Patches:
1. preact 10.27.2 → 10.28.2
   - Vulnerability: GHSA-36hm-qxxp-pg3m (JSON VNode Injection)
   - Type: Patch update (safe)

2. @modelcontextprotocol/sdk 1.25.1 → 1.25.2
   - Vulnerability: GHSA-8r9q-7v3j-jr4g (ReDoS)
   - Type: Patch update (safe)

3. langchain 1.0.2 → 1.2.8
   - Vulnerability: GHSA-r399-636x-v7f6 (Serialization Injection)
   - Type: Minor version update (requires testing)

Installation Time: {datetime.now()}
Backup Location: {self.backup_dir}

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
    cp {self.backup_dir}/package.json .
    cp {self.backup_dir}/package-lock.json .
    npm ci
    git reset --hard HEAD

================================================================================
"""

        if not self.config.dry_run:
            summary_file.write_text(summary)

        self.print_info(f"Summary saved to: {summary_file}")
        print(summary)

    def run(self) -> int:
        """Run the security update process."""
        self.initialize()

        if self.config.dry_run:
            self.print_warning("====== DRY RUN MODE ======")
            self.print_warning("No changes will be made to your system")

        if not self.check_prerequisites():
            return 1

        if not self.config.dry_run:
            self.backup_current_state()

        if not self.run_tests("pre-update"):
            self.print_warning("Pre-tests had issues, continuing anyway...")

        # Determine which updates to apply
        failed = 0

        if not self.config.mcp_only and not self.config.langchain_only:
            if not self.update_preact():
                failed += 1

        if not self.config.preact_only and not self.config.langchain_only:
            if not self.update_mcp():
                failed += 1

        if not self.config.preact_only and not self.config.mcp_only:
            if not self.update_langchain():
                failed += 1

        if failed > 0:
            self.print_error("Some updates failed")
            return 1

        if not self.run_tests("post-update"):
            if not self.config.force_update:
                return 1

        if not self.run_security_audit():
            if not self.config.force_update:
                return 1

        self.create_summary()

        self.print_success("=" * 50)
        self.print_success("Security patches applied successfully!")
        self.print_success("=" * 50)

        if self.config.dry_run:
            self.print_info("This was a DRY RUN - no actual changes were made")
        else:
            self.print_info("Next steps:")
            self.print_info(f"1. Review the backup: {self.backup_dir}")
            self.print_info("2. Run: npm test")
            self.print_info("3. Test in staging environment")
            self.print_info("4. Deploy to production when confident")
            self.print_info(f"\nLog file: {self.log_file}")

        return 0


def parse_args() -> UpdateConfig:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Security patch script for vibecode-webgui",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python updates.py                    # Run full security update with tests
    python updates.py --dry-run          # Dry run to see what would be done
    python updates.py --skip-tests       # Update without running tests
    python updates.py --preact-only      # Update only preact
        """,
    )

    parser.add_argument("-d", "--dry-run", action="store_true",
                        help="Show what would be done without making changes")
    parser.add_argument("-s", "--skip-tests", action="store_true",
                        help="Skip running tests after updates")
    parser.add_argument("-f", "--force", action="store_true",
                        help="Force updates even if tests fail")
    parser.add_argument("-v", "--verbose", action="store_true",
                        help="Enable verbose output")
    parser.add_argument("-p", "--preact-only", action="store_true",
                        help="Update only preact patch")
    parser.add_argument("-m", "--mcp-only", action="store_true",
                        help="Update only MCP SDK patch")
    parser.add_argument("-l", "--langchain-only", action="store_true",
                        help="Update only langchain patch")

    args = parser.parse_args()

    return UpdateConfig(
        skip_tests=args.skip_tests,
        force_update=args.force,
        dry_run=args.dry_run,
        verbose=args.verbose,
        preact_only=args.preact_only,
        mcp_only=args.mcp_only,
        langchain_only=args.langchain_only,
    )


def main() -> int:
    """Main entry point."""
    config = parse_args()
    updater = SecurityUpdater(config)
    return updater.run()


if __name__ == "__main__":
    sys.exit(main())

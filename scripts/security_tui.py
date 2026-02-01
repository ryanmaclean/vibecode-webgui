#!/usr/bin/env python3
"""
VibeCode Security TUI.

A text-based user interface for managing security operations including
scanning, auditing, monitoring, testing, and binary verification.
"""

import argparse
import os
import subprocess
import sys
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Optional


# ANSI color codes
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    CYAN = '\033[0;36m'
    MAGENTA = '\033[0;35m'
    WHITE = '\033[1;37m'
    BOLD = '\033[1m'
    DIM = '\033[2m'
    NC = '\033[0m'  # No Color


class Category(Enum):
    """Security operation categories."""
    SCANNING = "scanning"
    AUDITING = "auditing"
    MONITORING = "monitoring"
    TESTING = "testing"
    SETUP = "setup"
    UPDATES = "updates"
    BRANCH_PROTECTION = "branch_protection"
    SECRETS = "secrets"
    BINARY_VERIFICATION = "binary_verification"


@dataclass
class Script:
    """Represents a security script."""
    name: str
    path: Path
    description: str
    script_type: str  # "python", "shell", "typescript"

    @property
    def exists(self) -> bool:
        """Check if the script exists."""
        return self.path.exists()

    @property
    def display_name(self) -> str:
        """Get display name without extension."""
        return self.path.stem.replace('_', ' ').replace('-', ' ').title()


@dataclass
class CategoryConfig:
    """Configuration for a security category."""
    name: str
    display_name: str
    color: str
    description: str
    scripts: list[Script] = field(default_factory=list)


class SecurityManager:
    """Manages security operations via TUI."""

    def __init__(self, scripts_dir: Optional[Path] = None):
        """
        Initialize the security manager.

        Args:
            scripts_dir: Base directory for scripts
        """
        if scripts_dir is None:
            scripts_dir = Path(__file__).parent

        self.scripts_dir = scripts_dir
        self.security_dir = scripts_dir / "security"
        self.categories = self._build_categories()

    def _build_categories(self) -> dict[Category, CategoryConfig]:
        """Build category configurations with discovered scripts."""
        categories = {}

        # Scanning
        categories[Category.SCANNING] = CategoryConfig(
            name="scanning",
            display_name="Security Scanning",
            color=Colors.RED,
            description="Scan for vulnerabilities and security issues",
            scripts=[
                Script(
                    name="scan",
                    path=self.security_dir / "scan.py",
                    description="Run comprehensive security scan",
                    script_type="python",
                ),
                Script(
                    name="security-scan",
                    path=self.scripts_dir / "security-scan.sh",
                    description="Shell-based security scan",
                    script_type="shell",
                ),
                Script(
                    name="vulnerability-scan",
                    path=self.scripts_dir / "vulnerability-scan.sh",
                    description="Scan for known vulnerabilities",
                    script_type="shell",
                ),
            ],
        )

        # Auditing
        categories[Category.AUDITING] = CategoryConfig(
            name="auditing",
            display_name="Security Auditing",
            color=Colors.YELLOW,
            description="Audit security configurations and secrets",
            scripts=[
                Script(
                    name="audit",
                    path=self.security_dir / "audit.py",
                    description="Run security audit",
                    script_type="python",
                ),
                Script(
                    name="security-audit",
                    path=self.scripts_dir / "security-audit.sh",
                    description="Shell-based security audit",
                    script_type="shell",
                ),
                Script(
                    name="audit-secrets",
                    path=self.security_dir / "audit-secrets.ts",
                    description="Audit secrets and credentials",
                    script_type="typescript",
                ),
                Script(
                    name="audit-documentation",
                    path=self.scripts_dir / "audit-documentation.sh",
                    description="Audit security documentation",
                    script_type="shell",
                ),
                Script(
                    name="component-status-audit",
                    path=self.scripts_dir / "component-status-audit.sh",
                    description="Audit component security status",
                    script_type="shell",
                ),
            ],
        )

        # Monitoring
        categories[Category.MONITORING] = CategoryConfig(
            name="monitoring",
            display_name="Security Monitoring",
            color=Colors.CYAN,
            description="Monitor security events and alerts",
            scripts=[
                Script(
                    name="monitoring",
                    path=self.security_dir / "monitoring.py",
                    description="Security monitoring dashboard",
                    script_type="python",
                ),
                Script(
                    name="security-monitoring",
                    path=self.scripts_dir / "security-monitoring.sh",
                    description="Shell-based security monitoring",
                    script_type="shell",
                ),
            ],
        )

        # Testing
        categories[Category.TESTING] = CategoryConfig(
            name="testing",
            display_name="Security Testing",
            color=Colors.MAGENTA,
            description="Run security tests and validations",
            scripts=[
                Script(
                    name="test",
                    path=self.security_dir / "test.py",
                    description="Run security tests",
                    script_type="python",
                ),
                Script(
                    name="security-test",
                    path=self.scripts_dir / "security-test.sh",
                    description="Shell-based security tests",
                    script_type="shell",
                ),
            ],
        )

        # Setup
        categories[Category.SETUP] = CategoryConfig(
            name="setup",
            display_name="Security Setup",
            color=Colors.GREEN,
            description="Configure security settings",
            scripts=[
                Script(
                    name="setup",
                    path=self.security_dir / "setup.py",
                    description="Security setup wizard",
                    script_type="python",
                ),
                Script(
                    name="security-setup",
                    path=self.scripts_dir / "security-setup.sh",
                    description="Shell-based security setup",
                    script_type="shell",
                ),
            ],
        )

        # Updates
        categories[Category.UPDATES] = CategoryConfig(
            name="updates",
            display_name="Security Updates",
            color=Colors.BLUE,
            description="Apply security updates and patches",
            scripts=[
                Script(
                    name="updates",
                    path=self.security_dir / "updates.py",
                    description="Check and apply security updates",
                    script_type="python",
                ),
                Script(
                    name="security-updates",
                    path=self.scripts_dir / "security-updates.sh",
                    description="Shell-based security updates",
                    script_type="shell",
                ),
            ],
        )

        # Branch Protection
        categories[Category.BRANCH_PROTECTION] = CategoryConfig(
            name="branch_protection",
            display_name="Branch Protection",
            color=Colors.WHITE,
            description="Manage GitHub branch protection rules",
            scripts=[
                Script(
                    name="check-branch-protection",
                    path=self.security_dir / "check_branch_protection.py",
                    description="Check branch protection status",
                    script_type="python",
                ),
                Script(
                    name="enable-branch-protection",
                    path=self.security_dir / "enable_branch_protection.py",
                    description="Enable branch protection rules",
                    script_type="python",
                ),
            ],
        )

        # Secrets Management
        categories[Category.SECRETS] = CategoryConfig(
            name="secrets",
            display_name="Secrets Management",
            color=Colors.RED,
            description="Manage secrets and credentials",
            scripts=[
                Script(
                    name="migrate-secrets",
                    path=self.security_dir / "migrate_secrets_to_keychain.py",
                    description="Migrate secrets to keychain",
                    script_type="python",
                ),
                Script(
                    name="validate-keychain",
                    path=self.security_dir / "validate-keychain.ts",
                    description="Validate keychain configuration",
                    script_type="typescript",
                ),
                Script(
                    name="install-hook",
                    path=self.security_dir / "install-hook.ts",
                    description="Install security git hooks",
                    script_type="typescript",
                ),
            ],
        )

        # Binary Verification
        categories[Category.BINARY_VERIFICATION] = CategoryConfig(
            name="binary_verification",
            display_name="Binary Verification",
            color=Colors.CYAN,
            description="Verify downloaded binaries and tools",
            scripts=[
                Script(
                    name="verify-binary-download",
                    path=self.security_dir / "verify_binary_download.py",
                    description="Generic binary verification",
                    script_type="python",
                ),
                Script(
                    name="verify-helm",
                    path=self.security_dir / "verify_helm.py",
                    description="Verify Helm binary",
                    script_type="python",
                ),
                Script(
                    name="verify-kubectl",
                    path=self.security_dir / "verify_kubectl.py",
                    description="Verify kubectl binary",
                    script_type="python",
                ),
                Script(
                    name="verify-kubectx",
                    path=self.security_dir / "verify_kubectx.py",
                    description="Verify kubectx binary",
                    script_type="python",
                ),
                Script(
                    name="verify-kubens",
                    path=self.security_dir / "verify_kubens.py",
                    description="Verify kubens binary",
                    script_type="python",
                ),
            ],
        )

        return categories

    def clear_screen(self) -> None:
        """Clear the terminal screen."""
        os.system('clear' if os.name != 'nt' else 'cls')

    def print_header(self) -> None:
        """Print the application header."""
        print(f"{Colors.BOLD}{Colors.RED}")
        print("=" * 60)
        print("       VibeCode Security Manager")
        print("=" * 60)
        print(f"{Colors.NC}")
        print()

    def print_main_menu(self) -> None:
        """Print the main menu."""
        print(f"{Colors.BOLD}Security Categories:{Colors.NC}")
        print()

        menu_items = [
            ("1", "Scanning", Category.SCANNING),
            ("2", "Auditing", Category.AUDITING),
            ("3", "Monitoring", Category.MONITORING),
            ("4", "Testing", Category.TESTING),
            ("5", "Setup", Category.SETUP),
            ("6", "Updates", Category.UPDATES),
            ("7", "Branch Protection", Category.BRANCH_PROTECTION),
            ("8", "Secrets Management", Category.SECRETS),
            ("9", "Binary Verification", Category.BINARY_VERIFICATION),
        ]

        for key, label, category in menu_items:
            config = self.categories[category]
            available = sum(1 for s in config.scripts if s.exists)
            total = len(config.scripts)
            status = f"[{available}/{total}]"
            print(f"  {Colors.BOLD}[{key}]{Colors.NC} {config.color}{label:<22}{Colors.NC} {Colors.DIM}{status}{Colors.NC}")

        print()
        print(f"  {Colors.BOLD}[a]{Colors.NC} Run All Scans")
        print(f"  {Colors.BOLD}[s]{Colors.NC} Status Overview")
        print(f"  {Colors.BOLD}[q]{Colors.NC} Quit")
        print()

    def print_category_menu(self, config: CategoryConfig) -> None:
        """Print the menu for a specific category."""
        print(f"{Colors.BOLD}{config.color}{config.display_name}{Colors.NC}")
        print(f"{Colors.DIM}{config.description}{Colors.NC}")
        print(f"{Colors.DIM}{'=' * len(config.display_name)}{Colors.NC}")
        print()

        for idx, script in enumerate(config.scripts, 1):
            if script.exists:
                status = f"{Colors.GREEN}available{Colors.NC}"
            else:
                status = f"{Colors.RED}missing{Colors.NC}"

            type_badge = self._get_type_badge(script.script_type)
            print(f"  {Colors.BOLD}[{idx}]{Colors.NC} {script.display_name}")
            print(f"      {Colors.DIM}{script.description}{Colors.NC}")
            print(f"      {type_badge} ({status})")
            print()

        print(f"  {Colors.BOLD}[r]{Colors.NC} Run All in Category")
        print(f"  {Colors.BOLD}[b]{Colors.NC} Back to Main Menu")
        print(f"  {Colors.BOLD}[q]{Colors.NC} Quit")
        print()

    def _get_type_badge(self, script_type: str) -> str:
        """Get a colored badge for script type."""
        badges = {
            "python": f"{Colors.BLUE}[Python]{Colors.NC}",
            "shell": f"{Colors.GREEN}[Shell]{Colors.NC}",
            "typescript": f"{Colors.YELLOW}[TypeScript]{Colors.NC}",
        }
        return badges.get(script_type, f"[{script_type}]")

    def run_script(self, script: Script) -> bool:
        """
        Run a security script.

        Args:
            script: Script to run

        Returns:
            True if script succeeded, False otherwise
        """
        if not script.exists:
            print(f"{Colors.RED}Error: Script not found: {script.path}{Colors.NC}")
            return False

        print()
        print(f"{Colors.YELLOW}Running: {script.display_name}{Colors.NC}")
        print(f"{Colors.DIM}Script: {script.path}{Colors.NC}")
        print("-" * 60)
        print()

        # Determine how to run the script
        if script.script_type == "python":
            cmd = ["python3", str(script.path)]
        elif script.script_type == "shell":
            cmd = ["bash", str(script.path)]
        elif script.script_type == "typescript":
            # Check for ts-node or npx tsx
            if self._command_exists("npx"):
                cmd = ["npx", "tsx", str(script.path)]
            else:
                print(f"{Colors.YELLOW}TypeScript requires npx/tsx to run{Colors.NC}")
                return False
        else:
            cmd = [str(script.path)]

        result = subprocess.run(
            cmd,
            cwd=script.path.parent,
            check=False,
        )

        print()
        print("-" * 60)

        if result.returncode == 0:
            print(f"{Colors.GREEN}+ {script.display_name} completed successfully{Colors.NC}")
            return True
        else:
            print(f"{Colors.RED}x {script.display_name} failed (exit code: {result.returncode}){Colors.NC}")
            return False

    def _command_exists(self, cmd: str) -> bool:
        """Check if a command exists in PATH."""
        result = subprocess.run(
            ["which", cmd],
            capture_output=True,
            check=False,
        )
        return result.returncode == 0

    def run_all_in_category(self, config: CategoryConfig) -> tuple[int, int]:
        """
        Run all scripts in a category.

        Args:
            config: Category configuration

        Returns:
            Tuple of (successful, failed) counts
        """
        print(f"\n{Colors.BOLD}Running all {config.display_name} scripts...{Colors.NC}\n")

        successful = 0
        failed = 0

        for script in config.scripts:
            if script.exists:
                if self.run_script(script):
                    successful += 1
                else:
                    failed += 1
                print()

        return successful, failed

    def run_all_scans(self) -> None:
        """Run all scanning and auditing scripts."""
        print(f"\n{Colors.BOLD}{Colors.RED}Running Complete Security Scan...{Colors.NC}\n")

        total_success = 0
        total_fail = 0

        # Run scanning
        config = self.categories[Category.SCANNING]
        success, fail = self.run_all_in_category(config)
        total_success += success
        total_fail += fail

        # Run auditing
        config = self.categories[Category.AUDITING]
        success, fail = self.run_all_in_category(config)
        total_success += success
        total_fail += fail

        print()
        print("=" * 60)
        print(f"{Colors.BOLD}Security Scan Complete{Colors.NC}")
        print(f"  {Colors.GREEN}Successful: {total_success}{Colors.NC}")
        print(f"  {Colors.RED}Failed: {total_fail}{Colors.NC}")
        print("=" * 60)

    def status_overview(self) -> None:
        """Show status overview of all security scripts."""
        self.clear_screen()
        self.print_header()

        print(f"{Colors.BOLD}Security Scripts Status Overview{Colors.NC}")
        print("=" * 60)
        print()

        total_available = 0
        total_missing = 0

        for category, config in self.categories.items():
            available = [s for s in config.scripts if s.exists]
            missing = [s for s in config.scripts if not s.exists]

            total_available += len(available)
            total_missing += len(missing)

            status = f"{Colors.GREEN}{len(available)}{Colors.NC}/{len(config.scripts)}"
            print(f"{config.color}{Colors.BOLD}{config.display_name}{Colors.NC} [{status}]")

            for script in available:
                type_badge = self._get_type_badge(script.script_type)
                print(f"  {Colors.GREEN}+{Colors.NC} {script.name} {type_badge}")

            for script in missing:
                type_badge = self._get_type_badge(script.script_type)
                print(f"  {Colors.RED}-{Colors.NC} {script.name} {type_badge} (missing)")

            print()

        print("=" * 60)
        print(f"{Colors.BOLD}Summary:{Colors.NC}")
        print(f"  Available: {Colors.GREEN}{total_available}{Colors.NC}")
        print(f"  Missing: {Colors.RED}{total_missing}{Colors.NC}")
        print(f"  Total: {total_available + total_missing}")
        print()

    def wait_for_key(self) -> None:
        """Wait for user to press a key."""
        print()
        input(f"{Colors.DIM}Press Enter to continue...{Colors.NC}")

    def category_menu_loop(self, category: Category) -> None:
        """
        Run the menu loop for a specific category.

        Args:
            category: The category to manage
        """
        config = self.categories.get(category)
        if config is None:
            print(f"{Colors.RED}Category not available{Colors.NC}")
            self.wait_for_key()
            return

        while True:
            self.clear_screen()
            self.print_header()
            self.print_category_menu(config)

            try:
                choice = input(f"{Colors.BOLD}Select option: {Colors.NC}").strip().lower()
            except (KeyboardInterrupt, EOFError):
                print()
                return

            # Check for numeric choice (script selection)
            if choice.isdigit():
                idx = int(choice) - 1
                if 0 <= idx < len(config.scripts):
                    script = config.scripts[idx]
                    self.run_script(script)
                    self.wait_for_key()
                else:
                    print(f"{Colors.RED}Invalid selection{Colors.NC}")
                    self.wait_for_key()

            elif choice == "r":
                self.run_all_in_category(config)
                self.wait_for_key()

            elif choice == "b":
                return

            elif choice == "q":
                print(f"\n{Colors.GREEN}Goodbye!{Colors.NC}")
                sys.exit(0)

    def main_menu_loop(self) -> None:
        """Run the main menu loop."""
        category_map = {
            "1": Category.SCANNING,
            "2": Category.AUDITING,
            "3": Category.MONITORING,
            "4": Category.TESTING,
            "5": Category.SETUP,
            "6": Category.UPDATES,
            "7": Category.BRANCH_PROTECTION,
            "8": Category.SECRETS,
            "9": Category.BINARY_VERIFICATION,
        }

        while True:
            self.clear_screen()
            self.print_header()
            self.print_main_menu()

            try:
                choice = input(f"{Colors.BOLD}Select option: {Colors.NC}").strip().lower()
            except (KeyboardInterrupt, EOFError):
                print(f"\n{Colors.GREEN}Goodbye!{Colors.NC}")
                break

            if choice in category_map:
                self.category_menu_loop(category_map[choice])

            elif choice == "a":
                self.run_all_scans()
                self.wait_for_key()

            elif choice == "s":
                self.status_overview()
                self.wait_for_key()

            elif choice == "q":
                print(f"\n{Colors.GREEN}Goodbye!{Colors.NC}")
                break

    def run_direct_action(
        self,
        category_name: str,
        script_name: Optional[str] = None,
        run_all: bool = False,
    ) -> int:
        """
        Run a direct action without the TUI.

        Args:
            category_name: Name of the category
            script_name: Optional specific script name
            run_all: Run all scripts in category

        Returns:
            0 on success, 1 on failure
        """
        # Find the category
        config = None
        for cat, cfg in self.categories.items():
            if cfg.name == category_name:
                config = cfg
                break

        if config is None:
            print(f"{Colors.RED}Category '{category_name}' not found{Colors.NC}")
            print(f"Available: {', '.join(c.name for c in self.categories.values())}")
            return 1

        if run_all:
            success, fail = self.run_all_in_category(config)
            return 0 if fail == 0 else 1

        if script_name:
            # Find the script
            script = None
            for s in config.scripts:
                if s.name == script_name:
                    script = s
                    break

            if script is None:
                print(f"{Colors.RED}Script '{script_name}' not found in {config.display_name}{Colors.NC}")
                print(f"Available: {', '.join(s.name for s in config.scripts)}")
                return 1

            return 0 if self.run_script(script) else 1

        print(f"{Colors.RED}Specify --script or --all{Colors.NC}")
        return 1


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="VibeCode Security Manager - Manage security operations via TUI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
Examples:
  %(prog)s                                    # Launch interactive TUI
  %(prog)s --category scanning --all          # Run all scanning scripts
  %(prog)s --category auditing --script audit # Run specific audit script
  %(prog)s --scan-all                         # Run all scans and audits
  %(prog)s --list                             # List all categories and scripts
  %(prog)s --status                           # Show status overview

Categories:
  scanning, auditing, monitoring, testing, setup,
  updates, branch_protection, secrets, binary_verification
""",
    )
    parser.add_argument(
        "--category",
        type=str,
        help="Category for direct action",
    )
    parser.add_argument(
        "--script",
        type=str,
        help="Specific script to run (requires --category)",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Run all scripts in category",
    )
    parser.add_argument(
        "--scan-all",
        action="store_true",
        help="Run all scanning and auditing scripts",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List all categories and scripts",
    )
    parser.add_argument(
        "--status",
        action="store_true",
        help="Show status overview",
    )
    parser.add_argument(
        "--scripts-dir",
        type=Path,
        help="Override scripts directory",
    )
    args = parser.parse_args()

    manager = SecurityManager(scripts_dir=args.scripts_dir)

    # List mode
    if args.list:
        print(f"{Colors.BOLD}Security Categories and Scripts:{Colors.NC}")
        print()
        for config in manager.categories.values():
            print(f"{config.color}{Colors.BOLD}{config.display_name}{Colors.NC}")
            print(f"  Category: {config.name}")
            for script in config.scripts:
                status = f"{Colors.GREEN}+{Colors.NC}" if script.exists else f"{Colors.RED}-{Colors.NC}"
                print(f"    {status} {script.name} ({script.script_type})")
            print()
        return 0

    # Status mode
    if args.status:
        manager.status_overview()
        return 0

    # Run all scans
    if args.scan_all:
        manager.run_all_scans()
        return 0

    # Direct category action
    if args.category:
        return manager.run_direct_action(
            category_name=args.category,
            script_name=args.script,
            run_all=args.all,
        )

    # Check for orphaned arguments
    if args.script or args.all:
        print(f"{Colors.RED}Error: --script and --all require --category{Colors.NC}")
        return 1

    # Interactive TUI mode
    try:
        manager.main_menu_loop()
    except KeyboardInterrupt:
        print(f"\n{Colors.GREEN}Goodbye!{Colors.NC}")

    return 0


if __name__ == "__main__":
    sys.exit(main())

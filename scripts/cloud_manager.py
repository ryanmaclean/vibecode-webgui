#!/usr/bin/env python3
"""
VibeCode Cloud Manager TUI.

A text-based user interface for managing cloud operations across
AWS, GCP, Docker, and KIND providers.
"""

import argparse
import os
import subprocess
import sys
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Callable, Optional


# ANSI color codes
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    CYAN = '\033[0;36m'
    MAGENTA = '\033[0;35m'
    BOLD = '\033[1m'
    DIM = '\033[2m'
    NC = '\033[0m'  # No Color


class Provider(Enum):
    """Cloud provider types."""
    AWS = "aws"
    GCP = "gcp"
    DOCKER = "docker"
    KIND = "kind"


@dataclass
class ProviderConfig:
    """Configuration for a cloud provider."""
    name: str
    display_name: str
    color: str
    scripts_dir: Path
    start_script: Optional[str] = None
    stop_script: Optional[str] = None
    test_script: Optional[str] = None


class CloudManager:
    """Manages cloud operations via TUI."""

    def __init__(self, scripts_dir: Optional[Path] = None):
        """
        Initialize the cloud manager.

        Args:
            scripts_dir: Base directory for cloud scripts
        """
        if scripts_dir is None:
            scripts_dir = Path(__file__).parent / "cloud"

        self.scripts_dir = scripts_dir
        self.providers = self._discover_providers()

    def _discover_providers(self) -> dict[Provider, ProviderConfig]:
        """Discover available cloud providers and their scripts."""
        providers = {}

        # AWS
        aws_dir = self.scripts_dir / "aws"
        if aws_dir.exists():
            providers[Provider.AWS] = ProviderConfig(
                name="aws",
                display_name="Amazon Web Services",
                color=Colors.YELLOW,
                scripts_dir=aws_dir,
                start_script="start-workspace.sh",
                stop_script="stop-workspace.sh",
            )

        # GCP
        gcp_dir = self.scripts_dir / "gcp"
        if gcp_dir.exists():
            providers[Provider.GCP] = ProviderConfig(
                name="gcp",
                display_name="Google Cloud Platform",
                color=Colors.BLUE,
                scripts_dir=gcp_dir,
                start_script="start-workspace.sh",
                stop_script="stop-workspace.sh",
            )

        # Docker
        docker_dir = self.scripts_dir / "docker"
        if docker_dir.exists():
            providers[Provider.DOCKER] = ProviderConfig(
                name="docker",
                display_name="Docker Compose",
                color=Colors.CYAN,
                scripts_dir=docker_dir,
                start_script="start-compose.sh",
                stop_script="stop-compose.sh",
            )

        # KIND
        kind_dir = self.scripts_dir / "kind"
        if kind_dir.exists():
            providers[Provider.KIND] = ProviderConfig(
                name="kind",
                display_name="Kubernetes in Docker",
                color=Colors.MAGENTA,
                scripts_dir=kind_dir,
                test_script="test-cloud-chart.sh",
            )

        return providers

    def clear_screen(self) -> None:
        """Clear the terminal screen."""
        os.system('clear' if os.name != 'nt' else 'cls')

    def print_header(self) -> None:
        """Print the application header."""
        print(f"{Colors.BOLD}{Colors.BLUE}")
        print("=" * 60)
        print("       VibeCode Cloud Manager")
        print("=" * 60)
        print(f"{Colors.NC}")
        print()

    def print_provider_status(self) -> None:
        """Print status of all providers."""
        print(f"{Colors.BOLD}Available Providers:{Colors.NC}")
        print()

        for provider, config in self.providers.items():
            scripts = []
            if config.start_script and (config.scripts_dir / config.start_script).exists():
                scripts.append("start")
            if config.stop_script and (config.scripts_dir / config.stop_script).exists():
                scripts.append("stop")
            if config.test_script and (config.scripts_dir / config.test_script).exists():
                scripts.append("test")

            status = f"[{', '.join(scripts)}]" if scripts else "[no scripts]"
            print(f"  {config.color}{config.display_name}{Colors.NC}")
            print(f"    {Colors.DIM}Actions: {status}{Colors.NC}")
            print()

    def print_main_menu(self) -> None:
        """Print the main menu."""
        print(f"{Colors.BOLD}Main Menu:{Colors.NC}")
        print()

        menu_items = [
            ("1", "AWS", Colors.YELLOW),
            ("2", "GCP", Colors.BLUE),
            ("3", "Docker", Colors.CYAN),
            ("4", "KIND", Colors.MAGENTA),
            ("", "", ""),
            ("s", "Status Overview", Colors.GREEN),
            ("q", "Quit", Colors.RED),
        ]

        for key, label, color in menu_items:
            if key:
                print(f"  {Colors.BOLD}[{key}]{Colors.NC} {color}{label}{Colors.NC}")
            else:
                print()

        print()

    def print_provider_menu(self, config: ProviderConfig) -> None:
        """Print the menu for a specific provider."""
        print(f"{Colors.BOLD}{config.color}{config.display_name}{Colors.NC}")
        print(f"{Colors.DIM}{'=' * len(config.display_name)}{Colors.NC}")
        print()

        if config.start_script:
            script_path = config.scripts_dir / config.start_script
            status = f"{Colors.GREEN}available{Colors.NC}" if script_path.exists() else f"{Colors.RED}missing{Colors.NC}"
            print(f"  {Colors.BOLD}[1]{Colors.NC} Start Workspace  ({status})")

        if config.stop_script:
            script_path = config.scripts_dir / config.stop_script
            status = f"{Colors.GREEN}available{Colors.NC}" if script_path.exists() else f"{Colors.RED}missing{Colors.NC}"
            print(f"  {Colors.BOLD}[2]{Colors.NC} Stop Workspace   ({status})")

        if config.test_script:
            script_path = config.scripts_dir / config.test_script
            status = f"{Colors.GREEN}available{Colors.NC}" if script_path.exists() else f"{Colors.RED}missing{Colors.NC}"
            print(f"  {Colors.BOLD}[3]{Colors.NC} Run Tests        ({status})")

        print()
        print(f"  {Colors.BOLD}[b]{Colors.NC} Back to Main Menu")
        print(f"  {Colors.BOLD}[q]{Colors.NC} Quit")
        print()

    def run_script(self, script_path: Path, description: str) -> bool:
        """
        Run a shell script.

        Args:
            script_path: Path to the script
            description: Description of what the script does

        Returns:
            True if script succeeded, False otherwise
        """
        if not script_path.exists():
            print(f"{Colors.RED}Error: Script not found: {script_path}{Colors.NC}")
            return False

        print()
        print(f"{Colors.YELLOW}Running: {description}{Colors.NC}")
        print(f"{Colors.DIM}Script: {script_path}{Colors.NC}")
        print("-" * 60)
        print()

        result = subprocess.run(
            ["bash", str(script_path)],
            cwd=script_path.parent,
            check=False,
        )

        print()
        print("-" * 60)

        if result.returncode == 0:
            print(f"{Colors.GREEN}+ {description} completed successfully{Colors.NC}")
            return True
        else:
            print(f"{Colors.RED}x {description} failed (exit code: {result.returncode}){Colors.NC}")
            return False

    def handle_provider_action(self, config: ProviderConfig, action: str) -> bool:
        """
        Handle an action for a provider.

        Args:
            config: Provider configuration
            action: Action to perform (start, stop, test)

        Returns:
            True if action succeeded, False otherwise
        """
        if action == "start" and config.start_script:
            script_path = config.scripts_dir / config.start_script
            return self.run_script(script_path, f"Start {config.display_name} Workspace")

        elif action == "stop" and config.stop_script:
            script_path = config.scripts_dir / config.stop_script
            return self.run_script(script_path, f"Stop {config.display_name} Workspace")

        elif action == "test" and config.test_script:
            script_path = config.scripts_dir / config.test_script
            return self.run_script(script_path, f"Test {config.display_name}")

        else:
            print(f"{Colors.RED}Action not available for this provider{Colors.NC}")
            return False

    def wait_for_key(self) -> None:
        """Wait for user to press a key."""
        print()
        input(f"{Colors.DIM}Press Enter to continue...{Colors.NC}")

    def provider_menu_loop(self, provider: Provider) -> None:
        """
        Run the menu loop for a specific provider.

        Args:
            provider: The provider to manage
        """
        config = self.providers.get(provider)
        if config is None:
            print(f"{Colors.RED}Provider not available{Colors.NC}")
            self.wait_for_key()
            return

        while True:
            self.clear_screen()
            self.print_header()
            self.print_provider_menu(config)

            try:
                choice = input(f"{Colors.BOLD}Select option: {Colors.NC}").strip().lower()
            except (KeyboardInterrupt, EOFError):
                print()
                return

            if choice == "1" and config.start_script:
                self.handle_provider_action(config, "start")
                self.wait_for_key()

            elif choice == "2" and config.stop_script:
                self.handle_provider_action(config, "stop")
                self.wait_for_key()

            elif choice == "3" and config.test_script:
                self.handle_provider_action(config, "test")
                self.wait_for_key()

            elif choice == "b":
                return

            elif choice == "q":
                print(f"\n{Colors.GREEN}Goodbye!{Colors.NC}")
                sys.exit(0)

    def status_overview(self) -> None:
        """Show status overview of all providers."""
        self.clear_screen()
        self.print_header()

        print(f"{Colors.BOLD}Cloud Provider Status Overview{Colors.NC}")
        print("=" * 60)
        print()

        for provider, config in self.providers.items():
            print(f"{config.color}{Colors.BOLD}{config.display_name}{Colors.NC}")
            print(f"  Directory: {config.scripts_dir}")

            # List available scripts
            scripts_found = []
            if config.start_script:
                path = config.scripts_dir / config.start_script
                if path.exists():
                    scripts_found.append(f"{Colors.GREEN}start{Colors.NC}")
                else:
                    scripts_found.append(f"{Colors.RED}start (missing){Colors.NC}")

            if config.stop_script:
                path = config.scripts_dir / config.stop_script
                if path.exists():
                    scripts_found.append(f"{Colors.GREEN}stop{Colors.NC}")
                else:
                    scripts_found.append(f"{Colors.RED}stop (missing){Colors.NC}")

            if config.test_script:
                path = config.scripts_dir / config.test_script
                if path.exists():
                    scripts_found.append(f"{Colors.GREEN}test{Colors.NC}")
                else:
                    scripts_found.append(f"{Colors.RED}test (missing){Colors.NC}")

            print(f"  Scripts: {', '.join(scripts_found)}")
            print()

        self.wait_for_key()

    def main_menu_loop(self) -> None:
        """Run the main menu loop."""
        while True:
            self.clear_screen()
            self.print_header()
            self.print_main_menu()

            try:
                choice = input(f"{Colors.BOLD}Select option: {Colors.NC}").strip().lower()
            except (KeyboardInterrupt, EOFError):
                print(f"\n{Colors.GREEN}Goodbye!{Colors.NC}")
                break

            if choice == "1":
                if Provider.AWS in self.providers:
                    self.provider_menu_loop(Provider.AWS)
                else:
                    print(f"{Colors.RED}AWS not available{Colors.NC}")
                    self.wait_for_key()

            elif choice == "2":
                if Provider.GCP in self.providers:
                    self.provider_menu_loop(Provider.GCP)
                else:
                    print(f"{Colors.RED}GCP not available{Colors.NC}")
                    self.wait_for_key()

            elif choice == "3":
                if Provider.DOCKER in self.providers:
                    self.provider_menu_loop(Provider.DOCKER)
                else:
                    print(f"{Colors.RED}Docker not available{Colors.NC}")
                    self.wait_for_key()

            elif choice == "4":
                if Provider.KIND in self.providers:
                    self.provider_menu_loop(Provider.KIND)
                else:
                    print(f"{Colors.RED}KIND not available{Colors.NC}")
                    self.wait_for_key()

            elif choice == "s":
                self.status_overview()

            elif choice == "q":
                print(f"\n{Colors.GREEN}Goodbye!{Colors.NC}")
                break

    def run_direct_action(self, provider_name: str, action: str) -> int:
        """
        Run a direct action without the TUI.

        Args:
            provider_name: Name of the provider (aws, gcp, docker, kind)
            action: Action to perform (start, stop, test)

        Returns:
            0 on success, 1 on failure
        """
        # Find the provider
        provider = None
        config = None
        for p, c in self.providers.items():
            if c.name == provider_name:
                provider = p
                config = c
                break

        if config is None:
            print(f"{Colors.RED}Provider '{provider_name}' not found{Colors.NC}")
            print(f"Available providers: {', '.join(c.name for c in self.providers.values())}")
            return 1

        if self.handle_provider_action(config, action):
            return 0
        return 1


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="VibeCode Cloud Manager - Manage cloud operations via TUI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
Examples:
  %(prog)s                           # Launch interactive TUI
  %(prog)s --provider aws --start    # Start AWS workspace directly
  %(prog)s --provider gcp --stop     # Stop GCP workspace directly
  %(prog)s --provider docker --start # Start Docker compose
  %(prog)s --provider kind --test    # Run KIND tests
  %(prog)s --list                    # List available providers
""",
    )
    parser.add_argument(
        "--provider",
        type=str,
        choices=["aws", "gcp", "docker", "kind"],
        help="Provider to use for direct action",
    )
    parser.add_argument(
        "--start",
        action="store_true",
        help="Start workspace (requires --provider)",
    )
    parser.add_argument(
        "--stop",
        action="store_true",
        help="Stop workspace (requires --provider)",
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Run tests (requires --provider)",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List available providers and exit",
    )
    parser.add_argument(
        "--scripts-dir",
        type=Path,
        help="Override scripts directory",
    )
    args = parser.parse_args()

    manager = CloudManager(scripts_dir=args.scripts_dir)

    # List providers and exit
    if args.list:
        print(f"{Colors.BOLD}Available Cloud Providers:{Colors.NC}")
        print()
        for config in manager.providers.values():
            print(f"  {config.color}{config.name}{Colors.NC}: {config.display_name}")
            print(f"    Directory: {config.scripts_dir}")
        return 0

    # Direct action mode
    if args.provider:
        action = None
        if args.start:
            action = "start"
        elif args.stop:
            action = "stop"
        elif args.test:
            action = "test"

        if action is None:
            print(f"{Colors.RED}Error: Specify --start, --stop, or --test with --provider{Colors.NC}")
            return 1

        return manager.run_direct_action(args.provider, action)

    # Check for action without provider
    if args.start or args.stop or args.test:
        print(f"{Colors.RED}Error: --start, --stop, and --test require --provider{Colors.NC}")
        return 1

    # Interactive TUI mode
    try:
        manager.main_menu_loop()
    except KeyboardInterrupt:
        print(f"\n{Colors.GREEN}Goodbye!{Colors.NC}")

    return 0


if __name__ == "__main__":
    sys.exit(main())

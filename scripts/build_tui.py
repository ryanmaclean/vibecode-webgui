#!/usr/bin/env python3
"""Build TUI - Text User Interface for all VibeCode build scripts.

A curses-based TUI that consolidates all build-*.sh scripts into one
unified interface with categories, descriptions, and execution options.

Examples:
    ./scripts/build_tui.py
    ./scripts/build_tui.py --list
    ./scripts/build_tui.py --run build-production.sh
"""

import argparse
import curses
import os
import subprocess
import sys
from dataclasses import dataclass, field
from enum import Enum, auto
from pathlib import Path
from typing import Callable, Optional

# ANSI colors for non-curses output
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
RED = '\033[0;31m'
BLUE = '\033[0;34m'
CYAN = '\033[0;36m'
NC = '\033[0m'


class BuildCategory(Enum):
    """Categories for build scripts."""

    VM = auto()
    DOCKER = auto()
    DESKTOP = auto()
    RELEASE = auto()
    VFKIT = auto()
    SWIFT = auto()
    OPENVSCODE = auto()
    BENCHMARK = auto()
    OTHER = auto()

    @property
    def display_name(self) -> str:
        """Get display name for category."""
        names = {
            BuildCategory.VM: "VM Builds",
            BuildCategory.DOCKER: "Docker/Container",
            BuildCategory.DESKTOP: "Desktop Apps",
            BuildCategory.RELEASE: "Release Builds",
            BuildCategory.VFKIT: "vfkit VMs",
            BuildCategory.SWIFT: "Swift/Native",
            BuildCategory.OPENVSCODE: "OpenVSCode",
            BuildCategory.BENCHMARK: "Benchmarks",
            BuildCategory.OTHER: "Other",
        }
        return names.get(self, "Other")


@dataclass
class BuildScript:
    """Represents a build script."""

    name: str
    path: Path
    category: BuildCategory
    description: str = ""
    requires_docker: bool = False
    requires_sudo: bool = False


@dataclass
class BuildConfig:
    """Configuration for the build TUI."""

    scripts_dir: Path = field(default_factory=lambda: Path(__file__).parent)
    dry_run: bool = False
    verbose: bool = False


# Script definitions with metadata
SCRIPT_DEFINITIONS: dict[str, dict] = {
    # VM Builds
    "build-all-vms.sh": {
        "category": BuildCategory.VM,
        "description": "Master VM build - builds all specialized VMs",
        "requires_docker": True,
    },
    "build-unified-vm.sh": {
        "category": BuildCategory.VM,
        "description": "Build unified services VM",
    },
    "build-valkey-vm.sh": {
        "category": BuildCategory.VM,
        "description": "Build Valkey (Redis-compatible) VM",
    },
    "build-openvscode-vm.sh": {
        "category": BuildCategory.VM,
        "description": "Build OpenVSCode Server VM",
    },
    "build-vms-with-datadog.sh": {
        "category": BuildCategory.VM,
        "description": "Build VMs with Datadog monitoring",
    },
    "build-vz-vms-parallel.sh": {
        "category": BuildCategory.VM,
        "description": "Build Virtualization.framework VMs in parallel",
    },
    "build-vz-vms-with-datadog.sh": {
        "category": BuildCategory.VM,
        "description": "Build VZ VMs with Datadog integration",
    },
    "build-initramfs.sh": {
        "category": BuildCategory.VM,
        "description": "Build initramfs for VM boot",
    },
    "build-k3s-initramfs.sh": {
        "category": BuildCategory.VM,
        "description": "Build initramfs with K3s Kubernetes",
    },
    "build-gitpod-initramfs-arm64.sh": {
        "category": BuildCategory.VM,
        "description": "Build Gitpod initramfs for ARM64",
    },
    "build-gitpod-arm64.sh": {
        "category": BuildCategory.VM,
        "description": "Build Gitpod environment for ARM64",
    },
    "build-gitpod-k3s-arm64.sh": {
        "category": BuildCategory.VM,
        "description": "Build Gitpod with K3s for ARM64",
    },
    "build-fast-openvscode-vm-with-ai-tools.sh": {
        "category": BuildCategory.VM,
        "description": "Build fast OpenVSCode VM with AI tools",
    },

    # Docker/Container
    "build-code-server.sh": {
        "category": BuildCategory.DOCKER,
        "description": "Build code-server Docker image",
        "requires_docker": True,
    },
    "build-and-push-codeserver.sh": {
        "category": BuildCategory.DOCKER,
        "description": "Build and push code-server to registry",
        "requires_docker": True,
    },
    "build-and-test-code-server.sh": {
        "category": BuildCategory.DOCKER,
        "description": "Build and test code-server image",
        "requires_docker": True,
    },
    "build-and-test-unified.sh": {
        "category": BuildCategory.DOCKER,
        "description": "Build and test unified services",
        "requires_docker": True,
    },
    "build-codeserver-local.sh": {
        "category": BuildCategory.DOCKER,
        "description": "Build code-server for local use",
        "requires_docker": True,
    },
    "build-codeserver-multiarch.sh": {
        "category": BuildCategory.DOCKER,
        "description": "Build code-server for multiple architectures",
        "requires_docker": True,
    },
    "build-multiarch.sh": {
        "category": BuildCategory.DOCKER,
        "description": "Build multi-architecture containers",
        "requires_docker": True,
    },

    # Desktop
    "desktop/build-all.sh": {
        "category": BuildCategory.DESKTOP,
        "description": "Build desktop app for all platforms",
    },
    "desktop/build-linux.sh": {
        "category": BuildCategory.DESKTOP,
        "description": "Build Linux desktop (.deb, .AppImage, .rpm)",
    },
    "desktop/build-macos.sh": {
        "category": BuildCategory.DESKTOP,
        "description": "Build macOS desktop application",
    },

    # Release
    "release/build-macos-release.sh": {
        "category": BuildCategory.RELEASE,
        "description": "Complete macOS release with signing",
    },
    "build-production.sh": {
        "category": BuildCategory.RELEASE,
        "description": "Production build with SWC optimization",
    },
    "build-complete.sh": {
        "category": BuildCategory.RELEASE,
        "description": "Complete build of all components",
    },
    "build-complete-wiki.sh": {
        "category": BuildCategory.RELEASE,
        "description": "Build complete documentation wiki",
    },
    "build-tauri-with-vms.sh": {
        "category": BuildCategory.RELEASE,
        "description": "Build Tauri app with embedded VMs",
    },
    "build-pkg-for-ard.sh": {
        "category": BuildCategory.RELEASE,
        "description": "Build .pkg for Apple Remote Desktop",
    },
    "build-pkg-simple.sh": {
        "category": BuildCategory.RELEASE,
        "description": "Build simple .pkg installer",
    },
    "build-profiles.sh": {
        "category": BuildCategory.RELEASE,
        "description": "Build configuration profiles",
    },

    # vfkit VMs
    "vfkit/build-ai-tools-vm.sh": {
        "category": BuildCategory.VFKIT,
        "description": "Build vfkit VM with AI coding tools",
    },
    "vfkit/build-ai-tools-vm-complete.sh": {
        "category": BuildCategory.VFKIT,
        "description": "Complete AI tools VM with all deps",
    },
    "vfkit/build-all-tiny-services.sh": {
        "category": BuildCategory.VFKIT,
        "description": "Build all tiny service VMs",
    },
    "vfkit/build-busybox-node-docker.sh": {
        "category": BuildCategory.VFKIT,
        "description": "Build BusyBox + Node Docker VM",
        "requires_docker": True,
    },
    "vfkit/build-openvscode.sh": {
        "category": BuildCategory.VFKIT,
        "description": "Build OpenVSCode for vfkit",
    },
    "vfkit/build-openvscode-musl.sh": {
        "category": BuildCategory.VFKIT,
        "description": "Build OpenVSCode with musl libc",
    },
    "vfkit/build-services-arm64.sh": {
        "category": BuildCategory.VFKIT,
        "description": "Build ARM64 services for vfkit",
    },
    "vfkit/build-services-on-host.sh": {
        "category": BuildCategory.VFKIT,
        "description": "Build services to run on host",
    },
    "vfkit/build-tiny-node24.sh": {
        "category": BuildCategory.VFKIT,
        "description": "Build tiny Node.js 24 VM",
    },
    "vfkit/build-tiny-openvscode-with-rag.sh": {
        "category": BuildCategory.VFKIT,
        "description": "Build tiny OpenVSCode with RAG support",
    },
    "vfkit/build-tiny-postgresql-pgvector.sh": {
        "category": BuildCategory.VFKIT,
        "description": "Build tiny PostgreSQL with pgvector",
    },

    # Swift/Native
    "build-swift-app.sh": {
        "category": BuildCategory.SWIFT,
        "description": "Build VibeCode native Swift app",
    },
    "build-apple-runtime.sh": {
        "category": BuildCategory.SWIFT,
        "description": "Build Apple Virtualization runtime",
    },
    "build-vibecode.sh": {
        "category": BuildCategory.SWIFT,
        "description": "Build VibeCode main application",
    },

    # OpenVSCode
    "build-openvscode.sh": {
        "category": BuildCategory.OPENVSCODE,
        "description": "Build OpenVSCode with Liquid Glass UI",
    },

    # Benchmarks
    "benchmarks/build-and-validate-arm64-6.17.sh": {
        "category": BuildCategory.BENCHMARK,
        "description": "Build and validate ARM64 kernel 6.17",
    },
    "benchmarks/build-armv7-6.17-complete.sh": {
        "category": BuildCategory.BENCHMARK,
        "description": "Complete ARMv7 kernel 6.17 build",
    },
    "benchmarks/build-busybox-musl.sh": {
        "category": BuildCategory.BENCHMARK,
        "description": "Build BusyBox with musl",
    },
    "benchmarks/build-efi-stub-kernel.sh": {
        "category": BuildCategory.BENCHMARK,
        "description": "Build EFI stub kernel",
    },
    "benchmarks/build-minimal-initramfs.sh": {
        "category": BuildCategory.BENCHMARK,
        "description": "Build minimal initramfs",
    },
    "benchmarks/build-minivim-kernel.sh": {
        "category": BuildCategory.BENCHMARK,
        "description": "Build minimal vim kernel",
    },
    "benchmarks/build-minivim-kernel-6.17.sh": {
        "category": BuildCategory.BENCHMARK,
        "description": "Build minimal vim kernel 6.17",
    },
    "benchmarks/build-minivim-kernel-docker.sh": {
        "category": BuildCategory.BENCHMARK,
        "description": "Build minivim kernel in Docker",
        "requires_docker": True,
    },
    "benchmarks/build-neovim-initramfs.sh": {
        "category": BuildCategory.BENCHMARK,
        "description": "Build Neovim initramfs",
    },
    "benchmarks/build-neovim-initramfs-macos.sh": {
        "category": BuildCategory.BENCHMARK,
        "description": "Build Neovim initramfs for macOS",
    },
    "benchmarks/build-neovim-avante-initramfs.sh": {
        "category": BuildCategory.BENCHMARK,
        "description": "Build Neovim with Avante AI initramfs",
    },
}


def get_repo_root() -> Path:
    """Get the repository root directory.

    Returns:
        Path to repository root.
    """
    current = Path(__file__).resolve().parent
    while current != current.parent:
        if (current / ".git").exists():
            return current
        current = current.parent
    return Path(__file__).resolve().parent.parent


def discover_scripts(scripts_dir: Path) -> list[BuildScript]:
    """Discover all build scripts in the scripts directory.

    Args:
        scripts_dir: Path to scripts directory.

    Returns:
        List of BuildScript objects.
    """
    scripts = []

    # Find all build-*.sh scripts
    for pattern in ["build-*.sh", "*/build-*.sh", "*/*/build-*.sh"]:
        for script_path in scripts_dir.glob(pattern):
            # Get relative path from scripts dir
            try:
                rel_path = script_path.relative_to(scripts_dir)
            except ValueError:
                continue

            rel_path_str = str(rel_path)

            # Skip archived/old scripts
            if "archive" in rel_path_str or "old-" in rel_path_str:
                continue

            # Get script metadata
            if rel_path_str in SCRIPT_DEFINITIONS:
                meta = SCRIPT_DEFINITIONS[rel_path_str]
                script = BuildScript(
                    name=rel_path_str,
                    path=script_path,
                    category=meta.get("category", BuildCategory.OTHER),
                    description=meta.get("description", ""),
                    requires_docker=meta.get("requires_docker", False),
                    requires_sudo=meta.get("requires_sudo", False),
                )
            else:
                # Auto-categorize unknown scripts
                category = categorize_script(rel_path_str)
                script = BuildScript(
                    name=rel_path_str,
                    path=script_path,
                    category=category,
                    description=extract_description(script_path),
                )

            scripts.append(script)

    # Sort by category then name
    scripts.sort(key=lambda s: (s.category.value, s.name))
    return scripts


def categorize_script(name: str) -> BuildCategory:
    """Auto-categorize a script based on its name.

    Args:
        name: Script name/path.

    Returns:
        BuildCategory for the script.
    """
    name_lower = name.lower()

    if "vfkit/" in name_lower:
        return BuildCategory.VFKIT
    elif "desktop/" in name_lower:
        return BuildCategory.DESKTOP
    elif "release/" in name_lower:
        return BuildCategory.RELEASE
    elif "benchmark" in name_lower:
        return BuildCategory.BENCHMARK
    elif "docker" in name_lower or "codeserver" in name_lower:
        return BuildCategory.DOCKER
    elif "vm" in name_lower or "initramfs" in name_lower:
        return BuildCategory.VM
    elif "swift" in name_lower or "apple" in name_lower:
        return BuildCategory.SWIFT
    elif "openvscode" in name_lower:
        return BuildCategory.OPENVSCODE
    else:
        return BuildCategory.OTHER


def extract_description(script_path: Path) -> str:
    """Extract description from script comments.

    Args:
        script_path: Path to script.

    Returns:
        Description string.
    """
    try:
        with open(script_path, 'r') as f:
            lines = f.readlines()[:20]

        for line in lines:
            line = line.strip()
            # Look for comment descriptions
            if line.startswith("#") and not line.startswith("#!"):
                desc = line.lstrip("#").strip()
                if desc and len(desc) > 10 and not desc.startswith("set "):
                    return desc[:60]

        return ""
    except Exception:
        return ""


def check_docker_available() -> bool:
    """Check if Docker is available.

    Returns:
        True if Docker is running.
    """
    try:
        result = subprocess.run(
            ["docker", "info"],
            capture_output=True,
            timeout=5
        )
        return result.returncode == 0
    except Exception:
        return False


def run_script(
    script: BuildScript,
    args: list[str] = None,
    dry_run: bool = False,
    verbose: bool = False
) -> int:
    """Run a build script.

    Args:
        script: BuildScript to run.
        args: Additional arguments.
        dry_run: If True, only print command.
        verbose: If True, print verbose output.

    Returns:
        Exit code from script.
    """
    if args is None:
        args = []

    # Check prerequisites
    if script.requires_docker and not check_docker_available():
        print(f"{RED}Error: Docker is required but not available{NC}")
        return 1

    cmd = ["bash", str(script.path)] + args

    if dry_run:
        print(f"{YELLOW}Would run:{NC} {' '.join(cmd)}")
        return 0

    if verbose:
        print(f"{BLUE}Running:{NC} {' '.join(cmd)}")
        print()

    try:
        result = subprocess.run(cmd)
        return result.returncode
    except KeyboardInterrupt:
        print(f"\n{YELLOW}Build interrupted{NC}")
        return 130
    except Exception as e:
        print(f"{RED}Error running script: {e}{NC}")
        return 1


class BuildTUI:
    """Curses-based TUI for build script selection."""

    def __init__(self, scripts: list[BuildScript], config: BuildConfig):
        """Initialize the TUI.

        Args:
            scripts: List of available scripts.
            config: Build configuration.
        """
        self.scripts = scripts
        self.config = config
        self.current_idx = 0
        self.scroll_offset = 0
        self.selected_script: Optional[BuildScript] = None
        self.category_filter: Optional[BuildCategory] = None
        self.search_term = ""
        self.show_help = False

    def get_filtered_scripts(self) -> list[BuildScript]:
        """Get scripts filtered by current criteria.

        Returns:
            Filtered list of scripts.
        """
        scripts = self.scripts

        if self.category_filter:
            scripts = [s for s in scripts if s.category == self.category_filter]

        if self.search_term:
            term = self.search_term.lower()
            scripts = [s for s in scripts if term in s.name.lower() or term in s.description.lower()]

        return scripts

    def run(self) -> Optional[BuildScript]:
        """Run the TUI and return selected script.

        Returns:
            Selected BuildScript or None.
        """
        try:
            return curses.wrapper(self._main)
        except Exception as e:
            print(f"{RED}TUI error: {e}{NC}")
            return None

    def _main(self, stdscr) -> Optional[BuildScript]:
        """Main curses loop.

        Args:
            stdscr: Curses screen.

        Returns:
            Selected BuildScript or None.
        """
        curses.curs_set(0)
        curses.use_default_colors()

        # Initialize colors
        curses.init_pair(1, curses.COLOR_GREEN, -1)
        curses.init_pair(2, curses.COLOR_YELLOW, -1)
        curses.init_pair(3, curses.COLOR_BLUE, -1)
        curses.init_pair(4, curses.COLOR_CYAN, -1)
        curses.init_pair(5, curses.COLOR_RED, -1)

        while True:
            self._draw(stdscr)
            key = stdscr.getch()

            if key == ord('q') or key == 27:  # q or ESC
                return None
            elif key == curses.KEY_UP or key == ord('k'):
                self._move_cursor(-1)
            elif key == curses.KEY_DOWN or key == ord('j'):
                self._move_cursor(1)
            elif key == curses.KEY_PPAGE:  # Page up
                self._move_cursor(-10)
            elif key == curses.KEY_NPAGE:  # Page down
                self._move_cursor(10)
            elif key == ord('\n') or key == ord(' '):  # Enter or Space
                scripts = self.get_filtered_scripts()
                if scripts and 0 <= self.current_idx < len(scripts):
                    return scripts[self.current_idx]
            elif key == ord('/'):
                self._search_mode(stdscr)
            elif key == ord('c'):
                self._cycle_category()
            elif key == ord('C'):
                self.category_filter = None
                self.current_idx = 0
            elif key == ord('?'):
                self.show_help = not self.show_help
            elif key == ord('r'):
                # Quick run without leaving TUI
                scripts = self.get_filtered_scripts()
                if scripts and 0 <= self.current_idx < len(scripts):
                    return scripts[self.current_idx]

    def _draw(self, stdscr):
        """Draw the TUI.

        Args:
            stdscr: Curses screen.
        """
        stdscr.clear()
        height, width = stdscr.getmaxyx()

        # Header
        header = "╔══════════════════════════════════════════════════════════════╗"
        title = "║          VibeCode Build System - Script Selector             ║"
        footer_line = "╚══════════════════════════════════════════════════════════════╝"

        stdscr.attron(curses.color_pair(3) | curses.A_BOLD)
        stdscr.addstr(0, 0, header[:width-1])
        stdscr.addstr(1, 0, title[:width-1])
        stdscr.addstr(2, 0, footer_line[:width-1])
        stdscr.attroff(curses.color_pair(3) | curses.A_BOLD)

        # Filter info
        filter_info = ""
        if self.category_filter:
            filter_info = f"Category: {self.category_filter.display_name}"
        if self.search_term:
            filter_info += f"  Search: '{self.search_term}'"
        if filter_info:
            stdscr.addstr(3, 2, filter_info[:width-4], curses.color_pair(2))

        # Help or script list
        if self.show_help:
            self._draw_help(stdscr, height, width)
        else:
            self._draw_scripts(stdscr, height, width)

        # Status bar
        status = " ↑↓:Navigate  Enter:Select  /:Search  c:Category  ?:Help  q:Quit "
        stdscr.attron(curses.color_pair(4))
        stdscr.addstr(height-1, 0, status[:width-1].ljust(width-1))
        stdscr.attroff(curses.color_pair(4))

        stdscr.refresh()

    def _draw_scripts(self, stdscr, height: int, width: int):
        """Draw the script list.

        Args:
            stdscr: Curses screen.
            height: Screen height.
            width: Screen width.
        """
        scripts = self.get_filtered_scripts()
        start_y = 5
        max_items = height - 7

        # Adjust scroll offset
        if self.current_idx < self.scroll_offset:
            self.scroll_offset = self.current_idx
        elif self.current_idx >= self.scroll_offset + max_items:
            self.scroll_offset = self.current_idx - max_items + 1

        # Group by category
        current_category = None

        visible_idx = 0
        for i, script in enumerate(scripts):
            if i < self.scroll_offset:
                continue
            if visible_idx >= max_items:
                break

            y = start_y + visible_idx

            # Category header
            if script.category != current_category:
                current_category = script.category
                if visible_idx < max_items - 1:
                    cat_str = f"── {script.category.display_name} ──"
                    stdscr.addstr(y, 2, cat_str[:width-4], curses.color_pair(3) | curses.A_BOLD)
                    visible_idx += 1
                    y += 1

            if visible_idx >= max_items:
                break

            # Script entry
            is_selected = (i == self.current_idx)

            # Build display string
            name = script.name
            if len(name) > 35:
                name = name[:32] + "..."

            desc = script.description
            if len(desc) > width - 45:
                desc = desc[:width-48] + "..."

            # Indicators
            indicators = ""
            if script.requires_docker:
                indicators += "🐳"
            if script.requires_sudo:
                indicators += "🔐"

            line = f"  {name:<36} {desc}"
            if indicators:
                line = f"  {indicators} {name:<33} {desc}"

            if is_selected:
                stdscr.attron(curses.A_REVERSE | curses.color_pair(1))
                stdscr.addstr(y, 0, line[:width-1].ljust(width-1))
                stdscr.attroff(curses.A_REVERSE | curses.color_pair(1))
            else:
                stdscr.addstr(y, 0, line[:width-1])

            visible_idx += 1

        # Show count
        count_str = f" {len(scripts)} scripts "
        if len(scripts) != len(self.scripts):
            count_str += f"(of {len(self.scripts)} total) "
        stdscr.addstr(height-2, 2, count_str, curses.color_pair(4))

    def _draw_help(self, stdscr, height: int, width: int):
        """Draw help screen.

        Args:
            stdscr: Curses screen.
            height: Screen height.
            width: Screen width.
        """
        help_lines = [
            "",
            "  Keyboard Shortcuts:",
            "",
            "    ↑/k, ↓/j    Move cursor up/down",
            "    PgUp/PgDn   Page up/down",
            "    Enter       Select and run script",
            "    /           Search scripts",
            "    c           Cycle through categories",
            "    C           Clear category filter",
            "    ?           Toggle this help",
            "    q/ESC       Quit",
            "",
            "  Icons:",
            "    🐳          Requires Docker",
            "    🔐          Requires sudo",
            "",
            "  Press any key to return...",
        ]

        for i, line in enumerate(help_lines):
            if i + 5 < height - 2:
                stdscr.addstr(i + 5, 0, line[:width-1])

    def _move_cursor(self, delta: int):
        """Move cursor by delta.

        Args:
            delta: Amount to move.
        """
        scripts = self.get_filtered_scripts()
        if not scripts:
            return

        self.current_idx += delta
        self.current_idx = max(0, min(self.current_idx, len(scripts) - 1))

    def _cycle_category(self):
        """Cycle through category filters."""
        categories = list(BuildCategory)

        if self.category_filter is None:
            self.category_filter = categories[0]
        else:
            idx = categories.index(self.category_filter)
            if idx + 1 >= len(categories):
                self.category_filter = None
            else:
                self.category_filter = categories[idx + 1]

        self.current_idx = 0
        self.scroll_offset = 0

    def _search_mode(self, stdscr):
        """Enter search mode.

        Args:
            stdscr: Curses screen.
        """
        curses.curs_set(1)
        height, width = stdscr.getmaxyx()

        prompt = "Search: "
        stdscr.addstr(height-1, 0, prompt)
        stdscr.clrtoeol()

        search = ""
        while True:
            stdscr.addstr(height-1, len(prompt), search + " ")
            stdscr.move(height-1, len(prompt) + len(search))
            stdscr.refresh()

            key = stdscr.getch()

            if key == 27 or key == ord('\n'):  # ESC or Enter
                break
            elif key == curses.KEY_BACKSPACE or key == 127:
                search = search[:-1]
            elif 32 <= key <= 126:
                search += chr(key)

            self.search_term = search
            self.current_idx = 0
            self.scroll_offset = 0
            self._draw(stdscr)

        curses.curs_set(0)


def list_scripts(scripts: list[BuildScript]) -> None:
    """List all scripts in text format.

    Args:
        scripts: List of scripts.
    """
    print(f"{BLUE}VibeCode Build Scripts{NC}")
    print("=" * 60)
    print()

    current_category = None
    for script in scripts:
        if script.category != current_category:
            current_category = script.category
            print(f"{CYAN}{current_category.display_name}{NC}")
            print("-" * 40)

        indicators = ""
        if script.requires_docker:
            indicators += " [docker]"
        if script.requires_sudo:
            indicators += " [sudo]"

        print(f"  {GREEN}{script.name}{NC}{indicators}")
        if script.description:
            print(f"    {script.description}")

    print()
    print(f"Total: {len(scripts)} scripts")


def main(
    list_only: bool = False,
    run_script_name: Optional[str] = None,
    dry_run: bool = False,
    verbose: bool = False,
    script_args: Optional[list[str]] = None
) -> int:
    """Main entry point.

    Args:
        list_only: If True, list scripts and exit.
        run_script_name: Script to run directly.
        dry_run: If True, don't actually run scripts.
        verbose: If True, print verbose output.
        script_args: Additional arguments for script.

    Returns:
        Exit code.
    """
    repo_root = get_repo_root()
    scripts_dir = repo_root / "scripts"
    config = BuildConfig(
        scripts_dir=scripts_dir,
        dry_run=dry_run,
        verbose=verbose,
    )

    # Discover scripts
    scripts = discover_scripts(scripts_dir)

    if not scripts:
        print(f"{RED}No build scripts found in {scripts_dir}{NC}")
        return 1

    # List mode
    if list_only:
        list_scripts(scripts)
        return 0

    # Direct run mode
    if run_script_name:
        matching = [s for s in scripts if s.name == run_script_name or s.name.endswith(run_script_name)]
        if not matching:
            print(f"{RED}Script not found: {run_script_name}{NC}")
            return 1
        if len(matching) > 1:
            print(f"{YELLOW}Multiple matches found:{NC}")
            for s in matching:
                print(f"  - {s.name}")
            return 1

        script = matching[0]
        print(f"{BLUE}Running: {script.name}{NC}")
        if script.description:
            print(f"  {script.description}")
        print()

        return run_script(script, script_args or [], dry_run, verbose)

    # TUI mode
    tui = BuildTUI(scripts, config)
    selected = tui.run()

    if selected:
        print()
        print(f"{BLUE}Selected: {selected.name}{NC}")
        if selected.description:
            print(f"  {selected.description}")
        print()

        return run_script(selected, script_args or [], dry_run, verbose)

    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="TUI for VibeCode build scripts"
    )
    parser.add_argument(
        '--list', '-l',
        action='store_true',
        dest='list_only',
        help="List all scripts and exit"
    )
    parser.add_argument(
        '--run', '-r',
        dest='run_script',
        help="Run a specific script by name"
    )
    parser.add_argument(
        '--dry-run', '-n',
        action='store_true',
        help="Print commands without executing"
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help="Enable verbose output"
    )
    parser.add_argument(
        'script_args',
        nargs='*',
        help="Additional arguments to pass to script"
    )

    args = parser.parse_args()

    sys.exit(main(
        list_only=args.list_only,
        run_script_name=args.run_script,
        dry_run=args.dry_run,
        verbose=args.verbose,
        script_args=args.script_args
    ))

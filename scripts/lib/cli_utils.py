#!/usr/bin/env python3
"""
VibeCode CLI Utilities Module.

A consolidated Python module providing all common CLI utilities for scripts.
This module re-exports functionality from existing lib modules and adds
additional CLI-specific helpers.

Usage:
    from scripts.lib.cli_utils import (
        # Colors and output
        Colors, print_header, print_success, print_error, print_warning,

        # Logging
        log_info, log_error, log_success, log_warn, ScriptLogger,

        # Command execution
        run_command, run_command_capture, check_command_exists,

        # Progress indicators
        Spinner, ProgressBar,

        # File operations
        ensure_dir, read_json, write_json, atomic_write,

        # Environment
        require_env, get_env, load_dotenv,

        # Git operations
        git_root, git_branch, git_commit_hash,

        # Datadog integration
        DatadogLogger, ErrorTracker, LogAggregation,

        # Bootstrap and paths
        bootstrap_init, get_scripts_root, get_lib_dir,

        # KIND orchestration
        kind_set_scripts_dir, kind_run_step,

        # pgvector helpers
        start_container, wait_for_start, exec_sql,

        # Configuration
        Config, init_vibecode_script,
    )
"""

from __future__ import annotations

import contextlib
import itertools
import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time

# Datadog APM tracing
try:
    from ddtrace import tracer
    ddtrace_available = True
except ImportError:
    tracer = None  # type: ignore
    ddtrace_available = False
from dataclasses import dataclass, field
from pathlib import Path
from typing import (
    Any,
    Callable,
    Dict,
    Iterator,
    List,
    Optional,
    Sequence,
    TextIO,
    TypeVar,
    Union,
)

# =============================================================================
# Re-exports from existing modules
# =============================================================================

# Logging module
from .logging import (
    ScriptLogger,
    log_error,
    log_info,
    log_step,
    log_success,
    log_warn,
    log_warning,
)

# Bootstrap module
from .bootstrap import (
    BootstrapContext,
    BootstrapError,
    bootstrap_init,
    get_lib_dir,
    get_scripts_root,
)

# KIND module
from .kind import (
    KindError,
    KindRunner,
    kind_run_step,
    kind_set_scripts_dir,
)

# Datadog logging module
from .datadog_logging import (
    DatadogLogger,
    HTTPTransport as DatadogHTTPTransport,
)

# Error tracking module
from .error_tracking import (
    ErrorTracker,
    HTTPTransport as ErrorHTTPTransport,
)

# Log aggregation module
from .log_aggregation import (
    LogAggregation,
    get_log_aggregation,
    debug as log_debug,
    info as log_agg_info,
    warn as log_agg_warn,
    error as log_agg_error,
    log_deployment_event,
    log_kubernetes_event,
    log_database_event,
    log_performance_metric,
)

# pgvector module
from .pgvector import (
    PgVectorError,
    start_container,
    wait_for_start,
    exec_sql,
)

# VibeCode common module
from .vibecode_common import (
    Config,
    GracefulShutdown,
    Metrics,
    ensure_dir,
    get_project_root,
    get_script_dir,
    init_vibecode_script,
    retry_on_failure,
    setup_datadog_config,
    setup_logging,
    with_error_handling,
)


# =============================================================================
# ANSI Color Codes and Output Formatting
# =============================================================================

class Colors:
    """ANSI color codes for terminal output."""

    # Standard colors
    BLACK = '\033[0;30m'
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[0;33m'
    BLUE = '\033[0;34m'
    MAGENTA = '\033[0;35m'
    CYAN = '\033[0;36m'
    WHITE = '\033[0;37m'

    # Bright colors
    BRIGHT_BLACK = '\033[0;90m'
    BRIGHT_RED = '\033[0;91m'
    BRIGHT_GREEN = '\033[0;92m'
    BRIGHT_YELLOW = '\033[0;93m'
    BRIGHT_BLUE = '\033[0;94m'
    BRIGHT_MAGENTA = '\033[0;95m'
    BRIGHT_CYAN = '\033[0;96m'
    BRIGHT_WHITE = '\033[0;97m'

    # Styles
    BOLD = '\033[1m'
    DIM = '\033[2m'
    ITALIC = '\033[3m'
    UNDERLINE = '\033[4m'
    BLINK = '\033[5m'
    REVERSE = '\033[7m'
    HIDDEN = '\033[8m'
    STRIKETHROUGH = '\033[9m'

    # Reset
    NC = '\033[0m'
    RESET = '\033[0m'

    @classmethod
    def disable(cls) -> None:
        """Disable all colors (set to empty strings)."""
        for attr in dir(cls):
            if attr.isupper() and not attr.startswith('_'):
                setattr(cls, attr, '')

    @classmethod
    def is_supported(cls) -> bool:
        """Check if the terminal supports colors."""
        if os.getenv('NO_COLOR'):
            return False
        if not hasattr(sys.stdout, 'isatty'):
            return False
        return sys.stdout.isatty()


def colorize(text: str, color: str) -> str:
    """Apply color to text."""
    if not Colors.is_supported():
        return text
    return f"{color}{text}{Colors.RESET}"


def print_header(title: str, char: str = '=', width: int = 60) -> None:
    """Print a formatted header."""
    border = char * width
    print(f"{Colors.BOLD}{Colors.BLUE}{border}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{title.center(width)}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{border}{Colors.RESET}")
    print()


def print_success(message: str) -> None:
    """Print a success message."""
    print(f"{Colors.GREEN}+ {message}{Colors.RESET}")


def print_error(message: str, file: TextIO = sys.stderr) -> None:
    """Print an error message."""
    print(f"{Colors.RED}x {message}{Colors.RESET}", file=file)


def print_warning(message: str) -> None:
    """Print a warning message."""
    print(f"{Colors.YELLOW}! {message}{Colors.RESET}")


def print_info(message: str) -> None:
    """Print an info message."""
    print(f"{Colors.BLUE}* {message}{Colors.RESET}")


def print_step(step: int, total: int, message: str) -> None:
    """Print a step indicator."""
    print(f"{Colors.CYAN}[{step}/{total}]{Colors.RESET} {message}")


# =============================================================================
# Command Execution Helpers
# =============================================================================

@dataclass
class CommandResult:
    """Result of a command execution."""
    returncode: int
    stdout: str
    stderr: str
    command: List[str]
    duration: float

    @property
    def success(self) -> bool:
        """Check if command succeeded."""
        return self.returncode == 0

    def check(self) -> None:
        """Raise if command failed."""
        if not self.success:
            raise subprocess.CalledProcessError(
                self.returncode,
                self.command,
                self.stdout,
                self.stderr,
            )


def run_command(
    command: Union[str, Sequence[str]],
    cwd: Optional[Path] = None,
    env: Optional[Dict[str, str]] = None,
    timeout: Optional[float] = None,
    check: bool = True,
    shell: bool = False,
) -> int:
    """
    Run a command and return exit code.

    Args:
        command: Command to run (string or list)
        cwd: Working directory
        env: Environment variables
        timeout: Timeout in seconds
        check: Raise on non-zero exit
        shell: Use shell execution

    Returns:
        Exit code
    """
    if isinstance(command, str) and not shell:
        command = command.split()

    result = subprocess.run(
        command,
        cwd=cwd,
        env={**os.environ, **(env or {})},
        timeout=timeout,
        check=check,
        shell=shell,
    )
    return result.returncode


def run_command_capture(
    command: Union[str, Sequence[str]],
    cwd: Optional[Path] = None,
    env: Optional[Dict[str, str]] = None,
    timeout: Optional[float] = None,
    check: bool = False,
    shell: bool = False,
) -> CommandResult:
    """
    Run a command and capture output.

    Args:
        command: Command to run (string or list)
        cwd: Working directory
        env: Environment variables
        timeout: Timeout in seconds
        check: Raise on non-zero exit
        shell: Use shell execution

    Returns:
        CommandResult with output
    """
    if isinstance(command, str) and not shell:
        cmd_list = command.split()
    else:
        cmd_list = list(command) if not isinstance(command, str) else [command]

    start_time = time.time()

    result = subprocess.run(
        command if shell else cmd_list,
        cwd=cwd,
        env={**os.environ, **(env or {})},
        timeout=timeout,
        capture_output=True,
        text=True,
        shell=shell,
    )

    duration = time.time() - start_time

    cmd_result = CommandResult(
        returncode=result.returncode,
        stdout=result.stdout,
        stderr=result.stderr,
        command=cmd_list,
        duration=duration,
    )

    if check:
        cmd_result.check()

    return cmd_result


def check_command_exists(command: str) -> bool:
    """Check if a command exists in PATH."""
    return shutil.which(command) is not None


def require_command(command: str, install_hint: Optional[str] = None) -> None:
    """Require a command to exist, exit if not found."""
    if not check_command_exists(command):
        print_error(f"Required command not found: {command}")
        if install_hint:
            print_info(f"Install with: {install_hint}")
        sys.exit(1)


# =============================================================================
# Progress Indicators
# =============================================================================

class Spinner:
    """Animated spinner for long-running operations."""

    FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

    def __init__(self, message: str = "Working..."):
        self.message = message
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None

    def _spin(self) -> None:
        """Animation loop."""
        for frame in itertools.cycle(self.FRAMES):
            if self._stop_event.is_set():
                break
            sys.stdout.write(f"\r{Colors.CYAN}{frame}{Colors.RESET} {self.message}")
            sys.stdout.flush()
            time.sleep(0.1)

    def start(self) -> None:
        """Start the spinner."""
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._spin, daemon=True)
        self._thread.start()

    def stop(self, success: bool = True) -> None:
        """Stop the spinner."""
        self._stop_event.set()
        if self._thread:
            self._thread.join()

        icon = f"{Colors.GREEN}+{Colors.RESET}" if success else f"{Colors.RED}x{Colors.RESET}"
        sys.stdout.write(f"\r{icon} {self.message}\n")
        sys.stdout.flush()

    def __enter__(self) -> "Spinner":
        self.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.stop(success=exc_type is None)


class ProgressBar:
    """Simple progress bar for terminal output."""

    def __init__(
        self,
        total: int,
        width: int = 40,
        prefix: str = "Progress",
        fill: str = "█",
        empty: str = "░",
    ):
        self.total = total
        self.width = width
        self.prefix = prefix
        self.fill = fill
        self.empty = empty
        self.current = 0

    def update(self, current: Optional[int] = None) -> None:
        """Update progress bar."""
        if current is not None:
            self.current = current
        else:
            self.current += 1

        percent = self.current / self.total
        filled = int(self.width * percent)
        bar = self.fill * filled + self.empty * (self.width - filled)

        sys.stdout.write(f"\r{self.prefix}: [{bar}] {percent:.0%}")
        sys.stdout.flush()

        if self.current >= self.total:
            print()

    def __enter__(self) -> "ProgressBar":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        if self.current < self.total:
            print()


# =============================================================================
# File Operations
# =============================================================================

def read_json(path: Path) -> Any:
    """Read and parse a JSON file."""
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def write_json(path: Path, data: Any, indent: int = 2) -> None:
    """Write data to a JSON file."""
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=indent)
        f.write('\n')


@contextlib.contextmanager
def atomic_write(path: Path, mode: str = 'w') -> Iterator[TextIO]:
    """
    Write to a file atomically using a temporary file.

    Args:
        path: Target file path
        mode: File mode ('w' or 'wb')

    Yields:
        File handle for writing
    """
    path = Path(path)
    tmp_path = path.with_suffix(path.suffix + '.tmp')

    try:
        with open(tmp_path, mode) as f:
            yield f
        tmp_path.rename(path)
    except Exception:
        if tmp_path.exists():
            tmp_path.unlink()
        raise


def backup_file(path: Path, suffix: str = '.bak') -> Optional[Path]:
    """Create a backup of a file."""
    path = Path(path)
    if not path.exists():
        return None

    backup_path = path.with_suffix(path.suffix + suffix)
    shutil.copy2(path, backup_path)
    return backup_path


# =============================================================================
# Environment Variable Helpers
# =============================================================================

def get_env(key: str, default: Optional[str] = None) -> Optional[str]:
    """Get an environment variable with optional default."""
    return os.environ.get(key, default)


def require_env(key: str, description: Optional[str] = None) -> str:
    """
    Require an environment variable to be set.

    Args:
        key: Environment variable name
        description: Description for error message

    Returns:
        Environment variable value

    Raises:
        SystemExit: If variable is not set
    """
    value = os.environ.get(key)
    if value is None:
        desc = f" ({description})" if description else ""
        print_error(f"Required environment variable not set: {key}{desc}")
        sys.exit(1)
    return value


def load_dotenv(path: Optional[Path] = None) -> Dict[str, str]:
    """
    Load environment variables from a .env file.

    Args:
        path: Path to .env file (defaults to .env in current directory)

    Returns:
        Dictionary of loaded variables
    """
    if path is None:
        path = Path('.env')

    if not path.exists():
        return {}

    loaded = {}
    with open(path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue

            if '=' not in line:
                continue

            key, _, value = line.partition('=')
            key = key.strip()
            value = value.strip()

            # Remove quotes
            if (value.startswith('"') and value.endswith('"')) or \
               (value.startswith("'") and value.endswith("'")):
                value = value[1:-1]

            os.environ[key] = value
            loaded[key] = value

    return loaded


def set_env_defaults(defaults: Dict[str, str]) -> None:
    """Set environment variable defaults (won't override existing)."""
    for key, value in defaults.items():
        os.environ.setdefault(key, value)


# =============================================================================
# Git Operations
# =============================================================================

def git_root() -> Optional[Path]:
    """Get the root directory of the current git repository."""
    result = run_command_capture(['git', 'rev-parse', '--show-toplevel'])
    if result.success:
        return Path(result.stdout.strip())
    return None


def git_branch() -> Optional[str]:
    """Get the current git branch name."""
    result = run_command_capture(['git', 'branch', '--show-current'])
    if result.success:
        return result.stdout.strip() or None
    return None


def git_commit_hash(short: bool = False) -> Optional[str]:
    """Get the current git commit hash."""
    cmd = ['git', 'rev-parse']
    if short:
        cmd.append('--short')
    cmd.append('HEAD')

    result = run_command_capture(cmd)
    if result.success:
        return result.stdout.strip()
    return None


def git_is_dirty() -> bool:
    """Check if there are uncommitted changes."""
    result = run_command_capture(['git', 'status', '--porcelain'])
    return bool(result.stdout.strip())


def git_remote_url(remote: str = 'origin') -> Optional[str]:
    """Get the URL of a git remote."""
    result = run_command_capture(['git', 'remote', 'get-url', remote])
    if result.success:
        return result.stdout.strip()
    return None


# =============================================================================
# Table Formatting
# =============================================================================

def format_table(
    headers: List[str],
    rows: List[List[str]],
    align: Optional[List[str]] = None,
) -> str:
    """
    Format data as an ASCII table.

    Args:
        headers: Column headers
        rows: Table data rows
        align: Alignment per column ('l', 'r', 'c')

    Returns:
        Formatted table string
    """
    if not rows:
        return ""

    # Calculate column widths
    widths = [len(h) for h in headers]
    for row in rows:
        for i, cell in enumerate(row):
            if i < len(widths):
                widths[i] = max(widths[i], len(str(cell)))

    # Default alignment
    if align is None:
        align = ['l'] * len(headers)

    def format_cell(text: str, width: int, alignment: str) -> str:
        if alignment == 'r':
            return text.rjust(width)
        elif alignment == 'c':
            return text.center(width)
        return text.ljust(width)

    # Build table
    lines = []

    # Header
    header_line = " | ".join(
        format_cell(h, widths[i], align[i])
        for i, h in enumerate(headers)
    )
    lines.append(header_line)

    # Separator
    sep_line = "-+-".join("-" * w for w in widths)
    lines.append(sep_line)

    # Rows
    for row in rows:
        row_line = " | ".join(
            format_cell(str(row[i]) if i < len(row) else "", widths[i], align[i])
            for i in range(len(headers))
        )
        lines.append(row_line)

    return "\n".join(lines)


# =============================================================================
# Utility Functions
# =============================================================================

def confirm(prompt: str, default: bool = False) -> bool:
    """
    Ask for user confirmation.

    Args:
        prompt: Question to ask
        default: Default answer if user just presses Enter

    Returns:
        True if confirmed, False otherwise
    """
    suffix = "[Y/n]" if default else "[y/N]"
    response = input(f"{prompt} {suffix} ").strip().lower()

    if not response:
        return default

    return response in ('y', 'yes')


def human_readable_size(size_bytes: int) -> str:
    """Convert bytes to human readable format."""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if abs(size_bytes) < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} PB"


def human_readable_duration(seconds: float) -> str:
    """Convert seconds to human readable duration."""
    if seconds < 60:
        return f"{seconds:.1f}s"
    elif seconds < 3600:
        minutes = seconds / 60
        return f"{minutes:.1f}m"
    else:
        hours = seconds / 3600
        return f"{hours:.1f}h"


def timestamp() -> str:
    """Get current timestamp in ISO format."""
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def timestamp_local() -> str:
    """Get current local timestamp."""
    return time.strftime("%Y-%m-%d %H:%M:%S")


# =============================================================================
# Module Exports
# =============================================================================

__all__ = [
    # Colors and output
    'Colors',
    'colorize',
    'print_header',
    'print_success',
    'print_error',
    'print_warning',
    'print_info',
    'print_step',

    # Logging (from logging.py)
    'ScriptLogger',
    'log_info',
    'log_error',
    'log_success',
    'log_warn',
    'log_warning',
    'log_step',

    # Bootstrap (from bootstrap.py)
    'BootstrapContext',
    'BootstrapError',
    'bootstrap_init',
    'get_scripts_root',
    'get_lib_dir',

    # KIND (from kind.py)
    'KindRunner',
    'KindError',
    'kind_set_scripts_dir',
    'kind_run_step',

    # Datadog logging (from datadog_logging.py)
    'DatadogLogger',
    'DatadogHTTPTransport',

    # Error tracking (from error_tracking.py)
    'ErrorTracker',
    'ErrorHTTPTransport',

    # Log aggregation (from log_aggregation.py)
    'LogAggregation',
    'get_log_aggregation',
    'log_debug',
    'log_agg_info',
    'log_agg_warn',
    'log_agg_error',
    'log_deployment_event',
    'log_kubernetes_event',
    'log_database_event',
    'log_performance_metric',

    # pgvector (from pgvector.py)
    'PgVectorError',
    'start_container',
    'wait_for_start',
    'exec_sql',

    # VibeCode common (from vibecode_common.py)
    'Config',
    'GracefulShutdown',
    'Metrics',
    'ensure_dir',
    'get_project_root',
    'get_script_dir',
    'init_vibecode_script',
    'retry_on_failure',
    'setup_datadog_config',
    'setup_logging',
    'with_error_handling',

    # Command execution
    'CommandResult',
    'run_command',
    'run_command_capture',
    'check_command_exists',
    'require_command',

    # Progress indicators
    'Spinner',
    'ProgressBar',

    # File operations
    'read_json',
    'write_json',
    'atomic_write',
    'backup_file',

    # Environment
    'get_env',
    'require_env',
    'load_dotenv',
    'set_env_defaults',

    # Git operations
    'git_root',
    'git_branch',
    'git_commit_hash',
    'git_is_dirty',
    'git_remote_url',

    # Table formatting
    'format_table',

    # Utilities
    'confirm',
    'human_readable_size',
    'human_readable_duration',
    'timestamp',
    'timestamp_local',
]

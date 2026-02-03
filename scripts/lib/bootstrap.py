#!/usr/bin/env python3
"""Shared bootstrap helpers for scripts living under scripts/ops and scripts/tests.

Provides a consistent way to derive SCRIPTS_ROOT and LIB_DIR.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Tuple, Optional

# Global state
SCRIPTS_ROOT: Optional[Path] = None
LIB_DIR: Optional[Path] = None


def bootstrap_init(caller_dir: str) -> Tuple[Path, Path]:
    """Initialize bootstrap directories.

    Args:
        caller_dir: The directory of the calling script.

    Returns:
        Tuple of (SCRIPTS_ROOT, LIB_DIR).

    Raises:
        ValueError: If caller_dir is not provided or doesn't exist.
        FileNotFoundError: If the lib directory cannot be found.
    """
    global SCRIPTS_ROOT, LIB_DIR

    if not caller_dir:
        raise ValueError("bootstrap_init requires the calling script directory")

    caller_path = Path(caller_dir)

    if not caller_path.is_dir():
        raise ValueError(f"bootstrap_init: directory not found: {caller_dir}")

    # Derive SCRIPTS_ROOT if not already set
    if SCRIPTS_ROOT is None:
        if caller_path.name == "scripts":
            SCRIPTS_ROOT = caller_path
        else:
            SCRIPTS_ROOT = caller_path.parent.resolve()

    # Derive LIB_DIR if not already set
    if LIB_DIR is None:
        LIB_DIR = SCRIPTS_ROOT / "lib"

    if not LIB_DIR.is_dir():
        raise FileNotFoundError(
            f"Unable to locate scripts/lib directory (expected at {LIB_DIR})"
        )

    # Export as environment variables for child processes
    os.environ["SCRIPTS_ROOT"] = str(SCRIPTS_ROOT)
    os.environ["LIB_DIR"] = str(LIB_DIR)

    return SCRIPTS_ROOT, LIB_DIR


def get_scripts_root() -> Optional[Path]:
    """Get the current SCRIPTS_ROOT path."""
    return SCRIPTS_ROOT


def get_lib_dir() -> Optional[Path]:
    """Get the current LIB_DIR path."""
    return LIB_DIR


def reset() -> None:
    """Reset the bootstrap state. Useful for testing."""
    global SCRIPTS_ROOT, LIB_DIR
    SCRIPTS_ROOT = None
    LIB_DIR = None
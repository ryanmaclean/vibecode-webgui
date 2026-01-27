#!/usr/bin/env python3
"""Shared bootstrap helpers for Python scripts.

The historic Bash ``bootstrap.sh`` helper surfaced ``SCRIPTS_ROOT`` and
``LIB_DIR`` environment variables so that downstream scripts could find the
shared library directory.  Many Python rewrites still expect the same
contract, so this module mirrors that behaviour with a small Python friendly
API.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Tuple, Union


PathLike = Union[str, Path]


class BootstrapError(RuntimeError):
    """Raised when the bootstrap process cannot determine directories."""


@dataclass(frozen=True)
class BootstrapContext:
    """Resolved bootstrap paths returned by :func:`bootstrap_init`."""

    scripts_root: Path
    lib_dir: Path


def _resolve_directory(path_like: PathLike) -> Path:
    """Resolve ``path_like`` into an existing directory path."""

    path = Path(path_like).expanduser()
    if not path.is_absolute():
        path = path.resolve()

    if not path.exists() or not path.is_dir():
        raise BootstrapError(f"bootstrap_init requires an existing directory (got {path_like!r})")

    return path


def bootstrap_init(caller_dir: PathLike) -> BootstrapContext:
    """Initialise ``SCRIPTS_ROOT`` and ``LIB_DIR`` just like the Bash helper."""

    caller_path = _resolve_directory(caller_dir)

    scripts_root_env = os.environ.get("SCRIPTS_ROOT")
    if scripts_root_env:
        scripts_root = Path(scripts_root_env).resolve()
    else:
        scripts_root = caller_path if caller_path.name == "scripts" else caller_path.parent.resolve()
        os.environ["SCRIPTS_ROOT"] = str(scripts_root)

    lib_dir_env = os.environ.get("LIB_DIR")
    if lib_dir_env:
        lib_dir = Path(lib_dir_env).resolve()
    else:
        lib_dir = (scripts_root / "lib").resolve()
        os.environ["LIB_DIR"] = str(lib_dir)

    if not lib_dir.exists() or not lib_dir.is_dir():
        raise BootstrapError(f"Unable to locate scripts/lib directory (expected at {lib_dir})")

    return BootstrapContext(scripts_root=scripts_root, lib_dir=lib_dir)


def get_scripts_root() -> Path:
    """Return the cached ``SCRIPTS_ROOT`` value or raise ``BootstrapError``."""

    scripts_root = os.environ.get("SCRIPTS_ROOT")
    if not scripts_root:
        raise BootstrapError("SCRIPTS_ROOT is not defined. Call bootstrap_init first.")

    path = Path(scripts_root)
    if not path.exists():
        raise BootstrapError(f"SCRIPTS_ROOT points to a missing directory: {scripts_root}")

    return path


def get_lib_dir() -> Path:
    """Return the cached ``LIB_DIR`` value or raise ``BootstrapError``."""

    lib_dir = os.environ.get("LIB_DIR")
    if not lib_dir:
        raise BootstrapError("LIB_DIR is not defined. Call bootstrap_init first.")

    path = Path(lib_dir)
    if not path.exists():
        raise BootstrapError(f"LIB_DIR points to a missing directory: {lib_dir}")

    return path


__all__ = [
    "BootstrapContext",
    "BootstrapError",
    "bootstrap_init",
    "get_scripts_root",
    "get_lib_dir",
]


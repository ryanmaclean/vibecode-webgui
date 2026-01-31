"""Legacy vfkit helpers and their Python replacements."""

# Import Python-converted scripts with underscored names
from pathlib import Path as _Path
import importlib.util as _util
import sys as _sys


def _load_hyphenated_module(name: str, hyphenated_filename: str) -> None:
    """Load a module with a hyphenated filename."""
    module_path = _Path(__file__).parent / hyphenated_filename
    if module_path.exists():
        spec = _util.spec_from_file_location(name, module_path)
        if spec and spec.loader:
            module = _util.module_from_spec(spec)
            _sys.modules[f"scripts.vfkit.{name}"] = module
            spec.loader.exec_module(module)
            globals()[name] = module


# Load hyphenated Python modules
_load_hyphenated_module("setup_vfkit", "01-setup-vfkit.py")
_load_hyphenated_module("download_alpine_kernel", "02-download-alpine-kernel.py")
_load_hyphenated_module("create_alpine_rootfs", "03-create-alpine-rootfs.py")
_load_hyphenated_module("launch_alpine_vm", "04-launch-alpine-vm.py")



from __future__ import annotations
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

# Datadog Unified Service Tagging
_dd_service = "paths"
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


# Datadog APM tracing
try:
    from ddtrace import patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import shutil
from dataclasses import dataclass
from pathlib import Path
import os


@dataclass(frozen=True)
class VFKitPaths:
    """Resolved filesystem locations used by vfkit workflows."""

    project_root: Path
    scripts_dir: Path
    config_dir: Path
    vfkit_binary: Path
    vibecode_home: Path
    vm_logs_dir: Path
    vm_pids_dir: Path
    vm_state_dir: Path

    @classmethod
    def discover(cls, start: Path | None = None) -> "VFKitPaths":
        """Infer repo-relative directories starting at *start* or this file."""

        if start is None:
            start = Path(__file__).resolve().parents[2]
        project_root = start
        scripts_dir = project_root / "scripts" / "vfkit"
        config_dir = project_root / "config" / "vfkit"
        # Try bundled binary first, fall back to system vfkit
        bundled_binary = project_root / "src-tauri" / "resources" / "vfkit-aarch64-apple-darwin"
        if bundled_binary.exists():
            vfkit_binary = bundled_binary
        else:
            system_vfkit = shutil.which("vfkit")
            vfkit_binary = Path(system_vfkit) if system_vfkit else bundled_binary
        vibecode_home = Path(os.environ.get("VIBECODE_HOME", Path.home() / ".vibecode"))
        vm_logs_dir = vibecode_home / "vm-logs"
        vm_pids_dir = vibecode_home / "vm-pids"
        vm_state_dir = vibecode_home / "vm-state"
        return cls(
            project_root=project_root,
            scripts_dir=scripts_dir,
            config_dir=config_dir,
            vfkit_binary=vfkit_binary,
            vibecode_home=vibecode_home,
            vm_logs_dir=vm_logs_dir,
            vm_pids_dir=vm_pids_dir,
            vm_state_dir=vm_state_dir,
        )

    def ensure_runtime_dirs(self) -> None:
        """Create runtime dirs (logs/pids/state) if missing."""

        for path in (self.vm_logs_dir, self.vm_pids_dir, self.vm_state_dir):
            path.mkdir(parents=True, exist_ok=True)

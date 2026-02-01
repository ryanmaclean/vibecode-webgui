

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

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


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
        vfkit_binary = project_root / "src-tauri" / "resources" / "vfkit-aarch64-apple-darwin"
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

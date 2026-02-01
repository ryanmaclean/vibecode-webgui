

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

import os
import signal
import stat
from pathlib import Path
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import MagicMock, patch

from scripts.vfkit_py.paths import VFKitPaths
from scripts.vfkit_py.vm_manager import VMManager, dispatch


def _build_paths(tmp: Path) -> VFKitPaths:
    project_root = tmp
    scripts_dir = project_root / "scripts" / "vfkit"
    config_dir = project_root / "config" / "vfkit"
    binary = project_root / "src-tauri" / "resources" / "vfkit-aarch64-apple-darwin"
    vibecode_home = project_root / ".vfkit-home"
    vm_logs = vibecode_home / "logs"
    vm_pids = vibecode_home / "pids"
    vm_state = vibecode_home / "state"

    for path in (scripts_dir, config_dir, binary.parent, vm_logs, vm_pids, vm_state):
        path.mkdir(parents=True, exist_ok=True)

    # Touch vfkit binary + configs expected by VMManager
    binary.write_text("#!/bin/sh\nexit 0\n")
    os.chmod(binary, stat.S_IRWXU)

    for config in ("valkey-vm.yaml", "postgresql-vm.yaml", "nodejs-dev-vm.yaml"):
        (config_dir / config).write_text("name: test\n")

    return VFKitPaths(
        project_root=project_root,
        scripts_dir=scripts_dir,
        config_dir=config_dir,
        vfkit_binary=binary,
        vibecode_home=vibecode_home,
        vm_logs_dir=vm_logs,
        vm_pids_dir=vm_pids,
        vm_state_dir=vm_state,
    )


class VMManagerTests(TestCase):
    def setUp(self) -> None:
        self.tmp = Path(self._tmp_dir())
        self.paths = _build_paths(self.tmp)
        self.manager = VMManager(self.paths)

    def _tmp_dir(self) -> str:
        from tempfile import mkdtemp

        return mkdtemp(prefix="vfkit-tests-")

    def tearDown(self) -> None:
        import shutil

        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_start_vm_records_pid_and_state(self) -> None:
        with patch.object(self.manager, "_port_available", return_value=True), patch.object(
            self.manager, "_wait_for_port", return_value=True
        ), patch("scripts.vfkit_py.vm_manager.subprocess.Popen", return_value=SimpleNamespace(pid=4321)):
            self.manager.start_vm("valkey")

        pid_path = self.paths.vm_pids_dir / "valkey.pid"
        self.assertTrue(pid_path.exists())
        self.assertEqual(pid_path.read_text().strip(), "4321")

        state_path = self.paths.vm_state_dir / "valkey.state"
        contents = state_path.read_text()
        self.assertIn("started:", contents)
        self.assertIn("ready:", contents)

    def test_stop_vm_terminates_pid(self) -> None:
        pid_path = self.paths.vm_pids_dir / "valkey.pid"
        pid_path.write_text("5555\n")

        with patch.object(self.manager, "is_running", side_effect=[True, False]), patch(
            "scripts.vfkit_py.vm_manager.os.kill"
        ) as kill_mock:
            self.manager.stop_vm("valkey")

        kill_mock.assert_any_call(5555, signal.SIGTERM)  # type: ignore[name-defined]
        self.assertFalse(pid_path.exists())
        state_path = self.paths.vm_state_dir / "valkey.state"
        self.assertIn("stopped:", state_path.read_text())

    def test_dispatch_routes_to_expected_handler(self) -> None:
        manager = MagicMock(spec=VMManager)
        dispatch(manager, "start", ["valkey"])
        manager.start_vm.assert_called_once_with("valkey")
        dispatch(manager, "logs", ["valkey", "10"])
        manager.show_logs.assert_called_with("valkey", 10)
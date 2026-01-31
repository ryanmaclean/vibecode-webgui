from __future__ import annotations

from pathlib import Path
import runpy
from unittest import TestCase
from unittest.mock import patch


WRAPPERS = [
    ("start-nodejs-dev.py", ["start", "nodejs-dev"]),
    ("start-postgresql.py", ["start", "postgresql"]),
    ("start-valkey.py", ["start", "valkey"]),
    ("start-all-vms.py", ["start-all"]),
    ("stop-all-vms.py", ["stop-all"]),
    ("vm-health-check.py", ["health"]),
]


class VMWrapperTests(TestCase):
    def test_wrappers_delegate_to_runner_helper(self) -> None:
        scripts_dir = Path(__file__).resolve().parents[2] / "scripts" / "vfkit"
        for script, expected_args in WRAPPERS:
            with self.subTest(script=script):
                script_path = scripts_dir / script
                with patch("scripts.vfkit.runner_helper.run") as run_mock:
                    runpy.run_path(str(script_path), run_name="__main__")
                    run_mock.assert_called_once_with(expected_args)



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

from __future__ import annotations

import io
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import MagicMock, patch

from scripts.vfkit_py.valkey_tester import (
    ValkeyCLI,
    ValkeyConfig,
    ValkeyTestSuite,
    ValkeyTester,
)


class ValkeyCLITests(TestCase):
    @patch("scripts.vfkit_py.valkey_tester.shutil.which")
    def test_detect_prefers_redis(self, mock_which: MagicMock) -> None:
        mock_which.side_effect = lambda name: "/usr/bin/redis-cli" if name == "redis-cli" else None
        cli = ValkeyCLI.detect()
        self.assertEqual(cli.binary, "/usr/bin/redis-cli")

    @patch("scripts.vfkit_py.valkey_tester.subprocess.run")
    def test_run_builds_expected_command(self, mock_run: MagicMock) -> None:
        cli = ValkeyCLI("/opt/redis-cli")
        config = ValkeyConfig(host="example", port=6380, password="pw")
        cli.run(config, ["PING"], capture_output=False)
        args = mock_run.call_args[0][0]
        self.assertEqual(args[:7], ["/opt/redis-cli", "-h", "example", "-p", "6380", "-a", "pw"])


class ValkeyTesterTests(TestCase):
    def setUp(self) -> None:
        self.config = ValkeyConfig()
        self.cli = MagicMock()
        self.cli.binary = "redis-cli"

    def test_ping_success(self) -> None:
        self.cli.run.return_value = SimpleNamespace(stdout="PONG\n")
        tester = ValkeyTester(self.config, self.cli)
        self.assertTrue(tester.test_ping())
        call_args = self.cli.run.call_args
        self.assertEqual(call_args[0][0], self.config)
        self.assertEqual(call_args[0][1], ["ping"])

    def test_set_get_round_trip(self) -> None:
        self.cli.run.side_effect = [
            SimpleNamespace(stdout=""),
            SimpleNamespace(stdout="hello_from_vibecode_test\n"),
            SimpleNamespace(stdout=""),
        ]
        tester = ValkeyTester(self.config, self.cli)
        self.assertTrue(tester.test_set_get())
        self.assertEqual(self.cli.run.call_count, 3)

    def test_show_info_filters_fields(self) -> None:
        tester = ValkeyTester(self.config, self.cli)

        def fake_exec(*args: str) -> SimpleNamespace:
            # Minimal INFO output with headers and comments
            body = "# Server\nredis_version:7.2.1\nos:Linux\n# Memory\nused_memory_human:1M\n"
            return SimpleNamespace(stdout=body)

        with patch.object(tester, "_exec", side_effect=fake_exec):
            buf = io.StringIO()
            with patch("sys.stdout", buf):
                tester.show_info()
        output = buf.getvalue()
        self.assertIn("redis_version: 7.2.1", output)
        self.assertIn("used_memory_human: 1M", output)


class ValkeyTestSuiteTests(TestCase):
    def test_suite_tracks_pass_fail(self) -> None:
        tester = MagicMock()
        tester.config = ValkeyConfig()
        tester.cli.binary = "redis-cli"
        tester.show_info.return_value = None

        tests = [("ok", lambda: True), ("bad", lambda: False)]
        suite = ValkeyTestSuite(tester, tests=tests)
        self.assertFalse(suite.run())
        self.assertEqual(suite.passed, 1)
        self.assertEqual(suite.failed, 1)
        tester.show_info.assert_called_once()
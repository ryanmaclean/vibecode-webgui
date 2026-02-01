

"""Tests for the fix_database_connections_impl module."""

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

import sys
import types
import unittest
from pathlib import Path
from unittest import mock

MODULE_DIR = Path(__file__).resolve().parents[2] / "scripts"
if str(MODULE_DIR) not in sys.path:
    sys.path.insert(0, str(MODULE_DIR))

import fix_database_connections_impl as impl


class PasswordTests(unittest.TestCase):
    def test_generate_password_length_and_charset(self) -> None:
        password = impl.generate_password()
        self.assertEqual(len(password), impl.PASSWORD_LENGTH)
        allowed = set(impl.string.ascii_letters + impl.string.digits)
        self.assertTrue(set(password) <= allowed)


class PublicIPTests(unittest.TestCase):
    def test_get_public_ip_success(self) -> None:
        class FakeResponse:
            def __enter__(self) -> "FakeResponse":
                return self

            def __exit__(self, *_: object) -> None:  # noqa: D401
                return None

            def read(self) -> bytes:  # noqa: D401
                return b"203.0.113.1"

        with mock.patch.object(impl.request, "urlopen", return_value=FakeResponse()):
            self.assertEqual(impl.get_public_ip(), "203.0.113.1")

    def test_get_public_ip_failure(self) -> None:
        with mock.patch.object(impl.request, "urlopen", side_effect=RuntimeError("boom")):
            self.assertEqual(impl.get_public_ip(), "0.0.0.0")


class CommandTests(unittest.TestCase):
    def test_run_command_missing_binary(self) -> None:
        with mock.patch.object(impl.subprocess, "run", side_effect=FileNotFoundError):
            with self.assertRaises(impl.CommandError):
                impl.run_command(["missing-binary"])

    def test_add_firewall_rule_skips_when_ip_missing(self) -> None:
        cfg = impl.FirewallConfig(server_name="db", resource_group="rg")
        self.assertFalse(impl.add_firewall_rule(cfg, "0.0.0.0"))

    def test_add_firewall_rule_invokes_cli(self) -> None:
        cfg = impl.FirewallConfig(server_name="db", resource_group="rg")
        with mock.patch.object(impl, "run_command", return_value=True) as run_cmd:
            self.assertTrue(impl.add_firewall_rule(cfg, "10.0.0.1"))
        self.assertTrue(run_cmd.called)

    def test_reset_admin_password_invokes_cli(self) -> None:
        cfg = impl.PasswordResetConfig(server_name="db", resource_group="rg", user_display="test")
        with mock.patch.object(impl, "run_command", return_value=True) as run_cmd:
            self.assertTrue(impl.reset_admin_password(cfg, "abc"))
        self.assertTrue(run_cmd.called)


if __name__ == "__main__":
    unittest.main()
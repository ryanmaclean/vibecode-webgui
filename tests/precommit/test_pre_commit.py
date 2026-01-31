
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

"""Tests for the Python pre-commit implementation."""

from __future__ import annotations

import unittest
from pathlib import Path
from unittest import mock

from precommit import pre_commit as pc

FIXTURE_ROOT = Path(__file__).with_name("fixtures")


def _fixture(*parts: str) -> Path:
    return FIXTURE_ROOT.joinpath(*parts)


class BlockedFilesTests(unittest.TestCase):
    def test_blocked_files_detects_reports(self) -> None:
        files = [
            "src/app/index.ts",
            "reports/test-results/output.xml",
            "foo/.test-results/log.xml",
            "build/junit.xml",
        ]
        self.assertEqual(pc._blocked_files(files), files[1:])


class CandidateSecretTests(unittest.TestCase):
    def test_iter_candidate_secret_files_skips_env_and_node_modules(self) -> None:
        base = _fixture("candidate")
        node_file = base / "node_modules/pkg/index.js"
        env_file = base / ".env.local"
        valid_file = base / "src/app/main.ts"

        files = [str(node_file), str(env_file), str(valid_file)]
        result = list(pc._iter_candidate_secret_files(files))

        self.assertEqual(result, [valid_file])


class SecurityScanTests(unittest.TestCase):
    def test_scan_file_detects_secrets(self) -> None:
        target = _fixture("scan", "secrets.txt")
        description, location = pc._scan_file(target) or (None, None)
        self.assertEqual(description, "OpenAI/OpenRouter API key")
        self.assertEqual(location, target.as_posix())

    def test_run_security_scan_raises_on_exposed_secret(self) -> None:
        secret_file = _fixture("scan-secret", "src/app/index.ts")
        staged = [secret_file.as_posix()]
        iterator = iter([secret_file])
        with mock.patch.object(pc, "_iter_candidate_secret_files", return_value=iterator):
            with self.assertRaises(SystemExit):
                pc._run_security_scan(staged)


class SourceFileFiltersTests(unittest.TestCase):
    def test_is_src_code_file_filters_tests(self) -> None:
        self.assertTrue(pc._is_src_code_file("src/app/index.ts"))
        self.assertFalse(pc._is_src_code_file("src/app/__tests__/helper.ts"))
        self.assertFalse(pc._is_src_code_file("src/app/view.test.ts"))
        self.assertFalse(pc._is_src_code_file("lib/app.ts"))


class FullChecksTests(unittest.TestCase):
    def test_run_full_checks_invokes_linters_and_tests(self) -> None:
        staged = [
            "src/app/index.ts",
            "src/__tests__/example.ts",
            "lib/util.js",
        ]
        with mock.patch.object(pc, "_run_eslint") as eslint, mock.patch.object(
            pc, "_run_type_check"
        ) as type_check, mock.patch.object(pc, "_run_quick_tests") as quick_tests:
            pc._run_full_checks(staged)

        eslint.assert_called_once_with(staged)
        type_check.assert_called_once_with()
        quick_tests.assert_called_once_with()


if __name__ == "__main__":
    unittest.main()
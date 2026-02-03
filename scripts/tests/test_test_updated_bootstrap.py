#!/usr/bin/env python3
"""Tests for test_updated_bootstrap module."""

import os
import sys
import tempfile
from pathlib import Path
from unittest import TestCase, mock

# Add scripts/tests directory to path for bootstrap module
sys.path.insert(0, str(Path(__file__).parent))

from bootstrap.test_updated_bootstrap import (
    SCRIPTS_TO_CHECK,
    TestResult,
    TestSuite,
    check_script_exists,
    check_script_syntax,
    create_validation_script,
    get_relative_path,
    run_command,
    test_script_load,
)


class TestTestResult(TestCase):
    """Tests for TestResult dataclass."""

    def test_default_values(self):
        """Test default values."""
        result = TestResult(name="test", passed=True)
        self.assertEqual(result.name, "test")
        self.assertTrue(result.passed)
        self.assertEqual(result.message, "")
        self.assertFalse(result.fixed)

    def test_custom_values(self):
        """Test custom values."""
        result = TestResult(
            name="test",
            passed=False,
            message="error occurred",
            fixed=True
        )
        self.assertFalse(result.passed)
        self.assertEqual(result.message, "error occurred")
        self.assertTrue(result.fixed)


class TestTestSuite(TestCase):
    """Tests for TestSuite dataclass."""

    def test_empty_suite(self):
        """Test empty suite."""
        suite = TestSuite()
        self.assertEqual(suite.passed, 0)
        self.assertEqual(suite.failed, 0)
        self.assertTrue(suite.all_passed)

    def test_add_results(self):
        """Test adding results."""
        suite = TestSuite()
        suite.add(TestResult(name="t1", passed=True))
        suite.add(TestResult(name="t2", passed=True))
        suite.add(TestResult(name="t3", passed=False))

        self.assertEqual(suite.passed, 2)
        self.assertEqual(suite.failed, 1)
        self.assertFalse(suite.all_passed)

    def test_all_passed(self):
        """Test all_passed property."""
        suite = TestSuite()
        suite.add(TestResult(name="t1", passed=True))
        suite.add(TestResult(name="t2", passed=True))

        self.assertTrue(suite.all_passed)


class TestScriptsToCheck(TestCase):
    """Tests for SCRIPTS_TO_CHECK constant."""

    def test_contains_bootstrap(self):
        """Test contains main bootstrap script."""
        self.assertIn("aks-bootstrap.sh", SCRIPTS_TO_CHECK)

    def test_contains_datadog(self):
        """Test contains datadog setup script."""
        self.assertIn("aks-datadog-setup.sh", SCRIPTS_TO_CHECK)

    def test_contains_postgresql(self):
        """Test contains postgresql setup script."""
        self.assertIn("aks-postgresql-setup.sh", SCRIPTS_TO_CHECK)

    def test_contains_app_deploy(self):
        """Test contains app deployment script."""
        self.assertIn("aks-app-deploy.sh", SCRIPTS_TO_CHECK)


class TestRunCommand(TestCase):
    """Tests for run_command function."""

    def test_successful_command(self):
        """Test running successful command."""
        rc, stdout, stderr = run_command(["echo", "hello"])
        self.assertEqual(rc, 0)
        self.assertEqual(stdout.strip(), "hello")

    def test_failed_command(self):
        """Test running failed command."""
        rc, stdout, stderr = run_command(["false"], check=False)
        self.assertNotEqual(rc, 0)

    def test_command_not_found(self):
        """Test command not found."""
        rc, stdout, stderr = run_command(
            ["nonexistent_cmd_12345"],
            check=False
        )
        self.assertEqual(rc, -1)
        self.assertIn("not found", stderr)

    def test_with_env(self):
        """Test command with environment variables."""
        rc, stdout, stderr = run_command(
            ["bash", "-c", "echo $TEST_VAR"],
            env={"TEST_VAR": "test_value"}
        )
        self.assertEqual(rc, 0)
        self.assertEqual(stdout.strip(), "test_value")


class TestGetRelativePath(TestCase):
    """Tests for get_relative_path function."""

    def test_relative_to_repo(self):
        """Test path relative to repo root."""
        from bootstrap.test_updated_bootstrap import REPO_ROOT

        test_path = REPO_ROOT / "scripts" / "test.sh"
        result = get_relative_path(test_path)

        self.assertEqual(result, "scripts/test.sh")

    def test_unrelated_path(self):
        """Test unrelated path returns full path."""
        test_path = Path("/tmp/unrelated/test.sh")
        result = get_relative_path(test_path)

        self.assertEqual(result, "/tmp/unrelated/test.sh")


class TestCheckScriptExists(TestCase):
    """Tests for check_script_exists function."""

    def test_executable_script(self):
        """Test with executable script."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.sh', delete=False) as f:
            f.write("#!/bin/bash\necho hello\n")
            f.flush()
            os.chmod(f.name, 0o755)

            result = check_script_exists(Path(f.name))

            self.assertTrue(result.passed)
            self.assertEqual(result.message, "executable")

            os.unlink(f.name)

    def test_non_executable_script(self):
        """Test with non-executable script that gets fixed."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.sh', delete=False) as f:
            f.write("#!/bin/bash\necho hello\n")
            f.flush()
            os.chmod(f.name, 0o644)  # Not executable

            result = check_script_exists(Path(f.name))

            self.assertTrue(result.passed)
            self.assertTrue(result.fixed)
            self.assertIn("made executable", result.message)

            os.unlink(f.name)

    def test_missing_script(self):
        """Test with missing script."""
        result = check_script_exists(Path("/nonexistent/script.sh"))

        self.assertFalse(result.passed)
        self.assertEqual(result.message, "missing")


class TestCheckScriptSyntax(TestCase):
    """Tests for check_script_syntax function."""

    def test_valid_syntax(self):
        """Test script with valid syntax."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.sh', delete=False) as f:
            f.write("#!/bin/bash\necho hello\n")
            f.flush()

            result = check_script_syntax(Path(f.name))

            self.assertTrue(result.passed)
            self.assertEqual(result.message, "syntax OK")

            os.unlink(f.name)

    def test_invalid_syntax(self):
        """Test script with invalid syntax."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.sh', delete=False) as f:
            f.write("#!/bin/bash\nif then fi\n")  # Invalid syntax
            f.flush()

            result = check_script_syntax(Path(f.name))

            self.assertFalse(result.passed)
            self.assertIn("syntax error", result.message)

            os.unlink(f.name)

    def test_missing_file(self):
        """Test with missing file."""
        result = check_script_syntax(Path("/nonexistent/script.sh"))

        self.assertFalse(result.passed)
        self.assertEqual(result.message, "file not found")


class TestTestScriptLoad(TestCase):
    """Tests for test_script_load function."""

    def test_loadable_script(self):
        """Test script that can be sourced."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.sh', delete=False) as f:
            f.write("#!/bin/bash\nTEST_VAR=123\n")
            f.flush()

            result = test_script_load(Path(f.name))

            self.assertTrue(result.passed)
            self.assertEqual(result.message, "loaded successfully")

            os.unlink(f.name)

    def test_missing_file(self):
        """Test with missing file."""
        result = test_script_load(Path("/nonexistent/script.sh"))

        self.assertFalse(result.passed)
        self.assertEqual(result.message, "file not found")

    def test_with_env(self):
        """Test loading script with environment variables."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.sh', delete=False) as f:
            f.write("#!/bin/bash\n: ${REQUIRED_VAR:?}\n")
            f.flush()

            # Without required var - should fail
            result = test_script_load(Path(f.name))
            self.assertFalse(result.passed)

            # With required var - should pass
            result = test_script_load(Path(f.name), env={"REQUIRED_VAR": "set"})
            self.assertTrue(result.passed)

            os.unlink(f.name)


class TestCreateValidationScript(TestCase):
    """Tests for create_validation_script function."""

    def test_creates_temp_script(self):
        """Test creates temporary script."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.sh', delete=False) as f:
            f.write("""#!/bin/bash
log() { echo "$@"; }
main() {
  log "Starting"
  # Call additional setup scripts
  do_something
}
main "$@"
""")
            f.flush()

            result = create_validation_script(Path(f.name))

            self.assertIsNotNone(result)
            self.assertTrue(result.exists())

            content = result.read_text()
            self.assertIn("validation test completed", content)
            self.assertNotIn("do_something", content)

            result.unlink()
            os.unlink(f.name)

    def test_missing_file(self):
        """Test with missing file."""
        result = create_validation_script(Path("/nonexistent/script.sh"))
        self.assertIsNone(result)


if __name__ == '__main__':
    import unittest
    unittest.main()

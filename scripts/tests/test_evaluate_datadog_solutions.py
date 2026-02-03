#!/usr/bin/env python3
"""Tests for evaluate_datadog_solutions module."""

import sys
import tempfile
from pathlib import Path
from unittest import TestCase, mock

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from evaluate_datadog_solutions import (
    EvaluationConfig,
    SolutionEvaluation,
    command_exists,
    get_solution_1,
    get_solution_2,
    get_solution_3,
    write_output,
)


class TestSolutionEvaluation(TestCase):
    """Tests for SolutionEvaluation dataclass."""

    def test_create_evaluation(self):
        """Test creating a solution evaluation."""
        solution = SolutionEvaluation(
            name="Test Solution",
            number=1,
            pros=["Pro 1", "Pro 2"],
            cons=["Con 1"],
            setup_time="5 min",
            complexity="Low",
            best_for="Testing"
        )
        self.assertEqual(solution.name, "Test Solution")
        self.assertEqual(solution.number, 1)
        self.assertEqual(len(solution.pros), 2)
        self.assertEqual(len(solution.cons), 1)

    def test_default_lists(self):
        """Test default empty lists."""
        solution = SolutionEvaluation(name="Test", number=1)
        self.assertEqual(solution.pros, [])
        self.assertEqual(solution.cons, [])


class TestEvaluationConfig(TestCase):
    """Tests for EvaluationConfig dataclass."""

    def test_default_values(self):
        """Test default configuration."""
        config = EvaluationConfig(datadog_api_key="test-key")
        self.assertEqual(config.datadog_api_key, "test-key")
        self.assertEqual(config.datadog_site, "datadoghq.com")
        self.assertEqual(config.results_file, Path("/tmp/datadog-evaluation-results.txt"))

    def test_custom_values(self):
        """Test custom configuration."""
        config = EvaluationConfig(
            datadog_api_key="custom-key",
            datadog_site="datadoghq.eu",
            results_file=Path("/custom/path.txt")
        )
        self.assertEqual(config.datadog_site, "datadoghq.eu")
        self.assertEqual(config.results_file, Path("/custom/path.txt"))


class TestGetSolution1(TestCase):
    """Tests for get_solution_1 function."""

    def test_solution_name(self):
        """Test solution name."""
        solution = get_solution_1()
        self.assertEqual(solution.name, "SSH into Running VMs")
        self.assertEqual(solution.number, 1)

    def test_has_pros_and_cons(self):
        """Test solution has pros and cons."""
        solution = get_solution_1()
        self.assertGreater(len(solution.pros), 0)
        self.assertGreater(len(solution.cons), 0)

    def test_has_metadata(self):
        """Test solution has metadata."""
        solution = get_solution_1()
        self.assertIn("minute", solution.setup_time.lower())
        self.assertIn("Medium", solution.complexity)


class TestGetSolution2(TestCase):
    """Tests for get_solution_2 function."""

    def test_solution_name(self):
        """Test solution name."""
        solution = get_solution_2()
        self.assertEqual(solution.name, "Cloud-init VM Build Process")
        self.assertEqual(solution.number, 2)

    def test_has_pros_and_cons(self):
        """Test solution has pros and cons."""
        solution = get_solution_2()
        self.assertGreater(len(solution.pros), 0)
        self.assertGreater(len(solution.cons), 0)

    def test_has_metadata(self):
        """Test solution has metadata."""
        solution = get_solution_2()
        self.assertIn("minute", solution.setup_time.lower())
        self.assertIn("High", solution.complexity)


class TestGetSolution3(TestCase):
    """Tests for get_solution_3 function."""

    def test_solution_name(self):
        """Test solution name."""
        solution = get_solution_3()
        self.assertEqual(solution.name, "Lima VMs with Provisioning Scripts")
        self.assertEqual(solution.number, 3)

    def test_has_pros_and_cons(self):
        """Test solution has pros and cons."""
        solution = get_solution_3()
        self.assertGreater(len(solution.pros), 0)
        self.assertGreater(len(solution.cons), 0)

    def test_has_metadata(self):
        """Test solution has metadata."""
        solution = get_solution_3()
        self.assertIn("minute", solution.setup_time.lower())
        self.assertIn("Low", solution.complexity)


class TestCommandExists(TestCase):
    """Tests for command_exists function."""

    def test_existing_command(self):
        """Test existing command."""
        self.assertTrue(command_exists("python3") or command_exists("python"))

    def test_nonexistent_command(self):
        """Test non-existent command."""
        self.assertFalse(command_exists("nonexistent_12345"))


class TestWriteOutput(TestCase):
    """Tests for write_output function."""

    def test_writes_to_file(self):
        """Test writing to file."""
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
            path = Path(f.name)

        write_output(path, "Test line 1", also_print=False)
        write_output(path, "Test line 2", also_print=False)

        content = path.read_text()
        self.assertIn("Test line 1", content)
        self.assertIn("Test line 2", content)
        path.unlink()

    def test_appends_newline(self):
        """Test that newlines are appended."""
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
            path = Path(f.name)

        write_output(path, "Line 1", also_print=False)
        write_output(path, "Line 2", also_print=False)

        content = path.read_text()
        self.assertEqual(content.count('\n'), 2)
        path.unlink()


if __name__ == '__main__':
    import unittest
    unittest.main()

#!/usr/bin/env python3

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

"""Tests for fix_ts_ignore module."""

import sys
import tempfile
from pathlib import Path
from unittest import TestCase

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from fix_ts_ignore import (
    find_typescript_files,
    main,
    replace_in_file,
)


class TestFindTypescriptFiles(TestCase):
    """Tests for find_typescript_files function."""

    def test_finds_ts_files(self):
        """Test finding .ts files."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            (tmp_path / "test.ts").write_text("// test")
            (tmp_path / "test.tsx").write_text("// test")
            (tmp_path / "test.js").write_text("// test")

            files = find_typescript_files(tmp_path)
            names = [f.name for f in files]

            self.assertIn("test.ts", names)
            self.assertIn("test.tsx", names)
            self.assertNotIn("test.js", names)

    def test_finds_nested_files(self):
        """Test finding files in subdirectories."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            subdir = tmp_path / "components"
            subdir.mkdir()
            (subdir / "Button.tsx").write_text("// button")

            files = find_typescript_files(tmp_path)

            self.assertEqual(len(files), 1)
            self.assertEqual(files[0].name, "Button.tsx")

    def test_empty_directory(self):
        """Test with empty directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            files = find_typescript_files(Path(tmpdir))
            self.assertEqual(files, [])


class TestReplaceInFile(TestCase):
    """Tests for replace_in_file function."""

    def test_replaces_ts_ignore(self):
        """Test replacing @ts-ignore."""
        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = Path(tmpdir) / "test.ts"
            file_path.write_text("// @ts-ignore\nconst x = 1;")

            count = replace_in_file(file_path)

            self.assertEqual(count, 1)
            self.assertIn("@ts-expect-error", file_path.read_text())
            self.assertNotIn("@ts-ignore", file_path.read_text())

    def test_replaces_multiple(self):
        """Test replacing multiple occurrences."""
        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = Path(tmpdir) / "test.ts"
            content = "// @ts-ignore\nconst x = 1;\n// @ts-ignore\nconst y = 2;"
            file_path.write_text(content)

            count = replace_in_file(file_path)

            self.assertEqual(count, 2)

    def test_no_replacements(self):
        """Test file with no @ts-ignore."""
        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = Path(tmpdir) / "test.ts"
            file_path.write_text("const x = 1;")

            count = replace_in_file(file_path)

            self.assertEqual(count, 0)

    def test_dry_run_no_modification(self):
        """Test dry run doesn't modify file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = Path(tmpdir) / "test.ts"
            original = "// @ts-ignore\nconst x = 1;"
            file_path.write_text(original)

            count = replace_in_file(file_path, dry_run=True)

            self.assertEqual(count, 1)
            self.assertEqual(file_path.read_text(), original)


class TestMain(TestCase):
    """Tests for main function."""

    def test_nonexistent_directory(self):
        """Test with non-existent directory."""
        result = main(directory="/nonexistent/path")
        self.assertEqual(result, 1)

    def test_empty_directory(self):
        """Test with empty directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            result = main(directory=tmpdir)
            self.assertEqual(result, 0)

    def test_processes_files(self):
        """Test processing files in directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            (tmp_path / "test.ts").write_text("// @ts-ignore\nconst x = 1;")

            result = main(directory=tmpdir)

            self.assertEqual(result, 0)
            content = (tmp_path / "test.ts").read_text()
            self.assertIn("@ts-expect-error", content)

    def test_dry_run(self):
        """Test dry run mode."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            original = "// @ts-ignore\nconst x = 1;"
            (tmp_path / "test.ts").write_text(original)

            result = main(directory=tmpdir, dry_run=True)

            self.assertEqual(result, 0)
            self.assertEqual((tmp_path / "test.ts").read_text(), original)


if __name__ == '__main__':
    import unittest
    unittest.main()
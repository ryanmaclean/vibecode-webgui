"""Tests for scripts/add_frontmatter.py."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest


SCRIPTS_DIR = Path(__file__).resolve().parents[2] / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

from add_frontmatter import add_frontmatter_to_directory, has_frontmatter  # type: ignore # noqa: E402


def test_adds_frontmatter_when_missing(tmp_path: Path) -> None:
    doc = tmp_path / "example-doc.md"
    doc.write_text("# Example doc\n", encoding="utf-8")

    updated, skipped = add_frontmatter_to_directory(tmp_path)

    assert updated == [doc]
    assert skipped == []
    text = doc.read_text(encoding="utf-8")
    assert text.startswith("---\n")
    assert "title: example doc" in text
    assert "description: example doc documentation" in text
    assert text.endswith("# Example doc\n")


def test_skips_files_with_frontmatter(tmp_path: Path) -> None:
    doc = tmp_path / "already.md"
    doc.write_text("---\ntitle: custom\n---\n\nbody\n", encoding="utf-8")

    updated, skipped = add_frontmatter_to_directory(tmp_path)

    assert updated == []
    assert skipped == [doc]
    assert has_frontmatter(doc) is True
    assert doc.read_text(encoding="utf-8").startswith("---\n")


def test_non_markdown_files_ignored(tmp_path: Path) -> None:
    (tmp_path / "notes.txt").write_text("plain", encoding="utf-8")
    updated, skipped = add_frontmatter_to_directory(tmp_path)
    assert updated == []
    assert skipped == []


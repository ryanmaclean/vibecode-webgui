
# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""Tests for changelog_helper.py"""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "scripts"))

from changelog_helper import (
    CATEGORY_HEADERS,
    CATEGORY_ORDER,
    CommitInfo,
    parse_conventional_commit,
    format_commit_entry,
    is_git_repo,
)


class TestCategoryConfiguration:
    """Tests for category configuration."""

    def test_has_feat_category(self) -> None:
        """Should have feat category."""
        assert "feat" in CATEGORY_HEADERS
        assert "Added" in CATEGORY_HEADERS["feat"]

    def test_has_fix_category(self) -> None:
        """Should have fix category."""
        assert "fix" in CATEGORY_HEADERS
        assert "Fixed" in CATEGORY_HEADERS["fix"]

    def test_has_other_category(self) -> None:
        """Should have other category for non-conventional commits."""
        assert "other" in CATEGORY_HEADERS

    def test_all_categories_in_order(self) -> None:
        """All header categories should be in order list."""
        for cat in CATEGORY_HEADERS:
            assert cat in CATEGORY_ORDER


class TestParseConventionalCommit:
    """Tests for parse_conventional_commit function."""

    def test_parses_feat_commit(self) -> None:
        """Should parse feat type commit."""
        commit = CommitInfo(
            hash="abc1234567890",
            subject="feat: add new feature",
            body="",
            author="Test Author",
        )
        result = parse_conventional_commit(commit)
        assert result.commit_type == "feat"
        assert result.description == "add new feature"
        assert result.scope is None

    def test_parses_commit_with_scope(self) -> None:
        """Should parse commit with scope."""
        commit = CommitInfo(
            hash="abc1234567890",
            subject="fix(auth): resolve login bug",
            body="",
            author="Test Author",
        )
        result = parse_conventional_commit(commit)
        assert result.commit_type == "fix"
        assert result.scope == "auth"
        assert result.description == "resolve login bug"

    def test_detects_breaking_change_in_subject(self) -> None:
        """Should detect breaking change marker in subject."""
        commit = CommitInfo(
            hash="abc1234567890",
            subject="feat!: breaking change",
            body="",
            author="Test Author",
        )
        result = parse_conventional_commit(commit)
        assert result.is_breaking is True

    def test_detects_breaking_change_in_body(self) -> None:
        """Should detect BREAKING CHANGE in body."""
        commit = CommitInfo(
            hash="abc1234567890",
            subject="feat: some feature",
            body="BREAKING CHANGE: this breaks things",
            author="Test Author",
        )
        result = parse_conventional_commit(commit)
        assert result.is_breaking is True

    def test_non_conventional_becomes_other(self) -> None:
        """Non-conventional commits should be categorized as other."""
        commit = CommitInfo(
            hash="abc1234567890",
            subject="random commit message",
            body="",
            author="Test Author",
        )
        result = parse_conventional_commit(commit)
        assert result.commit_type == "other"


class TestFormatCommitEntry:
    """Tests for format_commit_entry function."""

    def test_formats_basic_entry(self) -> None:
        """Should format basic commit entry."""
        commit = CommitInfo(
            hash="abc1234567890",
            subject="",
            body="",
            author="",
            commit_type="feat",
            description="add feature",
        )
        entry = format_commit_entry(commit)
        assert entry == "- add feature (`abc1234`)"

    def test_formats_entry_with_scope(self) -> None:
        """Should format entry with scope."""
        commit = CommitInfo(
            hash="abc1234567890",
            subject="",
            body="",
            author="",
            commit_type="fix",
            scope="api",
            description="fix bug",
        )
        entry = format_commit_entry(commit)
        assert entry == "- **api**: fix bug (`abc1234`)"

    def test_formats_breaking_change(self) -> None:
        """Should highlight breaking changes."""
        commit = CommitInfo(
            hash="abc1234567890",
            subject="",
            body="",
            author="",
            commit_type="feat",
            description="break things",
            is_breaking=True,
        )
        entry = format_commit_entry(commit)
        assert "**BREAKING**" in entry


class TestIsGitRepo:
    """Tests for is_git_repo function."""

    @patch("subprocess.run")
    def test_returns_true_in_git_repo(self, mock_run: MagicMock) -> None:
        """Should return True when in git repo."""
        mock_run.return_value = MagicMock(returncode=0)
        assert is_git_repo() is True

    @patch("subprocess.run")
    def test_returns_false_outside_git_repo(self, mock_run: MagicMock) -> None:
        """Should return False when not in git repo."""
        mock_run.return_value = MagicMock(returncode=128)
        assert is_git_repo() is False
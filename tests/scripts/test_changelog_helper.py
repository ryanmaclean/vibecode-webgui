"""Tests for scripts.changelog_helper."""

from __future__ import annotations

from scripts import changelog_helper as helper


def _commit(subject: str, body: str = "", hash_: str = "abcdef1") -> helper.CommitSummary:
    return helper.CommitSummary(hash_, subject, body, "Test Author")


def test_parse_git_log_handles_multiple_commits():
    output = "abc1234|||feat(core): add feature|||Body|||Alice\n" \
        "def5678|||fix: stuff|||More|||Bob"
    commits = helper.parse_git_log(output)
    assert len(commits) == 2
    assert commits[0].subject == "feat(core): add feature"
    assert commits[1].hash == "def5678"


def test_analyze_commits_categorizes_and_counts():
    commits = [
        _commit("feat(core): add feature"),
        _commit("fix!: critical issue"),
        _commit("docs: update readme", "BREAKING CHANGE: restructure"),
        _commit("refactor: cleanup"),
        _commit("misc change"),
    ]
    analysis = helper.analyze_commits(commits)
    assert analysis.total_commits == 5
    assert analysis.conventional_commits == 4
    assert analysis.breaking_changes == 2
    assert any("**core**" in entry for entry in analysis.categories["feat"])
    assert analysis.categories["other"]


def test_format_categories_respects_order():
    categories = {key: [] for key in helper.CATEGORY_HEADERS}
    categories["fix"].append("- fix bug")
    categories["other"].append("- other change")
    formatted = helper.format_categories(categories)
    assert formatted.startswith(helper.CATEGORY_HEADERS["fix"])
    assert formatted.strip().endswith("- other change")

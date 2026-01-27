"""Unit tests for download_alpine_minimal module."""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts.vz import download_alpine_minimal as dam


def test_parse_iso_versions_sorts_unique() -> None:
    html = """
    <a href="alpine-virt-3.20.1-aarch64.iso">alpine-virt-3.20.1-aarch64.iso</a>
    <a href="alpine-virt-3.20.3-aarch64.iso">alpine-virt-3.20.3-aarch64.iso</a>
    <a href="alpine-virt-3.20.2-aarch64.iso">alpine-virt-3.20.2-aarch64.iso</a>
    """
    assert dam.parse_iso_versions(html) == ["3.20.1", "3.20.2", "3.20.3"]


def test_determine_release_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(dam, "fetch_release_listing", lambda url: (_ for _ in ()).throw(OSError()))
    config = dam.AlpineConfig()
    assert dam.determine_release(config) == dam.DEFAULT_FALLBACK_RELEASE


def test_find_kernel_candidate_prefers_known(tmp_path: Path) -> None:
    boot = tmp_path / "boot"
    boot.mkdir()
    virt = boot / "vmlinuz-virt"
    virt.write_text("kernel")
    assert dam.find_kernel_candidate(boot) == virt


def test_human_readable_size(tmp_path: Path) -> None:
    file_path = tmp_path / "file.bin"
    file_path.write_bytes(b"0" * 2048)
    assert "KB" in dam.human_readable_size(file_path)


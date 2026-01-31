
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

import os

import pytest

from scripts.lib import bootstrap


def test_bootstrap_init_sets_environment(tmp_path, monkeypatch):
    scripts_dir = tmp_path / "scripts"
    lib_dir = scripts_dir / "lib"
    lib_dir.mkdir(parents=True)

    monkeypatch.delenv("SCRIPTS_ROOT", raising=False)
    monkeypatch.delenv("LIB_DIR", raising=False)

    ctx = bootstrap.bootstrap_init(scripts_dir)

    assert ctx.scripts_root == scripts_dir.resolve()
    assert ctx.lib_dir == lib_dir.resolve()
    assert os.environ["SCRIPTS_ROOT"] == str(ctx.scripts_root)
    assert os.environ["LIB_DIR"] == str(ctx.lib_dir)


def test_bootstrap_init_respects_existing_environment(tmp_path, monkeypatch):
    scripts_dir = tmp_path / "scripts"
    lib_dir = scripts_dir / "lib"
    lib_dir.mkdir(parents=True)

    custom_root = tmp_path / "custom-root"
    custom_lib = custom_root / "special-lib"
    custom_lib.mkdir(parents=True)

    monkeypatch.setenv("SCRIPTS_ROOT", str(custom_root))
    monkeypatch.setenv("LIB_DIR", str(custom_lib))

    ctx = bootstrap.bootstrap_init(scripts_dir)

    assert ctx.scripts_root == custom_root.resolve()
    assert ctx.lib_dir == custom_lib.resolve()


def test_bootstrap_init_raises_for_missing_directory(tmp_path, monkeypatch):
    monkeypatch.delenv("SCRIPTS_ROOT", raising=False)
    monkeypatch.delenv("LIB_DIR", raising=False)
    with pytest.raises(bootstrap.BootstrapError):
        bootstrap.bootstrap_init(tmp_path / "missing")


def test_getters_require_initialisation(monkeypatch):
    monkeypatch.delenv("SCRIPTS_ROOT", raising=False)
    monkeypatch.delenv("LIB_DIR", raising=False)
    with pytest.raises(bootstrap.BootstrapError):
        bootstrap.get_scripts_root()
    with pytest.raises(bootstrap.BootstrapError):
        bootstrap.get_lib_dir()


def test_getters_validate_paths(tmp_path, monkeypatch):
    script_root = tmp_path / "scripts"
    lib_dir = script_root / "lib"
    script_root.mkdir()
    lib_dir.mkdir()

    monkeypatch.setenv("SCRIPTS_ROOT", str(script_root))
    monkeypatch.setenv("LIB_DIR", str(lib_dir))

    assert bootstrap.get_scripts_root() == script_root
    assert bootstrap.get_lib_dir() == lib_dir
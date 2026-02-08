"""Root conftest.py - ensures the project root is on sys.path for pytest.

This allows test files to use absolute imports like:
    from scripts.vfkit_py.vm_manager import VMManager
"""
import sys
from pathlib import Path

# Add project root to sys.path so `scripts` is importable as a package
project_root = str(Path(__file__).resolve().parent)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

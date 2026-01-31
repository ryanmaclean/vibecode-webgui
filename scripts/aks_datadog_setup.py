#!/usr/bin/env python3
"""AKS Datadog setup wrapper.

Deprecated: Datadog setup is handled by scripts/datadog_setup.py
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def main() -> int:
    """Main entry point."""
    print(
        "[aks-datadog-setup] NOTICE: this script is deprecated.\n"
        "Please invoke scripts/datadog_setup.py directly.\n"
        "Proceeding by delegating to the Python helper..."
    )

    script_dir = Path(__file__).parent.resolve()
    datadog_setup = script_dir / "datadog_setup.py"

    result = subprocess.run(
        [sys.executable, str(datadog_setup), *sys.argv[1:]],
        check=False,
    )
    return result.returncode


if __name__ == "__main__":
    sys.exit(main())

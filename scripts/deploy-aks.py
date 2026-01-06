#!/usr/bin/env python3
"""Thin wrapper for backwards compatibility.

This keeps the original hyphenated entry point working while
re-exporting the real implementation from `deploy_aks.py` so the
integration tests can import it as a module.
"""


# Datadog APM tracing
try:
    import ddtrace
    ddtrace.patch_all()
except ImportError:
    print("Warning: ddtrace not installed, tracing disabled")
    pass

from deploy_aks import main


if __name__ == "__main__":
    main()

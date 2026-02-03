#!/usr/bin/env python3
"""Proxy to Go CLI usage-insights command."""

import sys

from lib.go_cli import run_go_cli


def main() -> int:
    return run_go_cli("usage-insights", sys.argv[1:])


if __name__ == "__main__":
    raise SystemExit(main())

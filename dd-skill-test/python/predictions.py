#!/usr/bin/env python3
"""Proxy to Go CLI predictions command."""

import sys

from lib.go_cli import run_go_cli


def main() -> int:
    return run_go_cli("predictions", sys.argv[1:])


if __name__ == "__main__":
    raise SystemExit(main())

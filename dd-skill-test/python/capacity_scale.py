#!/usr/bin/env python3
"""Proxy to Go CLI capacity-scale command."""

import sys

from lib.go_cli import run_go_cli


def main() -> int:
    return run_go_cli("capacity-scale", sys.argv[1:])


if __name__ == "__main__":
    raise SystemExit(main())

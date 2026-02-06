from __future__ import annotations

import argparse
import io
import os
import random
import shutil
import socket
import subprocess
import sys
import time
from dataclasses import dataclass
from types import SimpleNamespace
from typing import Callable, Iterable, List, Sequence

from .log import COLORS, log_error, log_info, log_section, log_success, log_warn


@dataclass(frozen=True)
class ValkeyConfig:
    host: str = "localhost"
    port: int = 6379
    password: str = "VibeCodeChangeMe2025"


class ValkeyCLI:
    def __init__(self, binary: str):
        self.binary = binary

    @classmethod
    def detect(cls) -> "ValkeyCLI":
        for candidate in ("redis-cli", "valkey-cli"):
            path = shutil.which(candidate)
            if path:
                return cls(path)
        raise FileNotFoundError("Neither redis-cli nor valkey-cli was found in PATH")

    def run(
        self,
        config: ValkeyConfig,
        args: Sequence[str],
        *,
        capture_output: bool = True,
        check: bool = True,
    ) -> subprocess.CompletedProcess[str]:
        command = [
            self.binary,
            "-h",
            config.host,
            "-p",
            str(config.port),
            "-a",
            config.password,
            *args,
        ]
        return subprocess.run(command, capture_output=capture_output, text=True, check=check)


class ValkeyTester:
    def __init__(self, config: ValkeyConfig, cli: ValkeyCLI):
        self.config = config
        self.cli = cli

    # ------------------------------------------------------------------
    # helpers
    def _exec(self, *args: str) -> subprocess.CompletedProcess[str]:
        return self.cli.run(self.config, list(args))

    def _temp_key(self, suffix: str) -> str:
        now = int(time.time())
        return f"test:vibecode:{suffix}:{now}:{random.randint(1000, 9999)}"

    # ------------------------------------------------------------------

    # tests
    def test_port_connectivity(self) -> bool:
        try:
            with socket.create_connection((self.config.host, self.config.port), timeout=2):
                return True
        except OSError:
            return False

    def test_ping(self) -> bool:
        result = self._exec("ping")
        return result.stdout.strip() == "PONG"

    def test_set_get(self) -> bool:
        key = self._temp_key("set")
        value = "hello_from_vibecode_test"
        self._exec("SET", key, value)
        retrieved = self._exec("GET", key).stdout.strip()
        self._exec("DEL", key)
        return retrieved == value

    def test_ttl(self) -> bool:
        key = self._temp_key("ttl")
        value = "expires_in_5_seconds"
        self._exec("SETEX", key, "5", value)
        ttl_output = self._exec("TTL", key).stdout.strip()
        self._exec("DEL", key)
        try:
            ttl = int(ttl_output)
        except ValueError:
            return False
        return 0 < ttl <= 5

    def test_hash_operations(self) -> bool:
        key = self._temp_key("hash")
        self._exec("HSET", key, "field1", "value1", "field2", "value2")
        value = self._exec("HGET", key, "field1").stdout.strip()
        self._exec("HGETALL", key)
        self._exec("DEL", key)
        return value == "value1"

    def test_list_operations(self) -> bool:
        key = self._temp_key("list")
        self._exec("LPUSH", key, "item1", "item2", "item3")
        length_output = self._exec("LLEN", key).stdout.strip()
        self._exec("LRANGE", key, "0", "-1")
        self._exec("DEL", key)
        try:
            length = int(length_output)
        except ValueError:
            return False
        return length == 3

    def test_info(self) -> bool:
        self._exec("INFO", "server")
        return True

    def test_memory(self) -> bool:
        self._exec("INFO", "memory")
        return True

    def show_info(self) -> None:
        print(f"\n{COLORS.blue}=== Valkey Server Information ==={COLORS.reset}")
        sections = [
            ("Version", "server", ("redis_version", "valkey_version", "os", "arch_bits")),
            ("Memory", "memory", ("used_memory", "used_memory_human", "maxmemory", "maxmemory_human", "mem_fragmentation")),
            ("Stats", "stats", ("total_connections", "total_commands", "keyspace")),
            ("Persistence", "persistence", ("aof_", "rdb_")),
        ]
        for title, section, prefixes in sections:
            print(f"\n{COLORS.yellow}{title}:{COLORS.reset}")
            info_lines = self._info_section(section, prefixes)
            if not info_lines:
                print("  (no data)")
                continue
            for key, value in info_lines:
                print(f"  {key}: {value}")

    def _info_section(self, section: str, prefixes: Sequence[str]) -> list[tuple[str, str]]:
        output = self._exec("INFO", section).stdout
        matches: list[tuple[str, str]] = []
        for line in output.splitlines():
            if not line or line.startswith("#") or ":" not in line:
                continue
            key, value = line.split(":", 1)
            if any(key.startswith(prefix) for prefix in prefixes):
                matches.append((key, value))
        return matches


class ValkeyTestSuite:
    def __init__(
        self,
        tester: ValkeyTester,
        tests: Sequence[tuple[str, Callable[[], bool]]] | None = None,
    ):
        self.tester = tester
        self.tests = list(tests) if tests is not None else self._default_tests()
        self.passed = 0
        self.failed = 0

    def _default_tests(self) -> list[tuple[str, Callable[[], bool]]]:
        return [
            ("Port Connectivity", self.tester.test_port_connectivity),
            ("PING Command", self.tester.test_ping),
            ("SET/GET Operations", self.tester.test_set_get),
            ("TTL (Expiration)", self.tester.test_ttl),
            ("Hash Operations", self.tester.test_hash_operations),
            ("List Operations", self.tester.test_list_operations),
            ("INFO Command", self.tester.test_info),
            ("Memory Info", self.tester.test_memory),
        ]

    def run(self) -> bool:
        self._print_banner()
        log_info(f"Configuration:\n  Host: {self.tester.config.host}\n  Port: {self.tester.config.port}\n  Password: [REDACTED]")
        log_info(f"Using CLI: {self.tester.cli.binary}")

        for name, func in self.tests:
            print(f"\n{COLORS.blue}Test:{COLORS.reset} {name}")
            try:
                if func():
                    log_success(name)
                    self.passed += 1
                else:
                    log_error(name)
                    self.failed += 1
            except Exception as exc:  # pragma: no cover - defensive
                log_error(f"{name} - {exc}")
                self.failed += 1

        self.tester.show_info()
        self._print_summary()
        return self.failed == 0

    def _print_banner(self) -> None:
        banner = [
            "TPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPW",
            "Q  Valkey VM Comprehensive Test Suite   Q",
            "ZPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP]",
        ]
        for line in banner:
            print(f"{COLORS.blue}{line}{COLORS.reset}")

    def _print_summary(self) -> None:
        total = self.passed + self.failed
        print(f"\n{COLORS.blue}=== Test Summary ==={COLORS.reset}")
        print(f"  {COLORS.green}Passed:{COLORS.reset} {self.passed}")
        print(f"  {COLORS.red}Failed:{COLORS.reset} {self.failed}")
        print(f"  {COLORS.yellow}Total:{COLORS.reset} {total}")
        if self.failed == 0:
            print(f"\n{COLORS.green}All tests passed! Valkey is working correctly.{COLORS.reset}")
        else:
            print(f"\n{COLORS.red}Some tests failed. Check the Valkey VM logs.{COLORS.reset}")


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Valkey VM functional tests")
    parser.add_argument("--host", default="localhost", help="Valkey host")
    parser.add_argument("--port", type=int, default=6379, help="Valkey port")
    parser.add_argument("--password", default="VibeCodeChangeMe2025", help="Valkey password")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_arg_parser().parse_args(argv)
    config = ValkeyConfig(host=args.host, port=args.port, password=args.password)
    try:
        cli = ValkeyCLI.detect()
    except FileNotFoundError as exc:
        log_error(str(exc))
        return 1

    tester = ValkeyTester(config, cli)
    suite = ValkeyTestSuite(tester)
    success = suite.run()
    return 0 if success else 1


__all__ = [
    "ValkeyCLI",
    "ValkeyConfig",
    "ValkeyTestSuite",
    "ValkeyTester",
    "main",
]
#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""Network utilities for Alpine VM setup.

Includes fast downloads with aria2c and DNS testing.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.vfkit_py.log import COLORS, log_error, log_info, log_section, log_success, log_warn


@dataclass
class DNSServer:
    name: str
    address: str
    avg_time_ms: int | None = None
    working: bool = False


DNS_SERVERS = [
    DNSServer("Cloudflare", "1.1.1.1"),
    DNSServer("Cloudflare_Alt", "1.0.0.1"),
    DNSServer("Google", "8.8.8.8"),
    DNSServer("Google_Alt", "8.8.4.4"),
    DNSServer("Quad9", "9.9.9.9"),
    DNSServer("OpenDNS", "208.67.222.222"),
]


def test_dns_server(dns_server: str, test_domain: str = "google.com") -> bool:
    """Test if a DNS server is responsive."""
    if shutil.which("dig"):
        result = subprocess.run(
            ["dig", f"@{dns_server}", test_domain, "+time=2", "+tries=1"],
            capture_output=True,
            check=False,
        )
        return result.returncode == 0
    elif shutil.which("host"):
        result = subprocess.run(
            ["host", "-W", "2", test_domain, dns_server],
            capture_output=True,
            check=False,
        )
        return result.returncode == 0
    elif shutil.which("nslookup"):
        result = subprocess.run(
            ["nslookup", test_domain, dns_server],
            capture_output=True,
            timeout=2,
            check=False,
        )
        return result.returncode == 0
    return False


def test_dns_performance(dns_server: str, test_domain: str = "google.com") -> int | None:
    """Test DNS server response time in milliseconds."""
    if not shutil.which("dig"):
        return None

    total_time = 0
    successful_queries = 0

    for _ in range(3):
        result = subprocess.run(
            ["dig", f"@{dns_server}", test_domain, "+time=2", "+tries=1"],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode == 0:
            for line in result.stdout.splitlines():
                if "Query time:" in line:
                    parts = line.split()
                    for i, part in enumerate(parts):
                        if part == "msec" and i > 0:
                            try:
                                total_time += int(parts[i - 1])
                                successful_queries += 1
                            except ValueError:
                                pass
                            break

    return total_time // successful_queries if successful_queries > 0 else None


def setup_optimal_dns() -> tuple[str, str]:
    """Test DNS servers and find the fastest ones."""
    log_section("Testing DNS Servers")
    print()

    fastest_dns = ""
    fastest_time = 9999
    working_dns: list[str] = []

    print("Testing DNS servers for speed and reliability...")
    print()

    for server in DNS_SERVERS:
        if test_dns_server(server.address):
            server.working = True
            server.avg_time_ms = test_dns_performance(server.address)
            working_dns.append(server.address)

            if server.avg_time_ms is not None:
                print(f"  {COLORS.green}✓{COLORS.reset} {server.name} ({server.address}): {server.avg_time_ms}ms")
                if server.avg_time_ms < fastest_time:
                    fastest_time = server.avg_time_ms
                    fastest_dns = server.address
            else:
                print(f"  {COLORS.green}✓{COLORS.reset} {server.name} ({server.address}): working (no timing)")
        else:
            print(f"  {COLORS.red}✗{COLORS.reset} {server.name} ({server.address}): failed")

    print()

    if fastest_dns:
        print(f"{COLORS.green}Fastest DNS server: {fastest_dns} ({fastest_time}ms){COLORS.reset}")
        secondary = next((s for s in working_dns if s != fastest_dns), "8.8.8.8")
        return fastest_dns, secondary

    log_warn("Using default DNS servers")
    return "1.1.1.1", "8.8.8.8"


def test_network_speed() -> float | None:
    """Test download speed and return MB/s."""
    log_section("Testing Network Speed")
    print()

    test_url = "https://speed.cloudflare.com/__down?bytes=10000000"  # 10MB

    if shutil.which("aria2c"):
        print("Testing download speed with aria2c...")
        with tempfile.TemporaryDirectory() as tmpdir:
            start_time = time.time()
            result = subprocess.run(
                [
                    "aria2c",
                    "--quiet=true",
                    "--download-result=hide",
                    "--max-connection-per-server=8",
                    "--min-split-size=1M",
                    f"--dir={tmpdir}",
                    "--out=speedtest.tmp",
                    test_url,
                ],
                capture_output=True,
                check=False,
            )
            end_time = time.time()

            if result.returncode == 0:
                test_file = Path(tmpdir) / "speedtest.tmp"
                if test_file.exists():
                    size = test_file.stat().st_size
                    duration = end_time - start_time
                    if duration > 0 and size > 0:
                        speed_mbps = (size / duration) / (1024 * 1024)
                        print(f"{COLORS.green}Download speed: {speed_mbps:.2f} MB/s{COLORS.reset}")
                        return speed_mbps
    elif shutil.which("curl"):
        print("Testing download speed with curl...")
        with tempfile.NamedTemporaryFile(delete=True) as tmp:
            result = subprocess.run(
                ["curl", "-o", tmp.name, "-w", "%{speed_download}", test_url],
                capture_output=True,
                text=True,
                check=False,
            )
            if result.returncode == 0 and result.stdout:
                try:
                    speed_bps = float(result.stdout.strip())
                    speed_mbps = speed_bps / (1024 * 1024)
                    print(f"{COLORS.green}Download speed: {speed_mbps:.2f} MB/s{COLORS.reset}")
                    return speed_mbps
                except ValueError:
                    pass

    print()
    return None


def test_connectivity() -> dict[str, bool]:
    """Test connectivity to common hosts."""
    log_section("Testing Connectivity")
    print()

    test_hosts = [
        ("1.1.1.1", "cloudflare"),
        ("8.8.8.8", "google"),
        ("github.com", "github"),
        ("dl-cdn.alpinelinux.org", "alpine"),
    ]

    results = {}
    for host, label in test_hosts:
        result = subprocess.run(
            ["ping", "-c", "1", "-W", "2", host],
            capture_output=True,
            check=False,
        )
        if result.returncode == 0:
            # Try to get latency
            ping_result = subprocess.run(
                ["ping", "-c", "3", "-W", "2", host],
                capture_output=True,
                text=True,
                check=False,
            )
            latency = None
            if ping_result.returncode == 0:
                for line in ping_result.stdout.splitlines():
                    if "avg" in line.lower():
                        parts = line.split("/")
                        if len(parts) >= 5:
                            try:
                                latency = float(parts[4])
                            except (ValueError, IndexError):
                                pass
                        break

            if latency is not None:
                print(f"  {COLORS.green}✓{COLORS.reset} {label} ({host}): {latency:.1f}ms")
            else:
                print(f"  {COLORS.green}✓{COLORS.reset} {label} ({host}): reachable")
            results[label] = True
        else:
            print(f"  {COLORS.red}✗{COLORS.reset} {label} ({host}): unreachable")
            results[label] = False

    print()
    return results


def fast_download(url: str, output: str | Path, connections: int = 8) -> bool:
    """Download a file using aria2c if available, fallback to curl."""
    output = Path(output)

    if not shutil.which("aria2c"):
        log_warn("aria2c not installed, falling back to curl")
        result = subprocess.run(["curl", "-L", "-o", str(output), url], check=False)
        return result.returncode == 0

    print(f"📥 Downloading with aria2c ({connections} connections)...")
    print(f"   URL: {url}")

    result = subprocess.run(
        [
            "aria2c",
            f"--max-connection-per-server={connections}",
            "--min-split-size=1M",
            f"--split={connections}",
            "--file-allocation=none",
            "--continue=true",
            "--max-tries=3",
            "--retry-wait=2",
            "--timeout=60",
            "--connect-timeout=30",
            "--summary-interval=0",
            "--console-log-level=warn",
            f"--dir={output.parent}",
            f"--out={output.name}",
            url,
        ],
        check=False,
    )

    if result.returncode == 0:
        size = output.stat().st_size if output.exists() else 0
        size_human = f"{size / (1024*1024):.1f}MB" if size > 1024 * 1024 else f"{size / 1024:.1f}KB"
        print(f"{COLORS.green}✓{COLORS.reset} Download complete: {size_human}")
        return True

    print(f"{COLORS.red}✗{COLORS.reset} Download failed (exit code: {result.returncode})")
    return False


def parallel_downloads(downloads: Sequence[tuple[str, str | Path]]) -> bool:
    """Download multiple files in parallel using aria2c."""
    log_section("Parallel Downloads with aria2c")
    print()

    if not shutil.which("aria2c"):
        log_error("aria2c is not installed")
        return False

    for url, output in downloads:
        print(f"Queued: {Path(output).name}")

    print()
    print("Starting parallel downloads...")

    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as input_file:
        for url, output in downloads:
            output = Path(output)
            input_file.write(f"{url}\n")
            input_file.write(f"  dir={output.parent}\n")
            input_file.write(f"  out={output.name}\n")
        input_path = input_file.name

    try:
        result = subprocess.run(
            [
                "aria2c",
                f"--input-file={input_path}",
                f"--max-concurrent-downloads={len(downloads)}",
                "--max-connection-per-server=4",
                "--min-split-size=1M",
                "--split=4",
                "--file-allocation=none",
                "--continue=true",
            ],
            check=False,
        )
        return result.returncode == 0
    finally:
        Path(input_path).unlink(missing_ok=True)


def main(args: Sequence[str] | None = None) -> int:
    """Main entry point for CLI usage."""
    if args is None:
        args = sys.argv[1:]

    if not args:
        print("Usage: network_utils.py {test-dns|test-speed|test-connectivity|test-all|download|parallel}")
        print()
        print("Commands:")
        print("  test-dns           - Test DNS servers and find fastest")
        print("  test-speed         - Test download speed")
        print("  test-connectivity  - Test connectivity to common hosts")
        print("  test-all           - Run all tests")
        print("  download URL OUT [CONN]  - Fast download with aria2c")
        print("  parallel URL1 OUT1 URL2 OUT2 ...  - Parallel downloads")
        return 0

    command = args[0]

    if command == "test-dns":
        setup_optimal_dns()
    elif command == "test-speed":
        test_network_speed()
    elif command == "test-connectivity":
        test_connectivity()
    elif command == "test-all":
        test_connectivity()
        print()
        setup_optimal_dns()
        print()
        test_network_speed()
    elif command == "download":
        if len(args) < 3:
            log_error("Usage: download URL OUTPUT [CONNECTIONS]")
            return 1
        url, output = args[1], args[2]
        connections = int(args[3]) if len(args) > 3 else 8
        if not fast_download(url, output, connections):
            return 1
    elif command == "parallel":
        if len(args) < 3 or len(args) % 2 != 1:
            log_error("Usage: parallel URL1 OUT1 URL2 OUT2 ...")
            return 1
        downloads = [(args[i], args[i + 1]) for i in range(1, len(args), 2)]
        if not parallel_downloads(downloads):
            return 1
    else:
        log_error(f"Unknown command: {command}")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
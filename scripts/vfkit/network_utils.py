#!/usr/bin/env python3
"""Network utilities for Alpine VM setup.

Includes fast downloads with aria2c and DNS testing.
"""

import argparse
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path


class Color:
    """ANSI color codes for terminal output."""

    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    RED = "\033[0;31m"
    BLUE = "\033[0;34m"
    NC = "\033[0m"


@dataclass
class DNSServer:
    """DNS server configuration."""

    name: str
    address: str
    avg_time_ms: int | None = None
    working: bool = False


@dataclass
class ConnectivityResult:
    """Result of connectivity test."""

    host: str
    label: str
    reachable: bool
    latency_ms: float | None = None


def run_command(
    cmd: list[str],
    timeout: int | None = None,
    capture_output: bool = True,
) -> subprocess.CompletedProcess[str]:
    """Run a command and return result.

    Args:
        cmd: Command and arguments.
        timeout: Timeout in seconds.
        capture_output: Whether to capture stdout/stderr.

    Returns:
        CompletedProcess result.
    """
    try:
        return subprocess.run(
            cmd,
            capture_output=capture_output,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        return subprocess.CompletedProcess(cmd, returncode=1, stdout="", stderr="timeout")


def test_dns_server(dns_server: str, test_domain: str = "google.com") -> bool:
    """Test if a DNS server is working.

    Args:
        dns_server: DNS server IP address.
        test_domain: Domain to test resolution.

    Returns:
        True if DNS server responds.
    """
    # Try dig
    if shutil.which("dig"):
        result = run_command(
            ["dig", f"@{dns_server}", test_domain, "+time=2", "+tries=1"],
            timeout=5,
        )
        if result.returncode == 0:
            return True

    # Try host
    if shutil.which("host"):
        result = run_command(
            ["host", test_domain, dns_server],
            timeout=2,
        )
        if result.returncode == 0:
            return True

    # Try nslookup
    if shutil.which("nslookup"):
        result = run_command(
            ["nslookup", test_domain, dns_server],
            timeout=2,
        )
        if result.returncode == 0:
            return True

    return False


def test_dns_performance(dns_server: str, test_domain: str = "google.com") -> int | None:
    """Test DNS server performance.

    Args:
        dns_server: DNS server IP address.
        test_domain: Domain to test.

    Returns:
        Average query time in milliseconds, or None if failed.
    """
    if not shutil.which("dig"):
        return None

    total_time = 0
    successful_queries = 0

    for _ in range(3):
        result = run_command(
            ["dig", f"@{dns_server}", test_domain, "+time=2", "+tries=1"],
            timeout=5,
        )
        if result.returncode == 0 and result.stdout:
            for line in result.stdout.splitlines():
                if "Query time:" in line:
                    parts = line.split()
                    if len(parts) >= 4:
                        try:
                            query_time = int(parts[3])
                            total_time += query_time
                            successful_queries += 1
                        except ValueError:
                            pass
                    break

    if successful_queries > 0:
        return total_time // successful_queries
    return None


def setup_optimal_dns() -> tuple[str, str]:
    """Test DNS servers and find fastest.

    Returns:
        Tuple of (primary_dns, secondary_dns).
    """
    print(f"{Color.BLUE}=== Testing DNS Servers ==={Color.NC}")
    print()
    print("Testing DNS servers for speed and reliability...")
    print()

    dns_servers = [
        DNSServer("Cloudflare", "1.1.1.1"),
        DNSServer("Cloudflare_Alt", "1.0.0.1"),
        DNSServer("Google", "8.8.8.8"),
        DNSServer("Google_Alt", "8.8.4.4"),
        DNSServer("Quad9", "9.9.9.9"),
        DNSServer("OpenDNS", "208.67.222.222"),
    ]

    fastest_dns: DNSServer | None = None
    fastest_time = 9999
    working_servers: list[DNSServer] = []

    for server in dns_servers:
        if test_dns_server(server.address):
            server.working = True
            avg_time = test_dns_performance(server.address)
            server.avg_time_ms = avg_time

            if avg_time is not None:
                print(f"  {Color.GREEN}\u2713{Color.NC} {server.name} ({server.address}): {avg_time}ms")
                working_servers.append(server)
                if avg_time < fastest_time:
                    fastest_time = avg_time
                    fastest_dns = server
            else:
                print(f"  {Color.GREEN}\u2713{Color.NC} {server.name} ({server.address}): working (no timing)")
                working_servers.append(server)
        else:
            print(f"  {Color.RED}\u2717{Color.NC} {server.name} ({server.address}): failed")

    print()

    if fastest_dns:
        print(f"{Color.GREEN}Fastest DNS server: {fastest_dns.address} ({fastest_time}ms){Color.NC}")
        primary = fastest_dns.address

        # Find secondary
        secondary = "8.8.8.8"
        for server in working_servers:
            if server.address != primary:
                secondary = server.address
                break

        print(f"export DNS_PRIMARY={primary}")
        print(f"export DNS_SECONDARY={secondary}")
        return (primary, secondary)
    else:
        print(f"{Color.YELLOW}Using default DNS servers{Color.NC}")
        print("export DNS_PRIMARY=1.1.1.1")
        print("export DNS_SECONDARY=8.8.8.8")
        return ("1.1.1.1", "8.8.8.8")


def test_network_speed() -> None:
    """Test network download speed."""
    print(f"{Color.BLUE}=== Testing Network Speed ==={Color.NC}")
    print()

    test_url = "https://speed.cloudflare.com/__down?bytes=10000000"  # 10MB
    output_file = Path("/tmp/speedtest.tmp")

    if shutil.which("aria2c"):
        print("Testing download speed with aria2c...")
        start_time = time.time()

        result = run_command(
            [
                "aria2c",
                "--quiet=true",
                "--download-result=hide",
                "--max-connection-per-server=8",
                "--min-split-size=1M",
                "--dir=/tmp",
                "--out=speedtest.tmp",
                test_url,
            ],
            timeout=60,
        )

        end_time = time.time()
        duration = end_time - start_time

        if output_file.exists():
            size = output_file.stat().st_size
            output_file.unlink()

            if duration > 0 and size > 0:
                speed_mbps = (size / duration) / 1048576
                print(f"{Color.GREEN}Download speed: {speed_mbps:.2f} MB/s{Color.NC}")

    elif shutil.which("curl"):
        print("Testing download speed with curl...")
        result = run_command(
            ["curl", "-o", str(output_file), "-w", "\nSpeed: %{speed_download} bytes/sec\n", test_url],
            timeout=60,
        )

        if result.stdout:
            for line in result.stdout.splitlines():
                if "Speed:" in line:
                    parts = line.split()
                    if len(parts) >= 2:
                        try:
                            speed = float(parts[1])
                            print(f"{speed / 1048576:.2f} MB/s")
                        except ValueError:
                            pass

        if output_file.exists():
            output_file.unlink()

    print()


def test_connectivity() -> list[ConnectivityResult]:
    """Test connectivity to common hosts.

    Returns:
        List of connectivity results.
    """
    print(f"{Color.BLUE}=== Testing Connectivity ==={Color.NC}")
    print()

    test_hosts = [
        ("1.1.1.1", "cloudflare"),
        ("8.8.8.8", "google"),
        ("github.com", "github"),
        ("dl-cdn.alpinelinux.org", "alpine"),
    ]

    results: list[ConnectivityResult] = []

    for host, label in test_hosts:
        # Test with ping
        result = run_command(["ping", "-c", "1", "-W", "2", host], timeout=5)

        if result.returncode == 0:
            # Get latency with 3 pings
            latency_result = run_command(["ping", "-c", "3", "-W", "2", host], timeout=10)
            latency: float | None = None

            if latency_result.returncode == 0 and latency_result.stdout:
                lines = latency_result.stdout.splitlines()
                if lines:
                    last_line = lines[-1]
                    if "/" in last_line:
                        parts = last_line.split("/")
                        if len(parts) >= 5:
                            try:
                                latency = float(parts[4])
                            except ValueError:
                                pass

            if latency is not None:
                print(f"  {Color.GREEN}\u2713{Color.NC} {label} ({host}): {latency:.1f}ms")
            else:
                print(f"  {Color.GREEN}\u2713{Color.NC} {label} ({host}): reachable")

            results.append(ConnectivityResult(host, label, True, latency))
        else:
            print(f"  {Color.RED}\u2717{Color.NC} {label} ({host}): unreachable")
            results.append(ConnectivityResult(host, label, False))

    print()
    return results


def fast_download(url: str, output: str, connections: int = 8) -> bool:
    """Download a file using aria2c for speed.

    Args:
        url: URL to download.
        output: Output file path.
        connections: Number of parallel connections.

    Returns:
        True if download succeeded.
    """
    output_path = Path(output)

    if not shutil.which("aria2c"):
        print(f"{Color.YELLOW}aria2c not installed, falling back to curl{Color.NC}")
        result = run_command(["curl", "-L", "-o", output, url])
        return result.returncode == 0

    print(f"Downloading with aria2c ({connections} connections)...")
    print(f"   URL: {url}")

    result = run_command(
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
            f"--dir={output_path.parent}",
            f"--out={output_path.name}",
            url,
        ],
        capture_output=False,
    )

    if result.returncode == 0:
        if output_path.exists():
            size = output_path.stat().st_size
            size_human = f"{size / 1048576:.1f}M" if size > 1048576 else f"{size / 1024:.1f}K"
            print(f"{Color.GREEN}\u2713{Color.NC} Download complete: {size_human}")
        return True
    else:
        print(f"{Color.RED}\u2717{Color.NC} Download failed (exit code: {result.returncode})")
        return False


def parallel_downloads(downloads: list[tuple[str, str]]) -> bool:
    """Download multiple files in parallel.

    Args:
        downloads: List of (url, output_path) tuples.

    Returns:
        True if all downloads succeeded.
    """
    print(f"{Color.BLUE}=== Parallel Downloads with aria2c ==={Color.NC}")
    print()

    if not shutil.which("aria2c"):
        print(f"{Color.RED}aria2c is not installed{Color.NC}")
        return False

    for url, output in downloads:
        print(f"Queued: {Path(output).name}")

    print()
    print("Starting parallel downloads...")

    # Create aria2 input file
    input_file = Path(f"/tmp/aria2_downloads_{subprocess.os.getpid()}.txt")
    with open(input_file, "w") as f:
        for url, output in downloads:
            output_path = Path(output)
            f.write(f"{url}\n")
            f.write(f"  dir={output_path.parent}\n")
            f.write(f"  out={output_path.name}\n")

    result = run_command(
        [
            "aria2c",
            f"--input-file={input_file}",
            f"--max-concurrent-downloads={len(downloads)}",
            "--max-connection-per-server=4",
            "--min-split-size=1M",
            "--split=4",
            "--file-allocation=none",
            "--continue=true",
        ],
        capture_output=False,
    )

    input_file.unlink(missing_ok=True)
    return result.returncode == 0


def parse_args() -> argparse.Namespace:
    """Parse command line arguments.

    Returns:
        Parsed arguments.
    """
    parser = argparse.ArgumentParser(
        description="Network utilities for Alpine VM setup.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
Examples:
  %(prog)s test-all
  %(prog)s download https://example.com/file.tar.gz /tmp/file.tar.gz 16
  %(prog)s parallel 'https://url1|/tmp/file1' 'https://url2|/tmp/file2'
""",
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # test-dns
    subparsers.add_parser("test-dns", help="Test DNS servers and find fastest")

    # test-speed
    subparsers.add_parser("test-speed", help="Test download speed")

    # test-connectivity
    subparsers.add_parser("test-connectivity", help="Test connectivity to common hosts")

    # test-all
    subparsers.add_parser("test-all", help="Run all tests")

    # download
    download_parser = subparsers.add_parser("download", help="Fast download with aria2c")
    download_parser.add_argument("url", help="URL to download")
    download_parser.add_argument("output", help="Output file path")
    download_parser.add_argument(
        "connections",
        nargs="?",
        type=int,
        default=8,
        help="Number of connections (default: 8)",
    )

    # parallel
    parallel_parser = subparsers.add_parser("parallel", help="Parallel downloads")
    parallel_parser.add_argument(
        "downloads",
        nargs="+",
        help="Downloads in format 'URL|OUTPUT'",
    )

    return parser.parse_args()


def main() -> int:
    """Main entry point.

    Returns:
        Exit code.
    """
    args = parse_args()

    if args.command == "test-dns":
        setup_optimal_dns()
    elif args.command == "test-speed":
        test_network_speed()
    elif args.command == "test-connectivity":
        test_connectivity()
    elif args.command == "test-all":
        test_connectivity()
        print()
        setup_optimal_dns()
        print()
        test_network_speed()
    elif args.command == "download":
        success = fast_download(args.url, args.output, args.connections)
        return 0 if success else 1
    elif args.command == "parallel":
        downloads = []
        for item in args.downloads:
            if "|" in item:
                url, output = item.split("|", 1)
                downloads.append((url, output))
            else:
                print(f"Invalid format: {item} (expected 'URL|OUTPUT')")
                return 1
        success = parallel_downloads(downloads)
        return 0 if success else 1
    else:
        print("Usage: network_utils.py {test-dns|test-speed|test-connectivity|test-all|download|parallel}")
        print()
        print("Commands:")
        print("  test-dns           - Test DNS servers and find fastest")
        print("  test-speed         - Test download speed")
        print("  test-connectivity  - Test connectivity to common hosts")
        print("  test-all           - Run all tests")
        print("  download URL OUT [CONN]  - Fast download with aria2c")
        print("  parallel URL1|OUT1 URL2|OUT2 ...  - Parallel downloads")
        return 0

    return 0


if __name__ == "__main__":
    sys.exit(main())

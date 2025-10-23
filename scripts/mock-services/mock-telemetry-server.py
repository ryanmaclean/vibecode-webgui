#!/usr/bin/env python3
"""Simple mock telemetry server for Vibecode WebGUI tests.

Features:
    * HTTP endpoint `/events` to capture JSON events (POST)
    * HTTP endpoint `/metrics` to capture JSON metrics (POST)
    * HTTP endpoint `/reset` to clear captured data (POST)
    * HTTP endpoint `/dump` to return captured payloads (GET)
    * UDP listener for StatsD-compatible metrics (optional)

Usage:
    python3 scripts/mock-services/mock-telemetry-server.py --http-port 8080 --statsd-port 8125
"""

from __future__ import annotations

import argparse
import http.server
import json
import socket
import threading
from datetime import datetime
from typing import Any, Dict, List


class _TelemetryStore:
    def __init__(self) -> None:
        self.events: List[Dict[str, Any]] = []
        self.metrics: List[Dict[str, Any]] = []
        self.statsd_packets: List[str] = []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "events": self.events,
            "metrics": self.metrics,
            "statsd_packets": self.statsd_packets,
            "captured_at": datetime.utcnow().isoformat() + "Z",
        }

    def reset(self) -> None:
        self.events.clear()
        self.metrics.clear()
        self.statsd_packets.clear()


STORE = _TelemetryStore()


class TelemetryHandler(http.server.BaseHTTPRequestHandler):
    server_version = "VibecodeMockTelemetry/1.0"

    def _set_headers(self, status: int = 200) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()

    def _read_json(self) -> Dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        try:
            data = self.rfile.read(length)
            return json.loads(data.decode("utf-8")) if data else {}
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise ValueError(f"Invalid JSON payload: {exc}")

    def log_message(self, fmt: str, *args: Any) -> None:  # type: ignore[override]
        timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        message = fmt % args
        print(f"[{timestamp}] {self.address_string()} {message}")

    def do_GET(self) -> None:  # type: ignore[override]
        if self.path == "/dump":
            self._set_headers(200)
            self.wfile.write(json.dumps(STORE.to_dict(), indent=2).encode("utf-8"))
        else:
            self._set_headers(404)
            self.wfile.write(b"{\"error\": \"not found\"}")

    def do_POST(self) -> None:  # type: ignore[override]
        try:
            payload = self._read_json()
        except ValueError as exc:
            self._set_headers(400)
            self.wfile.write(json.dumps({"error": str(exc)}).encode("utf-8"))
            return

        if self.path == "/events":
            payload.setdefault("received_at", datetime.utcnow().isoformat() + "Z")
            STORE.events.append(payload)
            self._set_headers(202)
            self.wfile.write(json.dumps({"status": "accepted", "count": len(STORE.events)}).encode("utf-8"))
        elif self.path == "/metrics":
            payload.setdefault("received_at", datetime.utcnow().isoformat() + "Z")
            STORE.metrics.append(payload)
            self._set_headers(202)
            self.wfile.write(json.dumps({"status": "accepted", "count": len(STORE.metrics)}).encode("utf-8"))
        elif self.path == "/reset":
            STORE.reset()
            self._set_headers(200)
            self.wfile.write(b"{\"status\": \"reset\"}")
        else:
            self._set_headers(404)
            self.wfile.write(b"{\"error\": \"not found\"}")


def start_http_server(port: int) -> threading.Thread:
    server = http.server.ThreadingHTTPServer(("", port), TelemetryHandler)

    def serve() -> None:
        print(f"🌐 Mock telemetry HTTP server listening on port {port}")
        server.serve_forever()

    thread = threading.Thread(target=serve, daemon=True)
    thread.start()
    return thread


def start_statsd_server(port: int) -> threading.Thread:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(("", port))

    def listen() -> None:
        print(f"📊 Mock StatsD server listening on port {port}")
        while True:
            data, _ = sock.recvfrom(4096)
            packet = data.decode("utf-8", errors="replace")
            STORE.statsd_packets.append(packet)

    thread = threading.Thread(target=listen, daemon=True)
    thread.start()
    return thread


def main() -> None:
    parser = argparse.ArgumentParser(description="Mock telemetry server for Vibecode")
    parser.add_argument("--http-port", type=int, default=8080, help="HTTP port for event ingestion")
    parser.add_argument("--statsd-port", type=int, default=8125, help="UDP port for StatsD metrics (0 to disable)")
    args = parser.parse_args()

    start_http_server(args.http_port)
    if args.statsd_port:
        start_statsd_server(args.statsd_port)
    else:
        print("StatsD listener disabled (statsd port set to 0)")

    try:
        while True:
            threading.Event().wait(3600)
    except KeyboardInterrupt:
        print("\nShutting down mock telemetry server...")


if __name__ == "__main__":
    main()


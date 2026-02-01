#!/usr/bin/env python3



# Datadog APM tracing
try:
    import ddtrace
    ddtrace.patch_all()
except ImportError:
    print("Warning: ddtrace not installed, tracing disabled")
    pass

"""Verify Datadog Trace Search access for a given service/env window."""
from __future__ import annotations
# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), './')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

import argparse
import datetime as dt
import json
import os
import sys
import urllib.parse
import urllib.request


def die(message: str, exit_code: int = 1) -> None:
    print(message, file=sys.stderr)
    sys.exit(exit_code)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--service", required=True)
    parser.add_argument("--env", dest="env_tag", required=True)
    parser.add_argument("--window", default="1h", help="Datadog timeframe (e.g. 1h, 24h)")
    parser.add_argument("--limit", type=int, default=10)
    args = parser.parse_args()

    api_key = os.getenv("DD_API_KEY")
    app_key = os.getenv("DD_APP_KEY")
    base_url = os.getenv("DATADOG_TRACE_SEARCH_BASE_URL")
    site = os.getenv("DD_SITE", "datadoghq.com")
    if not api_key or not app_key:
        die("DD_API_KEY and DD_APP_KEY must be set in the environment")

    now = dt.datetime.utcnow()
    query = f"service:{args.service} env:{args.env_tag}"
    payload = {
        "data": {
            "type": "search_request",
            "attributes": {
                "filter": {
                    "from": f"now-{args.window}",
                    "to": "now",
                    "query": query,
                },
                "page": {"limit": args.limit},
                "sort": "-timestamp",
            },
        }
    }

    if base_url:
        url = urllib.parse.urljoin(base_url, "/api/v2/spans/events/search")
    else:
        url = f"https://api.{site}/api/v2/spans/events/search"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "DD-API-KEY": api_key,
            "DD-APPLICATION-KEY": app_key,
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = resp.read().decode()
    response = json.loads(body)
    series = response.get("data") or []
    if not series:
        die(
            f"No spans returned for {query} within window {args.window}. Raw response saved to stdout.",
            exit_code=2,
        )

    timestamp = now.strftime("%Y%m%dT%H%M%SZ")
    outdir = os.path.join("datadog", "trace-search")
    os.makedirs(outdir, exist_ok=True)
    outfile = os.path.join(outdir, f"{args.service}-{args.env_tag}-{timestamp}.json")
    with open(outfile, "w") as fh:
        json.dump(response, fh, indent=2)

    print(f"Saved {len(series)} spans to {outfile}")


if __name__ == "__main__":
    main()
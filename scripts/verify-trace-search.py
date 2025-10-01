#!/usr/bin/env python3
"""Verify Datadog Trace Search access for one or more service/env combos."""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import typing as t
import urllib.parse
import urllib.request
import urllib.error
import urllib.error


def die(message: str, exit_code: int = 1) -> None:
    print(message, file=sys.stderr)
    sys.exit(exit_code)


def run_check(
    *,
    service: str,
    env_tag: str,
    window: str,
    limit: int,
    api_key: str,
    app_key: str,
    base_url: str | None,
    site: str,
    output_dir: str,
) -> str:
    now = dt.datetime.utcnow()
    query = f"service:{service} env:{env_tag}"
    payload = {
        "data": {
            "type": "search_request",
            "attributes": {
                "filter": {
                    "from": f"now-{window}",
                    "to": "now",
                    "query": query,
                },
                "page": {"limit": limit},
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
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode() if exc.fp else ""
        if exc.code == 404:
            detail = body or exc.reason or "trace data not found"
            return None, {"status": "not_found", "detail": detail}
        raise

    response = json.loads(body)
    series = response.get("data") or []
    if not series:
        return None, {"status": "empty", "detail": f"No spans for {query} within window {window}"}

    timestamp = now.strftime("%Y%m%dT%H%M%SZ")
    os.makedirs(output_dir, exist_ok=True)
    outfile = os.path.join(output_dir, f"{service}-{env_tag}-{timestamp}.json")
    with open(outfile, "w", encoding="utf-8") as fh:
        json.dump(response, fh, indent=2)

    return outfile, {"status": "ok", "detail": f"{len(series)} spans"}


def load_checks(config_path: str) -> list[dict[str, t.Any]]:
    with open(config_path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, list):
        die("Config file must contain a JSON array of checks")
    checks: list[dict[str, t.Any]] = []
    for entry in data:
        if not isinstance(entry, dict):
            die("Each config entry must be an object")
        if "service" not in entry or "env" not in entry:
            die("Config entries must include 'service' and 'env'")
        checks.append(entry)
    return checks


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--service", help="Service name (if not using --config)")
    parser.add_argument("--env", dest="env_tag", help="Environment tag (if not using --config)")
    parser.add_argument("--window", default="1h", help="Datadog timeframe (e.g. 1h, 24h)")
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--config", help="Path to JSON config of checks")
    parser.add_argument(
        "--output-dir",
        default=os.path.join("datadog", "trace-search"),
        help="Directory to write trace search responses",
    )
    args = parser.parse_args()

    api_key = os.getenv("DD_API_KEY")
    app_key = os.getenv("DD_APP_KEY")
    base_url = os.getenv("DATADOG_TRACE_SEARCH_BASE_URL")
    site = os.getenv("DD_SITE", "datadoghq.com")
    if not api_key or not app_key:
        die("DD_API_KEY and DD_APP_KEY must be set in the environment")

    if args.config:
        checks = load_checks(args.config)
    else:
        service = args.service or os.getenv("TRACE_VERIFY_SERVICE")
        env_tag = args.env_tag or os.getenv("TRACE_VERIFY_ENV")
        if not service or not env_tag:
            die("Provide --service/--env or use --config / TRACE_VERIFY_* envs")
        checks = [
            {
                "service": service,
                "env": env_tag,
                "window": args.window,
                "limit": args.limit,
            }
        ]

    saved: list[str] = []
    summary_checks: list[dict[str, t.Any]] = []
    for entry in checks:
        window = entry.get("window", args.window)
        limit = int(entry.get("limit", args.limit))
        outfile, status = run_check(
            service=entry["service"],
            env_tag=entry["env"],
            window=window,
            limit=limit,
            api_key=api_key,
            app_key=app_key,
            base_url=base_url,
            site=site,
            output_dir=args.output_dir,
        )
        if outfile:
            saved.append(outfile)
        summary_checks.append(
            {
                "service": entry["service"],
                "env": entry["env"],
                "window": window,
                "limit": limit,
                "output": outfile,
                "status": status.get("status"),
                "detail": status.get("detail"),
            }
        )

    summary = {
        "generated_at": dt.datetime.utcnow().isoformat() + "Z",
        "checks": summary_checks,
    }
    os.makedirs(args.output_dir, exist_ok=True)
    summary_path = os.path.join(args.output_dir, "trace-search-summary.json")
    with open(summary_path, "w", encoding="utf-8") as fh:
        json.dump(summary, fh, indent=2)

    print(f"Saved {len(saved)} trace search results. Summary: {summary_path}")


if __name__ == "__main__":
    main()

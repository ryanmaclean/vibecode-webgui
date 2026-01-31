#!/usr/bin/env python3

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


# Datadog APM tracing
try:
    import ddtrace
    ddtrace.patch_all()
except ImportError:
    print("Warning: ddtrace not installed, tracing disabled")
    pass

"""Batch verify Datadog trace search access using a config file."""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--config",
        required=True,
        help="Path to JSON config file with service/env/window configurations"
    )
    args = parser.parse_args()

    # Verify config file exists
    config_path = Path(args.config)
    if not config_path.exists():
        print(f"❌ Config file not found: {config_path}", file=sys.stderr)
        sys.exit(1)

    # Load config
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            configs = json.load(f)
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON in config file: {e}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(configs, list):
        print(f"❌ Config must be a JSON array of service configurations", file=sys.stderr)
        sys.exit(1)

    # Verify required environment variables
    api_key = os.getenv("DD_API_KEY")
    app_key = os.getenv("DD_APP_KEY")
    if not api_key or not app_key:
        print("❌ DD_API_KEY and DD_APP_KEY must be set in the environment", file=sys.stderr)
        sys.exit(1)

    # Get the directory containing this script
    script_dir = Path(__file__).parent
    verify_script = script_dir / "verify-trace-search.py"

    if not verify_script.exists():
        print(f"❌ verify-trace-search.py not found at: {verify_script}", file=sys.stderr)
        sys.exit(1)

    print(f"🔍 Processing {len(configs)} service configuration(s)...")
    print()

    results = []
    for idx, config in enumerate(configs, 1):
        # Validate config structure
        required_fields = {"service", "env"}
        missing = required_fields - config.keys()
        if missing:
            print(f"❌ Config {idx}: Missing required fields: {', '.join(sorted(missing))}")
            results.append({"config": config, "status": "invalid", "error": f"Missing fields: {missing}"})
            continue

        service = config["service"]
        env_tag = config["env"]
        window = config.get("window", "1h")
        limit = config.get("limit", 10)

        print(f"📊 [{idx}/{len(configs)}] Checking: {service} (env={env_tag}, window={window})")

        # Build command
        cmd = [
            str(verify_script),
            "--service", service,
            "--env", env_tag,
            "--window", window,
            "--limit", str(limit)
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60,
                env=os.environ.copy()
            )

            if result.returncode == 0:
                print(f"✅ Success: {result.stdout.strip()}")
                results.append({"config": config, "status": "success"})
            elif result.returncode == 2:
                print(f"⚠️  No traces found for {service} in {env_tag} (window: {window})")
                results.append({"config": config, "status": "no_traces"})
            else:
                print(f"❌ Failed: {result.stderr.strip()}")
                results.append({"config": config, "status": "error", "error": result.stderr.strip()})
        except subprocess.TimeoutExpired:
            print(f"❌ Timeout: Request exceeded 60 seconds")
            results.append({"config": config, "status": "timeout"})
        except Exception as e:
            print(f"❌ Exception: {e}")
            results.append({"config": config, "status": "exception", "error": str(e)})

        print()

    # Summary
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)

    success_count = sum(1 for r in results if r["status"] == "success")
    no_traces_count = sum(1 for r in results if r["status"] == "no_traces")
    error_count = sum(1 for r in results if r["status"] in ("error", "timeout", "exception", "invalid"))

    print(f"✅ Successful: {success_count}")
    print(f"⚠️  No traces: {no_traces_count}")
    print(f"❌ Errors: {error_count}")
    print()

    # Exit with appropriate code
    # Success if at least one config succeeded
    # Warning (exit 2) if no traces found but no errors
    # Error (exit 1) if any errors occurred
    if error_count > 0:
        print("❌ Some checks failed")
        sys.exit(1)
    elif success_count == 0 and no_traces_count > 0:
        print("⚠️  No traces found for any service (may be expected in non-production)")
        sys.exit(0)  # Don't fail the build for missing traces
    else:
        print("✅ All checks passed")
        sys.exit(0)


if __name__ == "__main__":
    main()
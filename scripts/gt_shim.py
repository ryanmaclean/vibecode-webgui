#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "gt-shim"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "scripts"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation

try:
    import os as _os; _c = __import__('ddtrace').config; _s = _os.path.basename(__file__).replace('.py',''); _c.service = _s; _c.requests.service = _s; __import__('ddtrace').patch_all()
except: pass


# -- VibeCode Telemetry --
import sys
import os

# Initialize log aggregation
log_agg = get_log_aggregation()

try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), './')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

import sys
import logging
import subprocess
import json
import os

# This shim allows legacy 'gt' commands to map to OpenClaw
logging.basicConfig(format='[GT-SHIM] %(message)s')
logger = logging.getLogger()

def main():
    args = sys.argv[1:]
    if not args:
        print("Gas Town Shim (Powered by OpenClaw)")
        return

    cmd = args[0]
    if cmd == "status":
        # Call Ralph Loop
        subprocess.run(["python3", "scripts/ralph_loop.py"])
    elif cmd == "up":
        print("Starting OpenClaw VM...")
        subprocess.run(["python3", "scripts/launch_ubuntu_vm.py"])
    elif cmd == "mayor":
        print("🎩 GT Mayor: Reviewing Issues for Assignment...")
        
        # Fetch issues via gh CLI
        try:
            res = subprocess.run(["gh", "issue", "list", "--state", "open", "--limit", "5", "--json", "number,title"], capture_output=True, text=True)
            if res.returncode != 0:
                print(f"❌ GitHub CLI error: {res.stderr}")
                return

            issues = json.loads(res.stdout)
            
            if not issues:
                print("  No open issues found.")
                return
            
            os.makedirs(".agents/tasks", exist_ok=True)
            
            for issue in issues:
                print(f"  - Issue #{issue['number']}: {issue['title']}")
                
                # Check if task already exists
                task_file = f".agents/tasks/polecat-issue-{issue['number']}.md"
                if os.path.exists(task_file):
                     print(f"    ℹ️  Agent already assigned ({task_file})")
                else:
                    print(f"    🚀 Slinging work to Polecat Agent...")
                    with open(task_file, "w") as f:
                        f.write(f"# Task: Resolve Issue #{issue['number']}\n\n")
                        f.write(f"Title: {issue['title']}\n")
                        f.write(f"Source: GitHub Issue #{issue['number']}\n")
                        f.write(f"Status: Pending\n")
                    print(f"    ✅ Task created: {task_file}")
                
        except Exception as e:
            print(f"❌ Failed to execute Mayor protocol: {e}")

    else:
        print(f"Unknown legacy command: {cmd}. Try 'status', 'up', or 'mayor'.")

if __name__ == "__main__":
    main()
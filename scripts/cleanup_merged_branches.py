#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "cleanup-merged-branches"
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

import subprocess
import sys

def get_merged_branches():
    # Get remote branches merged into main
    cmd = ["git", "branch", "-r", "--merged", "main"]
    result = subprocess.run(cmd, capture_output=True, text=True)
    branches = []
    for line in result.stdout.splitlines():
        branch = line.strip()
        if "->" in branch: continue # Skip HEAD -> main
        if "origin/main" in branch: continue
        if "origin/release/" in branch: continue # Skip releases for safety
        if branch.startswith("origin/"):
            branches.append(branch.replace("origin/", ""))
    return branches

def delete_branches(branches):
    if not branches:
        print("No merged branches to delete.")
        return

    print(f"Found {len(branches)} merged branches to delete.")
    
    # Batch delete to be faster
    # git push origin --delete branch1 branch2 ...
    # But command line length limits might apply.
    # Let's do chunks of 10.
    
    chunk_size = 10
    for i in range(0, len(branches), chunk_size):
        chunk = branches[i:i + chunk_size]
        print(f"Deleting chunk {i//chunk_size + 1}: {chunk}")
        cmd = ["git", "push", "origin", "--delete"] + chunk
        subprocess.run(cmd)

if __name__ == "__main__":
    branches = get_merged_branches()
    delete_branches(branches)
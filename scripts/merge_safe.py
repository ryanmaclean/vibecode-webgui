#!/usr/bin/env python3
import subprocess
import sys
from vibecode.telemetry import init_telemetry, get_logger
from ddtrace import tracer

logger = get_logger("merge_safe")
init_telemetry("vibecode-merge-safe")

BRANCHES = [
    "fix/typescript-ai-monitoring-any",
    "fix/typescript-api-routes-any",
    "fix/typescript-collaboration-types",
    "fix/typescript-components-any-batch2",
    # Add others as needed
]

@tracer.wrap()
def merge_branch(branch):
    logger.info(f"Attempting merge: {branch}")
    try:
        subprocess.run(["git", "merge", f"origin/{branch}", "-m", f"Merge {branch}"], check=True)
        logger.info(f"✅ Merged {branch}")
        return True
    except subprocess.CalledProcessError:
        logger.error(f"❌ Conflict in {branch} - Aborting")
        subprocess.run(["git", "merge", "--abort"])
        return False

if __name__ == "__main__":
    subprocess.run(["git", "fetch", "origin"], check=True)
    for branch in BRANCHES:
        merge_branch(branch)

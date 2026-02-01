#!/usr/bin/env python3
import subprocess
import sys
from vibecode.telemetry import init_telemetry, get_logger
from ddtrace import tracer

logger = get_logger("merge_safe")
init_telemetry("vibecode-merge-safe")

BRANCHES = [
    "polecat/vibecode-111/st-sh2py-security@ml2k1lcc",
    "polecat/vibecode-108/st-sh2py-tests@ml2jzv7b",
    "polecat/vibecode-110/st-sh2py-util@ml2k10le",
    "polecat/amazonite/st-o7lr@mkq8vdvc",
    "fix/typescript-api-routes-any",
    "fix/typescript-services-pages-types",
    "fix/typescript-parser-error-types",
    "fix/typescript-collaboration-types",
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

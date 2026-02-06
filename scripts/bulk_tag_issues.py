#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "bulk-tag-issues"
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
import json
import time
import sys

def run_gh_command(cmd):
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {e}")
        return None

def get_items(item_type):
    # item_type is "issue" or "pr"
    print(f"Fetching {item_type}s...")
    output = run_gh_command(["gh", item_type, "list", "--limit", "100", "--json", "number,title,labels"])
    if output:
        return json.loads(output)
    return []

def add_label(item_type, number, labels):
    print(f"Tagging {item_type} #{number} with {labels}...")
    cmd = ["gh", item_type, "edit", str(number)]
    for label in labels:
        cmd.extend(["--add-label", label])
    
    run_gh_command(cmd)
    time.sleep(1) # Avoid rate limits

def main():
    # Ensure labels exist
    print("Ensuring labels exist...")
    subprocess.run(["gh", "label", "create", "feature-audit", "--color", "c5def5", "--force"], capture_output=True)
    subprocess.run(["gh", "label", "create", "priority:low", "--color", "0e8a16", "--force"], capture_output=True)
    subprocess.run(["gh", "label", "create", "area:docs", "--color", "0075ca", "--force"], capture_output=True)

    # Process Issues
    issues = get_items("issue")
    for issue in issues:
        number = issue['number']
        title = issue['title']
        current_labels = [l['name'] for l in issue['labels']]
        
        labels_to_add = []
        
        if "Feature Audit" in title:
            if "feature-audit" not in current_labels:
                labels_to_add.append("feature-audit")
            if "priority:low" not in current_labels:
                labels_to_add.append("priority:low")
        
        if "docs" in title.lower() or "documentation" in title.lower():
             if "area:docs" not in current_labels:
                labels_to_add.append("area:docs")

        if labels_to_add:
            add_label("issue", number, labels_to_add)

    # Process PRs
    prs = get_items("pr")
    for pr in prs:
        number = pr['number']
        title = pr['title']
        current_labels = [l['name'] for l in pr['labels']]
        
        labels_to_add = []
        
        if "Feature Audit" in title:
            if "feature-audit" not in current_labels:
                labels_to_add.append("feature-audit")
            if "priority:low" not in current_labels:
                labels_to_add.append("priority:low")
        
        if "docs" in title.lower() or "documentation" in title.lower():
             if "area:docs" not in current_labels:
                labels_to_add.append("area:docs")

        if labels_to_add:
            add_label("pr", number, labels_to_add)

if __name__ == "__main__":
    main()
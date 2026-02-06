#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "fix-telemetry-imports"
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

try:
    import os as _os; _c = __import__('ddtrace').config; _s = _os.path.basename(__file__).replace('.py',''); _c.service = _s; _c.requests.service = _s; __import__('ddtrace').patch_all()
except: pass

import os

TELEMETRY_START = "# -- VibeCode Telemetry --"
TELEMETRY_END = "# ------------------------"

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Check if telemetry exists
    telemetry_start_idx = -1
    telemetry_end_idx = -1
    
    for i, line in enumerate(lines):
        if TELEMETRY_START in line:
            telemetry_start_idx = i
        if TELEMETRY_END in line:
            telemetry_end_idx = i
            
    if telemetry_start_idx == -1 or telemetry_end_idx == -1:
        return False

    # Check for future imports
    future_import_idx = -1
    for i, line in enumerate(lines):
        if line.strip().startswith("from __future__"):
            future_import_idx = i

    if future_import_idx == -1:
        return False

    # If telemetry is BEFORE future import, we need to move it
    if telemetry_start_idx < future_import_idx:
        print(f"Fixing {filepath}...")
        
        # Extract telemetry block
        telemetry_block = lines[telemetry_start_idx:telemetry_end_idx+1]
        
        # Remove telemetry block from original location
        # We delete from end to start to avoid index shifting issues within the block
        del lines[telemetry_start_idx:telemetry_end_idx+1]
        
        # Find the new index for future import (it shifted down because we deleted lines above it? No, shifted up)
        # We need to re-scan for future import because indices changed
        new_future_idx = -1
        for i, line in enumerate(lines):
            if line.strip().startswith("from __future__"):
                new_future_idx = i
        
        # Insert after the future import
        # We insert at new_future_idx + 1
        insert_pos = new_future_idx + 1
        
        # Add a newline before if needed
        if insert_pos < len(lines) and lines[insert_pos].strip() != "":
            telemetry_block.append("\n")
            
        lines[insert_pos:insert_pos] = telemetry_block
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        return True
        
    return False

def main():
    count = 0
    for root, dirs, files in os.walk("."):
        if ".venv" in dirs:
            dirs.remove(".venv")
        if "node_modules" in dirs:
            dirs.remove("node_modules")
            
        for file in files:
            if file.endswith(".py"):
                if fix_file(os.path.join(root, file)):
                    count += 1
    
    print(f"Fixed {count} files.")

if __name__ == "__main__":
    main()
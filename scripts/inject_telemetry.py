#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "inject-telemetry"
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

import os

# Initialize log aggregation
log_agg = get_log_aggregation()


def get_relative_path_to_scripts(file_path):
    abs_file_path = os.path.abspath(file_path)
    repo_root = os.getcwd()
    
    if not abs_file_path.startswith(repo_root):
        return "../" 
        
    rel_path = os.path.relpath(abs_file_path, repo_root)
    depth = rel_path.count(os.sep)
    
    path_to_scripts = "../" * (depth - 1) if depth > 0 else "./"
    if path_to_scripts == "": path_to_scripts = "./"
    
    return path_to_scripts

def inject_telemetry(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        if "init_telemetry" in content:
            return

        lines = content.splitlines()
        insert_idx = 0
        
        # Skip shebang
        if lines and lines[0].startswith("#!"):
            insert_idx += 1
        # Skip encoding
        if len(lines) > insert_idx and "coding:" in lines[insert_idx]:
            insert_idx += 1
        # Skip empty lines
        while len(lines) > insert_idx and not lines[insert_idx].strip():
            insert_idx += 1
        # Skip __future__ imports
        while len(lines) > insert_idx and lines[insert_idx].startswith("from __future__"):
            insert_idx += 1
            
        rel_path = get_relative_path_to_scripts(file_path)
        
        injection = [
            "",
            "# -- VibeCode Telemetry --",
            "import sys",
            "import os",
            "try:",
            f"    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '{rel_path}')))",
            "    from vibecode.telemetry import init_telemetry",
            "    tracer = init_telemetry(os.path.basename(__file__))",
            "except ImportError:",
            "    pass",
            "# ------------------------",
            ""
        ]
        
        new_lines = lines[:insert_idx] + injection + lines[insert_idx:]
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(new_lines))
        
        print(f"Injected telemetry into {file_path}")
    except Exception as e:
        print(f"Failed to process {file_path}: {e}")

def main():
    print("Injecting Datadog telemetry into Python files...")
    for root, dirs, files in os.walk("."):
        # Exclude directories
        if "node_modules" in dirs: dirs.remove("node_modules")
        if "venv" in dirs: dirs.remove("venv")
        if ".venv" in dirs: dirs.remove(".venv") # CRITICAL FIX
        if ".git" in dirs: dirs.remove(".git")
        
        for file in files:
            if file.endswith(".py"):
                # Exclude specific files
                if file == "telemetry.py": continue
                if file == "__init__.py": continue # Skip init files to avoid circular imports
                if file == "inject_telemetry.py": continue
                
                file_path = os.path.join(root, file)
                inject_telemetry(file_path)

if __name__ == "__main__":
    main()

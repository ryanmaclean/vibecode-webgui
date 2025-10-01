#!/usr/bin/env python3
"""
Wrapper script for roundtable_mcp_server with Datadog tracing.
Patches the log file path to use a writable location and adds DD tracing.
"""
import os
import sys
from pathlib import Path

# Initialize Datadog tracing before importing the server
try:
    import ddtrace
    from ddtrace import tracer, patch
    
    # Set environment variables for Datadog Agent connection
    if 'DD_AGENT_HOST' not in os.environ:
        os.environ['DD_AGENT_HOST'] = 'localhost'
    if 'DD_TRACE_AGENT_PORT' not in os.environ:
        os.environ['DD_TRACE_AGENT_PORT'] = '8126'
    
    # Patch common libraries
    patch(logging=True, requests=True, subprocess=True)
    
    # Set service name and tags
    ddtrace.config.service = 'mcp-roundtable-ai'
    ddtrace.config.env = os.getenv('DD_ENV', 'development')
    ddtrace.config.version = os.getenv('DD_VERSION', '1.0.0')
    
    print(f"Datadog tracing enabled for roundtable-ai MCP server", file=sys.stderr)
except ImportError:
    print(f"Warning: ddtrace not available, running without tracing", file=sys.stderr)
except Exception as e:
    print(f"Warning: Failed to initialize ddtrace: {e}", file=sys.stderr)

# Change to a writable directory before importing the server
# This ensures Path.cwd() returns a writable location
os.chdir(os.path.expanduser("~/vibecode-webgui"))

# Now import and run the server with tracing
from roundtable_mcp_server import main

if __name__ == "__main__":
    if 'tracer' in dir():
        with tracer.trace("mcp.roundtable.main", service="mcp-roundtable-ai"):
            main()
    else:
        main()

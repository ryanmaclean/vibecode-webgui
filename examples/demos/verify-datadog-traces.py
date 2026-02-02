#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
Verify Datadog traces have input/output content

Queries Datadog API to check if traces exist and have content in INPUT/OUTPUT fields.
"""

import os
import sys
import json
import time
from datetime import datetime, timedelta

def get_api_key():
    """Get Datadog API key from config file"""
    try:
        with open('/opt/datadog-agent/etc/datadog.yaml') as f:
            for line in f:
                if line.strip().startswith('api_key:') and 'dogfood' not in line.lower():
                    return line.split(':', 1)[1].strip()
    except Exception as e:
        print(f"Error reading API key: {e}")
    return os.getenv('DD_API_KEY')

def query_datadog_traces(api_key, ml_app, service, minutes_ago=15):
    """Query Datadog API for traces"""
    import urllib.request
    import urllib.parse
    
    now = int(time.time())
    from_time = now - (minutes_ago * 60)
    
    # Use Datadog's trace search API
    # Note: This requires proper API/App key setup
    url = f"https://api.datadoghq.com/api/v2/apm/traces"
    
    params = {
        'filter[query]': f'service:{service} ml_app:{ml_app}',
        'filter[from]': f'{from_time}000000000',
        'filter[to]': f'{now}000000000',
        'page[limit]': '5'
    }
    
    query_string = urllib.parse.urlencode(params)
    full_url = f"{url}?{query_string}"
    
    req = urllib.request.Request(
        full_url,
        headers={
            'DD-API-KEY': api_key,
            'Content-Type': 'application/json'
        }
    )
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"API query failed: {e}")
        return None

def check_trace_content(trace_data):
    """Check if trace has input/output content"""
    if not trace_data or 'data' not in trace_data:
        return False, "No trace data found"
    
    traces = trace_data.get('data', [])
    if not traces:
        return False, "No traces found"
    
    print(f"Found {len(traces)} trace(s)")
    
    for i, trace in enumerate(traces):
        trace_id = trace.get('id', 'unknown')
        spans = trace.get('attributes', {}).get('spans', [])
        
        print(f"\nTrace {i+1}: {trace_id}")
        print(f"  Spans: {len(spans)}")
        
        # Check for workflow spans with input/output
        workflow_spans = [s for s in spans if s.get('attributes', {}).get('type') == 'workflow']
        if workflow_spans:
            print(f"  Workflow spans: {len(workflow_spans)}")
            for span in workflow_spans:
                name = span.get('attributes', {}).get('name', 'unknown')
                has_input = 'input' in str(span).lower() or 'input_value' in str(span)
                has_output = 'output' in str(span).lower() or 'output_value' in str(span)
                print(f"    - {name}: INPUT={has_input}, OUTPUT={has_output}")
        
        # Check for LLM spans
        llm_spans = [s for s in spans if 'openai' in str(s).lower() or 'llm' in str(s).lower()]
        if llm_spans:
            print(f"  LLM spans: {len(llm_spans)}")
    
    return True, f"Found {len(traces)} trace(s)"

def main():
    print("=" * 70)
    print("Datadog Trace Verification")
    print("=" * 70)
    print()
    
    # Configuration
    ml_app = os.getenv('DD_LLMOBS_ML_APP', 'vibecode-crewai-working')
    service = os.getenv('DD_SERVICE', 'vibecode-crew')
    
    print(f"ML App: {ml_app}")
    print(f"Service: {service}")
    print()
    
    # Get API key
    api_key = get_api_key()
    if not api_key:
        print("ERROR: DD_API_KEY not found")
        print("Set DD_API_KEY environment variable or ensure Datadog agent config is readable")
        sys.exit(1)
    
    print(f"API Key: {api_key[:10]}...")
    print()
    
    # Query traces
    print("Querying Datadog for traces...")
    print("(Note: API access may require application key)")
    print()
    
    trace_data = query_datadog_traces(api_key, ml_app, service)
    
    if trace_data:
        success, message = check_trace_content(trace_data)
        print()
        print(f"Status: {message}")
    else:
        print()
        print("=" * 70)
        print("MANUAL VERIFICATION REQUIRED")
        print("=" * 70)
        print()
        print("The Datadog API query requires proper authentication.")
        print("Please verify manually in the Datadog UI:")
        print()
        print(f"1. Go to: https://app.datadoghq.com/llm/traces")
        print(f"2. Search: ml_app:{ml_app}")
        print(f"3. Filter: service:{service}")
        print(f"4. Check the most recent trace")
        print(f"5. Verify INPUT/OUTPUT fields show content (not 'No content')")
        print()
        print("Expected:")
        print("- Workflow span: INPUT with task descriptions, OUTPUT with results")
        print("- Agent spans: INPUT with task descriptions, OUTPUT with responses")
        print("- LLM spans: INPUT with prompts, OUTPUT with responses")
        print()

if __name__ == '__main__':
    main()

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

"""
Automated Log Aggregation Integration Script
Automatically integrates Datadog log aggregation into existing deployment scripts
"""


# Datadog APM tracing
try:
    import ddtrace
    ddtrace.patch_all()
except ImportError:
    print("Warning: ddtrace not installed, tracing disabled")
    pass

import os
import sys
import re
import argparse
from pathlib import Path
from typing import List, Dict, Any

class LogAggregationIntegrator:
    def __init__(self, scripts_dir: str = "scripts"):
        self.scripts_dir = Path(scripts_dir)
        self.integration_patterns = {
            'bash': {
                'import_pattern': r'^#!/bin/bash',
                'import_line': 'source "$(dirname "$0")/lib/log-aggregation.sh"\n',
                'init_pattern': r'init_log_aggregation',
                'init_line': 'init_log_aggregation\n',
                'cleanup_pattern': r'cleanup_log_aggregation',
                'cleanup_line': 'trap cleanup_log_aggregation EXIT\n'
            },
            'python': {
                'import_pattern': r'^#!/usr/bin/env python3',
                'import_line': 'from scripts.lib.log_aggregation import get_log_aggregation\n',
                'init_pattern': r'get_log_aggregation',
                'init_line': 'log_agg = get_log_aggregation()\n',
                'cleanup_pattern': r'log_agg\.cleanup',
                'cleanup_line': 'log_agg.cleanup()\n'
            },
            'node': {
                'import_pattern': r'^#!/usr/bin/env node',
                'import_line': 'const LogAggregation = require("./lib/log-aggregation-node.js");\n',
                'init_pattern': r'new LogAggregation',
                'init_line': 'const logAggregation = new LogAggregation();\n',
                'cleanup_pattern': r'logAggregation\.cleanup',
                'cleanup_line': 'logAggregation.cleanup();\n'
            }
        }
    
    def detect_script_type(self, file_path: Path) -> str:
        """Detect the type of script based on shebang and extension"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                first_line = f.readline().strip()
                
            if first_line.startswith('#!/bin/bash') or file_path.suffix == '.sh':
                return 'bash'
            elif first_line.startswith('#!/usr/bin/env python') or file_path.suffix == '.py':
                return 'python'
            elif first_line.startswith('#!/usr/bin/env node') or file_path.suffix == '.js':
                return 'node'
            else:
                return 'unknown'
        except Exception:
            return 'unknown'
    
    def read_script_content(self, file_path: Path) -> str:
        """Read script content with proper encoding handling"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
        except UnicodeDecodeError:
            # Try with different encoding
            with open(file_path, 'r', encoding='latin-1') as f:
                return f.read()
    
    def write_script_content(self, file_path: Path, content: str):
        """Write script content with proper encoding"""
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
    
    def integrate_bash_script(self, content: str) -> str:
        """Integrate log aggregation into bash script"""
        lines = content.split('\n')
        new_lines = []
        
        # Add import after shebang
        if lines[0].startswith('#!/bin/bash'):
            new_lines.append(lines[0])
            new_lines.append('')
            new_lines.append('# Datadog Log Aggregation')
            new_lines.append('source "$(dirname "$0")/lib/log-aggregation.sh"')
            new_lines.append('')
            
            # Add initialization after imports
            init_added = False
            for i, line in enumerate(lines[1:], 1):
                new_lines.append(line)
                
                # Add initialization after variable declarations
                if not init_added and (line.startswith('#') or line.strip() == '' or '=' in line):
                    if i < len(lines) - 1 and not lines[i+1].startswith('#'):
                        new_lines.append('')
                        new_lines.append('# Initialize log aggregation')
                        new_lines.append('init_log_aggregation')
                        new_lines.append('')
                        init_added = True
        else:
            new_lines = lines
        
        return '\n'.join(new_lines)
    
    def integrate_python_script(self, content: str) -> str:
        """Integrate log aggregation into Python script"""
        lines = content.split('\n')
        new_lines = []
        
        # Add import after shebang and docstring
        import_added = False
        init_added = False
        
        for i, line in enumerate(lines):
            new_lines.append(line)
            
            # Add import after shebang and initial comments
            if not import_added and (line.startswith('#!/usr/bin/env python') or 
                                   (line.startswith('"""') and i > 0 and lines[i-1].startswith('#!/usr/bin/env python'))):
                new_lines.append('')
                new_lines.append('# Datadog Log Aggregation')
                new_lines.append('from scripts.lib.log_aggregation import get_log_aggregation')
                new_lines.append('')
                import_added = True
            
            # Add initialization after imports
            elif not init_added and import_added and (line.startswith('import ') or line.startswith('from ')):
                if i == len(lines) - 1 or not (lines[i+1].startswith('import ') or lines[i+1].startswith('from ')):
                    new_lines.append('')
                    new_lines.append('# Initialize log aggregation')
                    new_lines.append('log_agg = get_log_aggregation()')
                    new_lines.append('')
                    init_added = True
        
        return '\n'.join(new_lines)
    
    def integrate_node_script(self, content: str) -> str:
        """Integrate log aggregation into Node.js script"""
        lines = content.split('\n')
        new_lines = []
        
        # Add import after shebang
        import_added = False
        init_added = False
        
        for i, line in enumerate(lines):
            new_lines.append(line)
            
            # Add import after shebang
            if not import_added and line.startswith('#!/usr/bin/env node'):
                new_lines.append('')
                new_lines.append('// Datadog Log Aggregation')
                new_lines.append('const LogAggregation = require("./lib/log-aggregation-node.js");')
                new_lines.append('')
                import_added = True
            
            # Add initialization after imports
            elif not init_added and import_added and (line.startswith('const ') or line.startswith('let ') or line.startswith('var ')):
                if i == len(lines) - 1 or not (lines[i+1].startswith('const ') or lines[i+1].startswith('let ') or lines[i+1].startswith('var ')):
                    new_lines.append('')
                    new_lines.append('// Initialize log aggregation')
                    new_lines.append('const logAggregation = new LogAggregation();')
                    new_lines.append('')
                    init_added = True
        
        return '\n'.join(new_lines)
    
    def integrate_script(self, file_path: Path) -> bool:
        """Integrate log aggregation into a single script"""
        script_type = self.detect_script_type(file_path)
        
        if script_type == 'unknown':
            print(f"⚠️ Skipping {file_path}: Unknown script type")
            return False
        
        try:
            content = self.read_script_content(file_path)
            
            # Check if already integrated
            if 'log-aggregation' in content or 'LogAggregation' in content:
                print(f"ℹ️ Skipping {file_path}: Already has log aggregation")
                return False
            
            # Integrate based on script type
            if script_type == 'bash':
                new_content = self.integrate_bash_script(content)
            elif script_type == 'python':
                new_content = self.integrate_python_script(content)
            elif script_type == 'node':
                new_content = self.integrate_node_script(content)
            else:
                return False
            
            # Write back the modified content
            self.write_script_content(file_path, new_content)
            print(f"✅ Integrated log aggregation into {file_path}")
            return True
            
        except Exception as e:
            print(f"❌ Failed to integrate {file_path}: {e}")
            return False
    
    def find_scripts(self, pattern: str = "*.sh") -> List[Path]:
        """Find scripts matching the pattern"""
        scripts = []
        
        for root, dirs, files in os.walk(self.scripts_dir):
            # Skip lib directory to avoid modifying the log aggregation modules themselves
            if 'lib' in root:
                continue
                
            for file in files:
                file_path = Path(root) / file
                if file_path.match(pattern):
                    scripts.append(file_path)
        
        return scripts
    
    def integrate_all_scripts(self, dry_run: bool = False) -> Dict[str, Any]:
        """Integrate log aggregation into all deployment scripts"""
        results = {
            'total_scripts': 0,
            'integrated': 0,
            'skipped': 0,
            'failed': 0,
            'scripts': []
        }
        
        # Find all script types
        bash_scripts = self.find_scripts("*.sh")
        python_scripts = self.find_scripts("*.py")
        node_scripts = self.find_scripts("*.js")
        
        all_scripts = bash_scripts + python_scripts + node_scripts
        results['total_scripts'] = len(all_scripts)
        
        print(f"🔍 Found {len(all_scripts)} scripts to process")
        
        for script_path in all_scripts:
            script_result = {
                'path': str(script_path),
                'type': self.detect_script_type(script_path),
                'status': 'pending'
            }
            
            if dry_run:
                print(f"🔍 Would integrate: {script_path}")
                script_result['status'] = 'would_integrate'
                results['integrated'] += 1
            else:
                if self.integrate_script(script_path):
                    script_result['status'] = 'integrated'
                    results['integrated'] += 1
                else:
                    script_result['status'] = 'skipped'
                    results['skipped'] += 1
            
            results['scripts'].append(script_result)
        
        return results
    
    def create_integration_report(self, results: Dict[str, Any]) -> str:
        """Create a detailed integration report"""
        report = []
        report.append("# Datadog Log Aggregation Integration Report")
        report.append(f"Generated: {os.popen('date').read().strip()}")
        report.append("")
        
        report.append("## Summary")
        report.append(f"- Total Scripts: {results['total_scripts']}")
        report.append(f"- Integrated: {results['integrated']}")
        report.append(f"- Skipped: {results['skipped']}")
        report.append(f"- Failed: {results['failed']}")
        report.append("")
        
        report.append("## Script Details")
        for script in results['scripts']:
            status_emoji = {
                'integrated': '✅',
                'skipped': 'ℹ️',
                'failed': '❌',
                'would_integrate': '🔍'
            }.get(script['status'], '❓')
            
            report.append(f"- {status_emoji} {script['path']} ({script['type']})")
        
        return '\n'.join(report)

def main():
    parser = argparse.ArgumentParser(description='Integrate Datadog log aggregation into deployment scripts')
    parser.add_argument('--scripts-dir', default='scripts', help='Directory containing scripts to integrate')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done without making changes')
    parser.add_argument('--report-file', help='Save integration report to file')
    
    args = parser.parse_args()
    
    integrator = LogAggregationIntegrator(args.scripts_dir)
    
    print("🚀 Starting Datadog Log Aggregation Integration")
    print(f"Scripts directory: {args.scripts_dir}")
    print(f"Dry run: {args.dry_run}")
    print("")
    
    results = integrator.integrate_all_scripts(dry_run=args.dry_run)
    
    print("")
    print("📊 Integration Results:")
    print(f"Total scripts: {results['total_scripts']}")
    print(f"Integrated: {results['integrated']}")
    print(f"Skipped: {results['skipped']}")
    print(f"Failed: {results['failed']}")
    
    if args.report_file:
        report = integrator.create_integration_report(results)
        with open(args.report_file, 'w') as f:
            f.write(report)
        print(f"📄 Report saved to: {args.report_file}")
    
    if results['integrated'] > 0:
        print("")
        print("🎉 Log aggregation integration completed!")
        print("Next steps:")
        print("1. Test the integrated scripts")
        print("2. Verify logs are being sent to Datadog")
        print("3. Check Datadog Logs dashboard for incoming logs")

if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""
Datadog Log Aggregation Module for Python Scripts
Provides centralized logging functionality for all deployment scripts
Usage: from scripts.lib.log_aggregation import LogAggregation
"""

import os
import sys
import json
import time
import subprocess
import tempfile
from datetime import datetime
from typing import Dict, Any, Optional

class LogAggregation:
    def __init__(self):
        self.enabled = os.getenv('DD_LOG_AGGREGATION_ENABLED', 'true').lower() == 'true'
        self.service_name = os.getenv('DD_SERVICE', 'vibecode-webgui')
        self.environment = os.getenv('DD_ENV', 'development')
        self.version = os.getenv('DD_VERSION', '1.0.0')
        self.api_key = os.getenv('DD_API_KEY')
        self.log_level = self._parse_log_level(os.getenv('DD_LOG_LEVEL', 'info'))
        self.log_file = None
        self.start_time = time.time()
        self.node_script_path = None
        
        # Log levels
        self.levels = {
            'debug': 0,
            'info': 1,
            'warn': 2,
            'error': 3
        }
        
        self._init()
    
    def _parse_log_level(self, level: str) -> int:
        return self.levels.get(level.lower(), self.levels['info'])
    
    def _init(self):
        if not self.enabled:
            print('ℹ️ Log aggregation disabled')
            return
        
        if not self.api_key:
            print('⚠️ Warning: DD_API_KEY not set, log aggregation disabled')
            self.enabled = False
            return
        
        try:
            # Find the Node.js log aggregation script
            script_dir = os.path.dirname(os.path.abspath(__file__))
            self.node_script_path = os.path.join(script_dir, 'log-aggregation-node.js')
            
            if not os.path.exists(self.node_script_path):
                print('⚠️ Warning: Node.js log aggregation script not found, using basic logging')
                self.enabled = False
                return
            
            # Create log directory
            log_dir = os.path.join(tempfile.gettempdir(), 'datadog-logs')
            os.makedirs(log_dir, exist_ok=True)
            
            # Initialize log file
            timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
            script_name = os.path.basename(sys.argv[0]).replace('.py', '')
            self.log_file = os.path.join(log_dir, f'{script_name}-{timestamp}.log')
            
            # Write initial metadata
            metadata = {
                'service': self.service_name,
                'env': self.environment,
                'version': self.version,
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'script': script_name,
                'pid': os.getpid()
            }
            
            with open(self.log_file, 'w') as f:
                f.write(json.dumps(metadata) + '\n')
            
            print(f'✅ Log aggregation initialized: {self.log_file}')
            
        except Exception as error:
            print(f'❌ Failed to initialize log aggregation: {error}')
            self.enabled = False
    
    def _send_log_to_datadog(self, level: str, message: str, context: Dict[str, Any] = None):
        if not self.enabled or not self.node_script_path:
            return
        
        try:
            log_entry = {
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'level': level.upper(),
                'message': message,
                'service': self.service_name,
                'env': self.environment,
                'version': self.version,
                'script': os.path.basename(sys.argv[0]),
                'pid': os.getpid(),
                'context': {
                    **(context or {}),
                    'component': os.path.basename(sys.argv[0])
                }
            }
            
            # Write to local log file
            with open(self.log_file, 'a') as f:
                f.write(json.dumps(log_entry) + '\n')
            
            # Send to Datadog via Node.js script
            try:
                subprocess.run([
                    'node', self.node_script_path,
                    '--log-entry', json.dumps(log_entry)
                ], check=False, capture_output=True, timeout=5)
            except (subprocess.TimeoutExpired, subprocess.CalledProcessError, FileNotFoundError):
                # Silently handle errors to avoid disrupting main script
                pass
                
        except Exception:
            # Silently handle errors to avoid disrupting main script
            pass
    
    def log(self, level: str, message: str, context: Dict[str, Any] = None):
        if self.levels.get(level, 1) >= self.log_level:
            emoji = {
                'debug': '🔍',
                'info': 'ℹ️',
                'warn': '⚠️',
                'error': '❌'
            }.get(level, 'ℹ️')
            
            print(f'{emoji} {level.upper()}: {message}')
            self._send_log_to_datadog(level, message, context)
    
    def debug(self, message: str, context: Dict[str, Any] = None):
        self.log('debug', message, context)
    
    def info(self, message: str, context: Dict[str, Any] = None):
        self.log('info', message, context)
    
    def warn(self, message: str, context: Dict[str, Any] = None):
        self.log('warn', message, context)
    
    def error(self, message: str, context: Dict[str, Any] = None):
        self.log('error', message, context)
    
    def log_script_start(self, script_name: str, parameters: Dict[str, Any] = None):
        self.info(f'Script started: {script_name}')
        self._send_log_to_datadog('info', 'Script execution started', {
            'script': script_name,
            'parameters': json.dumps(parameters or {}),
            'event': 'script_start'
        })
    
    def log_script_end(self, script_name: str, exit_code: int = 0, duration: Optional[float] = None):
        actual_duration = duration or (time.time() - self.start_time)
        
        if exit_code == 0:
            self.info(f'Script completed successfully: {script_name} ({actual_duration:.1f}s)')
            self._send_log_to_datadog('info', 'Script execution completed', {
                'script': script_name,
                'exit_code': exit_code,
                'duration': actual_duration,
                'event': 'script_end'
            })
        else:
            self.error(f'Script failed: {script_name} (exit code: {exit_code}, duration: {actual_duration:.1f}s)')
            self._send_log_to_datadog('error', 'Script execution failed', {
                'script': script_name,
                'exit_code': exit_code,
                'duration': actual_duration,
                'event': 'script_end',
                'error': True
            })
    
    def log_deployment_event(self, event_type: str, component: str, status: str, details: Dict[str, Any] = None):
        self.info(f'Deployment event: {event_type} - {component} ({status})')
        self._send_log_to_datadog('info', 'Deployment event', {
            'event_type': event_type,
            'component': component,
            'status': status,
            'details': json.dumps(details or {}),
            'event': 'deployment'
        })
    
    def log_kubernetes_event(self, operation: str, resource: str, namespace: str, status: str):
        self.info(f'Kubernetes event: {operation} {resource} in {namespace} ({status})')
        self._send_log_to_datadog('info', 'Kubernetes operation', {
            'operation': operation,
            'resource': resource,
            'namespace': namespace,
            'status': status,
            'event': 'kubernetes'
        })
    
    def log_database_event(self, operation: str, database: str, status: str, details: Dict[str, Any] = None):
        self.info(f'Database event: {operation} on {database} ({status})')
        self._send_log_to_datadog('info', 'Database operation', {
            'operation': operation,
            'database': database,
            'status': status,
            'details': json.dumps(details or {}),
            'event': 'database'
        })
    
    def log_performance_metric(self, metric_name: str, value: float, unit: str = '', tags: Dict[str, Any] = None):
        self.debug(f'Performance metric: {metric_name} = {value} {unit}')
        self._send_log_to_datadog('info', 'Performance metric', {
            'metric_name': metric_name,
            'value': value,
            'unit': unit,
            'tags': json.dumps(tags or {}),
            'event': 'performance'
        })
    
    def cleanup(self):
        if self.log_file and os.path.exists(self.log_file):
            try:
                # Send final summary log
                with open(self.log_file, 'r') as f:
                    line_count = sum(1 for line in f if line.strip())
                
                self._send_log_to_datadog('info', 'Script execution summary', {
                    'total_log_entries': line_count,
                    'log_file': self.log_file,
                    'event': 'script_summary'
                })
                
            except Exception:
                # Silently handle cleanup errors
                pass

# Global instance for easy access
_log_aggregation = None

def get_log_aggregation() -> LogAggregation:
    global _log_aggregation
    if _log_aggregation is None:
        _log_aggregation = LogAggregation()
    return _log_aggregation

# Convenience functions
def debug(message: str, context: Dict[str, Any] = None):
    get_log_aggregation().debug(message, context)

def info(message: str, context: Dict[str, Any] = None):
    get_log_aggregation().info(message, context)

def warn(message: str, context: Dict[str, Any] = None):
    get_log_aggregation().warn(message, context)

def error(message: str, context: Dict[str, Any] = None):
    get_log_aggregation().error(message, context)

def log_deployment_event(event_type: str, component: str, status: str, details: Dict[str, Any] = None):
    get_log_aggregation().log_deployment_event(event_type, component, status, details)

def log_kubernetes_event(operation: str, resource: str, namespace: str, status: str):
    get_log_aggregation().log_kubernetes_event(operation, resource, namespace, status)

def log_database_event(operation: str, database: str, status: str, details: Dict[str, Any] = None):
    get_log_aggregation().log_database_event(operation, database, status, details)

def log_performance_metric(metric_name: str, value: float, unit: str = '', tags: Dict[str, Any] = None):
    get_log_aggregation().log_performance_metric(metric_name, value, unit, tags)

# Auto-cleanup on exit
import atexit
atexit.register(lambda: get_log_aggregation().cleanup())

if __name__ == '__main__':
    # Test the logging system
    log_agg = LogAggregation()
    
    log_agg.info('Log aggregation test started')
    log_agg.debug('Debug message test')
    log_agg.warn('Warning message test')
    log_agg.error('Error message test')
    
    log_agg.log_deployment_event('test', 'test-component', 'success', {'test': True})
    log_agg.log_performance_metric('test_metric', 100, 'ms', {'test': True})
    
    log_agg.info('Log aggregation test completed')


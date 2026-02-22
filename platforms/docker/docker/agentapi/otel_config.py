"""
OpenTelemetry Configuration for AgentAPI
Provides configuration values for telemetry initialization
"""

import os


class OTelConfig:
    """OpenTelemetry configuration from environment variables"""

    def __init__(self):
        # Service identification
        self.service_name = os.environ.get('OTEL_SERVICE_NAME', 'agentapi')
        self.service_version = os.environ.get('AGENTAPI_VERSION', '0.1.0')
        self.deployment_environment = os.environ.get('OTEL_DEPLOYMENT_ENVIRONMENT', 'development')

        # OpenTelemetry settings
        self.enabled = os.environ.get('OTEL_ENABLED', 'true').lower() == 'true'
        self.exporter_otlp_endpoint = os.environ.get(
            'OTEL_EXPORTER_OTLP_ENDPOINT',
            'http://localhost:4318'
        )
        self.exporter_otlp_protocol = os.environ.get('OTEL_EXPORTER_OTLP_PROTOCOL', 'http/protobuf')

        # Trace settings
        self.traces_exporter = os.environ.get('OTEL_TRACES_EXPORTER', 'otlp')
        self.trace_sample_rate = float(os.environ.get('OTEL_TRACE_SAMPLE_RATE', '1.0'))

        # Metrics settings
        self.metrics_exporter = os.environ.get('OTEL_METRICS_EXPORTER', 'otlp')
        self.metrics_export_interval = int(os.environ.get('OTEL_METRICS_EXPORT_INTERVAL', '60000'))

        # Resource attributes
        self.resource_attributes = {
            'service.name': self.service_name,
            'service.version': self.service_version,
            'deployment.environment': self.deployment_environment,
        }

        # Parse additional resource attributes from env
        custom_attrs = os.environ.get('OTEL_RESOURCE_ATTRIBUTES', '')
        if custom_attrs:
            for attr in custom_attrs.split(','):
                if '=' in attr:
                    key, value = attr.split('=', 1)
                    self.resource_attributes[key.strip()] = value.strip()

    def __repr__(self):
        return f"<OTelConfig service={self.service_name} enabled={self.enabled}>"


# Global config instance
config = OTelConfig()

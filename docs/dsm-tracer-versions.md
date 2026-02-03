# Data Streams Tracer Checklist

Use this as a per-language checklist before enabling schema tracking or DSM across Tundra Dome services.

## Global
- `DD_DATA_STREAMS_ENABLED=true` on all producers/consumers
- Kafka broker `log.message.format.version` >= 0.11.0.0
- Ensure all services add `service`, `env`, `version`, `rig`, `role`, `lane` tags

## Language checklists

### Node.js
- Package: `dd-trace`
- DSM enabled: `DD_DATA_STREAMS_ENABLED=true`
- Schema tracking: Avro/Protobuf supported (check tracer version in DD docs)
- Target version: **5.24+** (or **4.48+**) for schema tracking

### Python
- Package: `ddtrace`
- DSM enabled: `DD_DATA_STREAMS_ENABLED=true`
- Kafka libs: `confluent-kafka` >= 1.16.0 (recommended 2.11.0+) or `aiokafka` >= 4.1.0
- Schema tracking: Avro/Protobuf supported (check tracer version in DD docs)
- Target version: **2.14+** for schema tracking

### Java
- Package: `dd-trace-java`
- DSM enabled: `DD_DATA_STREAMS_ENABLED=true`
- Schema tracking: Avro/Protobuf supported
- Target version: **1.36+** for schema tracking

### Go
- Package: `dd-trace-go`
- DSM enabled: `DD_DATA_STREAMS_ENABLED=true`
- Schema tracking: verify in DD docs for Avro/Protobuf support
- Target version: verify in DD docs

### .NET
- Package: `Datadog.Trace`
- DSM enabled: `DD_DATA_STREAMS_ENABLED=true`
- Schema tracking: Avro/Protobuf supported
- Target version: **3.15+** for schema tracking

### Ruby
- Package: `ddtrace`
- DSM enabled: `DD_DATA_STREAMS_ENABLED=true`
- Schema tracking: verify in DD docs

### PHP
- Package: `ddtrace`
- DSM enabled: `DD_DATA_STREAMS_ENABLED=true`
- Schema tracking: verify in DD docs

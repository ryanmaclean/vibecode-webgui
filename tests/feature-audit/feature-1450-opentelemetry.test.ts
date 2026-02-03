import fs from 'fs';
import path from 'path';

describe('feature audit 1450: OpenTelemetry tracing', () => {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const tracingPath = path.join(repoRoot, 'infrastructure', 'services', 'ai-gateway', 'src', 'tracing.ts');

  it('configures OTLP trace exporter', () => {
    const content = fs.readFileSync(tracingPath, 'utf-8');
    expect(content).toContain('OTLPTraceExporter');
    expect(content).toContain('OTEL_EXPORTER_OTLP_ENDPOINT');
  });
});

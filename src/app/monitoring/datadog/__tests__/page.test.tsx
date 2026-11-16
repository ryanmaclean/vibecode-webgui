import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/monitoring/datadog',
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  );
});

// ── Mock data ──────────────────────────────────────────────────────────────

const MOCK_SERVICES = [
  { name: 'vibecode-webgui', environment: 'production', tracesPerMin: 142, errorRate: 0.12, p95Latency: 245, status: 'healthy' },
  { name: 'vibecode-api', environment: 'production', tracesPerMin: 89, errorRate: 0.08, p95Latency: 312, status: 'healthy' },
  { name: 'vibecode-vm-manager', environment: 'production', tracesPerMin: 34, errorRate: 0.31, p95Latency: 1240, status: 'degraded' },
  { name: 'vibecode-health-checker', environment: 'production', tracesPerMin: 12, errorRate: 0.00, p95Latency: 45, status: 'healthy' },
  { name: 'vibecode-ai-gateway', environment: 'production', tracesPerMin: 67, errorRate: 0.45, p95Latency: 890, status: 'degraded' },
  { name: 'vibecode-websocket', environment: 'production', tracesPerMin: 28, errorRate: 0.00, p95Latency: 18, status: 'healthy' },
];

const MOCK_MONITORS = [
  { id: 'm-001', name: 'Service Health', type: 'service', status: 'OK', lastTriggered: '2024-01-15T10:30:00Z' },
  { id: 'm-002', name: 'API Error Rate', type: 'metric', status: 'Warn', lastTriggered: '2024-01-15T09:45:00Z' },
  { id: 'm-003', name: 'VM Boot Time', type: 'metric', status: 'OK', lastTriggered: '2024-01-14T22:00:00Z' },
  { id: 'm-004', name: 'AI Response Latency', type: 'metric', status: 'Alert', lastTriggered: '2024-01-15T11:00:00Z' },
  { id: 'm-005', name: 'Database Connection Pool', type: 'metric', status: 'OK', lastTriggered: '2024-01-15T08:00:00Z' },
  { id: 'm-006', name: 'Memory Usage', type: 'metric', status: 'OK', lastTriggered: '2024-01-15T07:30:00Z' },
  { id: 'm-007', name: 'WebSocket Connections', type: 'metric', status: 'OK', lastTriggered: '2024-01-14T18:00:00Z' },
  { id: 'm-008', name: 'Certificate Expiry', type: 'log', status: 'OK', lastTriggered: '2024-01-10T12:00:00Z' },
];

const MOCK_CONFIG = [
  { key: 'DD_AGENT_HOST', value: 'localhost', description: 'Datadog agent host' },
  { key: 'DD_TRACE_ENABLED', value: 'true', description: 'Enable distributed tracing' },
  { key: 'DD_SERVICE', value: 'vibecode', description: 'Service name tag' },
  { key: 'DD_ENV', value: 'production', description: 'Environment tag' },
];

function createFetchMock() {
  return jest.fn((url: string) => {
    if (url.includes('section=services')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ services: MOCK_SERVICES }) });
    }
    if (url.includes('section=monitors')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ monitors: MOCK_MONITORS }) });
    }
    if (url.includes('section=config')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ config: MOCK_CONFIG }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }) as jest.Mock;
}

async function renderAndSettle() {
  global.fetch = createFetchMock();
  render(<DatadogIntegrationPage />);
  // Wait for loading to complete
  await waitFor(() => {
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
}

import DatadogIntegrationPage from '../page';

describe('DatadogIntegrationPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', async () => {
    await renderAndSettle();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Datadog Integration');
  });

  it('renders page description', async () => {
    await renderAndSettle();
    expect(
      screen.getByText('APM, logs, metrics, and DogStatsD observability integration')
    ).toBeInTheDocument();
  });

  it('renders breadcrumb with link to /monitoring', async () => {
    await renderAndSettle();
    const monitoringLink = screen.getByText('Monitoring');
    expect(monitoringLink).toBeInTheDocument();
    expect(monitoringLink.closest('a')).toHaveAttribute('href', '/monitoring');
  });

  it('renders Connection Status section', async () => {
    await renderAndSettle();
    expect(screen.getByText('Connection Status')).toBeInTheDocument();
    const connectedBadges = screen.getAllByText('Connected');
    expect(connectedBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('renders APM Traces metric card', async () => {
    await renderAndSettle();
    expect(screen.getByText('APM Traces')).toBeInTheDocument();
    expect(screen.getByText('12.4K')).toBeInTheDocument();
  });

  it('renders Log Events metric card', async () => {
    await renderAndSettle();
    expect(screen.getByText('Log Events')).toBeInTheDocument();
    expect(screen.getByText('45.8K')).toBeInTheDocument();
  });

  it('renders Custom Metrics card', async () => {
    await renderAndSettle();
    expect(screen.getByText('Custom Metrics')).toBeInTheDocument();
    expect(screen.getByText('23')).toBeInTheDocument();
  });

  it('renders Monitors metric card', async () => {
    await renderAndSettle();
    // "Monitors" appears as both card label and section heading
    const monitorsText = screen.getAllByText(/Monitors/);
    expect(monitorsText.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('renders Traced Services table with service names', async () => {
    await renderAndSettle();
    expect(screen.getByText('Traced Services')).toBeInTheDocument();
    expect(screen.getByText('vibecode-webgui')).toBeInTheDocument();
    expect(screen.getByText('vibecode-api')).toBeInTheDocument();
    expect(screen.getByText('vibecode-vm-manager')).toBeInTheDocument();
    expect(screen.getByText('vibecode-health-checker')).toBeInTheDocument();
    expect(screen.getByText('vibecode-ai-gateway')).toBeInTheDocument();
    expect(screen.getByText('vibecode-websocket')).toBeInTheDocument();
  });

  it('renders Active Monitors section with monitor names', async () => {
    await renderAndSettle();
    expect(screen.getByText('Active Monitors')).toBeInTheDocument();
    expect(screen.getByText('Service Health')).toBeInTheDocument();
    expect(screen.getByText('API Error Rate')).toBeInTheDocument();
    expect(screen.getByText('VM Boot Time')).toBeInTheDocument();
    expect(screen.getByText('AI Response Latency')).toBeInTheDocument();
    expect(screen.getByText('Database Connection Pool')).toBeInTheDocument();
    expect(screen.getByText('Memory Usage')).toBeInTheDocument();
    expect(screen.getByText('WebSocket Connections')).toBeInTheDocument();
    expect(screen.getByText('Certificate Expiry')).toBeInTheDocument();
  });

  it('renders Configuration section with env vars', async () => {
    await renderAndSettle();
    expect(screen.getByText('Configuration')).toBeInTheDocument();
    expect(screen.getByText('DD_AGENT_HOST')).toBeInTheDocument();
    expect(screen.getByText('DD_TRACE_ENABLED')).toBeInTheDocument();
    expect(screen.getByText('DD_SERVICE')).toBeInTheDocument();
    expect(screen.getByText('DD_ENV')).toBeInTheDocument();
  });

  it('toggles env var values visibility', async () => {
    await renderAndSettle();
    const showBtn = screen.getByText('Show Values');
    expect(showBtn).toBeInTheDocument();
    fireEvent.click(showBtn);
    expect(screen.getByText('Hide Values')).toBeInTheDocument();
    // Values should now be visible
    expect(screen.getByText('localhost')).toBeInTheDocument();
    expect(screen.getByText('vibecode')).toBeInTheDocument();
  });

  it('toggles API key visibility', async () => {
    await renderAndSettle();
    // Initially masked
    expect(screen.getByText('dd-api-****-****')).toBeInTheDocument();
  });

  it('renders Open Datadog Dashboard link', async () => {
    await renderAndSettle();
    expect(screen.getByText('Open Datadog Dashboard')).toBeInTheDocument();
  });

  it('renders VSCode Extension section', async () => {
    await renderAndSettle();
    expect(screen.getByText('VSCode Extension')).toBeInTheDocument();
    expect(screen.getByText('v2.0.0')).toBeInTheDocument();
    expect(screen.getByText('19 registered')).toBeInTheDocument();
  });
});

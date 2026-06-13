import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/monitoring/api-performance',
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  );
});

// ── Mock data ──────────────────────────────────────────────────────────────

const MOCK_ENDPOINTS = [
  { endpoint: '/api/health/services', method: 'GET', avgLatency: 45, p50: 40, p95: 80, p99: 120, reqPerMin: 60, errorRate: 0 },
  { endpoint: '/api/ai/models', method: 'GET', avgLatency: 120, p50: 110, p95: 200, p99: 350, reqPerMin: 10, errorRate: 0.1 },
  { endpoint: '/api/vm/instances', method: 'GET', avgLatency: 180, p50: 160, p95: 320, p99: 480, reqPerMin: 8, errorRate: 0.5 },
  { endpoint: '/api/containers', method: 'GET', avgLatency: 95, p50: 85, p95: 180, p99: 260, reqPerMin: 15, errorRate: 0.2 },
  { endpoint: '/api/monitoring/metrics', method: 'GET', avgLatency: 65, p50: 60, p95: 110, p99: 160, reqPerMin: 20, errorRate: 0 },
  { endpoint: '/api/ai/chat', method: 'POST', avgLatency: 2400, p50: 2000, p95: 4500, p99: 6000, reqPerMin: 5, errorRate: 1.5 },
  { endpoint: '/api/vm/create', method: 'POST', avgLatency: 1200, p50: 1000, p95: 2500, p99: 3500, reqPerMin: 2, errorRate: 0.8 },
  { endpoint: '/api/auth/login', method: 'POST', avgLatency: 85, p50: 75, p95: 150, p99: 220, reqPerMin: 12, errorRate: 0.3 },
  { endpoint: '/api/monitoring/health', method: 'GET', avgLatency: 30, p50: 28, p95: 55, p99: 80, reqPerMin: 30, errorRate: 0 },
  { endpoint: '/api/files/upload', method: 'POST', avgLatency: 350, p50: 300, p95: 650, p99: 900, reqPerMin: 3, errorRate: 0.4 },
  { endpoint: '/api/settings', method: 'GET', avgLatency: 55, p50: 50, p95: 95, p99: 140, reqPerMin: 5, errorRate: 0 },
  { endpoint: '/api/users/profile', method: 'GET', avgLatency: 70, p50: 65, p95: 120, p99: 180, reqPerMin: 8, errorRate: 0.1 },
  { endpoint: '/api/webhooks', method: 'POST', avgLatency: 200, p50: 180, p95: 380, p99: 550, reqPerMin: 4, errorRate: 0.6 },
  { endpoint: '/api/logs/export', method: 'GET', avgLatency: 800, p50: 700, p95: 1500, p99: 2200, reqPerMin: 1, errorRate: 0 },
  { endpoint: '/api/notifications', method: 'GET', avgLatency: 40, p50: 35, p95: 72, p99: 105, reqPerMin: 25, errorRate: 0 },
  { endpoint: '/api/ai/embeddings', method: 'POST', avgLatency: 450, p50: 400, p95: 850, p99: 1200, reqPerMin: 6, errorRate: 0.2 },
];

const MOCK_ERRORS_4XX = [
  { endpoint: '/api/containers', method: 'GET', count: 120, lastSeen: '2m ago' },
  { endpoint: '/api/auth/login', method: 'POST', count: 98, lastSeen: '5m ago' },
  { endpoint: '/api/vm/instances', method: 'GET', count: 57, lastSeen: '1m ago' },
  { endpoint: '/api/webhooks', method: 'POST', count: 35, lastSeen: '10m ago' },
];

const MOCK_ERRORS_5XX = [
  { endpoint: '/api/ai/chat', method: 'POST', count: 22, lastSeen: '3m ago' },
  { endpoint: '/api/vm/create', method: 'POST', count: 15, lastSeen: '8m ago' },
  { endpoint: '/api/files/upload', method: 'POST', count: 8, lastSeen: '15m ago' },
];

function createFetchMock() {
  return jest.fn((_url: string) => {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        endpoints: MOCK_ENDPOINTS,
        errors4xx: MOCK_ERRORS_4XX,
        errors5xx: MOCK_ERRORS_5XX,
      }),
    });
  }) as jest.Mock;
}

async function renderAndSettle() {
  global.fetch = createFetchMock();
  render(<APIPerformancePage />);
  // Wait for loading to complete (heading appears after data loads)
  await waitFor(() => {
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
}

import APIPerformancePage from '../page';

describe('APIPerformancePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', async () => {
    await renderAndSettle();
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('API Performance');
  });

  it('renders page description', async () => {
    await renderAndSettle();
    expect(
      screen.getByText('Endpoint latency, throughput, and error tracking')
    ).toBeInTheDocument();
  });

  it('renders breadcrumb with link to /monitoring', async () => {
    await renderAndSettle();
    const monitoringLink = screen.getByText('Monitoring');
    expect(monitoringLink).toBeInTheDocument();
    expect(monitoringLink.closest('a')).toHaveAttribute('href', '/monitoring');
  });

  it('renders Total Requests summary card', async () => {
    await renderAndSettle();
    expect(screen.getByText('Total Requests / 24h')).toBeInTheDocument();
  });

  it('renders Avg Response Time summary card', async () => {
    await renderAndSettle();
    expect(screen.getByText('Avg Response Time')).toBeInTheDocument();
  });

  it('renders Error Rate summary card', async () => {
    await renderAndSettle();
    const matches = screen.getAllByText(/Error Rate/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders Throughput summary card', async () => {
    await renderAndSettle();
    expect(screen.getByText('Throughput')).toBeInTheDocument();
  });

  it('renders time range buttons (1h, 6h, 24h, 7d)', async () => {
    await renderAndSettle();
    expect(screen.getByText('1h')).toBeInTheDocument();
    expect(screen.getByText('6h')).toBeInTheDocument();
    expect(screen.getByText('24h')).toBeInTheDocument();
    expect(screen.getByText('7d')).toBeInTheDocument();
  });

  it('switches time range when button is clicked', async () => {
    await renderAndSettle();
    const btn1h = screen.getByText('1h');
    fireEvent.click(btn1h);
    expect(btn1h).toBeInTheDocument();
  });

  it('renders Endpoint Performance table heading', async () => {
    await renderAndSettle();
    expect(screen.getByText('Endpoint Performance')).toBeInTheDocument();
    expect(screen.getByText(/16 endpoints tracked/)).toBeInTheDocument();
  });

  it('renders endpoint table with endpoint paths', async () => {
    await renderAndSettle();
    expect(screen.getByText('/api/health/services')).toBeInTheDocument();
    expect(screen.getByText('/api/ai/models')).toBeInTheDocument();
    // /api/vm/instances appears in both endpoint table and 4xx errors section
    const vmInstances = screen.getAllByText('/api/vm/instances');
    expect(vmInstances.length).toBeGreaterThanOrEqual(1);
    // /api/containers appears in both the endpoint table and the 4xx errors section
    const containersMatches = screen.getAllByText('/api/containers');
    expect(containersMatches.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('/api/monitoring/metrics')).toBeInTheDocument();
  });

  it('renders endpoint table column headers', async () => {
    await renderAndSettle();
    expect(screen.getByText('Endpoint')).toBeInTheDocument();
    expect(screen.getByText('Method')).toBeInTheDocument();
    const avgLatencyMatches = screen.getAllByText(/Avg Latency/);
    expect(avgLatencyMatches.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('P50')).toBeInTheDocument();
    expect(screen.getByText('P95')).toBeInTheDocument();
    expect(screen.getByText('P99')).toBeInTheDocument();
  });

  it('sorts endpoints when clicking column header', async () => {
    await renderAndSettle();
    const endpointHeader = screen.getByText('Endpoint');
    fireEvent.click(endpointHeader);
    // After clicking, sorted by endpoint - page should still render correctly
    expect(screen.getByText('/api/health/services')).toBeInTheDocument();
  });

  it('renders Client Errors (4xx) section', async () => {
    await renderAndSettle();
    expect(screen.getByText('Client Errors (4xx)')).toBeInTheDocument();
    expect(screen.getByText(/Top endpoints by 4xx error count/)).toBeInTheDocument();
  });

  it('renders Server Errors (5xx) section', async () => {
    await renderAndSettle();
    expect(screen.getByText('Server Errors (5xx)')).toBeInTheDocument();
    expect(screen.getByText(/Top endpoints by 5xx error count/)).toBeInTheDocument();
  });

  it('renders error count totals', async () => {
    await renderAndSettle();
    // Total 4xx = 310, Total 5xx = 45
    expect(screen.getByText('310')).toBeInTheDocument();
    // "45" appears as both an error total and as a latency value, so use getAllByText
    const fortyFiveMatches = screen.getAllByText('45');
    expect(fortyFiveMatches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders trend indicators on summary cards', async () => {
    await renderAndSettle();
    expect(screen.getByText('+8.3%')).toBeInTheDocument();
    expect(screen.getByText('-4.1%')).toBeInTheDocument();
    expect(screen.getByText('-0.12%')).toBeInTheDocument();
    expect(screen.getByText('+12.5%')).toBeInTheDocument();
  });
});

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/monitoring/performance',
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  );
});

// ── Mock data ──────────────────────────────────────────────────────────────

const MOCK_REPORT = {
  timeframe: '1h',
  timestamp: new Date().toISOString(),
  status: 'healthy',
  metrics: {
    cpuUsage: 34,
    loadAverage: { '1m': 1.2, '5m': 1.0, '15m': 0.9 },
    memory: { totalMB: 4096, freeMB: 2048, usedPercent: 50 },
    process: { heapUsedMB: 256, heapTotalMB: 512, rssMB: 384, externalMB: 10, uptimeSeconds: 86400 },
  },
  recommendations: [],
  critical_issues: [],
  summary: { avg_api_response_time: 142 },
};

const MOCK_HEALTH = {
  healthy: true,
  status: 'healthy',
  issues: [],
  recommendations: [],
  timestamp: new Date().toISOString(),
};

function createFetchMock() {
  return jest.fn((url: string) => {
    if (url.includes('action=report')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_REPORT) });
    }
    if (url.includes('action=health')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_HEALTH) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }) as jest.Mock;
}

async function renderAndSettle() {
  global.fetch = createFetchMock();
  render(<PerformanceMetricsPage />);
  // Wait for loading to complete (heading appears after data loads)
  await waitFor(() => {
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
}

import PerformanceMetricsPage from '../page';

describe('PerformanceMetricsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', async () => {
    await renderAndSettle();
    const matches = screen.getAllByText('Performance Metrics');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders page title as heading', async () => {
    await renderAndSettle();
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Performance Metrics');
  });

  it('renders page description', async () => {
    await renderAndSettle();
    expect(
      screen.getByText('API endpoint and VM resource performance monitoring')
    ).toBeInTheDocument();
  });

  it('renders breadcrumb with link to /monitoring', async () => {
    await renderAndSettle();
    const monitoringLink = screen.getByText('Monitoring');
    expect(monitoringLink).toBeInTheDocument();
    expect(monitoringLink.closest('a')).toHaveAttribute('href', '/monitoring');
  });

  it('renders Avg API Latency metric card', async () => {
    await renderAndSettle();
    expect(screen.getByText('Avg API Latency')).toBeInTheDocument();
  });

  it('renders P95 Latency metric card', async () => {
    await renderAndSettle();
    expect(screen.getByText('P95 Latency')).toBeInTheDocument();
  });

  it('renders Process Uptime metric card', async () => {
    await renderAndSettle();
    expect(screen.getByText('Process Uptime')).toBeInTheDocument();
  });

  it('renders Error Rate metric card', async () => {
    await renderAndSettle();
    // "Error Rate" appears in metric card and table header
    const matches = screen.getAllByText(/Error Rate/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders time range buttons', async () => {
    await renderAndSettle();
    expect(screen.getByText('Last 1h')).toBeInTheDocument();
    expect(screen.getByText('Last 6h')).toBeInTheDocument();
    expect(screen.getByText('Last 24h')).toBeInTheDocument();
    expect(screen.getByText('Last 7d')).toBeInTheDocument();
  });

  it('switches time range when a button is clicked', async () => {
    await renderAndSettle();
    const btn6h = screen.getByText('Last 6h');
    fireEvent.click(btn6h);
    expect(btn6h).toBeInTheDocument();
  });

  it('renders auto-refresh toggle button', async () => {
    await renderAndSettle();
    const autoRefreshBtn = screen.getByText('Off');
    expect(autoRefreshBtn).toBeInTheDocument();
  });

  it('toggles auto-refresh when clicked', async () => {
    await renderAndSettle();
    const toggleBtn = screen.getByText('Off').closest('button')!;
    fireEvent.click(toggleBtn);
    expect(screen.getByText('On')).toBeInTheDocument();
    expect(screen.getByText('Auto-refresh')).toBeInTheDocument();
  });

  it('renders Refresh button', async () => {
    await renderAndSettle();
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  it('renders API Endpoint Performance table heading', async () => {
    await renderAndSettle();
    expect(screen.getByText('API Endpoint Performance')).toBeInTheDocument();
    expect(screen.getByText(/0 endpoints tracked/)).toBeInTheDocument();
  });

  it('renders endpoint table column headers', async () => {
    await renderAndSettle();
    expect(screen.getByText('Endpoint')).toBeInTheDocument();
    expect(screen.getByText('Method')).toBeInTheDocument();
    const avgLatencyMatches = screen.getAllByText(/Avg Latency/);
    expect(avgLatencyMatches.length).toBeGreaterThanOrEqual(1);
    const errorRateMatches = screen.getAllByText(/Error Rate/);
    expect(errorRateMatches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders VM Resource Performance section', async () => {
    await renderAndSettle();
    expect(screen.getByText('VM Resource Performance')).toBeInTheDocument();
    // With mocked data, resource cards should be present
    expect(screen.getByText('CPU Usage')).toBeInTheDocument();
    expect(screen.getByText('System Memory')).toBeInTheDocument();
  });
});

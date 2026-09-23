import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/monitoring/logs',
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  );
});

// ── Mock data ──────────────────────────────────────────────────────────────

function makeLog(id: number, level: string, source: string, message: string) {
  return {
    id: `log-${id.toString().padStart(3, '0')}`,
    timestamp: new Date(Date.now() - id * 60000).toISOString(),
    level,
    source,
    message,
  };
}

const MOCK_LOGS = [
  makeLog(1, 'error', 'API', 'Request to /api/ai/chat failed: ECONNREFUSED'),
  makeLog(2, 'info', 'VM', 'Instance vm-001 boot completed in 24.3s'),
  makeLog(3, 'warn', 'API', 'Rate limit approaching for /api/vm/instances'),
  makeLog(4, 'info', 'Health', 'Health check passed for all services'),
  makeLog(5, 'debug', 'Auth', 'Token refresh successful for user admin@example.com'),
  makeLog(6, 'error', 'AI', 'AI model response timeout after 30s'),
  makeLog(7, 'info', 'WebSocket', 'WebSocket connection established from 192.168.1.1'),
  makeLog(8, 'warn', 'VM', 'VM memory usage at 85% capacity'),
  makeLog(9, 'info', 'Scheduler', 'Scheduled job cleanup-expired-tokens completed'),
  makeLog(10, 'debug', 'API', 'Cache hit for /api/monitoring/metrics'),
  makeLog(11, 'error', 'API', 'Database connection pool exhausted'),
  makeLog(12, 'info', 'VM', 'VM instance vm-002 started successfully'),
  makeLog(13, 'warn', 'AI', 'AI response latency exceeds 5000ms threshold'),
  makeLog(14, 'info', 'Health', 'Database health check: 45ms response time'),
  makeLog(15, 'debug', 'WebSocket', 'Ping/pong exchange completed'),
  makeLog(16, 'error', 'Auth', 'Failed login attempt from 10.0.0.1'),
  makeLog(17, 'info', 'API', 'API server started on port 3000'),
  makeLog(18, 'warn', 'VM', 'VM disk usage at 78%'),
  makeLog(19, 'info', 'Scheduler', 'Daily cleanup job started'),
  makeLog(20, 'debug', 'API', 'Request processed in 234ms'),
  makeLog(21, 'error', 'API', 'Webhook delivery failed: connection refused'),
  makeLog(22, 'info', 'VM', 'VM instance terminated on schedule'),
  makeLog(23, 'warn', 'AI', 'Token limit approaching for current session'),
  makeLog(24, 'info', 'Health', 'Redis health check: connected'),
  makeLog(25, 'debug', 'Auth', 'OAuth flow initiated'),
  makeLog(26, 'error', 'WebSocket', 'WebSocket connection dropped unexpectedly'),
  makeLog(27, 'info', 'API', 'New deployment pushed successfully'),
  makeLog(28, 'warn', 'VM', 'VM boot time exceeded 30s threshold'),
  makeLog(29, 'info', 'Scheduler', 'Metrics aggregation completed'),
  makeLog(30, 'debug', 'AI', 'Model selection: gpt-4o-mini'),
  makeLog(31, 'error', 'API', 'SSL certificate validation failed'),
  makeLog(32, 'info', 'VM', 'VM snapshot created'),
  makeLog(33, 'warn', 'Auth', 'Session expiry warning for admin user'),
  makeLog(34, 'info', 'Health', 'All systems nominal'),
  makeLog(35, 'debug', 'API', 'Request routing completed'),
];

function createFetchMock() {
  return jest.fn((_url: string) => {
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ logs: MOCK_LOGS }) });
  }) as jest.Mock;
}

async function renderAndSettle() {
  global.fetch = createFetchMock();
  render(<MonitoringLogsPage />);
  // Wait for the log entries to appear (loading spinner disappears)
  await waitFor(() => {
    expect(screen.getByText('Request to /api/ai/chat failed: ECONNREFUSED')).toBeInTheDocument();
  });
}

import MonitoringLogsPage from '../page';

describe('MonitoringLogsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', async () => {
    await renderAndSettle();
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Application Logs');
  });

  it('renders page description', async () => {
    await renderAndSettle();
    expect(
      screen.getByText('Centralized log viewer for all application services')
    ).toBeInTheDocument();
  });

  it('renders breadcrumb with link to /monitoring', async () => {
    await renderAndSettle();
    const monitoringLink = screen.getByText('Monitoring');
    expect(monitoringLink).toBeInTheDocument();
    expect(monitoringLink.closest('a')).toHaveAttribute('href', '/monitoring');
  });

  it('renders log level filter tabs (All, Error, Warning, Info, Debug)', async () => {
    await renderAndSettle();
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.getByText('Info')).toBeInTheDocument();
    expect(screen.getByText('Debug')).toBeInTheDocument();
  });

  it('renders source filter dropdown', async () => {
    await renderAndSettle();
    expect(screen.getByText('All Sources')).toBeInTheDocument();
  });

  it('renders search input', async () => {
    await renderAndSettle();
    expect(screen.getByPlaceholderText('Search log messages...')).toBeInTheDocument();
  });

  it('renders log entries from mock data', async () => {
    await renderAndSettle();
    expect(
      screen.getByText('Request to /api/ai/chat failed: ECONNREFUSED')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Instance vm-001 boot completed in 24.3s')
    ).toBeInTheDocument();
  });

  it('renders Load More button when there are more entries', async () => {
    await renderAndSettle();
    // 35 total entries, page size 15, so Load More should be present
    const loadMoreBtn = screen.getByText(/Load More/);
    expect(loadMoreBtn).toBeInTheDocument();
    expect(screen.getByText(/20 remaining/)).toBeInTheDocument();
  });

  it('loads more entries when Load More is clicked', async () => {
    await renderAndSettle();
    const loadMoreBtn = screen.getByText(/Load More/).closest('button')!;
    fireEvent.click(loadMoreBtn);
    // After loading more, should show 30 of 35 entries
    expect(screen.getByText(/Showing 30 of 35/)).toBeInTheDocument();
  });

  it('renders Export button', async () => {
    await renderAndSettle();
    expect(screen.getByText('Export')).toBeInTheDocument();
  });

  it('filters logs when a level tab is clicked', async () => {
    await renderAndSettle();
    fireEvent.click(screen.getByText('Error'));
    // Should show only error entries and results count should update
    expect(screen.getByText(/Showing/)).toBeInTheDocument();
    expect(
      screen.getByText('Request to /api/ai/chat failed: ECONNREFUSED')
    ).toBeInTheDocument();
  });

  it('filters logs by search query', async () => {
    await renderAndSettle();
    const searchInput = screen.getByPlaceholderText('Search log messages...');
    fireEvent.change(searchInput, { target: { value: 'vm-001' } });
    expect(
      screen.getByText('Instance vm-001 boot completed in 24.3s')
    ).toBeInTheDocument();
  });

  it('shows results count and clear filters link', async () => {
    await renderAndSettle();
    expect(screen.getByText(/Showing 15 of 35/)).toBeInTheDocument();
    // After applying a filter, clear filters link should appear
    fireEvent.click(screen.getByText('Error'));
    expect(screen.getByText('Clear filters')).toBeInTheDocument();
  });

  it('renders auto-refresh toggle button', async () => {
    await renderAndSettle();
    const offBtn = screen.getByText('Off');
    expect(offBtn).toBeInTheDocument();
    fireEvent.click(offBtn.closest('button')!);
    expect(screen.getByText('On')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
  });
});

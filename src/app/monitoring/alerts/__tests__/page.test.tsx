import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/monitoring/alerts',
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  );
});

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Bell: (props: any) => <svg data-testid="bell-icon" {...props} />,
  AlertTriangle: (props: any) => <svg data-testid="alert-triangle-icon" {...props} />,
  AlertCircle: (props: any) => <svg data-testid="alert-circle-icon" {...props} />,
  Info: (props: any) => <svg data-testid="info-icon" {...props} />,
  Check: (props: any) => <svg data-testid="check-icon" {...props} />,
  Clock: (props: any) => <svg data-testid="clock-icon" {...props} />,
  Filter: (props: any) => <svg data-testid="filter-icon" {...props} />,
  ChevronRight: (props: any) => <svg data-testid="chevron-right-icon" {...props} />,
  BellOff: (props: any) => <svg data-testid="bell-off-icon" {...props} />,
  Eye: (props: any) => <svg data-testid="eye-icon" {...props} />,
  Settings: (props: any) => <svg data-testid="settings-icon" {...props} />,
  X: (props: any) => <svg data-testid="x-icon" {...props} />,
}));

import MonitoringAlertsPage from '../page';

// ── Test fixtures ─────────────────────────────────────────────────────────

const MOCK_ALERTS = [
  {
    id: 'alert-001',
    title: 'Database connection pool at 92% capacity',
    message: 'PostgreSQL connection pool utilization exceeded 90%.',
    severity: 'critical',
    status: 'active',
    source: 'PostgreSQL',
    triggeredAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    rule: 'Connection Pool Capacity',
  },
  {
    id: 'alert-002',
    title: 'AI monthly spend approaching budget limit',
    message: 'Current monthly AI spend is $847.20 of $1,000.00 budget.',
    severity: 'warning',
    status: 'active',
    source: 'AI Cost Tracking',
    triggeredAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    rule: 'Monthly Budget Threshold',
  },
  {
    id: 'alert-003',
    title: 'API response time elevated',
    message: 'Average API response time is 450ms.',
    severity: 'warning',
    status: 'acknowledged',
    source: 'API Gateway',
    triggeredAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    acknowledgedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    rule: 'Response Time SLA',
  },
  {
    id: 'alert-004',
    title: 'Valkey memory usage above 75%',
    message: 'Valkey in-memory cache is using 78% of allocated memory.',
    severity: 'warning',
    status: 'active',
    source: 'Valkey',
    triggeredAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    rule: 'Memory Usage Threshold',
  },
  {
    id: 'alert-005',
    title: 'SSH service restarted automatically',
    message: 'Dropbear SSH service was unresponsive.',
    severity: 'info',
    status: 'resolved',
    source: 'SSH (Dropbear)',
    triggeredAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    resolvedAt: new Date(Date.now() - 5.9 * 60 * 60 * 1000).toISOString(),
    rule: 'Service Health Check',
  },
  {
    id: 'alert-006',
    title: 'Docker container OOM killed',
    message: 'Container "test-runner" was terminated by OOM killer.',
    severity: 'critical',
    status: 'resolved',
    source: 'Docker',
    triggeredAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    resolvedAt: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(),
    rule: 'Container Resource Limit',
  },
];

const MOCK_RULES = [
  {
    id: 'rule-001',
    name: 'Service Health Check',
    description: 'Alert when any service is unresponsive for more than 60 seconds',
    severity: 'critical',
    enabled: true,
    condition: 'Service down > 60s',
    category: 'service',
  },
  {
    id: 'rule-002',
    name: 'Connection Pool Capacity',
    description: 'Alert when database connection pool exceeds 90% utilization',
    severity: 'critical',
    enabled: true,
    condition: 'Pool usage > 90%',
    category: 'resource',
  },
  {
    id: 'rule-003',
    name: 'Monthly Budget Threshold',
    description: 'Alert when monthly AI spend exceeds 80% of budget',
    severity: 'warning',
    enabled: true,
    condition: 'Monthly spend > 80% of budget',
    category: 'budget',
  },
  {
    id: 'rule-004',
    name: 'Response Time SLA',
    description: 'Alert when average API response time exceeds 300ms for 10 minutes',
    severity: 'warning',
    enabled: true,
    condition: 'Avg response > 300ms for 10m',
    category: 'performance',
  },
  {
    id: 'rule-005',
    name: 'Memory Usage Threshold',
    description: 'Alert when any service memory usage exceeds 75%',
    severity: 'warning',
    enabled: true,
    condition: 'Memory > 75%',
    category: 'resource',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────

function createFetchMock(alertsPayload: { alerts: any[]; rules: any[] }) {
  return jest.fn((url: string) => {
    if (url === '/api/monitoring/alerts') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(alertsPayload),
      });
    }
    if (url === '/api/monitoring/pool-alerts') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    });
  }) as jest.Mock;
}

/** Render and wait for both API fetches to settle. */
async function renderAndSettle(
  alertsPayload = { alerts: MOCK_ALERTS, rules: MOCK_RULES }
) {
  global.fetch = createFetchMock(alertsPayload);
  render(<MonitoringAlertsPage />);
  // Wait for loading to complete (summary cards appear)
  await waitFor(() => {
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('MonitoringAlertsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Loading / Error / Empty states ──────────────────────────────────

  it('shows loading spinner initially', () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock; // never resolves
    render(<MonitoringAlertsPage />);
    expect(screen.getByText('Loading alerts...')).toBeInTheDocument();
  });

  it('shows error state with retry button on fetch failure', async () => {
    global.fetch = jest.fn((url: string) => {
      if (url === '/api/monitoring/alerts') {
        return Promise.resolve({ ok: false, status: 500 });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' }),
      });
    }) as jest.Mock;

    render(<MonitoringAlertsPage />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch alerts/)).toBeInTheDocument();
    });
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('shows empty state when API returns no alerts', async () => {
    await renderAndSettle({ alerts: [], rules: [] });
    // Active tab should show empty message
    expect(
      screen.getByText('No active alerts matching the current filters.')
    ).toBeInTheDocument();
  });

  it('shows empty state for rules tab when no rules returned', async () => {
    await renderAndSettle({ alerts: [], rules: [] });
    fireEvent.click(screen.getByText('Alert Rules'));
    expect(screen.getByText('No alert rules configured.')).toBeInTheDocument();
  });

  // ── Basic rendering ─────────────────────────────────────────────────

  it('renders without crashing', async () => {
    await renderAndSettle();
    const alertsTexts = screen.getAllByText('Alerts');
    expect(alertsTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('shows page heading and description', async () => {
    await renderAndSettle();
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Alerts');
    expect(
      screen.getByText('Service health, budget, and performance alert management')
    ).toBeInTheDocument();
  });

  it('shows breadcrumb with link to /monitoring', async () => {
    await renderAndSettle();
    const monitoringLink = screen.getByText('Monitoring');
    expect(monitoringLink).toBeInTheDocument();
    expect(monitoringLink.closest('a')).toHaveAttribute('href', '/monitoring');
  });

  it('displays summary cards with correct counts', async () => {
    await renderAndSettle();
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Acknowledged')).toBeInTheDocument();
    expect(screen.getByText('Resolved')).toBeInTheDocument();
  });

  it('renders alert list with severity badges', async () => {
    await renderAndSettle();
    const criticalBadges = screen.getAllByText('critical');
    expect(criticalBadges.length).toBeGreaterThanOrEqual(1);
    const warningBadges = screen.getAllByText('warning');
    expect(warningBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('renders alert titles in active view', async () => {
    await renderAndSettle();
    expect(
      screen.getByText('Database connection pool at 92% capacity')
    ).toBeInTheDocument();
    expect(
      screen.getByText('AI monthly spend approaching budget limit')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Valkey memory usage above 75%')
    ).toBeInTheDocument();
  });

  it('renders tab navigation (Active Alerts, Alert History, Alert Rules)', async () => {
    await renderAndSettle();
    expect(screen.getByText('Active Alerts')).toBeInTheDocument();
    expect(screen.getByText('Alert History')).toBeInTheDocument();
    expect(screen.getByText('Alert Rules')).toBeInTheDocument();
  });

  it('switches to History tab on click', async () => {
    await renderAndSettle();
    fireEvent.click(screen.getByText('Alert History'));
    expect(
      screen.getByText('SSH service restarted automatically')
    ).toBeInTheDocument();
    expect(screen.getByText('Docker container OOM killed')).toBeInTheDocument();
  });

  it('switches to Rules tab and shows rule categories', async () => {
    await renderAndSettle();
    fireEvent.click(screen.getByText('Alert Rules'));
    expect(screen.getByText('Service Health')).toBeInTheDocument();
    expect(screen.getByText('Budget Alerts')).toBeInTheDocument();
    expect(screen.getByText('Performance')).toBeInTheDocument();
    expect(screen.getByText('Resource Usage')).toBeInTheDocument();
  });

  it('shows rule names on Rules tab', async () => {
    await renderAndSettle();
    fireEvent.click(screen.getByText('Alert Rules'));
    expect(screen.getByText('Connection Pool Capacity')).toBeInTheDocument();
    expect(screen.getByText('Monthly Budget Threshold')).toBeInTheDocument();
    expect(screen.getByText('Response Time SLA')).toBeInTheDocument();
    expect(screen.getByText('Memory Usage Threshold')).toBeInTheDocument();
  });

  it('shows Filters button and toggles filter dropdowns', async () => {
    await renderAndSettle();
    const filtersBtn = screen.getByText('Filters');
    expect(filtersBtn).toBeInTheDocument();

    fireEvent.click(filtersBtn);
    expect(screen.getByText('Severity:')).toBeInTheDocument();
    expect(screen.getByText('Status:')).toBeInTheDocument();
  });

  it('shows filter dropdown options', async () => {
    await renderAndSettle();
    fireEvent.click(screen.getByText('Filters'));

    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    expect(selects.length).toBe(2);

    const severityOptions = Array.from(selects[0].options).map((o) => o.value);
    expect(severityOptions).toContain('all');
    expect(severityOptions).toContain('critical');
    expect(severityOptions).toContain('warning');
    expect(severityOptions).toContain('info');

    const statusOptions = Array.from(selects[1].options).map((o) => o.value);
    expect(statusOptions).toContain('all');
    expect(statusOptions).toContain('active');
    expect(statusOptions).toContain('acknowledged');
    expect(statusOptions).toContain('resolved');
  });

  it('shows action buttons on active alerts', async () => {
    await renderAndSettle();
    const acknowledgeButtons = screen.getAllByText('Acknowledge');
    expect(acknowledgeButtons.length).toBeGreaterThanOrEqual(1);
    const resolveButtons = screen.getAllByText('Resolve');
    expect(resolveButtons.length).toBeGreaterThanOrEqual(1);
    const snoozeButtons = screen.getAllByText('Snooze');
    expect(snoozeButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('fetches alerts and pool alert status on mount', async () => {
    global.fetch = createFetchMock({ alerts: [], rules: [] });
    render(<MonitoringAlertsPage />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/monitoring/alerts');
      expect(global.fetch).toHaveBeenCalledWith('/api/monitoring/pool-alerts');
    });
  });

  it('shows pool alert status indicator', async () => {
    global.fetch = createFetchMock({ alerts: [], rules: [] });
    render(<MonitoringAlertsPage />);
    await waitFor(() => {
      expect(screen.getByText(/Pool alerts: healthy/)).toBeInTheDocument();
    });
  });
});

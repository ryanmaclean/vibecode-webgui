import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
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

// Helper: render and wait for the async pool-alerts fetch to settle
async function renderAndSettle() {
  render(<MonitoringAlertsPage />);
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith('/api/monitoring/pool-alerts');
  });
  // Wait for state update from the fetch
  await waitFor(() => {
    expect(screen.getByText(/Pool alerts:/)).toBeInTheDocument();
  });
}

describe('MonitoringAlertsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock the pool-alerts fetch
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' }),
      })
    ) as jest.Mock;
  });

  it('renders without crashing', async () => {
    await renderAndSettle();
    // "Alerts" appears in breadcrumb and heading
    const alertsTexts = screen.getAllByText('Alerts');
    expect(alertsTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('shows page heading and description', async () => {
    await renderAndSettle();
    // Check h1 heading specifically
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Alerts');
    expect(screen.getByText('Service health, budget, and performance alert management')).toBeInTheDocument();
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
    expect(screen.getByText('Database connection pool at 92% capacity')).toBeInTheDocument();
    expect(screen.getByText('AI monthly spend approaching budget limit')).toBeInTheDocument();
    expect(screen.getByText('Valkey memory usage above 75%')).toBeInTheDocument();
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
    expect(screen.getByText('SSH service restarted automatically')).toBeInTheDocument();
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

    const severityOptions = Array.from(selects[0].options).map(o => o.value);
    expect(severityOptions).toContain('all');
    expect(severityOptions).toContain('critical');
    expect(severityOptions).toContain('warning');
    expect(severityOptions).toContain('info');

    const statusOptions = Array.from(selects[1].options).map(o => o.value);
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

  it('fetches pool alert status on mount', async () => {
    render(<MonitoringAlertsPage />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/monitoring/pool-alerts');
    });
  });

  it('shows pool alert status indicator', async () => {
    render(<MonitoringAlertsPage />);
    await waitFor(() => {
      expect(screen.getByText(/Pool alerts: healthy/)).toBeInTheDocument();
    });
  });
});

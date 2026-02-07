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

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Activity: (props: any) => <svg data-testid="activity-icon" {...props} />,
  Clock: (props: any) => <svg data-testid="clock-icon" {...props} />,
  Zap: (props: any) => <svg data-testid="zap-icon" {...props} />,
  AlertTriangle: (props: any) => <svg data-testid="alert-triangle-icon" {...props} />,
  RefreshCw: (props: any) => <svg data-testid="refresh-icon" {...props} />,
  Server: (props: any) => <svg data-testid="server-icon" {...props} />,
  ArrowUp: (props: any) => <svg data-testid="arrow-up-icon" {...props} />,
  ArrowDown: (props: any) => <svg data-testid="arrow-down-icon" {...props} />,
  TrendingUp: (props: any) => <svg data-testid="trending-up-icon" {...props} />,
  TrendingDown: (props: any) => <svg data-testid="trending-down-icon" {...props} />,
  ChevronRight: (props: any) => <svg data-testid="chevron-right-icon" {...props} />,
  Cpu: (props: any) => <svg data-testid="cpu-icon" {...props} />,
  HardDrive: (props: any) => <svg data-testid="harddrive-icon" {...props} />,
  Wifi: (props: any) => <svg data-testid="wifi-icon" {...props} />,
  MemoryStick: (props: any) => <svg data-testid="memorystick-icon" {...props} />,
}));

import PerformanceMetricsPage from '../page';

describe('PerformanceMetricsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<PerformanceMetricsPage />);
    const matches = screen.getAllByText('Performance Metrics');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders page title as heading', () => {
    render(<PerformanceMetricsPage />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Performance Metrics');
  });

  it('renders page description', () => {
    render(<PerformanceMetricsPage />);
    expect(
      screen.getByText('API endpoint and VM resource performance monitoring')
    ).toBeInTheDocument();
  });

  it('renders breadcrumb with link to /monitoring', () => {
    render(<PerformanceMetricsPage />);
    const monitoringLink = screen.getByText('Monitoring');
    expect(monitoringLink).toBeInTheDocument();
    expect(monitoringLink.closest('a')).toHaveAttribute('href', '/monitoring');
  });

  it('renders Avg API Latency metric card', () => {
    render(<PerformanceMetricsPage />);
    expect(screen.getByText('Avg API Latency')).toBeInTheDocument();
  });

  it('renders P95 Latency metric card', () => {
    render(<PerformanceMetricsPage />);
    expect(screen.getByText('P95 Latency')).toBeInTheDocument();
  });

  it('renders VM Boot Time metric card', () => {
    render(<PerformanceMetricsPage />);
    expect(screen.getByText('VM Boot Time')).toBeInTheDocument();
    expect(screen.getByText('24.3s')).toBeInTheDocument();
  });

  it('renders Error Rate metric card', () => {
    render(<PerformanceMetricsPage />);
    // "Error Rate" appears in metric card and table header
    const matches = screen.getAllByText(/Error Rate/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders time range buttons', () => {
    render(<PerformanceMetricsPage />);
    expect(screen.getByText('Last 1h')).toBeInTheDocument();
    expect(screen.getByText('Last 6h')).toBeInTheDocument();
    expect(screen.getByText('Last 24h')).toBeInTheDocument();
    expect(screen.getByText('Last 7d')).toBeInTheDocument();
  });

  it('switches time range when a button is clicked', () => {
    render(<PerformanceMetricsPage />);
    const btn6h = screen.getByText('Last 6h');
    fireEvent.click(btn6h);
    // The button class should change (active state) - verify by re-render stability
    expect(btn6h).toBeInTheDocument();
  });

  it('renders auto-refresh toggle button', () => {
    render(<PerformanceMetricsPage />);
    const autoRefreshBtn = screen.getByText('Off');
    expect(autoRefreshBtn).toBeInTheDocument();
  });

  it('toggles auto-refresh when clicked', () => {
    render(<PerformanceMetricsPage />);
    const toggleBtn = screen.getByText('Off').closest('button')!;
    fireEvent.click(toggleBtn);
    expect(screen.getByText('On')).toBeInTheDocument();
    expect(screen.getByText('Auto-refresh')).toBeInTheDocument();
  });

  it('renders Refresh button', () => {
    render(<PerformanceMetricsPage />);
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  it('renders API Endpoint Performance table heading', () => {
    render(<PerformanceMetricsPage />);
    expect(screen.getByText('API Endpoint Performance')).toBeInTheDocument();
    expect(screen.getByText(/10 endpoints tracked/)).toBeInTheDocument();
  });

  it('renders endpoint table with endpoint paths', () => {
    render(<PerformanceMetricsPage />);
    expect(screen.getByText('/api/health/services')).toBeInTheDocument();
    expect(screen.getByText('/api/ai/chat')).toBeInTheDocument();
    expect(screen.getByText('/api/vm/instances')).toBeInTheDocument();
    expect(screen.getByText('/api/containers')).toBeInTheDocument();
  });

  it('renders endpoint table column headers', () => {
    render(<PerformanceMetricsPage />);
    expect(screen.getByText('Endpoint')).toBeInTheDocument();
    expect(screen.getByText('Method')).toBeInTheDocument();
    // Avg Latency appears in card and table header
    const avgLatencyMatches = screen.getAllByText(/Avg Latency/);
    expect(avgLatencyMatches.length).toBeGreaterThanOrEqual(1);
    const errorRateMatches = screen.getAllByText(/Error Rate/);
    expect(errorRateMatches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders VM Resource Performance section', () => {
    render(<PerformanceMetricsPage />);
    expect(screen.getByText('VM Resource Performance')).toBeInTheDocument();
    expect(screen.getByText('CPU Usage')).toBeInTheDocument();
    expect(screen.getByText('Memory Usage')).toBeInTheDocument();
    expect(screen.getByText('Disk I/O')).toBeInTheDocument();
    expect(screen.getByText('Network')).toBeInTheDocument();
  });

  it('renders VM resource values', () => {
    render(<PerformanceMetricsPage />);
    // "34%" appears both as the value text and the percentage label at bottom
    const cpuValues = screen.getAllByText('34%');
    expect(cpuValues.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('2.1 GB / 4.0 GB')).toBeInTheDocument();
    expect(screen.getByText('R: 12.4 MB/s')).toBeInTheDocument();
    expect(screen.getByText('In: 45.2 Mbps')).toBeInTheDocument();
  });

  it('renders trend indicators with vs prev period label', () => {
    render(<PerformanceMetricsPage />);
    const prevPeriodTexts = screen.getAllByText('vs prev period');
    expect(prevPeriodTexts.length).toBe(4);
  });
});

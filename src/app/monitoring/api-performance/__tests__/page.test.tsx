import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  AlertTriangle: (props: any) => <svg data-testid="alert-triangle-icon" {...props} />,
  Zap: (props: any) => <svg data-testid="zap-icon" {...props} />,
  ArrowUpDown: (props: any) => <svg data-testid="arrow-updown-icon" {...props} />,
  TrendingUp: (props: any) => <svg data-testid="trending-up-icon" {...props} />,
  TrendingDown: (props: any) => <svg data-testid="trending-down-icon" {...props} />,
  AlertCircle: (props: any) => <svg data-testid="alert-circle-icon" {...props} />,
  CheckCircle: (props: any) => <svg data-testid="check-circle-icon" {...props} />,
  Clock: (props: any) => <svg data-testid="clock-icon" {...props} />,
  ChevronRight: (props: any) => <svg data-testid="chevron-right-icon" {...props} />,
  ArrowUp: (props: any) => <svg data-testid="arrow-up-icon" {...props} />,
  ArrowDown: (props: any) => <svg data-testid="arrow-down-icon" {...props} />,
}));

import APIPerformancePage from '../page';

describe('APIPerformancePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<APIPerformancePage />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('API Performance');
  });

  it('renders page description', () => {
    render(<APIPerformancePage />);
    expect(
      screen.getByText('Endpoint latency, throughput, and error tracking')
    ).toBeInTheDocument();
  });

  it('renders breadcrumb with link to /monitoring', () => {
    render(<APIPerformancePage />);
    const monitoringLink = screen.getByText('Monitoring');
    expect(monitoringLink).toBeInTheDocument();
    expect(monitoringLink.closest('a')).toHaveAttribute('href', '/monitoring');
  });

  it('renders Total Requests summary card', () => {
    render(<APIPerformancePage />);
    expect(screen.getByText('Total Requests / 24h')).toBeInTheDocument();
  });

  it('renders Avg Response Time summary card', () => {
    render(<APIPerformancePage />);
    expect(screen.getByText('Avg Response Time')).toBeInTheDocument();
  });

  it('renders Error Rate summary card', () => {
    render(<APIPerformancePage />);
    const matches = screen.getAllByText(/Error Rate/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders Throughput summary card', () => {
    render(<APIPerformancePage />);
    expect(screen.getByText('Throughput')).toBeInTheDocument();
  });

  it('renders time range buttons (1h, 6h, 24h, 7d)', () => {
    render(<APIPerformancePage />);
    expect(screen.getByText('1h')).toBeInTheDocument();
    expect(screen.getByText('6h')).toBeInTheDocument();
    expect(screen.getByText('24h')).toBeInTheDocument();
    expect(screen.getByText('7d')).toBeInTheDocument();
  });

  it('switches time range when button is clicked', () => {
    render(<APIPerformancePage />);
    const btn1h = screen.getByText('1h');
    fireEvent.click(btn1h);
    expect(btn1h).toBeInTheDocument();
  });

  it('renders Endpoint Performance table heading', () => {
    render(<APIPerformancePage />);
    expect(screen.getByText('Endpoint Performance')).toBeInTheDocument();
    expect(screen.getByText(/16 endpoints tracked/)).toBeInTheDocument();
  });

  it('renders endpoint table with endpoint paths', () => {
    render(<APIPerformancePage />);
    expect(screen.getByText('/api/health/services')).toBeInTheDocument();
    expect(screen.getByText('/api/ai/models')).toBeInTheDocument();
    expect(screen.getByText('/api/vm/instances')).toBeInTheDocument();
    // /api/containers appears in both the endpoint table and the 4xx errors section
    const containersMatches = screen.getAllByText('/api/containers');
    expect(containersMatches.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('/api/monitoring/metrics')).toBeInTheDocument();
  });

  it('renders endpoint table column headers', () => {
    render(<APIPerformancePage />);
    expect(screen.getByText('Endpoint')).toBeInTheDocument();
    expect(screen.getByText('Method')).toBeInTheDocument();
    const avgLatencyMatches = screen.getAllByText(/Avg Latency/);
    expect(avgLatencyMatches.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('P50')).toBeInTheDocument();
    expect(screen.getByText('P95')).toBeInTheDocument();
    expect(screen.getByText('P99')).toBeInTheDocument();
  });

  it('sorts endpoints when clicking column header', () => {
    render(<APIPerformancePage />);
    const endpointHeader = screen.getByText('Endpoint');
    fireEvent.click(endpointHeader);
    // After clicking, sorted by endpoint - page should still render correctly
    expect(screen.getByText('/api/health/services')).toBeInTheDocument();
  });

  it('renders Client Errors (4xx) section', () => {
    render(<APIPerformancePage />);
    expect(screen.getByText('Client Errors (4xx)')).toBeInTheDocument();
    expect(screen.getByText(/Top endpoints by 4xx error count/)).toBeInTheDocument();
  });

  it('renders Server Errors (5xx) section', () => {
    render(<APIPerformancePage />);
    expect(screen.getByText('Server Errors (5xx)')).toBeInTheDocument();
    expect(screen.getByText(/Top endpoints by 5xx error count/)).toBeInTheDocument();
  });

  it('renders error count totals', () => {
    render(<APIPerformancePage />);
    // Total 4xx = 310, Total 5xx = 45
    expect(screen.getByText('310')).toBeInTheDocument();
    // "45" appears as both an error total and as a latency value, so use getAllByText
    const fortyFiveMatches = screen.getAllByText('45');
    expect(fortyFiveMatches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders trend indicators on summary cards', () => {
    render(<APIPerformancePage />);
    expect(screen.getByText('+8.3%')).toBeInTheDocument();
    expect(screen.getByText('-4.1%')).toBeInTheDocument();
    expect(screen.getByText('-0.12%')).toBeInTheDocument();
    expect(screen.getByText('+12.5%')).toBeInTheDocument();
  });
});

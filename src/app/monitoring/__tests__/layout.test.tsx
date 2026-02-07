import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  usePathname: () => '/monitoring',
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href, onClick, ...rest }: any) => (
    <a href={href} onClick={onClick} {...rest}>{children}</a>
  );
});

// Mock ErrorBoundary to render children directly
jest.mock('@/components/error/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  LayoutDashboard: (props: any) => <svg data-testid="icon-dashboard" {...props} />,
  Network: (props: any) => <svg data-testid="icon-network" {...props} />,
  Database: (props: any) => <svg data-testid="icon-database" {...props} />,
  Cpu: (props: any) => <svg data-testid="icon-cpu" {...props} />,
  Layers: (props: any) => <svg data-testid="icon-layers" {...props} />,
  Zap: (props: any) => <svg data-testid="icon-zap" {...props} />,
  Activity: (props: any) => <svg data-testid="icon-activity" {...props} />,
  FileText: (props: any) => <svg data-testid="icon-filetext" {...props} />,
  AlertTriangle: (props: any) => <svg data-testid="icon-alert" {...props} />,
  BarChart: (props: any) => <svg data-testid="icon-barchart" {...props} />,
}));

import MonitoringLayout from '../layout';

describe('MonitoringLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(
      <MonitoringLayout>
        <div>Test Content</div>
      </MonitoringLayout>
    );
    expect(screen.getByText('Monitoring')).toBeInTheDocument();
  });

  it('renders Monitoring sidebar heading', () => {
    render(
      <MonitoringLayout>
        <div>Test Content</div>
      </MonitoringLayout>
    );
    const heading = screen.getByText('Monitoring');
    expect(heading).toBeInTheDocument();
    expect(heading.tagName).toBe('H2');
  });

  it('renders children in main content area', () => {
    render(
      <MonitoringLayout>
        <div data-testid="child-content">Main Content Area</div>
      </MonitoringLayout>
    );
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('Main Content Area')).toBeInTheDocument();
  });

  it('renders Dashboard nav item', () => {
    render(
      <MonitoringLayout><div /></MonitoringLayout>
    );
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders Connection Pool nav item', () => {
    render(
      <MonitoringLayout><div /></MonitoringLayout>
    );
    expect(screen.getByText('Connection Pool')).toBeInTheDocument();
  });

  it('renders Database nav item', () => {
    render(
      <MonitoringLayout><div /></MonitoringLayout>
    );
    expect(screen.getByText('Database')).toBeInTheDocument();
  });

  it('renders all 10 navigation items', () => {
    render(
      <MonitoringLayout><div /></MonitoringLayout>
    );
    const navItems = [
      'Dashboard',
      'Connection Pool',
      'Database',
      'Embeddings',
      'Vector Database',
      'API Performance',
      'Performance',
      'Logs',
      'Alerts',
      'Datadog',
    ];
    navItems.forEach((item) => {
      expect(screen.getByText(item)).toBeInTheDocument();
    });
  });

  it('has correct href for each nav item', () => {
    render(
      <MonitoringLayout><div /></MonitoringLayout>
    );
    const links = screen.getAllByRole('link');
    const hrefs = links.map((link) => link.getAttribute('href'));
    expect(hrefs).toContain('/monitoring');
    expect(hrefs).toContain('/monitoring/connection-pool');
    expect(hrefs).toContain('/monitoring/database');
    expect(hrefs).toContain('/monitoring/embeddings');
    expect(hrefs).toContain('/monitoring/vector-db');
    expect(hrefs).toContain('/monitoring/api-performance');
    expect(hrefs).toContain('/monitoring/performance');
    expect(hrefs).toContain('/monitoring/logs');
    expect(hrefs).toContain('/monitoring/alerts');
    expect(hrefs).toContain('/monitoring/datadog');
  });

  it('applies active style to Dashboard when pathname is /monitoring', () => {
    render(
      <MonitoringLayout><div /></MonitoringLayout>
    );
    const dashboardLink = screen.getByText('Dashboard').closest('a');
    expect(dashboardLink).toHaveClass('bg-blue-50');
    expect(dashboardLink).toHaveClass('text-blue-700');
  });
});

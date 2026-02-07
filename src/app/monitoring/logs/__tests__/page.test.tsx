import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  FileText: (props: any) => <svg data-testid="file-text-icon" {...props} />,
  Search: (props: any) => <svg data-testid="search-icon" {...props} />,
  Filter: (props: any) => <svg data-testid="filter-icon" {...props} />,
  Download: (props: any) => <svg data-testid="download-icon" {...props} />,
  RefreshCw: (props: any) => <svg data-testid="refresh-icon" {...props} />,
  ChevronDown: (props: any) => <svg data-testid="chevron-down-icon" {...props} />,
  ChevronRight: (props: any) => <svg data-testid="chevron-right-icon" {...props} />,
  AlertCircle: (props: any) => <svg data-testid="alert-circle-icon" {...props} />,
  AlertTriangle: (props: any) => <svg data-testid="alert-triangle-icon" {...props} />,
  Info: (props: any) => <svg data-testid="info-icon" {...props} />,
  Bug: (props: any) => <svg data-testid="bug-icon" {...props} />,
}));

import MonitoringLogsPage from '../page';

describe('MonitoringLogsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<MonitoringLogsPage />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Application Logs');
  });

  it('renders page description', () => {
    render(<MonitoringLogsPage />);
    expect(
      screen.getByText('Centralized log viewer for all application services')
    ).toBeInTheDocument();
  });

  it('renders breadcrumb with link to /monitoring', () => {
    render(<MonitoringLogsPage />);
    const monitoringLink = screen.getByText('Monitoring');
    expect(monitoringLink).toBeInTheDocument();
    expect(monitoringLink.closest('a')).toHaveAttribute('href', '/monitoring');
  });

  it('renders log level filter tabs (All, Error, Warning, Info, Debug)', () => {
    render(<MonitoringLogsPage />);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.getByText('Info')).toBeInTheDocument();
    expect(screen.getByText('Debug')).toBeInTheDocument();
  });

  it('renders source filter dropdown', () => {
    render(<MonitoringLogsPage />);
    expect(screen.getByText('All Sources')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<MonitoringLogsPage />);
    expect(screen.getByPlaceholderText('Search log messages...')).toBeInTheDocument();
  });

  it('renders log entries from mock data', () => {
    render(<MonitoringLogsPage />);
    expect(
      screen.getByText('Request to /api/ai/chat failed: ECONNREFUSED')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Instance vm-001 boot completed in 24.3s')
    ).toBeInTheDocument();
  });

  it('renders Load More button when there are more entries', () => {
    render(<MonitoringLogsPage />);
    // 35 total entries, page size 15, so Load More should be present
    const loadMoreBtn = screen.getByText(/Load More/);
    expect(loadMoreBtn).toBeInTheDocument();
    expect(screen.getByText(/20 remaining/)).toBeInTheDocument();
  });

  it('loads more entries when Load More is clicked', () => {
    render(<MonitoringLogsPage />);
    const loadMoreBtn = screen.getByText(/Load More/).closest('button')!;
    fireEvent.click(loadMoreBtn);
    // After loading more, should show 30 of 35 entries
    expect(screen.getByText(/Showing 30 of 35/)).toBeInTheDocument();
  });

  it('renders Export button', () => {
    render(<MonitoringLogsPage />);
    expect(screen.getByText('Export')).toBeInTheDocument();
  });

  it('filters logs when a level tab is clicked', () => {
    render(<MonitoringLogsPage />);
    fireEvent.click(screen.getByText('Error'));
    // Should show only error entries and results count should update
    expect(screen.getByText(/Showing/)).toBeInTheDocument();
    expect(
      screen.getByText('Request to /api/ai/chat failed: ECONNREFUSED')
    ).toBeInTheDocument();
  });

  it('filters logs by search query', () => {
    render(<MonitoringLogsPage />);
    const searchInput = screen.getByPlaceholderText('Search log messages...');
    fireEvent.change(searchInput, { target: { value: 'vm-001' } });
    expect(
      screen.getByText('Instance vm-001 boot completed in 24.3s')
    ).toBeInTheDocument();
  });

  it('shows results count and clear filters link', () => {
    render(<MonitoringLogsPage />);
    expect(screen.getByText(/Showing 15 of 35/)).toBeInTheDocument();
    // After applying a filter, clear filters link should appear
    fireEvent.click(screen.getByText('Error'));
    expect(screen.getByText('Clear filters')).toBeInTheDocument();
  });

  it('renders auto-refresh toggle button', () => {
    render(<MonitoringLogsPage />);
    const offBtn = screen.getByText('Off');
    expect(offBtn).toBeInTheDocument();
    fireEvent.click(offBtn.closest('button')!);
    expect(screen.getByText('On')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
  });
});

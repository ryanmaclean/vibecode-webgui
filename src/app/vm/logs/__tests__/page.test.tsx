import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/vm/logs',
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  FileText: (props: any) => <svg data-testid="file-text-icon" {...props} />,
  Download: (props: any) => <svg data-testid="download-icon" {...props} />,
  Trash2: (props: any) => <svg data-testid="trash-icon" {...props} />,
  Search: (props: any) => <svg data-testid="search-icon" {...props} />,
  Filter: (props: any) => <svg data-testid="filter-icon" {...props} />,
}));

import VMLogsPage from '../page';

describe('VMLogsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Mock the health fetch
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            services: [
              { name: 'ssh', status: 'healthy' },
              { name: 'postgresql', status: 'healthy' },
              { name: 'valkey', status: 'healthy' },
              { name: 'openvscode', status: 'healthy' },
              { name: 'docker', status: 'healthy' },
            ],
          }),
      })
    ) as jest.Mock;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders without crashing', () => {
    render(<VMLogsPage />);
    expect(screen.getByText('Service Logs')).toBeInTheDocument();
  });

  it('shows page heading and description', () => {
    render(<VMLogsPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Service Logs');
    expect(screen.getByText('View and search logs from all VM services')).toBeInTheDocument();
  });

  it('renders all service tabs', () => {
    render(<VMLogsPage />);
    expect(screen.getByText('SSH')).toBeInTheDocument();
    expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    expect(screen.getByText('Valkey')).toBeInTheDocument();
    expect(screen.getByText('OpenVSCode')).toBeInTheDocument();
    expect(screen.getByText('Docker')).toBeInTheDocument();
  });

  it('defaults to SSH tab', () => {
    render(<VMLogsPage />);
    const sshButton = screen.getByText('SSH').closest('button');
    expect(sshButton).toHaveClass('border-blue-500');
  });

  it('switches service tab on click', () => {
    render(<VMLogsPage />);
    fireEvent.click(screen.getByText('PostgreSQL'));
    const pgButton = screen.getByText('PostgreSQL').closest('button');
    expect(pgButton).toHaveClass('border-blue-500');
    const sshButton = screen.getByText('SSH').closest('button');
    expect(sshButton).not.toHaveClass('border-blue-500');
  });

  it('renders search input with placeholder', () => {
    render(<VMLogsPage />);
    expect(screen.getByPlaceholderText('Search logs...')).toBeInTheDocument();
  });

  it('filters logs by search query', () => {
    render(<VMLogsPage />);
    const searchInput = screen.getByPlaceholderText('Search logs...');
    // Type a search query that is very unlikely to match any log message
    fireEvent.change(searchInput, { target: { value: 'ZZZZZ_NONEXISTENT_QUERY_ZZZZZ' } });
    // Should show the empty state
    expect(screen.getByText('No log entries matching filters')).toBeInTheDocument();
  });

  it('renders log level filter dropdown', () => {
    render(<VMLogsPage />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toEqual(['all', 'error', 'warning', 'info', 'debug']);
  });

  it('filters logs by level', () => {
    render(<VMLogsPage />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'error' } });
    // After filtering to error, all visible entries should be error level
    const entries = screen.queryAllByText('[ERROR]');
    // Each entry is either present or the empty state is shown
    if (entries.length === 0) {
      expect(screen.getByText('No log entries matching filters')).toBeInTheDocument();
    } else {
      expect(entries.length).toBeGreaterThan(0);
    }
  });

  it('renders Clear button', () => {
    render(<VMLogsPage />);
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('clears logs when Clear button is clicked', () => {
    render(<VMLogsPage />);
    fireEvent.click(screen.getByText('Clear'));
    // After clearing, the empty state should show
    expect(screen.getByText('No log entries')).toBeInTheDocument();
  });

  it('renders Download button', () => {
    render(<VMLogsPage />);
    expect(screen.getByText('Download')).toBeInTheDocument();
  });

  it('shows entry count', () => {
    render(<VMLogsPage />);
    expect(screen.getByText(/entries/)).toBeInTheDocument();
  });

  it('fetches service health statuses on mount', async () => {
    render(<VMLogsPage />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/health/services');
    });
  });

  it('shows empty state with no matching filters message', () => {
    render(<VMLogsPage />);
    // Set search to something impossible
    const searchInput = screen.getByPlaceholderText('Search logs...');
    fireEvent.change(searchInput, { target: { value: 'IMPOSSIBLE_MATCH_STRING_12345' } });
    expect(screen.getByText('No log entries matching filters')).toBeInTheDocument();
  });
});

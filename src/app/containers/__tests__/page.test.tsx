import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/containers',
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Box: (props: any) => <svg data-testid="box-icon" {...props} />,
  Play: (props: any) => <svg data-testid="play-icon" {...props} />,
  Square: (props: any) => <svg data-testid="square-icon" {...props} />,
  RefreshCw: (props: any) => <svg data-testid="refresh-icon" {...props} />,
  Trash2: (props: any) => <svg data-testid="trash-icon" {...props} />,
  Terminal: (props: any) => <svg data-testid="terminal-icon" {...props} />,
  Search: (props: any) => <svg data-testid="search-icon" {...props} />,
  Filter: (props: any) => <svg data-testid="filter-icon" {...props} />,
  Plus: (props: any) => <svg data-testid="plus-icon" {...props} />,
  X: (props: any) => <svg data-testid="x-icon" {...props} />,
  AlertCircle: (props: any) => <svg data-testid="alert-circle-icon" {...props} />,
  Clock: (props: any) => <svg data-testid="clock-icon" {...props} />,
  Loader2: (props: any) => <svg data-testid="loader-icon" {...props} />,
  Server: (props: any) => <svg data-testid="server-icon" {...props} />,
}));

import ContainersPage from '../page';

const mockContainers = [
  {
    id: 'abc123def456',
    name: 'nginx-web',
    image: 'nginx:1.25',
    state: 'running',
    ipAddress: '172.17.0.2',
    ports: { 8080: 80 },
    created: new Date().toISOString(),
  },
  {
    id: 'def456ghi789',
    name: 'postgres-db',
    image: 'postgres:16',
    state: 'stopped',
    ipAddress: '172.17.0.3',
    created: new Date().toISOString(),
  },
  {
    id: 'ghi789jkl012',
    name: 'redis-cache',
    image: 'redis:7',
    state: 'exited',
    created: new Date().toISOString(),
  },
];

const mockDockerStatus = {
  dockerType: 'Docker',
  version: '24.0.7',
  running: true,
  socketPath: '/var/run/docker.sock',
  contextName: 'default',
};

function mockFetchSuccess(containers = mockContainers, dockerStatus = mockDockerStatus) {
  global.fetch = jest.fn((url: string) => {
    if (url === '/api/containers') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ containers }),
      });
    }
    if (url === '/api/docker/status') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: dockerStatus }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    });
  }) as jest.Mock;
}

describe('ContainersPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders without crashing', async () => {
    mockFetchSuccess();
    render(<ContainersPage />);
    await waitFor(() => {
      expect(screen.getByText('Containers')).toBeInTheDocument();
    });
  });

  it('displays Docker status section', async () => {
    mockFetchSuccess();
    render(<ContainersPage />);
    await waitFor(() => {
      expect(screen.getByText('Container Runtime')).toBeInTheDocument();
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });

  it('shows Docker version in status', async () => {
    mockFetchSuccess();
    render(<ContainersPage />);
    await waitFor(() => {
      expect(screen.getByText(/Docker v24\.0\.7/)).toBeInTheDocument();
    });
  });

  it('shows Disconnected when Docker is not running', async () => {
    mockFetchSuccess(mockContainers, { ...mockDockerStatus, running: false });
    render(<ContainersPage />);
    await waitFor(() => {
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });
  });

  it('renders container table with all containers', async () => {
    mockFetchSuccess();
    render(<ContainersPage />);
    await waitFor(() => {
      expect(screen.getByText('nginx-web')).toBeInTheDocument();
      expect(screen.getByText('postgres-db')).toBeInTheDocument();
      expect(screen.getByText('redis-cache')).toBeInTheDocument();
    });
  });

  it('renders container images in the table', async () => {
    mockFetchSuccess();
    render(<ContainersPage />);
    await waitFor(() => {
      expect(screen.getByText('nginx:1.25')).toBeInTheDocument();
      expect(screen.getByText('postgres:16')).toBeInTheDocument();
      expect(screen.getByText('redis:7')).toBeInTheDocument();
    });
  });

  it('shows table column headers', async () => {
    mockFetchSuccess();
    render(<ContainersPage />);
    await waitFor(() => {
      expect(screen.getByText('Container')).toBeInTheDocument();
      expect(screen.getByText('Image')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('IP Address')).toBeInTheDocument();
      expect(screen.getByText('Created')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });
  });

  it('renders filter tabs (All, Running, Stopped, Exited)', async () => {
    mockFetchSuccess();
    render(<ContainersPage />);
    await waitFor(() => {
      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByText('Running')).toBeInTheDocument();
      expect(screen.getByText('Stopped')).toBeInTheDocument();
      expect(screen.getByText('Exited')).toBeInTheDocument();
    });
  });

  it('filters containers when a status tab is clicked', async () => {
    mockFetchSuccess();
    render(<ContainersPage />);

    await waitFor(() => {
      expect(screen.getByText('nginx-web')).toBeInTheDocument();
    });

    // Click "Running" filter
    fireEvent.click(screen.getByText('Running'));

    // Only running container should be visible
    expect(screen.getByText('nginx-web')).toBeInTheDocument();
    expect(screen.queryByText('postgres-db')).not.toBeInTheDocument();
    expect(screen.queryByText('redis-cache')).not.toBeInTheDocument();
  });

  it('renders search input', async () => {
    mockFetchSuccess();
    render(<ContainersPage />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search by name, image, or ID...')).toBeInTheDocument();
    });
  });

  it('filters containers by search query', async () => {
    mockFetchSuccess();
    render(<ContainersPage />);

    await waitFor(() => {
      expect(screen.getByText('nginx-web')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search by name, image, or ID...');
    fireEvent.change(searchInput, { target: { value: 'nginx' } });

    expect(screen.getByText('nginx-web')).toBeInTheDocument();
    expect(screen.queryByText('postgres-db')).not.toBeInTheDocument();
    expect(screen.queryByText('redis-cache')).not.toBeInTheDocument();
  });

  it('renders Run Container button', async () => {
    mockFetchSuccess();
    render(<ContainersPage />);
    await waitFor(() => {
      expect(screen.getByText('Run Container')).toBeInTheDocument();
    });
  });

  it('renders Refresh button', async () => {
    mockFetchSuccess();
    render(<ContainersPage />);
    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });

  it('opens Run Container dialog when button is clicked', async () => {
    mockFetchSuccess();
    render(<ContainersPage />);

    await waitFor(() => {
      expect(screen.getByText('Run Container')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Run Container'));

    expect(screen.getByText('Image *')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. alpine:latest, nginx:1.25')).toBeInTheDocument();
    expect(screen.getByText('Port Mappings')).toBeInTheDocument();
    expect(screen.getByText('Environment Variables')).toBeInTheDocument();
  });

  it('shows container count footer', async () => {
    mockFetchSuccess();
    render(<ContainersPage />);
    await waitFor(() => {
      expect(screen.getByText(/3 of 3 containers/)).toBeInTheDocument();
    });
  });

  it('shows empty state when no containers exist', async () => {
    mockFetchSuccess([]);
    render(<ContainersPage />);
    await waitFor(() => {
      expect(screen.getByText('No containers')).toBeInTheDocument();
      expect(screen.getByText('Get started by running a new container.')).toBeInTheDocument();
    });
  });

  it('shows error banner when fetch fails', async () => {
    global.fetch = jest.fn((url: string) => {
      if (url === '/api/containers') {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockDockerStatus }),
      });
    }) as jest.Mock;

    render(<ContainersPage />);
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows page description', async () => {
    mockFetchSuccess();
    render(<ContainersPage />);
    await waitFor(() => {
      expect(screen.getByText('Manage container instances running in the VM')).toBeInTheDocument();
    });
  });
});

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/health',
}));

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  close = jest.fn();
}
(global as any).WebSocket = MockWebSocket;

import HealthPage from '../page';

const mockHealthData = {
  status: 'healthy',
  timestamp: new Date().toISOString(),
  totalCheckTimeMs: 42,
  summary: {
    healthy: 4,
    unhealthy: 1,
    unknown: 0,
  },
  services: [
    {
      name: 'ssh',
      status: 'healthy',
      latencyMs: 5,
      lastChecked: new Date().toISOString(),
      error: null,
    },
    {
      name: 'postgresql',
      status: 'healthy',
      latencyMs: 12,
      lastChecked: new Date().toISOString(),
      error: null,
    },
    {
      name: 'valkey',
      status: 'healthy',
      latencyMs: 3,
      lastChecked: new Date().toISOString(),
      error: null,
    },
    {
      name: 'openvscode',
      status: 'healthy',
      latencyMs: 25,
      lastChecked: new Date().toISOString(),
      error: null,
    },
    {
      name: 'docker',
      status: 'unhealthy',
      latencyMs: 0,
      lastChecked: new Date().toISOString(),
      error: 'Connection refused',
    },
  ],
};

describe('HealthPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders without crashing and shows loading state', () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock;
    render(<HealthPage />);
    expect(screen.getByText('Loading health status...')).toBeInTheDocument();
  });

  it('displays service health heading after data loads', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockHealthData),
      })
    ) as jest.Mock;

    render(<HealthPage />);

    await waitFor(() => {
      expect(screen.getByText('Service Health')).toBeInTheDocument();
    });
  });

  it('shows overall status summary', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockHealthData),
      })
    ) as jest.Mock;

    render(<HealthPage />);

    await waitFor(() => {
      expect(screen.getByText('Overall Status')).toBeInTheDocument();
      // "Healthy" appears multiple times (overall + per-service badges)
      const healthyTexts = screen.getAllByText('Healthy');
      expect(healthyTexts.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders service cards for all services', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockHealthData),
      })
    ) as jest.Mock;

    render(<HealthPage />);

    await waitFor(() => {
      expect(screen.getByTestId('service-card-ssh')).toBeInTheDocument();
      expect(screen.getByTestId('service-card-postgresql')).toBeInTheDocument();
      expect(screen.getByTestId('service-card-valkey')).toBeInTheDocument();
      expect(screen.getByTestId('service-card-openvscode')).toBeInTheDocument();
      expect(screen.getByTestId('service-card-docker')).toBeInTheDocument();
    });
  });

  it('shows service display names', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockHealthData),
      })
    ) as jest.Mock;

    render(<HealthPage />);

    await waitFor(() => {
      expect(screen.getByText('SSH (Dropbear)')).toBeInTheDocument();
      expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
      expect(screen.getByText('Valkey')).toBeInTheDocument();
      expect(screen.getByText('OpenVSCode')).toBeInTheDocument();
      expect(screen.getByText('Docker')).toBeInTheDocument();
    });
  });

  it('shows restart buttons for each service', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockHealthData),
      })
    ) as jest.Mock;

    render(<HealthPage />);

    await waitFor(() => {
      expect(screen.getByTestId('restart-btn-ssh')).toBeInTheDocument();
      expect(screen.getByTestId('restart-btn-postgresql')).toBeInTheDocument();
    });
  });

  it('shows error state when service errors exist', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockHealthData),
      })
    ) as jest.Mock;

    render(<HealthPage />);

    await waitFor(() => {
      expect(screen.getByText('Connection refused')).toBeInTheDocument();
    });
  });

  it('shows error banner when fetch fails', async () => {
    global.fetch = jest.fn(() =>
      Promise.reject(new Error('Network error'))
    ) as jest.Mock;

    render(<HealthPage />);

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });
  });

  it('shows health summary counts', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockHealthData),
      })
    ) as jest.Mock;

    render(<HealthPage />);

    await waitFor(() => {
      expect(screen.getByTestId('health-summary')).toBeInTheDocument();
      // Check that healthy/unhealthy counts are shown
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  it('shows page description', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockHealthData),
      })
    ) as jest.Mock;

    render(<HealthPage />);

    await waitFor(() => {
      expect(screen.getByText(/Real-time health monitoring/)).toBeInTheDocument();
    });
  });
});

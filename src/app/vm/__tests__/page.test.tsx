import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/vm',
}));

// Mock the MultiVMDashboard component to isolate page-level logic
jest.mock('@/components/vm', () => ({
  MultiVMDashboard: (props: any) => (
    <div data-testid="multi-vm-dashboard">
      {props.loading && <span data-testid="loading">Loading...</span>}
      {props.error && <span data-testid="error">{props.error}</span>}
      <span data-testid="vm-count">{props.vms?.length ?? 0}</span>
      <span data-testid="profile-count">{props.profiles?.length ?? 0}</span>
    </div>
  ),
}));

import VMDashboardPage from '../page';

describe('VMDashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing and shows loading state initially', () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock;
    render(<VMDashboardPage />);
    expect(screen.getByTestId('multi-vm-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('fetches VM instances and profiles on mount', async () => {
    const mockInstances = [
      { id: 'vm-1', name: 'Test VM', status: { status: 'running' } },
    ];
    global.fetch = jest.fn((url: string) => {
      if (url === '/api/vm/instances') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ instances: mockInstances }),
        });
      }
      if (url === '/api/vm/profiles') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ profiles: [{ id: 'dev', name: 'Dev' }] }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as jest.Mock;

    render(<VMDashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('vm-count')).toHaveTextContent('1');
    });
    expect(screen.getByTestId('profile-count')).toHaveTextContent('1');
  });

  it('displays error when fetch fails', async () => {
    global.fetch = jest.fn((url: string) => {
      if (url === '/api/vm/instances') {
        return Promise.resolve({
          ok: false,
          statusText: 'Internal Server Error',
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ profiles: [] }),
      });
    }) as jest.Mock;

    render(<VMDashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Failed to fetch VMs');
    });
  });

  it('falls back to default profiles when profiles fetch fails', async () => {
    global.fetch = jest.fn((url: string) => {
      if (url === '/api/vm/instances') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ instances: [] }),
        });
      }
      if (url === '/api/vm/profiles') {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as jest.Mock;

    render(<VMDashboardPage />);

    await waitFor(() => {
      // Falls back to 3 default profiles
      expect(screen.getByTestId('profile-count')).toHaveTextContent('3');
    });
  });

  it('passes callback handlers to dashboard', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ instances: [], profiles: [] }),
      })
    ) as jest.Mock;

    render(<VMDashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('multi-vm-dashboard')).toBeInTheDocument();
    });
  });
});

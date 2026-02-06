import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/vm/snapshots',
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  );
});

// Mock SnapshotManager component
jest.mock('@/components/vm', () => ({
  SnapshotManager: (props: any) => (
    <div data-testid="snapshot-manager">
      <span data-testid="snapshot-vm-id">{props.vmId}</span>
      <span data-testid="snapshot-vm-name">{props.vmName}</span>
    </div>
  ),
}));

import VMSnapshotsPage from '../page';

describe('VMSnapshotsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock;
    render(<VMSnapshotsPage />);
    expect(screen.getByText('VM Snapshots')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock;
    render(<VMSnapshotsPage />);
    // Loading skeleton is shown via animate-pulse div
    const pulseElements = document.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('shows breadcrumb navigation', () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock;
    render(<VMSnapshotsPage />);
    expect(screen.getByText('Virtual Machines')).toBeInTheDocument();
    expect(screen.getByText('Snapshots')).toBeInTheDocument();
  });

  it('shows empty state when no VMs exist', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ instances: [] }),
      })
    ) as jest.Mock;

    render(<VMSnapshotsPage />);

    await waitFor(() => {
      expect(screen.getByText('No Virtual Machines')).toBeInTheDocument();
    });
    expect(screen.getByText('Go to VM Dashboard')).toBeInTheDocument();
  });

  it('shows VM selector and snapshot manager when VMs exist', async () => {
    const mockVMs = [
      { id: 'vm-1', name: 'Dev VM', status: { status: 'running' } },
      { id: 'vm-2', name: 'Test VM', status: { status: 'stopped' } },
    ];
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ instances: mockVMs }),
      })
    ) as jest.Mock;

    render(<VMSnapshotsPage />);

    await waitFor(() => {
      expect(screen.getByText('Select VM')).toBeInTheDocument();
    });
    expect(screen.getByTestId('snapshot-manager')).toBeInTheDocument();
    expect(screen.getByTestId('snapshot-vm-id')).toHaveTextContent('vm-1');
  });

  it('shows page description', () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock;
    render(<VMSnapshotsPage />);
    expect(screen.getByText(/Save and restore VM state/)).toBeInTheDocument();
  });
});

/**
 * Tests for SnapshotManager component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// Mock lucide-react
jest.mock('lucide-react', () =>
  new Proxy({}, {
    get: (_, name) => {
      if (name === '__esModule') return false;
      return (props: any) => <svg data-testid={`icon-${String(name)}`} {...props} />;
    },
  })
);

// Mock UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className} data-testid="card">{children}</div>,
  CardContent: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children, className }: any) => <h3 className={className}>{children}</h3>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, ...props }: any) => <span data-variant={variant} {...props}>{children}</span>,
}));

jest.mock('@/components/ui/input', () => {
  const MockReact = require('react');
  return {
    Input: MockReact.forwardRef(({ ...props }: any, ref: any) => <input ref={ref} {...props} />),
  };
});

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor, ...props }: any) => <label htmlFor={htmlFor} {...props}>{children}</label>,
}));

jest.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, id, disabled }: any) => (
    <input type="checkbox" id={id} checked={checked} onChange={(e) => onCheckedChange?.(e.target.checked)} disabled={disabled} data-testid={`switch-${id}`} />
  ),
}));

jest.mock('@/components/ui/progress', () => ({
  Progress: ({ value }: any) => <div data-testid="progress" data-value={value} />,
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

import { SnapshotManager } from '@/components/vm/SnapshotManager';
import type { SnapshotInfo } from '@/types/vm-snapshot';

const mockSnapshots: SnapshotInfo[] = [
  {
    id: 'snap-1',
    vmId: 'vm-1',
    vmName: 'dev-vm',
    name: 'Before upgrade',
    description: 'Snapshot before system upgrade',
    state: 'ready',
    size: 1073741824, // 1 GB
    createdAt: new Date(Date.now() - 3600000), // 1 hour ago
    includesDisk: true,
    includesMemory: false,
    compressed: true,
    compressionAlgorithm: 'zstd',
    checksum: 'abc123def456789',
    metadata: {
      services: [{ name: 'postgres', port: 5432 }, { name: 'ssh', port: 22 }],
    },
  },
  {
    id: 'snap-2',
    vmId: 'vm-1',
    vmName: 'dev-vm',
    name: 'Initial setup',
    description: 'Fresh OS install',
    state: 'ready',
    size: 536870912, // 512 MB
    createdAt: new Date(Date.now() - 86400000), // 1 day ago
    includesDisk: true,
    includesMemory: true,
    compressed: false,
    metadata: {
      services: [],
    },
  },
];

// Mock fetch using jest.spyOn to properly intercept
let mockFetch: jest.SpyInstance;

function mockFetchWithSnapshots(snapshots: SnapshotInfo[] = mockSnapshots) {
  mockFetch = jest.spyOn(global, 'fetch').mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: { snapshots },
      }),
    } as Response)
  );
}

async function renderAndWaitForLoad(props: any = {}) {
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<SnapshotManager vmId="vm-1" {...props} />);
    // Flush all microtasks (fetch resolution + state updates)
    await new Promise((r) => setTimeout(r, 0));
  });
  return result!;
}

describe('SnapshotManager', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockFetchWithSnapshots();
  });

  afterEach(() => {
    mockFetch?.mockRestore();
  });

  it('renders loading state initially', () => {
    render(<SnapshotManager vmId="vm-1" />);
    expect(screen.getByTestId('icon-Loader2')).toBeInTheDocument();
  });

  it('renders snapshots after loading', async () => {
    await renderAndWaitForLoad({ vmName: 'dev-vm' });
    expect(screen.getByText('Before upgrade')).toBeInTheDocument();
    expect(screen.getByText('Initial setup')).toBeInTheDocument();
  });

  it('displays title and description', async () => {
    await renderAndWaitForLoad({ vmName: 'dev-vm' });
    expect(screen.getByText('Snapshots')).toBeInTheDocument();
    expect(screen.getByText(/Save and restore VM state for dev-vm/)).toBeInTheDocument();
  });

  it('displays snapshot count and total size', async () => {
    await renderAndWaitForLoad();
    expect(screen.getByText('2 snapshots')).toBeInTheDocument();
    expect(screen.getByText(/Total:/)).toBeInTheDocument();
  });

  it('shows New Snapshot button', async () => {
    await renderAndWaitForLoad();
    expect(screen.getByText('New Snapshot')).toBeInTheDocument();
  });

  it('shows Import Snapshot button', async () => {
    await renderAndWaitForLoad();
    expect(screen.getByText('Import Snapshot')).toBeInTheDocument();
  });

  it('expands snapshot details on click', async () => {
    await renderAndWaitForLoad();
    expect(screen.getByText('Before upgrade')).toBeInTheDocument();

    const snapshotRow = screen.getByText('Before upgrade').closest('[role="button"]');
    if (snapshotRow) {
      fireEvent.click(snapshotRow);
      expect(screen.getByText('Snapshot before system upgrade')).toBeInTheDocument();
      expect(screen.getByText(/Includes Disk:/)).toBeInTheDocument();
      expect(screen.getByText('postgres:5432')).toBeInTheDocument();
    }
  });

  it('filters snapshots by search', async () => {
    await renderAndWaitForLoad();

    const searchInput = screen.getByPlaceholderText('Search snapshots...');
    fireEvent.change(searchInput, { target: { value: 'upgrade' } });

    expect(screen.getByText('Before upgrade')).toBeInTheDocument();
    expect(screen.queryByText('Initial setup')).not.toBeInTheDocument();
  });

  it('shows no results message for search', async () => {
    await renderAndWaitForLoad();

    const searchInput = screen.getByPlaceholderText('Search snapshots...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    expect(screen.getByText("No snapshots match your search")).toBeInTheDocument();
  });

  it('opens create dialog', async () => {
    await renderAndWaitForLoad({ vmName: 'dev-vm' });

    fireEvent.click(screen.getByText('New Snapshot'));
    expect(screen.getAllByText('Create Snapshot').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Snapshot Name')).toBeInTheDocument();
  });

  it('opens restore dialog', async () => {
    await renderAndWaitForLoad();

    const restoreButtons = screen.getAllByTitle('Restore snapshot');
    fireEvent.click(restoreButtons[0]);

    expect(screen.getByText(/Restore "Before upgrade"/)).toBeInTheDocument();
    expect(screen.getByText('Restore')).toBeInTheDocument();
  });

  it('opens delete dialog', async () => {
    await renderAndWaitForLoad();

    const deleteButtons = screen.getAllByTitle('Delete snapshot');
    fireEvent.click(deleteButtons[0]);

    expect(screen.getByText(/Delete "Before upgrade"/)).toBeInTheDocument();
    expect(screen.getByText(/This action cannot be undone/)).toBeInTheDocument();
  });

  it('opens export dialog', async () => {
    await renderAndWaitForLoad();

    const exportButtons = screen.getAllByTitle('Export snapshot');
    fireEvent.click(exportButtons[0]);

    expect(screen.getByText(/Export "Before upgrade"/)).toBeInTheDocument();
    expect(screen.getByText('Download')).toBeInTheDocument();
  });

  it('handles fetch error', async () => {
    mockFetch.mockRestore();
    mockFetch = jest.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: false, error: 'VM not found' }),
      } as Response)
    );

    await renderAndWaitForLoad();
    expect(screen.getByText('VM not found')).toBeInTheDocument();
  });

  it('shows empty state when no snapshots', async () => {
    mockFetch.mockRestore();
    mockFetchWithSnapshots([]);

    await renderAndWaitForLoad();
    expect(screen.getByText('No snapshots yet')).toBeInTheDocument();
    expect(screen.getByText('Create your first snapshot to save VM state')).toBeInTheDocument();
  });

  it('displays snapshot state badges', async () => {
    await renderAndWaitForLoad();
    expect(screen.getAllByText('Ready')).toHaveLength(2);
  });

  it('calls onSnapshotDeleted callback on delete', async () => {
    const onDeleted = jest.fn();
    let fetchCallCount = 0;
    mockFetch.mockRestore();
    mockFetch = jest.spyOn(global, 'fetch').mockImplementation(() => {
      fetchCallCount++;
      if (fetchCallCount === 1) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { snapshots: mockSnapshots } }),
        } as Response);
      }
      if (fetchCallCount === 2) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { snapshots: [] } }),
      } as Response);
    });

    await renderAndWaitForLoad({ onSnapshotDeleted: onDeleted });
    expect(screen.getByText('Before upgrade')).toBeInTheDocument();

    // Open delete dialog
    const deleteButtons = screen.getAllByTitle('Delete snapshot');
    fireEvent.click(deleteButtons[0]);

    // Confirm delete
    const confirmBtn = screen.getByText('Delete');
    await act(async () => {
      fireEvent.click(confirmBtn);
      await new Promise((r) => setTimeout(r, 0));
    });

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledWith('snap-1');
    });
  });
});
